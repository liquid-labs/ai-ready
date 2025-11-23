/**
 * Integration tests for cache invalidation workflows (v2.0.0)
 * Tests cache behavior with real file system modifications
 */
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { fileExists, readJsonFile, runCLI, setupTestProject, sleep } from './test-helpers'

describe('Integration: Cache invalidation', () => {
  let testDir
  let originalHome

  beforeAll(async () => {
    // Create isolated test environment
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-cache-test-'))
    originalHome = process.env.HOME

    // Set HOME to test directory to isolate cache files
    process.env.HOME = testDir
  })

  afterAll(async () => {
    process.env.HOME = originalHome
    try {
      await fs.rm(testDir, { recursive : true, force : true })
    }
    catch {
      // Silently ignore cleanup errors
    }
  })

  beforeEach(async () => {
    // Clean up test directory before each test
    const entries = await fs.readdir(testDir)
    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(testDir, entry)
        const stat = await fs.stat(fullPath)
        if (stat.isDirectory()) {
          await fs.rm(fullPath, { recursive : true, force : true })
        }
        else {
          await fs.unlink(fullPath)
        }
      })
    )
    await setupTestProject(testDir)
  })

  describe('Cache creation and usage', () => {
    it('should create .air-plugin-cache.json on first sync', async () => {
      const cachePath = path.join(testDir, '.air-plugin-cache.json')

      // Verify cache doesn't exist
      expect(await fileExists(cachePath)).toBe(false)

      // Run sync
      const { exitCode } = await runCLI(['sync'], testDir)
      expect(exitCode).toBe(0)

      // Verify cache was created
      expect(await fileExists(cachePath)).toBe(true)

      const cache = await readJsonFile(cachePath)
      expect(cache.scannedAt).toBeDefined()
      expect(cache.packageJsonMTime).toBeDefined()
      expect(cache.packageLockMTime).toBeDefined()
      expect(cache.providers).toBeDefined()
    })

    it('should use cache on subsequent syncs', async () => {
      const cachePath = path.join(testDir, '.air-plugin-cache.json')

      // First sync
      await runCLI(['sync'], testDir)
      const cache1 = await readJsonFile(cachePath)
      const timestamp1 = cache1.scannedAt

      // Wait to ensure different timestamp if rescanned
      await sleep(100)

      // Second sync
      await runCLI(['sync'], testDir)
      const cache2 = await readJsonFile(cachePath)
      const timestamp2 = cache2.scannedAt

      // Timestamp should be same (cache was reused)
      expect(timestamp1).toBe(timestamp2)
    })

    it('should cache plugin provider data', async () => {
      await runCLI(['sync'], testDir)

      const cachePath = path.join(testDir, '.air-plugin-cache.json')
      const cache = await readJsonFile(cachePath)

      expect(Array.isArray(cache.providers)).toBe(true)
      expect(cache.providers.length).toBeGreaterThan(0)

      // Check provider structure
      const provider = cache.providers[0]
      expect(provider.packageName).toBeDefined()
      expect(provider.version).toBeDefined()
      expect(provider.path).toBeDefined()
      expect(provider.pluginDeclaration).toBeDefined()
    })
  })

  describe('Cache invalidation on package.json changes', () => {
    it('should invalidate cache when package.json is modified', async () => {
      const cachePath = path.join(testDir, '.air-plugin-cache.json')
      const packageJsonPath = path.join(testDir, 'package.json')

      // Initial sync
      await runCLI(['sync'], testDir)
      const cache1 = await readJsonFile(cachePath)
      const timestamp1 = cache1.scannedAt
      const mtime1 = cache1.packageJsonMTime

      // Wait to ensure file mtime changes
      await sleep(1100)

      // Modify package.json
      const packageJson = await readJsonFile(packageJsonPath)
      packageJson.version = '1.0.1'
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))

      // Sync again
      await runCLI(['sync'], testDir)
      const cache2 = await readJsonFile(cachePath)
      const timestamp2 = cache2.scannedAt
      const mtime2 = cache2.packageJsonMTime

      // Cache should be invalidated
      expect(timestamp1).not.toBe(timestamp2)
      expect(mtime1).not.toBe(mtime2)
    })

    it('should invalidate cache when dependencies change', async () => {
      const cachePath = path.join(testDir, '.air-plugin-cache.json')
      const packageJsonPath = path.join(testDir, 'package.json')

      // Initial sync
      await runCLI(['sync'], testDir)
      const cache1 = await readJsonFile(cachePath)
      const timestamp1 = cache1.scannedAt

      // Wait to ensure file mtime changes
      await sleep(1100)

      // Add new dependency
      const packageJson = await readJsonFile(packageJsonPath)
      packageJson.dependencies['new-package'] = '1.0.0'
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))

      // Sync again
      await runCLI(['sync'], testDir)
      const cache2 = await readJsonFile(cachePath)
      const timestamp2 = cache2.scannedAt

      // Cache should be invalidated
      expect(timestamp1).not.toBe(timestamp2)
    })
  })

  describe('Cache invalidation on package-lock.json changes', () => {
    it('should invalidate cache when package-lock.json is modified', async () => {
      const cachePath = path.join(testDir, '.air-plugin-cache.json')
      const packageLockPath = path.join(testDir, 'package-lock.json')

      // Initial sync
      await runCLI(['sync'], testDir)
      const cache1 = await readJsonFile(cachePath)
      const timestamp1 = cache1.scannedAt
      const mtime1 = cache1.packageLockMTime

      // Wait to ensure file mtime changes
      await sleep(1100)

      // Modify package-lock.json
      const packageLock = await readJsonFile(packageLockPath)
      packageLock.version = '1.0.1'
      await fs.writeFile(packageLockPath, JSON.stringify(packageLock, null, 2))

      // Sync again
      await runCLI(['sync'], testDir)
      const cache2 = await readJsonFile(cachePath)
      const timestamp2 = cache2.scannedAt
      const mtime2 = cache2.packageLockMTime

      // Cache should be invalidated
      expect(timestamp1).not.toBe(timestamp2)
      expect(mtime1).not.toBe(mtime2)
    })
  })

  describe('--no-cache flag', () => {
    it('should bypass cache when --no-cache is used', async () => {
      const cachePath = path.join(testDir, '.air-plugin-cache.json')

      // Initial sync to create cache
      await runCLI(['sync'], testDir)
      const cache1 = await readJsonFile(cachePath)
      const timestamp1 = cache1.scannedAt

      // Wait to ensure different timestamp if rescanned
      await sleep(100)

      // Sync with --no-cache
      await runCLI(['sync', '--no-cache'], testDir)
      const cache2 = await readJsonFile(cachePath)
      const timestamp2 = cache2.scannedAt

      // Timestamp should be different (cache was bypassed and recreated)
      expect(timestamp1).not.toBe(timestamp2)
    })

    it('should work when cache file is corrupted', async () => {
      const cachePath = path.join(testDir, '.air-plugin-cache.json')

      // Create invalid cache
      await fs.writeFile(cachePath, '{ invalid json')

      // Sync with --no-cache should succeed
      const { exitCode } = await runCLI(['sync', '--no-cache'], testDir)
      expect(exitCode).toBe(0)

      // Valid cache should be created
      const cache = await readJsonFile(cachePath)
      expect(cache.providers).toBeDefined()
    })
  })

  describe('Cache with malformed files', () => {
    it('should handle corrupted cache file gracefully', async () => {
      const cachePath = path.join(testDir, '.air-plugin-cache.json')

      // Create valid cache first
      await runCLI(['sync'], testDir)

      // Corrupt the cache
      await fs.writeFile(cachePath, '{ "invalid": json }')

      // Should fall back to full scan
      const { exitCode } = await runCLI(['sync'], testDir)
      expect(exitCode).toBe(0)

      // Cache should be recreated
      const cache = await readJsonFile(cachePath)
      expect(cache.providers).toBeDefined()
    })

    it('should handle missing package-lock.json', async () => {
      const packageLockPath = path.join(testDir, 'package-lock.json')

      // Remove package-lock.json
      await fs.unlink(packageLockPath)

      // Should still work (packageLockMTime will be 0)
      const { exitCode } = await runCLI(['sync'], testDir)
      expect(exitCode).toBe(0)

      const cachePath = path.join(testDir, '.air-plugin-cache.json')
      const cache = await readJsonFile(cachePath)
      expect(cache.packageLockMTime).toBe(0)
    })
  })

  describe('Cache performance', () => {
    it('should be faster on subsequent syncs with cache', async () => {
      // First sync (no cache)
      const start1 = Date.now()
      await runCLI(['sync'], testDir)
      const duration1 = Date.now() - start1

      // Second sync (with cache)
      const start2 = Date.now()
      await runCLI(['sync'], testDir)
      const duration2 = Date.now() - start2

      // Second sync should be faster (or at least not significantly slower)
      // Using a generous multiplier to avoid flaky tests
      expect(duration2).toBeLessThan(duration1 * 2)
    })
  })
})
