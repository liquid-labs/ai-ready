/**
 * Functional tests for 'air remove' command
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import path from 'path'
import {
  setupTestEnv,
  setupClaudePluginDir,
  runCLI,
  readJsonFile,
  readFile,
  parseMarkdownTable
} from './helpers.js'

describe('air remove (functional)', () => {
  let testDir
  let cleanup
  let pluginDir

  beforeEach(async () => {
    const env = await setupTestEnv()
    testDir = env.testDir
    cleanup = env.cleanup

    // Setup mock Claude plugin directory in test dir
    const { pluginsDir } = await setupClaudePluginDir(testDir)
    pluginDir = pluginsDir
  })

  afterEach(async () => {
    await cleanup()
  })

  describe('Basic removal', () => {
    it('should remove an installed Claude Skill', async () => {
      // First install
      await runCLI(
        ['install', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Then remove
      const { stdout, exitCode } = await runCLI(
        ['remove', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      expect(stdout).toContain('removed')

      // Verify plugin removed from registry
      const installedPlugins = await readJsonFile(
        path.join(pluginDir, 'installed_plugins.json')
      )
      expect(Object.keys(installedPlugins)).not.toContain('skillonly@test-air-package-marketplace')
    })

    it('should remove an installed generic integration', async () => {
      // First install
      await runCLI(
        ['install', 'test-air-package/GenericOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Then remove
      const { stdout, exitCode } = await runCLI(
        ['remove', 'test-air-package/GenericOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      expect(stdout).toContain('removed')

      // Verify entry removed from AGENTS.md
      const agentsContent = await readFile(path.join(testDir, 'AGENTS.md'))
      if (agentsContent) {
        const entries = parseMarkdownTable(agentsContent)
        const genericEntry = entries.find(e => e.name === 'GenericOnly')
        expect(genericEntry).toBeFalsy()
      }
    })

    it('should remove dual-type integration (both types by default)', async () => {
      // First install both types
      await runCLI(
        ['install', 'test-air-package/DualTypeIntegration'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Then remove
      const { stdout, exitCode } = await runCLI(
        ['remove', 'test-air-package/DualTypeIntegration'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)

      // Verify skill removed
      const installedPlugins = await readJsonFile(
        path.join(pluginDir, 'installed_plugins.json')
      )
      expect(Object.keys(installedPlugins)).not.toContain('dualtypeintegration@test-air-package-marketplace')

      // Verify generic removed
      const agentsContent = await readFile(path.join(testDir, 'AGENTS.md'))
      if (agentsContent) {
        const entries = parseMarkdownTable(agentsContent)
        const dualTypeEntry = entries.find(e => e.name === 'DualTypeIntegration')
        expect(dualTypeEntry).toBeFalsy()
      }
    })
  })

  describe('Selective removal with flags', () => {
    it('should remove only skill with --skill flag', async () => {
      // Install both types
      await runCLI(
        ['install', 'test-air-package/DualTypeIntegration'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Remove only skill
      const { exitCode } = await runCLI(
        ['remove', 'test-air-package/DualTypeIntegration', '--skill'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)

      // Verify skill removed
      const installedPlugins = await readJsonFile(
        path.join(pluginDir, 'installed_plugins.json')
      )
      expect(Object.keys(installedPlugins)).not.toContain('dualtypeintegration@test-air-package-marketplace')

      // Verify generic still installed
      const agentsContent = await readFile(path.join(testDir, 'AGENTS.md'))
      expect(agentsContent).toBeTruthy()
      const entries = parseMarkdownTable(agentsContent)
      const dualTypeEntry = entries.find(e => e.name === 'DualTypeIntegration')
      expect(dualTypeEntry).toBeTruthy()
    })

    it('should remove only generic with --generic flag', async () => {
      // Install both types
      await runCLI(
        ['install', 'test-air-package/DualTypeIntegration'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Remove only generic
      const { exitCode } = await runCLI(
        ['remove', 'test-air-package/DualTypeIntegration', '--generic'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)

      // Verify generic removed
      const agentsContent = await readFile(path.join(testDir, 'AGENTS.md'))
      if (agentsContent) {
        const entries = parseMarkdownTable(agentsContent)
        const dualTypeEntry = entries.find(e => e.name === 'DualTypeIntegration')
        expect(dualTypeEntry).toBeFalsy()
      }

      // Verify skill still installed
      const installedPlugins = await readJsonFile(
        path.join(pluginDir, 'installed_plugins.json')
      )
      expect(Object.keys(installedPlugins)).toContain('dualtypeintegration@test-air-package-marketplace')
    })
  })

  describe('Error handling', () => {
    it('should fail gracefully for non-existent integration', async () => {
      const { stderr, exitCode } = await runCLI(
        ['remove', 'test-air-package/NonExistent'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).not.toBe(0)
      expect(stderr).toContain('not found')
    })

    it('should handle removing non-installed integration', async () => {
      const { stderr, exitCode } = await runCLI(
        ['remove', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).not.toBe(0)
      expect(stderr.toLowerCase()).toMatch(/not.*installed/)
    })

    it('should fail when trying to remove skill-only type with --generic flag', async () => {
      // Install skill
      await runCLI(
        ['install', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Try to remove with --generic flag
      const { stderr, exitCode } = await runCLI(
        ['remove', 'test-air-package/SkillOnly', '--generic'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).not.toBe(0)
      expect(stderr).toContain('does not provide')
    })

    it('should fail when trying to remove generic-only type with --skill flag', async () => {
      // Install generic
      await runCLI(
        ['install', 'test-air-package/GenericOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Try to remove with --skill flag
      const { stderr, exitCode } = await runCLI(
        ['remove', 'test-air-package/GenericOnly', '--skill'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).not.toBe(0)
      expect(stderr).toContain('does not provide')
    })
  })

  describe('Partial removal scenarios', () => {
    it('should handle removing only skill when both types are installed', async () => {
      // Install both types
      await runCLI(
        ['install', 'test-air-package/DualTypeIntegration'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Remove skill
      await runCLI(
        ['remove', 'test-air-package/DualTypeIntegration', '--skill'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Try to remove skill again - should fail
      const { stderr, exitCode } = await runCLI(
        ['remove', 'test-air-package/DualTypeIntegration', '--skill'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).not.toBe(0)
      expect(stderr.toLowerCase()).toMatch(/not.*installed/)
    })

    it('should handle removing only generic when both types are installed', async () => {
      // Install both types
      await runCLI(
        ['install', 'test-air-package/DualTypeIntegration'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Remove generic
      await runCLI(
        ['remove', 'test-air-package/DualTypeIntegration', '--generic'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Try to remove generic again - should fail
      const { stderr, exitCode } = await runCLI(
        ['remove', 'test-air-package/DualTypeIntegration', '--generic'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).not.toBe(0)
      expect(stderr.toLowerCase()).toMatch(/not.*installed/)
    })
  })

  describe('Backup file creation', () => {
    it('should create backup of installed_plugins.json before removal', async () => {
      // Install skill
      await runCLI(
        ['install', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Remove skill
      await runCLI(
        ['remove', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Check backup exists
      const backupContent = await readFile(
        path.join(pluginDir, 'installed_plugins.json.bak')
      )
      expect(backupContent).toBeTruthy()

      // Backup should contain the skill that was removed
      const backup = JSON.parse(backupContent)
      expect(Object.keys(backup)).toContain('skillonly@test-air-package-marketplace')
    })

    it('should create backup of AGENTS.md before removal', async () => {
      // Install generic
      await runCLI(
        ['install', 'test-air-package/GenericOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Remove generic
      await runCLI(
        ['remove', 'test-air-package/GenericOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Check backup exists
      const backupContent = await readFile(path.join(testDir, 'AGENTS.md.bak'))
      expect(backupContent).toBeTruthy()

      // Backup should contain the entry that was removed
      const entries = parseMarkdownTable(backupContent)
      const genericEntry = entries.find(e => e.name === 'GenericOnly')
      expect(genericEntry).toBeTruthy()
    })
  })
})
