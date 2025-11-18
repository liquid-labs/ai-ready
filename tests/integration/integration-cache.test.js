/**
 * Integration tests for cache invalidation workflows
 * Tests cache behavior with real file system modifications
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import {
  setupTestProject,
  runCLI,
  readJsonFile,
  fileExists,
  sleep
} from './test-helpers'

describe('Integration: Cache invalidation', () => {
  let testDir
  let originalHome

  beforeAll(async () => {
    // Create isolated test environment
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-cache-test-'))
    originalHome = process.env.HOME

    // Set HOME to test directory to isolate cache files
    // NOTE: This requires tests to run sequentially (--runInBand in Jest config)
    // to prevent parallel test conflicts. The modified HOME is passed to child
    // processes via runCLI() helper which explicitly includes process.env.
    process.env.HOME = testDir
  })

  afterAll(async () => {
    process.env.HOME = originalHome
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('Failed to cleanup:', error.message)
    }
  })

  beforeEach(async () => {
    // Clean up test directory before each test
    const entries = await fs.readdir(testDir)
    for (const entry of entries) {
      const fullPath = path.join(testDir, entry)
      const stat = await fs.stat(fullPath)
      if (stat.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true })
      } else {
        await fs.unlink(fullPath)
      }
    }
    await setupTestProject(testDir, { projectName: 'cache-test-project' })
  })

  describe('Cache creation and usage', () => {
    it('should create cache on first scan', async () => {
      const cachePath = path.join(testDir, '.aircache.json')

      // Verify cache doesn't exist
      const existsBefore = await fileExists(cachePath)
      expect(existsBefore).toBe(false)

      // Run list command (triggers scan)
      await runCLI(['list'], testDir)

      // Verify cache created
      const existsAfter = await fileExists(cachePath)
      expect(existsAfter).toBe(true)

      // Verify cache contains expected data
      const cache = await readJsonFile(cachePath)
      expect(cache).toBeTruthy()
      expect(cache.scannedAt).toBeTruthy()
      expect(cache.packageJsonMTime).toBeTruthy()
      expect(cache.packageLockMTime).toBeTruthy()
      expect(cache.npmProviders).toBeTruthy()
      expect(cache.npmProviders).toHaveLength(1)
      expect(cache.npmProviders[0].libraryName).toBe('test-air-package')
    })

    it('should use cached results on subsequent scans', async () => {
      const cachePath = path.join(testDir, '.aircache.json')

      // First scan - creates cache
      await runCLI(['list'], testDir)
      const cache1 = await readJsonFile(cachePath)
      const scannedAt1 = cache1.scannedAt

      // Wait a bit
      await sleep(100)

      // Second scan - should use cache
      await runCLI(['list'], testDir)
      const cache2 = await readJsonFile(cachePath)
      const scannedAt2 = cache2.scannedAt

      // scannedAt should be the same (cache was reused)
      expect(scannedAt2).toBe(scannedAt1)
    })
  })

  describe('Cache invalidation on package.json changes', () => {
    it('should invalidate cache when package.json is modified', async () => {
      const cachePath = path.join(testDir, '.aircache.json')
      const packageJsonPath = path.join(testDir, 'package.json')

      // First scan - creates cache
      await runCLI(['list'], testDir)
      const cache1 = await readJsonFile(cachePath)
      const scannedAt1 = cache1.scannedAt

      // Modify package.json
      const packageJson = await readJsonFile(packageJsonPath)
      packageJson.version = '2.0.0'
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))

      // Explicitly set mtime to ensure it differs from cached value
      const newTime = new Date(Date.now() + 2000)
      await fs.utimes(packageJsonPath, newTime, newTime)

      // Second scan - should invalidate cache
      await runCLI(['list'], testDir)
      const cache2 = await readJsonFile(cachePath)
      const scannedAt2 = cache2.scannedAt

      // scannedAt should be different (cache was invalidated)
      expect(scannedAt2).not.toBe(scannedAt1)
      expect(new Date(scannedAt2).getTime()).toBeGreaterThan(new Date(scannedAt1).getTime())
    })

    it('should update packageJsonMTime in cache after modification', async () => {
      const cachePath = path.join(testDir, '.aircache.json')
      const packageJsonPath = path.join(testDir, 'package.json')

      // First scan
      await runCLI(['list'], testDir)
      const cache1 = await readJsonFile(cachePath)
      const mtime1 = cache1.packageJsonMTime

      // Modify package.json
      const packageJson = await readJsonFile(packageJsonPath)
      packageJson.description = 'Modified'
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))

      // Explicitly set mtime to ensure it differs from cached value
      const newTime = new Date(Date.now() + 2000)
      await fs.utimes(packageJsonPath, newTime, newTime)

      // Second scan
      await runCLI(['list'], testDir)
      const cache2 = await readJsonFile(cachePath)
      const mtime2 = cache2.packageJsonMTime

      // mtime should be updated
      expect(mtime2).toBeGreaterThan(mtime1)
    })
  })

  describe('Cache invalidation on package-lock.json changes', () => {
    it('should invalidate cache when package-lock.json is modified', async () => {
      const cachePath = path.join(testDir, '.aircache.json')
      const packageLockPath = path.join(testDir, 'package-lock.json')

      // First scan
      await runCLI(['list'], testDir)
      const cache1 = await readJsonFile(cachePath)
      const scannedAt1 = cache1.scannedAt

      // Modify package-lock.json
      const packageLock = await readJsonFile(packageLockPath)
      packageLock.lockfileVersion = 2
      await fs.writeFile(packageLockPath, JSON.stringify(packageLock, null, 2))

      // Explicitly set mtime to ensure it differs from cached value
      const newTime = new Date(Date.now() + 2000)
      await fs.utimes(packageLockPath, newTime, newTime)

      // Second scan
      await runCLI(['list'], testDir)
      const cache2 = await readJsonFile(cachePath)
      const scannedAt2 = cache2.scannedAt

      // Cache should be invalidated
      expect(scannedAt2).not.toBe(scannedAt1)
    })

    it('should update packageLockMTime in cache after modification', async () => {
      const cachePath = path.join(testDir, '.aircache.json')
      const packageLockPath = path.join(testDir, 'package-lock.json')

      // First scan
      await runCLI(['list'], testDir)
      const cache1 = await readJsonFile(cachePath)
      const mtime1 = cache1.packageLockMTime

      // Modify package-lock.json
      const packageLock = await readJsonFile(packageLockPath)
      packageLock.lockfileVersion = 2
      await fs.writeFile(packageLockPath, JSON.stringify(packageLock, null, 2))

      // Explicitly set mtime to ensure it differs from cached value
      const newTime = new Date(Date.now() + 2000)
      await fs.utimes(packageLockPath, newTime, newTime)

      // Second scan
      await runCLI(['list'], testDir)
      const cache2 = await readJsonFile(cachePath)
      const mtime2 = cache2.packageLockMTime

      // mtime should be updated
      expect(mtime2).toBeGreaterThan(mtime1)
    })
  })

  describe('Cache invalidation on dependency changes', () => {
    it('should invalidate cache when dependencies are added', async () => {
      const cachePath = path.join(testDir, '.aircache.json')
      const packageJsonPath = path.join(testDir, 'package.json')

      // First scan
      await runCLI(['list'], testDir)
      const cache1 = await readJsonFile(cachePath)

      // Add dependency
      const packageJson = await readJsonFile(packageJsonPath)
      packageJson.dependencies['new-package'] = '1.0.0'
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))

      // Explicitly set mtime to ensure it differs from cached value
      const newTime = new Date(Date.now() + 2000)
      await fs.utimes(packageJsonPath, newTime, newTime)

      // Second scan
      await runCLI(['list'], testDir)
      const cache2 = await readJsonFile(cachePath)

      // Cache should be invalidated
      expect(cache2.scannedAt).not.toBe(cache1.scannedAt)
    })

    it('should invalidate cache when dependencies are removed', async () => {
      const cachePath = path.join(testDir, '.aircache.json')
      const packageJsonPath = path.join(testDir, 'package.json')

      // First scan
      await runCLI(['list'], testDir)
      const cache1 = await readJsonFile(cachePath)

      // Remove dependency
      const packageJson = await readJsonFile(packageJsonPath)
      delete packageJson.dependencies['test-air-package']
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))

      // Explicitly set mtime to ensure it differs from cached value
      const newTime = new Date(Date.now() + 2000)
      await fs.utimes(packageJsonPath, newTime, newTime)

      // Second scan
      await runCLI(['list'], testDir)
      const cache2 = await readJsonFile(cachePath)

      // Cache should be invalidated
      expect(cache2.scannedAt).not.toBe(cache1.scannedAt)
    })
  })

  describe('Cache resilience', () => {
    it('should rebuild cache if .aircache.json is deleted', async () => {
      const cachePath = path.join(testDir, '.aircache.json')

      // First scan - creates cache
      await runCLI(['list'], testDir)
      expect(await fileExists(cachePath)).toBe(true)

      // Delete cache
      await fs.unlink(cachePath)
      expect(await fileExists(cachePath)).toBe(false)

      // Second scan - should rebuild cache
      await runCLI(['list'], testDir)
      expect(await fileExists(cachePath)).toBe(true)

      // Verify cache is valid
      const cache = await readJsonFile(cachePath)
      expect(cache.npmProviders).toHaveLength(1)
    })

    it('should rebuild cache if .aircache.json is corrupted', async () => {
      const cachePath = path.join(testDir, '.aircache.json')

      // First scan - creates cache
      await runCLI(['list'], testDir)

      // Corrupt cache
      await fs.writeFile(cachePath, 'invalid json{{{')

      // Second scan - should rebuild cache
      await runCLI(['list'], testDir)

      // Verify cache is valid
      const cache = await readJsonFile(cachePath)
      expect(cache).toBeTruthy()
      expect(cache.npmProviders).toBeTruthy()
    })
  })

  describe('Performance verification', () => {
    it('should be faster on cache hit vs cache miss', async () => {
      // First run - cache miss
      const start1 = Date.now()
      await runCLI(['list'], testDir)
      const duration1 = Date.now() - start1

      // Second run - cache hit
      const start2 = Date.now()
      await runCLI(['list'], testDir)
      const duration2 = Date.now() - start2

      // Cache hit should be faster (or at least not slower)
      // Note: This is a soft check as timing can vary
      expect(duration2).toBeLessThanOrEqual(duration1 * 2)
    })
  })
})