/**
 * Integration tests for concurrent sync protection
 * Tests behavior when multiple sync processes run simultaneously
 * @module tests/integration/concurrent-sync
 */
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { readJsonFile, runCLI, setupTestProject } from './test-helpers'

describe('Integration: Concurrent Sync', () => {
  let testDir
  let originalHome

  beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-int-concurrent-'))
    originalHome = process.env.HOME
  })

  afterAll(async () => {
    process.env.HOME = originalHome
    await fs.rm(testDir, { recursive : true, force : true })
  })

  describe('Concurrent sync processes', () => {
    it('should handle two concurrent sync operations without corruption', async () => {
      const projectDir = path.join(testDir, 'concurrent-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'concurrent-project' })

      // Run two sync operations simultaneously
      const [result1, result2] = await Promise.all([
        runCLI(['sync'], projectDir, { env : { HOME : projectDir } }),
        runCLI(['sync'], projectDir, { env : { HOME : projectDir } }),
      ])

      // At least one should succeed
      expect(result1.exitCode === 0 || result2.exitCode === 0).toBe(true)

      // Verify settings file is not corrupted
      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings).toBeDefined()
      expect(settings.plugins).toBeDefined()
      expect(Array.isArray(settings.plugins.enabled)).toBe(true)
      expect(Array.isArray(settings.plugins.disabled)).toBe(true)
      expect(typeof settings.plugins.marketplaces).toBe('object')

      // Verify plugins were enabled (no duplicates)
      const enabledSet = new Set(settings.plugins.enabled)
      expect(enabledSet.size).toBe(settings.plugins.enabled.length) // No duplicates
    })

    it('should handle multiple concurrent syncs from different projects', async () => {
      const sharedHome = path.join(testDir, 'shared-concurrent-home')
      await fs.mkdir(sharedHome, { recursive : true })

      const project1 = path.join(testDir, 'concurrent-proj-1')
      const project2 = path.join(testDir, 'concurrent-proj-2')
      const project3 = path.join(testDir, 'concurrent-proj-3')

      await fs.mkdir(project1, { recursive : true })
      await fs.mkdir(project2, { recursive : true })
      await fs.mkdir(project3, { recursive : true })

      await setupTestProject(project1, { projectName : 'concurrent-proj-1' })
      await setupTestProject(project2, { projectName : 'concurrent-proj-2' })
      await setupTestProject(project3, { projectName : 'concurrent-proj-3' })

      // Run sync from all three projects simultaneously
      const results = await Promise.all([
        runCLI(['sync'], project1, { env : { HOME : sharedHome } }),
        runCLI(['sync'], project2, { env : { HOME : sharedHome } }),
        runCLI(['sync'], project3, { env : { HOME : sharedHome } }),
      ])

      // At least one should succeed
      const successCount = results.filter((r) => r.exitCode === 0).length
      expect(successCount).toBeGreaterThan(0)

      // Verify settings are valid
      const settingsPath = path.join(sharedHome, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings).toBeDefined()
      expect(settings.plugins).toBeDefined()

      // Check for no duplicates
      const enabledSet = new Set(settings.plugins.enabled)
      expect(enabledSet.size).toBe(settings.plugins.enabled.length)
    })

    it('should handle rapid successive syncs', async () => {
      const projectDir = path.join(testDir, 'rapid-sync')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'rapid-sync' })

      // Run 5 syncs in rapid succession
      const syncPromises = []
      for (let i = 0; i < 5; i++) {
        syncPromises.push(runCLI(['sync'], projectDir, { env : { HOME : projectDir } }))
      }

      const results = await Promise.all(syncPromises)

      // Count successes
      const successCount = results.filter((r) => r.exitCode === 0).length
      expect(successCount).toBeGreaterThan(0)

      // Verify final state is valid
      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings).toBeDefined()
      expect(settings.plugins.enabled.length).toBeGreaterThan(0)

      // No duplicates
      const enabledSet = new Set(settings.plugins.enabled)
      expect(enabledSet.size).toBe(settings.plugins.enabled.length)
    })
  })

  describe('File locking behavior', () => {
    it('should not corrupt settings during concurrent writes', async () => {
      const projectDir = path.join(testDir, 'file-lock-test')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'file-lock-test' })

      // Run 10 concurrent syncs to stress test file locking
      const syncPromises = Array.from({ length : 10 }, () => runCLI(['sync'], projectDir, { env : { HOME : projectDir } }))

      await Promise.all(syncPromises)

      // Verify settings file is valid JSON
      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settingsContent = await fs.readFile(settingsPath, 'utf8')

      // Should be parseable (not corrupted)
      let settings
      expect(() => {
        settings = JSON.parse(settingsContent)
      }).not.toThrow()

      // Should have valid structure
      expect(settings.plugins).toBeDefined()
      expect(Array.isArray(settings.plugins.enabled)).toBe(true)
    })

    it('should handle concurrent view operations during sync', async () => {
      const projectDir = path.join(testDir, 'view-during-sync')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'view-during-sync' })

      // Run sync and view concurrently
      const [syncResult, viewResult] = await Promise.all([
        runCLI(['sync'], projectDir, { env : { HOME : projectDir } }),
        runCLI(['view'], projectDir, { env : { HOME : projectDir } }),
      ])

      // Both should complete (though one might fail if settings don't exist yet)
      expect(syncResult.exitCode === 0 || viewResult.exitCode === 0).toBe(true)

      // Verify settings are valid after both operations
      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings).toBeDefined()
    })
  })

  describe('Backup file handling during concurrent operations', () => {
    it('should handle backup file creation during concurrent syncs', async () => {
      const projectDir = path.join(testDir, 'backup-concurrent')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'backup-concurrent' })

      // Initial sync
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Run multiple syncs concurrently
      await Promise.all([
        runCLI(['sync'], projectDir, { env : { HOME : projectDir } }),
        runCLI(['sync'], projectDir, { env : { HOME : projectDir } }),
        runCLI(['sync'], projectDir, { env : { HOME : projectDir } }),
      ])

      // Verify no corruption
      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings).toBeDefined()
      expect(settings.plugins).toBeDefined()
    })
  })

  describe('Resource exhaustion scenarios', () => {
    it('should handle many concurrent syncs without resource exhaustion', async () => {
      const projectDir = path.join(testDir, 'resource-test')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'resource-test' })

      // Run 20 concurrent syncs
      const syncPromises = Array.from({ length : 20 }, () => runCLI(['sync'], projectDir, { env : { HOME : projectDir } }))

      const results = await Promise.all(syncPromises)

      // Most should succeed (some might fail due to contention, that's OK)
      const successCount = results.filter((r) => r.exitCode === 0).length
      expect(successCount).toBeGreaterThan(10) // At least half should succeed

      // Final state should be valid
      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings).toBeDefined()
      expect(settings.plugins).toBeDefined()

      // Verify structure integrity
      const enabledSet = new Set(settings.plugins.enabled)
      expect(enabledSet.size).toBe(settings.plugins.enabled.length) // No duplicates
    })
  })

  describe('Interleaved read/write operations', () => {
    it('should handle interleaved sync and view operations', async () => {
      const projectDir = path.join(testDir, 'interleaved')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'interleaved' })

      // Interleave sync and view operations
      const operations = []
      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          operations.push(runCLI(['sync'], projectDir, { env : { HOME : projectDir } }))
        }
        else {
          operations.push(runCLI(['view'], projectDir, { env : { HOME : projectDir } }))
        }
      }

      const results = await Promise.all(operations)

      // Most operations should succeed
      const successCount = results.filter((r) => r.exitCode === 0).length
      expect(successCount).toBeGreaterThan(5)

      // Final state should be valid
      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings).toBeDefined()
    })

    it('should maintain data consistency across concurrent operations', async () => {
      const projectDir = path.join(testDir, 'consistency-test')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'consistency-test' })

      // Run many concurrent syncs
      await Promise.all(Array.from({ length : 15 }, () => runCLI(['sync'], projectDir, { env : { HOME : projectDir } })))

      // Read settings multiple times and verify consistency
      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings1 = await readJsonFile(settingsPath)
      const settings2 = await readJsonFile(settingsPath)
      const settings3 = await readJsonFile(settingsPath)

      // All reads should return the same data
      expect(JSON.stringify(settings1)).toBe(JSON.stringify(settings2))
      expect(JSON.stringify(settings2)).toBe(JSON.stringify(settings3))

      // Verify no duplicate entries
      const enabledSet = new Set(settings1.plugins.enabled)
      expect(enabledSet.size).toBe(settings1.plugins.enabled.length)
    })
  })
})
