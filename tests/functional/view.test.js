/**
 * Functional tests for 'air plugins view' command (v2.0.0)
 */
import path from 'path'

import { createTestPackage, readJsonFile, runCLI, setupClaudeSettings, setupTestEnv } from './helpers'

describe('air plugins view (functional)', () => {
  let testDir
  let cleanup
  let homeDir

  beforeEach(async () => {
    const env = await setupTestEnv({ dependencies : ['test-plugin', '@scoped/plugin'] })
    testDir = env.testDir
    cleanup = env.cleanup
    homeDir = testDir // Use test dir as HOME

    // Setup Claude settings
    await setupClaudeSettings(homeDir)

    // Create test plugins (names must be kebab-case per schema)
    await createTestPackage(testDir, 'test-plugin', {
      name        : 'test-plugin',
      version     : '1.0.0',
      description : 'A test plugin for functional testing',
      source      : './',
    })

    await createTestPackage(testDir, '@scoped/plugin', {
      name        : 'scoped-plugin',
      version     : '2.0.0',
      description : 'A scoped test plugin',
      source      : './',
    })
  })

  afterEach(async () => {
    await cleanup()
  })

  describe('Basic view functionality', () => {
    it('should display plugins from current project', async () => {
      const { stdout, exitCode } = await runCLI(['plugins', 'view'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout).toContain('test-plugin')
    })

    it('should show plugin status as not-installed initially', async () => {
      const { stdout, exitCode } = await runCLI(['plugins', 'view'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).toMatch(/not.*installed|not-installed/)
    })

    it('should handle scoped packages', async () => {
      const { stdout, exitCode } = await runCLI(['plugins', 'view'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout).toContain('scoped-plugin')
      expect(stdout).toContain('@scoped/plugin')
    })
  })

  describe('View with --all flag', () => {
    it('should show all plugins in Claude settings', async () => {
      // First sync to populate settings
      await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      const { stdout, exitCode } = await runCLI(['plugins', 'view', '--all'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout).toContain('test-plugin')
      expect(stdout).toContain('scoped-plugin')
    })

    it('should work even without local project', async () => {
      // Sync first to populate settings
      await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      // Run from different directory
      const { exitCode } = await runCLI(['plugins', 'view', '--all'], '/', {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).toBe(0)
      // Should still show plugins from settings
    })
  })

  describe('Plugin status display', () => {
    it('should show enabled status after sync', async () => {
      // Sync to enable plugins
      await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      const { stdout, exitCode } = await runCLI(['plugins', 'view'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).toMatch(/enabled/)
    })

    it('should show disabled status for disabled plugins', async () => {
      // Sync first
      await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      // Manually disable a plugin
      const settingsPath = path.join(homeDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)
      const pluginKey = settings.plugins.enabled[0]
      settings.plugins.enabled = settings.plugins.enabled.filter((p) => p !== pluginKey)
      settings.plugins.disabled = [pluginKey]
      await require('fs/promises').writeFile(settingsPath, JSON.stringify(settings, null, 2))

      const { stdout, exitCode } = await runCLI(['plugins', 'view'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).toMatch(/disabled/)
    })
  })

  describe('Output format', () => {
    it('should display plugin information in hierarchical format', async () => {
      const { stdout, exitCode } = await runCLI(['plugins', 'view'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).toBe(0)
      // Check for hierarchical format with key sections
      expect(stdout.toLowerCase()).toMatch(/package:|plugin:|status:|description:/i)
    })

    it('should show version information', async () => {
      const { stdout, exitCode } = await runCLI(['plugins', 'view'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout).toContain('1.0.0')
      expect(stdout).toContain('2.0.0')
    })

    it('should show description', async () => {
      const { stdout, exitCode } = await runCLI(['plugins', 'view'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout).toContain('A test plugin for functional testing')
      expect(stdout).toContain('A scoped test plugin')
    })
  })

  describe('Error handling', () => {
    it('should handle missing package.json gracefully', async () => {
      // Remove package.json
      await require('fs/promises').unlink(path.join(testDir, 'package.json'))

      const { stdout, exitCode } = await runCLI(['plugins', 'view'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      // Should succeed with no plugins found (graceful degradation)
      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).toMatch(/no.*plugins?|found 0/)
    })

    it('should handle empty project', async () => {
      // Create new empty project
      const emptyEnv = await setupTestEnv({ dependencies : [] })

      const { stdout, exitCode } = await runCLI(['plugins', 'view'], emptyEnv.testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).toMatch(/no.*plugins?|found 0/)

      await emptyEnv.cleanup()
    })
  })

  describe('Path parameter', () => {
    it('should view plugins from specified path', async () => {
      const { stdout, exitCode } = await runCLI(['plugins', 'view', testDir], '/', {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout).toContain('test-plugin')
    })

    it('should handle invalid path gracefully', async () => {
      const { exitCode, stdout } = await runCLI(['plugins', 'view', '/nonexistent/path'], '/', {
        env : { ...process.env, HOME : homeDir },
      })

      // Should succeed with no plugins (graceful degradation)
      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).toMatch(/no.*plugin.*found|no.*marketplaces? found/i)
    })
  })
})
