/**
 * Functional tests for 'air sync' command (v2.0.0)
 */
import path from 'path'

import { createTestPackage, fileExists, readJsonFile, runCLI, setupClaudeSettings, setupTestEnv } from './helpers'

describe('air sync (functional)', () => {
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

    // Create test plugins
    await createTestPackage(testDir, 'test-plugin', {
      name        : 'TestPlugin',
      version     : '1.0.0',
      description : 'A test plugin for functional testing',
      skillPath   : '.claude-plugin/skill',
    })

    await createTestPackage(testDir, '@scoped/plugin', {
      name        : 'ScopedPlugin',
      version     : '2.0.0',
      description : 'A scoped test plugin',
      skillPath   : '.claude-plugin/skill',
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
      expect(settings.plugins.enabled).toContain('TestPlugin')
      expect(settings.plugins.enabled).toContain('ScopedPlugin')
    })

    it('should create marketplace entries', async () => {
      await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      const settingsPath = path.join(homeDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings.plugins.marketplaces['test-plugin-marketplace']).toBeDefined()
      expect(settings.plugins.marketplaces['@scoped/plugin-marketplace']).toBeDefined()

      // Check marketplace structure
      const marketplace = settings.plugins.marketplaces['test-plugin-marketplace']
      expect(marketplace.source.type).toBe('directory')
      expect(marketplace.source.path).toContain('test-plugin')
      expect(marketplace.plugins.TestPlugin).toBeDefined()
      expect(marketplace.plugins.TestPlugin.version).toBe('1.0.0')
    })

    it('should create cache file', async () => {
      await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      const cachePath = path.join(testDir, '.air-plugin-cache.json')
      expect(await fileExists(cachePath)).toBe(true)

      const cache = await readJsonFile(cachePath)
      expect(cache.providers).toHaveLength(2)
      expect(cache.providers.some((p) => p.packageName === 'test-plugin')).toBe(true)
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
      const pluginName = 'TestPlugin'
      settings.plugins.enabled = settings.plugins.enabled.filter((p) => p !== pluginName)
      settings.plugins.disabled = [pluginName]
      await require('fs/promises').writeFile(settingsPath, JSON.stringify(settings, null, 2))

      // Sync again
      await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      // Verify plugin is still disabled
      settings = await readJsonFile(settingsPath)
      expect(settings.plugins.disabled).toContain(pluginName)
      expect(settings.plugins.enabled).not.toContain(pluginName)
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

  describe('No-cache mode', () => {
    it('should skip cache with --no-cache flag', async () => {
      // First sync to create cache
      await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      // Modify cache to be invalid
      const cachePath = path.join(testDir, '.air-plugin-cache.json')
      const cache = await readJsonFile(cachePath)
      cache.providers = [] // Empty providers
      await require('fs/promises').writeFile(cachePath, JSON.stringify(cache, null, 2))

      // Sync with --no-cache should ignore the empty cache
      await runCLI(['sync', '--no-cache'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      const settings = await readJsonFile(path.join(homeDir, '.claude/settings.json'))
      // Should still find plugins despite bad cache
      expect(settings.plugins.enabled.length).toBeGreaterThan(0)
    })
  })

  describe('Cache usage', () => {
    it('should use cache on repeated syncs', async () => {
      // First sync
      await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      const cachePath = path.join(testDir, '.air-plugin-cache.json')
      const cache1 = await readJsonFile(cachePath)
      const timestamp1 = cache1.scannedAt

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Second sync
      await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      const cache2 = await readJsonFile(cachePath)
      const timestamp2 = cache2.scannedAt

      // Timestamp should be the same (cache was used)
      expect(timestamp1).toBe(timestamp2)
    })

    it('should invalidate cache when package.json changes', async () => {
      // First sync
      await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      const cachePath = path.join(testDir, '.air-plugin-cache.json')
      const cache1 = await readJsonFile(cachePath)
      const timestamp1 = cache1.scannedAt

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Modify package.json
      const packageJsonPath = path.join(testDir, 'package.json')
      const packageJson = await readJsonFile(packageJsonPath)
      packageJson.version = '1.0.1'
      await require('fs/promises').writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))

      // Second sync
      await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      const cache2 = await readJsonFile(cachePath)
      const timestamp2 = cache2.scannedAt

      // Timestamp should be different (cache was invalidated)
      expect(timestamp1).not.toBe(timestamp2)
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
      expect(settings.plugins.marketplaces['@scoped/plugin-marketplace']).toBeDefined()
      expect(settings.plugins.enabled).toContain('ScopedPlugin')
    })
  })

  describe('Error handling', () => {
    it('should fail gracefully with missing package.json', async () => {
      // Remove package.json
      await require('fs/promises').unlink(path.join(testDir, 'package.json'))

      const { stderr, exitCode } = await runCLI(['sync'], testDir, {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).not.toBe(0)
      expect(stderr.toLowerCase()).toMatch(/package\.json|enoent|no such file/)
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

    it('should handle invalid path', async () => {
      const { stderr, exitCode } = await runCLI(['sync', '/nonexistent/path'], '/', {
        env : { ...process.env, HOME : homeDir },
      })

      expect(exitCode).not.toBe(0)
      expect(stderr.toLowerCase()).toMatch(/enoent|no such file|not found|does not exist/)
    })
  })
})
