import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { getPluginState, getPluginStates, readSettings, updateSettings } from '_lib/storage/claude-settings'
import { PLUGIN_STATUSES } from '_lib/types'

describe('claude-settings', () => {
  let tempDir
  let settingsPath

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-test-'))
    settingsPath = path.join(tempDir, 'settings.json')
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive : true, force : true })
  })

  describe('readSettings', () => {
    it('should return default settings if file missing', async () => {
      const settings = await readSettings(settingsPath)

      expect(settings.plugins).toBeDefined()
      expect(settings.plugins.enabled).toEqual([])
      expect(settings.plugins.disabled).toEqual([])
      expect(settings.plugins.marketplaces).toEqual({})
    })

    it('should read existing settings file', async () => {
      const testSettings = {
        plugins : {
          enabled      : ['plugin-a', 'plugin-b'],
          disabled     : ['plugin-c'],
          marketplaces : {
            'test-marketplace' : {
              source : {
                type : 'directory',
                path : '/path/to/test',
              },
              plugins : {
                'plugin-a' : {
                  version   : '1.0.0',
                  skillPath : '.claude-plugin/skill',
                },
              },
            },
          },
        },
        otherSettings : { foo : 'bar' },
      }

      await fs.writeFile(settingsPath, JSON.stringify(testSettings), 'utf8')

      const settings = await readSettings(settingsPath)

      expect(settings).toEqual(testSettings)
      expect(settings.otherSettings.foo).toBe('bar')
    })

    it('should ensure plugins section exists if missing', async () => {
      await fs.writeFile(settingsPath, JSON.stringify({ other : 'data' }), 'utf8')

      const settings = await readSettings(settingsPath)

      expect(settings.plugins).toBeDefined()
      expect(settings.plugins.enabled).toEqual([])
      expect(settings.plugins.disabled).toEqual([])
      expect(settings.plugins.marketplaces).toEqual({})
      expect(settings.other).toBe('data')
    })

    it('should handle malformed JSON gracefully', async () => {
      await fs.writeFile(settingsPath, '{invalid json}', 'utf8')

      // Suppress console.warn for this test
      // eslint-disable-next-line no-console
      const originalWarn = console.warn
      // eslint-disable-next-line no-console
      console.warn = () => {}

      const settings = await readSettings(settingsPath)

      // eslint-disable-next-line no-console
      console.warn = originalWarn

      expect(settings.plugins).toBeDefined()
      expect(settings.plugins.enabled).toEqual([])

      // Should have created a backup
      const backupExists = await fs
        .access(`${settingsPath}.bak`)
        .then(() => true)
        .catch(() => false)

      expect(backupExists).toBe(true)
    })

    it('should handle missing enabled/disabled/marketplaces', async () => {
      await fs.writeFile(settingsPath, JSON.stringify({ plugins : {} }), 'utf8')

      const settings = await readSettings(settingsPath)

      expect(settings.plugins.enabled).toEqual([])
      expect(settings.plugins.disabled).toEqual([])
      expect(settings.plugins.marketplaces).toEqual({})
    })
  })

  describe('updateSettings', () => {
    it('should add new plugin to enabled list', async () => {
      const providers = [
        {
          packageName       : 'test-package',
          path              : '/path/to/test-package',
          version           : '1.0.0',
          pluginDeclaration : {
            name        : 'test-plugin',
            version     : '1.0.0',
            description : 'Test plugin',
            skillPath   : '.claude-plugin/skill',
          },
        },
      ]

      const changes = await updateSettings(settingsPath, providers)

      expect(changes.added).toEqual(['test-plugin'])
      expect(changes.updated).toEqual([])

      const settings = await readSettings(settingsPath)

      expect(settings.plugins.enabled).toContain('test-plugin')
      expect(settings.plugins.marketplaces['test-package-marketplace']).toBeDefined()
    })

    it('should not add disabled plugin to enabled list', async () => {
      // Set up existing settings with disabled plugin
      const existingSettings = {
        plugins : {
          enabled      : [],
          disabled     : ['test-plugin'],
          marketplaces : {},
        },
      }
      await fs.writeFile(settingsPath, JSON.stringify(existingSettings), 'utf8')

      const providers = [
        {
          packageName       : 'test-package',
          path              : '/path/to/test-package',
          version           : '1.0.0',
          pluginDeclaration : {
            name        : 'test-plugin',
            version     : '1.0.0',
            description : 'Test plugin',
            skillPath   : '.claude-plugin/skill',
          },
        },
      ]

      const changes = await updateSettings(settingsPath, providers)

      expect(changes.added).toEqual([])
      expect(changes.updated).toEqual([])

      const settings = await readSettings(settingsPath)

      expect(settings.plugins.enabled).not.toContain('test-plugin')
      expect(settings.plugins.disabled).toContain('test-plugin')
    })

    it('should update marketplace entry for existing plugin', async () => {
      // Set up existing settings
      const existingSettings = {
        plugins : {
          enabled      : ['test-plugin'],
          disabled     : [],
          marketplaces : {
            'test-package-marketplace' : {
              source : {
                type : 'directory',
                path : '/old/path',
              },
              plugins : {
                'test-plugin' : {
                  version   : '0.9.0',
                  skillPath : '.claude-plugin/skill',
                },
              },
            },
          },
        },
      }
      await fs.writeFile(settingsPath, JSON.stringify(existingSettings), 'utf8')

      const providers = [
        {
          packageName       : 'test-package',
          path              : '/new/path',
          version           : '1.0.0',
          pluginDeclaration : {
            name        : 'test-plugin',
            version     : '1.0.0',
            description : 'Test plugin',
            skillPath   : '.claude-plugin/skill',
          },
        },
      ]

      const changes = await updateSettings(settingsPath, providers)

      expect(changes.added).toEqual([])
      expect(changes.updated).toEqual(['test-plugin'])

      const settings = await readSettings(settingsPath)

      expect(settings.plugins.marketplaces['test-package-marketplace'].source.path).toBe('/new/path')
      expect(settings.plugins.marketplaces['test-package-marketplace'].plugins['test-plugin'].version).toBe('1.0.0')
    })

    it('should handle multiple providers', async () => {
      const providers = [
        {
          packageName       : 'package-a',
          path              : '/path/a',
          version           : '1.0.0',
          pluginDeclaration : {
            name        : 'plugin-a',
            version     : '1.0.0',
            description : 'Plugin A',
            skillPath   : '.claude-plugin/skill',
          },
        },
        {
          packageName       : 'package-b',
          path              : '/path/b',
          version           : '2.0.0',
          pluginDeclaration : {
            name        : 'plugin-b',
            version     : '2.0.0',
            description : 'Plugin B',
            skillPath   : '.claude-plugin/skill',
          },
        },
      ]

      const changes = await updateSettings(settingsPath, providers)

      expect(changes.added).toEqual(['plugin-a', 'plugin-b'])

      const settings = await readSettings(settingsPath)

      expect(settings.plugins.enabled).toEqual(['plugin-a', 'plugin-b'])
      expect(settings.plugins.marketplaces['package-a-marketplace']).toBeDefined()
      expect(settings.plugins.marketplaces['package-b-marketplace']).toBeDefined()
    })

    it('should not write settings if no changes', async () => {
      // Set up existing settings
      const existingSettings = {
        plugins : {
          enabled      : [],
          disabled     : ['test-plugin'],
          marketplaces : {},
        },
      }
      await fs.writeFile(settingsPath, JSON.stringify(existingSettings), 'utf8')

      const mtime1 = (await fs.stat(settingsPath)).mtimeMs

      await new Promise((resolve) => setTimeout(resolve, 10))

      const providers = [
        {
          packageName       : 'test-package',
          path              : '/path/to/test-package',
          version           : '1.0.0',
          pluginDeclaration : {
            name        : 'test-plugin',
            version     : '1.0.0',
            description : 'Test plugin',
            skillPath   : '.claude-plugin/skill',
          },
        },
      ]

      await updateSettings(settingsPath, providers)

      const mtime2 = (await fs.stat(settingsPath)).mtimeMs

      // File should not have been modified
      expect(mtime2).toBe(mtime1)
    })

    it('should create backup before writing', async () => {
      // Create initial settings
      const initialSettings = {
        plugins : {
          enabled      : [],
          disabled     : [],
          marketplaces : {},
        },
      }
      await fs.writeFile(settingsPath, JSON.stringify(initialSettings), 'utf8')

      const providers = [
        {
          packageName       : 'test-package',
          path              : '/path/to/test-package',
          version           : '1.0.0',
          pluginDeclaration : {
            name        : 'test-plugin',
            version     : '1.0.0',
            description : 'Test plugin',
            skillPath   : '.claude-plugin/skill',
          },
        },
      ]

      await updateSettings(settingsPath, providers)

      // Check backup was created
      const backupExists = await fs
        .access(`${settingsPath}.bak`)
        .then(() => true)
        .catch(() => false)

      expect(backupExists).toBe(true)

      const backupContent = await fs.readFile(`${settingsPath}.bak`, 'utf8')

      expect(JSON.parse(backupContent)).toEqual(initialSettings)
    })

    it('should preserve other settings fields', async () => {
      const existingSettings = {
        plugins : {
          enabled      : [],
          disabled     : [],
          marketplaces : {},
        },
        customSetting : 'preserved',
        nested        : { value : 42 },
      }
      await fs.writeFile(settingsPath, JSON.stringify(existingSettings), 'utf8')

      const providers = [
        {
          packageName       : 'test-package',
          path              : '/path/to/test-package',
          version           : '1.0.0',
          pluginDeclaration : {
            name        : 'test-plugin',
            version     : '1.0.0',
            description : 'Test plugin',
            skillPath   : '.claude-plugin/skill',
          },
        },
      ]

      await updateSettings(settingsPath, providers)

      const settings = await readSettings(settingsPath)

      expect(settings.customSetting).toBe('preserved')
      expect(settings.nested.value).toBe(42)
    })
  })

  describe('getPluginState', () => {
    it('should return enabled for enabled plugin', () => {
      const settings = {
        plugins : {
          enabled      : ['test-plugin'],
          disabled     : [],
          marketplaces : {},
        },
      }

      expect(getPluginState('test-plugin', settings)).toBe(PLUGIN_STATUSES.ENABLED)
    })

    it('should return disabled for disabled plugin', () => {
      const settings = {
        plugins : {
          enabled      : [],
          disabled     : ['test-plugin'],
          marketplaces : {},
        },
      }

      expect(getPluginState('test-plugin', settings)).toBe(PLUGIN_STATUSES.DISABLED)
    })

    it('should return not-installed for unknown plugin', () => {
      const settings = {
        plugins : {
          enabled      : [],
          disabled     : [],
          marketplaces : {},
        },
      }

      expect(getPluginState('unknown-plugin', settings)).toBe(PLUGIN_STATUSES.NOT_INSTALLED)
    })
  })

  describe('getPluginStates', () => {
    it('should return states for all providers', () => {
      const providers = [
        {
          packageName       : 'package-a',
          path              : '/path/a',
          version           : '1.0.0',
          pluginDeclaration : {
            name        : 'plugin-a',
            version     : '1.0.0',
            description : 'Plugin A',
            skillPath   : '.claude-plugin/skill',
          },
        },
        {
          packageName       : 'package-b',
          path              : '/path/b',
          version           : '2.0.0',
          pluginDeclaration : {
            name        : 'plugin-b',
            version     : '2.0.0',
            description : 'Plugin B',
            skillPath   : '.claude-plugin/skill',
          },
        },
      ]

      const settings = {
        plugins : {
          enabled      : ['plugin-a'],
          disabled     : ['plugin-b'],
          marketplaces : {},
        },
      }

      const states = getPluginStates(providers, settings)

      expect(states).toHaveLength(2)
      expect(states[0]).toMatchObject({
        name        : 'plugin-a',
        status      : PLUGIN_STATUSES.ENABLED,
        source      : '/path/a',
        version     : '1.0.0',
        description : 'Plugin A',
      })
      expect(states[1]).toMatchObject({
        name        : 'plugin-b',
        status      : PLUGIN_STATUSES.DISABLED,
        source      : '/path/b',
        version     : '2.0.0',
        description : 'Plugin B',
      })
    })
  })
})
