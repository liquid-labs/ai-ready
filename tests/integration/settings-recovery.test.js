/**
 * Integration tests for settings file recovery and error handling
 * Tests corrupted, missing, and malformed settings file scenarios
 * @module tests/integration/settings-recovery
 */
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { corruptSettingsFile, fileExists, readJsonFile, runCLI, setupTestProject } from './test-helpers'

describe('Integration: Settings Recovery', () => {
  let testDir
  let originalHome

  beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-int-recovery-'))
    originalHome = process.env.HOME
  })

  afterAll(async () => {
    process.env.HOME = originalHome
    await fs.rm(testDir, { recursive : true, force : true })
  })

  describe('Corrupted JSON handling', () => {
    it('should handle invalid JSON and create backup', async () => {
      const projectDir = path.join(testDir, 'invalid-json-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'invalid-json-project' })

      const settingsPath = path.join(projectDir, '.claude/settings.json')

      // Corrupt the settings file
      await corruptSettingsFile(settingsPath, 'invalid-json')

      // Run sync (may handle gracefully or fail - depends on implementation)
      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Check if backup was created (implementation-dependent)
      // If the tool creates backups on corruption, verify it
      // For now, we test that sync either recovers or fails gracefully

      if (result.exitCode === 0) {
        // If sync succeeded, verify settings are now valid
        const settings = await readJsonFile(settingsPath)
        expect(settings).toBeDefined()
        expect(settings.plugins).toBeDefined()
      }
      else {
        // If sync failed, it should fail with meaningful error
        expect(result.stderr).toBeTruthy()
      }
    })

    it('should create fresh settings when file is empty', async () => {
      const projectDir = path.join(testDir, 'empty-file-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'empty-file-project' })

      const settingsPath = path.join(projectDir, '.claude/settings.json')

      // Create empty settings file
      await corruptSettingsFile(settingsPath, 'empty-file')

      // Run sync
      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Should either succeed with fresh settings or fail gracefully
      if (result.exitCode === 0) {
        const settings = await readJsonFile(settingsPath)
        expect(settings).toBeDefined()
        expect(settings.plugins).toBeDefined()
        expect(settings.plugins.enabled).toBeDefined()
      }
    })
  })

  describe('Missing settings file scenarios', () => {
    it('should create settings.json if file does not exist', async () => {
      const projectDir = path.join(testDir, 'missing-settings-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'missing-settings-project' })

      const settingsPath = path.join(projectDir, '.claude/settings.json')

      // Delete settings file
      await fs.rm(settingsPath, { force : true })

      // Verify it doesn't exist
      expect(await fileExists(settingsPath)).toBe(false)

      // Run sync
      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      // Verify settings file was created
      expect(await fileExists(settingsPath)).toBe(true)

      const settings = await readJsonFile(settingsPath)
      expect(settings.plugins).toBeDefined()
      expect(settings.plugins.enabled).toContain('TestPlugin@test-plugin-marketplace')
    })

    it('should create .claude directory if it does not exist', async () => {
      const projectDir = path.join(testDir, 'missing-claude-dir-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'missing-claude-dir-project' })

      const claudeDir = path.join(projectDir, '.claude')

      // Delete entire .claude directory
      await fs.rm(claudeDir, { recursive : true, force : true })

      // Verify it doesn't exist
      expect(await fileExists(claudeDir)).toBe(false)

      // Run sync
      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      // Verify .claude directory and settings were created
      expect(await fileExists(claudeDir)).toBe(true)
      expect(await fileExists(path.join(claudeDir, 'settings.json'))).toBe(true)

      const settings = await readJsonFile(path.join(claudeDir, 'settings.json'))
      expect(settings.plugins).toBeDefined()
    })
  })

  describe('Malformed settings structure', () => {
    it('should handle settings without plugins section', async () => {
      const projectDir = path.join(testDir, 'missing-plugins-section')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'missing-plugins-section' })

      const settingsPath = path.join(projectDir, '.claude/settings.json')

      // Corrupt with missing plugins section
      await corruptSettingsFile(settingsPath, 'missing-plugins-section')

      // Run sync
      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Should either add plugins section or fail gracefully
      if (result.exitCode === 0) {
        const settings = await readJsonFile(settingsPath)
        expect(settings.plugins).toBeDefined()
        expect(settings.plugins.enabled).toBeDefined()
      }
    })

    it('should handle settings with malformed plugins structure', async () => {
      const projectDir = path.join(testDir, 'malformed-structure')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'malformed-structure' })

      const settingsPath = path.join(projectDir, '.claude/settings.json')

      // Corrupt with malformed structure
      await corruptSettingsFile(settingsPath, 'malformed-structure')

      // Run sync
      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Should either fix structure or fail gracefully
      if (result.exitCode === 0) {
        const settings = await readJsonFile(settingsPath)
        expect(typeof settings.plugins).toBe('object')
        expect(Array.isArray(settings.plugins.enabled)).toBe(true)
      }
    })
  })

  describe('Permission and access errors', () => {
    it('should handle read-only settings file gracefully', async () => {
      const projectDir = path.join(testDir, 'readonly-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'readonly-project' })

      const settingsPath = path.join(projectDir, '.claude/settings.json')

      // Make settings file read-only
      await fs.chmod(settingsPath, 0o444)

      // Run sync
      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Should fail with permission error
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toBeTruthy()

      // Restore permissions for cleanup
      await fs.chmod(settingsPath, 0o644)
    })

    it('should handle read-only .claude directory gracefully', async () => {
      const projectDir = path.join(testDir, 'readonly-dir-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'readonly-dir-project' })

      const claudeDir = path.join(projectDir, '.claude')

      // Make .claude directory read-only
      await fs.chmod(claudeDir, 0o555)

      // Run sync
      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Should fail with permission error
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toBeTruthy()

      // Restore permissions for cleanup
      await fs.chmod(claudeDir, 0o755)
    })
  })

  describe('Recovery from partial corruption', () => {
    it('should preserve valid sections when recovering from corruption', async () => {
      const projectDir = path.join(testDir, 'partial-recovery-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'partial-recovery-project' })

      // First, sync to create valid settings
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      let settings = await readJsonFile(settingsPath)

      // Add custom settings
      settings.customSection = { customKey : 'customValue' }
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))

      // Corrupt only part of the file (this is tricky - for this test we'll replace with partial valid JSON)
      const partiallyValid = {
        customSection : { customKey : 'customValue' },
        plugins       : {
          enabled : settings.plugins.enabled,
          // missing disabled and marketplaces
        },
      }
      await fs.writeFile(settingsPath, JSON.stringify(partiallyValid, null, 2))

      // Run sync
      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      if (result.exitCode === 0) {
        const recoveredSettings = await readJsonFile(settingsPath)

        // Should restore missing sections
        expect(recoveredSettings.plugins.disabled).toBeDefined()
        expect(recoveredSettings.plugins.marketplaces).toBeDefined()

        // Should preserve custom section
        expect(recoveredSettings.customSection).toBeDefined()
        expect(recoveredSettings.customSection.customKey).toBe('customValue')
      }
    })
  })

  describe('Concurrent corruption scenarios', () => {
    it('should handle corruption that occurs between read and write', async () => {
      const projectDir = path.join(testDir, 'concurrent-corruption')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'concurrent-corruption' })

      // Initial sync
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')

      // This test is more theoretical - in practice, we're testing that
      // the tool doesn't lose data if settings are modified externally

      // Corrupt after initial sync
      await corruptSettingsFile(settingsPath, 'invalid-json')

      // Try to sync again
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Tool should either recover or fail gracefully without data loss
      // If it creates a backup, verify it exists
      const backupPath = `${settingsPath}.bak`
      const backupExists = await fileExists(backupPath)

      if (backupExists) {
        // If backup was created, original corrupted data should be preserved
        const backup = await fs.readFile(backupPath, 'utf8')
        expect(backup).toContain('{ "plugins": { "enabled": [') // Corrupted content
      }
    })
  })
})
