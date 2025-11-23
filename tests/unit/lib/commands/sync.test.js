import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { syncCommand } from '_lib/commands/sync'
import { ClaudePluginConfig } from '_lib/storage/claude-config'
import { readSettings } from '_lib/storage/claude-settings'

import { createPackageJson, createTestPackage } from '../test-lib'

describe('sync command', () => {
  let tempDir
  let claudeDir
  let settingsPath

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-sync-test-'))
    claudeDir = path.join(tempDir, '.claude')
    await fs.mkdir(claudeDir, { recursive : true })
    settingsPath = path.join(claudeDir, 'settings.json')
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive : true, force : true })
  })

  describe('syncCommand', () => {
    it('should enable newly discovered plugins', async () => {
      await createTestPackage(tempDir, 'test-lib', {
        name        : 'test-plugin',
        version     : '1.0.0',
        description : 'Test plugin',
        skillPath   : '.claude-plugin/skill',
      })
      await createPackageJson(tempDir, ['test-lib'])

      const config = ClaudePluginConfig.createForTest(tempDir)
      await syncCommand({ path : tempDir, quiet : true, config })

      const settings = await readSettings(settingsPath)
      expect(settings.plugins.enabled).toContain('test-plugin@test-lib-marketplace')
      expect(settings.plugins.marketplaces['test-lib-marketplace']).toBeDefined()
      expect(settings.plugins.marketplaces['test-lib-marketplace'].plugins['test-plugin'].version).toBe('1.0.0')
    })

    it('should respect disabled plugins', async () => {
      // Pre-populate settings with disabled plugin
      await fs.writeFile(
        settingsPath,
        JSON.stringify({
          plugins : {
            enabled      : [],
            disabled     : ['test-plugin@test-lib-marketplace'],
            marketplaces : {},
          },
        }),
        'utf8'
      )

      await createTestPackage(tempDir, 'test-lib', {
        name        : 'test-plugin',
        version     : '1.0.0',
        description : 'Test plugin',
        skillPath   : '.claude-plugin/skill',
      })
      await createPackageJson(tempDir, ['test-lib'])

      const config = ClaudePluginConfig.createForTest(tempDir)
      await syncCommand({ path : tempDir, quiet : true, config })

      const settings = await readSettings(settingsPath)
      expect(settings.plugins.enabled).not.toContain('test-plugin@test-lib-marketplace')
      expect(settings.plugins.disabled).toContain('test-plugin@test-lib-marketplace')
    })

    it('should handle no plugins found', async () => {
      const config = ClaudePluginConfig.createForTest(tempDir)
      await syncCommand({ path : tempDir, quiet : true, config })

      // Should not crash, just do nothing
      // Settings file might not exist if no plugins found
      try {
        const settings = await readSettings(settingsPath)
        expect(settings.plugins.enabled).toEqual([])
      }
      catch (error) {
        // Settings file doesn't exist - that's fine
        expect(error.code).toBe('ENOENT')
      }
    })

    it('should enable multiple plugins', async () => {
      await createTestPackage(tempDir, 'lib-1', {
        name        : 'plugin-1',
        version     : '1.0.0',
        description : 'Plugin 1',
        skillPath   : '.claude-plugin/skill',
      })

      await createTestPackage(tempDir, 'lib-2', {
        name        : 'plugin-2',
        version     : '2.0.0',
        description : 'Plugin 2',
        skillPath   : '.claude-plugin/skill',
      })
      await createPackageJson(tempDir, ['lib-1', 'lib-2'])

      const config = ClaudePluginConfig.createForTest(tempDir)
      await syncCommand({ path : tempDir, quiet : true, config })

      const settings = await readSettings(settingsPath)
      expect(settings.plugins.enabled).toContain('plugin-1@lib-1-marketplace')
      expect(settings.plugins.enabled).toContain('plugin-2@lib-2-marketplace')
      expect(settings.plugins.marketplaces['lib-1-marketplace']).toBeDefined()
      expect(settings.plugins.marketplaces['lib-2-marketplace']).toBeDefined()
    })

    it('should update marketplace path when package version changes', async () => {
      // First sync with v1.0.0
      await createTestPackage(tempDir, 'test-lib', {
        name        : 'test-plugin',
        version     : '1.0.0',
        description : 'Test plugin',
        skillPath   : '.claude-plugin/skill',
      })
      await createPackageJson(tempDir, ['test-lib'])

      const config = ClaudePluginConfig.createForTest(tempDir)
      await syncCommand({ path : tempDir, quiet : true, config })

      let settings = await readSettings(settingsPath)
      expect(settings.plugins.marketplaces['test-lib-marketplace'].plugins['test-plugin'].version).toBe('1.0.0')

      // Update to v2.0.0
      await createTestPackage(tempDir, 'test-lib', {
        name        : 'test-plugin',
        version     : '2.0.0',
        description : 'Test plugin updated',
        skillPath   : '.claude-plugin/skill',
      })

      // Sync again with noCache to force rescan
      await syncCommand({ path : tempDir, quiet : true, noCache : true, config })

      settings = await readSettings(settingsPath)
      expect(settings.plugins.marketplaces['test-lib-marketplace'].plugins['test-plugin'].version).toBe('2.0.0')
    })

    it('should not output when quiet flag is set', async () => {
      await createTestPackage(tempDir, 'test-lib', {
        name        : 'test-plugin',
        version     : '1.0.0',
        description : 'Test',
        skillPath   : '.claude-plugin/skill',
      })
      await createPackageJson(tempDir, ['test-lib'])

      const logs = []
      // eslint-disable-next-line no-console
      const originalLog = console.log
      // eslint-disable-next-line no-console
      console.log = (...args) => logs.push(args.join(' '))

      const config = ClaudePluginConfig.createForTest(tempDir)
      await syncCommand({ path : tempDir, quiet : true, config })

      // eslint-disable-next-line no-console
      console.log = originalLog

      expect(logs.length).toBe(0)
    })

    it('should output when quiet flag is not set', async () => {
      await createTestPackage(tempDir, 'test-lib', {
        name        : 'test-plugin',
        version     : '1.0.0',
        description : 'Test',
        skillPath   : '.claude-plugin/skill',
      })
      await createPackageJson(tempDir, ['test-lib'])

      const logs = []
      // eslint-disable-next-line no-console
      const originalLog = console.log
      // eslint-disable-next-line no-console
      console.log = (...args) => logs.push(args.join(' '))

      const config = ClaudePluginConfig.createForTest(tempDir)
      await syncCommand({ path : tempDir, quiet : false, config })

      // eslint-disable-next-line no-console
      console.log = originalLog

      const output = logs.join('\n')
      expect(output).toContain('Scanning dependencies')
      expect(output).toContain('Found 1 plugin')
      expect(output).toContain('New plugins discovered')
      expect(output).toContain('test-plugin')
      expect(output).toContain('Restart Claude Code')
    })

    it('should handle noCache option', async () => {
      await createTestPackage(tempDir, 'test-lib', {
        name        : 'test-plugin',
        version     : '1.0.0',
        description : 'Test',
        skillPath   : '.claude-plugin/skill',
      })
      await createPackageJson(tempDir, ['test-lib'])

      const config = ClaudePluginConfig.createForTest(tempDir)

      // First sync creates cache
      await syncCommand({ path : tempDir, quiet : true, config })

      // Second sync with noCache should still work
      await syncCommand({ path : tempDir, quiet : true, noCache : true, config })

      const settings = await readSettings(settingsPath)
      expect(settings.plugins.enabled).toContain('test-plugin@test-lib-marketplace')
    })
  })
})
