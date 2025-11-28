/**
 * Functional tests for 'air plugins sync' command (v2.0.0)
 */
import path from 'path'

import { createTestPackage, fileExists, readJsonFile, runCLI, setupClaudeSettings, setupTestEnv } from './helpers'

describe('air plugins sync (functional)', () => {
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

  describe('Basic sync functionality', () => {
    it('should discover and enable plugins', async () => {
      const { exitCode } = await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).toBe(0)

      // Check settings file was created/updated
      const settingsPath = path.join(homeDir, '.claude/settings.json')
      expect(await fileExists(settingsPath)).toBe(true)

      const settings = await readJsonFile(settingsPath)
      expect(settings.plugins.enabled).toContain('test-plugin@test-plugin-marketplace')
      expect(settings.plugins.enabled).toContain('scoped-plugin@plugin-marketplace')
    })

    it('should create marketplace entries', async () => {
      await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      const settingsPath = path.join(homeDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings.plugins.marketplaces['test-plugin-marketplace']).toBeDefined()
      expect(settings.plugins.marketplaces['plugin-marketplace']).toBeDefined()

      // Check marketplace structure
      const marketplace = settings.plugins.marketplaces['test-plugin-marketplace']
      expect(marketplace.source.type).toBe('directory')
      expect(marketplace.source.path).toContain('test-plugin')
      expect(marketplace.plugins['test-plugin']).toBeDefined()
      expect(marketplace.plugins['test-plugin'].version).toBe('1.0.0')
    })

    it('should display success message', async () => {
      const { stdout, exitCode } = await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).toMatch(/plugins? (added|discovered|updated)|✓/)
    })
  })

  describe('Respects user choices', () => {
    it('should not re-enable disabled plugins', async () => {
      // First sync
      await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      // Manually disable a plugin
      const settingsPath = path.join(homeDir, '.claude/settings.json')
      let settings = await readJsonFile(settingsPath)
      const pluginKey = 'test-plugin@test-plugin-marketplace'
      settings.plugins.enabled = settings.plugins.enabled.filter((p) => p !== pluginKey)
      settings.plugins.disabled = [pluginKey]
      await require('fs/promises').writeFile(settingsPath, JSON.stringify(settings, null, 2))

      // Sync again
      await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      // Verify plugin is still disabled
      settings = await readJsonFile(settingsPath)
      expect(settings.plugins.disabled).toContain(pluginKey)
      expect(settings.plugins.enabled).not.toContain(pluginKey)
    })

    it('should preserve other enabled plugins', async () => {
      // Add a manual plugin to enabled list
      const settingsPath = path.join(homeDir, '.claude/settings.json')
      let settings = await readJsonFile(settingsPath)
      settings.plugins.enabled = ['manual-plugin@manual-marketplace']
      await require('fs/promises').writeFile(settingsPath, JSON.stringify(settings, null, 2))

      // Sync
      await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      // Verify manual plugin is preserved
      settings = await readJsonFile(settingsPath)
      expect(settings.plugins.enabled).toContain('manual-plugin@manual-marketplace')
    })

    it('should preserve other marketplaces', async () => {
      // Add a manual marketplace
      const settingsPath = path.join(homeDir, '.claude/settings.json')
      let settings = await readJsonFile(settingsPath)
      settings.plugins.marketplaces['manual-marketplace'] = {
        source  : { type : 'directory', path : '/some/path' },
        plugins : { ManualPlugin : { version : '1.0.0', skillPath : 'skill' } },
      }
      await require('fs/promises').writeFile(settingsPath, JSON.stringify(settings, null, 2))

      // Sync
      await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      // Verify manual marketplace is preserved
      settings = await readJsonFile(settingsPath)
      expect(settings.plugins.marketplaces['manual-marketplace']).toBeDefined()
    })
  })

  describe('Quiet mode', () => {
    it('should suppress output with --quiet flag', async () => {
      const { stdout, exitCode } = await runCLI(['sync', '--quiet'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout.trim()).toBe('')
    })

    it('should still update settings in quiet mode', async () => {
      await runCLI(['sync', '--quiet'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      const settingsPath = path.join(homeDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)
      expect(settings.plugins.enabled.length).toBeGreaterThan(0)
    })
  })

  describe('Scoped packages', () => {
    it('should handle scoped package names correctly', async () => {
      await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      const settingsPath = path.join(homeDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Check scoped package marketplace
      expect(settings.plugins.marketplaces['plugin-marketplace']).toBeDefined()
      expect(settings.plugins.enabled).toContain('scoped-plugin@plugin-marketplace')
    })
  })

  describe('Error handling', () => {
    it('should handle missing package.json gracefully', async () => {
      // Remove package.json
      await require('fs/promises').unlink(path.join(testDir, 'package.json'))

      const { exitCode } = await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      // Should succeed with no plugins (graceful degradation)
      expect(exitCode).toBe(0)
    })

    it('should handle malformed package.json', async () => {
      const packageJsonPath = path.join(testDir, 'package.json')
      await require('fs/promises').writeFile(packageJsonPath, '{ invalid json')

      const { stderr, exitCode } = await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).not.toBe(0)
      expect(stderr.toLowerCase()).toMatch(/json|parse/)
    })

    it('should handle missing node_modules gracefully', async () => {
      // Remove node_modules
      await require('fs/promises').rm(path.join(testDir, 'node_modules'), { recursive : true, force : true })

      const { exitCode } = await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      // Should succeed but with no plugins
      expect(exitCode).toBe(0)
    })
  })

  describe('Path parameter', () => {
    it('should sync plugins from specified path', async () => {
      const { exitCode } = await runCLI(['sync', testDir], '/', {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).toBe(0)

      const settingsPath = path.join(homeDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)
      expect(settings.plugins.enabled.length).toBeGreaterThan(0)
    })

    it('should handle invalid path gracefully', async () => {
      const { exitCode } = await runCLI(['sync', '/nonexistent/path'], '/', {
        env : { ...process.env, HOME : homeDir },
      })

      // Should succeed with no plugins (graceful degradation)
      expect(exitCode).toBe(0)
    })
  })
})
