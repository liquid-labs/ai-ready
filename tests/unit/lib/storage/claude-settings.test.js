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
                  version : '1.0.0',
                  source  : './plugins/a',
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
          packageName            : 'test-package',
          path                   : '/path/to/test-package',
          version                : '1.0.0',
          marketplaceDeclaration : {
            name    : 'test-marketplace',
            owner   : { name : 'Test Owner' },
            plugins : [
              {
                name        : 'test-plugin',
                source      : './plugin',
                version     : '1.0.0',
                description : 'Test plugin',
              },
            ],
          },
        },
      ]

      const changes = await updateSettings(settingsPath, providers)

      expect(changes.added).toEqual(['test-plugin'])
      expect(changes.updated).toEqual([])

      const settings = await readSettings(settingsPath)

      expect(settings.plugins.enabled).toContain('test-plugin@test-marketplace')
      expect(settings.plugins.marketplaces['test-marketplace']).toBeDefined()
    })

    it('should not add disabled plugin to enabled list', async () => {
      // Set up existing settings with disabled plugin
      const existingSettings = {
        plugins : {
          enabled      : [],
          disabled     : ['test-plugin@test-marketplace'],
          marketplaces : {},
        },
      }
      await fs.writeFile(settingsPath, JSON.stringify(existingSettings), 'utf8')

      const providers = [
        {
          packageName            : 'test-package',
          path                   : '/path/to/test-package',
          version                : '1.0.0',
          marketplaceDeclaration : {
            name    : 'test-marketplace',
            owner   : { name : 'Test Owner' },
            plugins : [
              {
                name        : 'test-plugin',
                source      : './plugin',
                version     : '1.0.0',
                description : 'Test plugin',
              },
            ],
          },
        },
      ]

      const changes = await updateSettings(settingsPath, providers)

      expect(changes.added).toEqual([])
      expect(changes.updated).toEqual([])

      const settings = await readSettings(settingsPath)

      expect(settings.plugins.enabled).not.toContain('test-plugin@test-marketplace')
      expect(settings.plugins.disabled).toContain('test-plugin@test-marketplace')
    })

    it('should update marketplace entry for existing plugin', async () => {
      // Set up existing settings
      const existingSettings = {
        plugins : {
          enabled      : ['test-plugin@test-marketplace'],
          disabled     : [],
          marketplaces : {
            'test-marketplace' : {
              source : {
                type : 'directory',
                path : '/old/path',
              },
              plugins : {
                'test-plugin' : {
                  version : '0.9.0',
                  source  : './plugin',
                },
              },
            },
          },
        },
      }
      await fs.writeFile(settingsPath, JSON.stringify(existingSettings), 'utf8')

      const providers = [
        {
          packageName            : 'test-package',
          path                   : '/new/path',
          version                : '1.0.0',
          marketplaceDeclaration : {
            name    : 'test-marketplace',
            owner   : { name : 'Test Owner' },
            plugins : [
              {
                name        : 'test-plugin',
                source      : './plugin',
                version     : '1.0.0',
                description : 'Test plugin',
              },
            ],
          },
        },
      ]

      const changes = await updateSettings(settingsPath, providers)

      expect(changes.added).toEqual([])
      expect(changes.updated).toEqual(['test-plugin'])

      const settings = await readSettings(settingsPath)

      expect(settings.plugins.marketplaces['test-marketplace'].source.path).toBe('/new/path')
      expect(settings.plugins.marketplaces['test-marketplace'].plugins['test-plugin'].version).toBe('1.0.0')
    })

    it('should handle multiple providers', async () => {
      const providers = [
        {
          packageName            : 'package-a',
          path                   : '/path/a',
          version                : '1.0.0',
          marketplaceDeclaration : {
            name    : 'marketplace-a',
            owner   : { name : 'Test' },
            plugins : [
              {
                name        : 'plugin-a',
                source      : './plugin',
                version     : '1.0.0',
                description : 'Plugin A',
              },
            ],
          },
        },
        {
          packageName            : 'package-b',
          path                   : '/path/b',
          version                : '2.0.0',
          marketplaceDeclaration : {
            name    : 'marketplace-b',
            owner   : { name : 'Test' },
            plugins : [
              {
                name        : 'plugin-b',
                source      : './plugin',
                version     : '2.0.0',
                description : 'Plugin B',
              },
            ],
          },
        },
      ]

      const changes = await updateSettings(settingsPath, providers)

      expect(changes.added).toEqual(['plugin-a', 'plugin-b'])

      const settings = await readSettings(settingsPath)

      expect(settings.plugins.enabled).toEqual(['plugin-a@marketplace-a', 'plugin-b@marketplace-b'])
      expect(settings.plugins.marketplaces['marketplace-a']).toBeDefined()
      expect(settings.plugins.marketplaces['marketplace-b']).toBeDefined()
    })

    it('should handle marketplace with multiple plugins', async () => {
      const providers = [
        {
          packageName            : 'multi-package',
          path                   : '/path/multi',
          version                : '1.0.0',
          marketplaceDeclaration : {
            name    : 'multi-marketplace',
            owner   : { name : 'Test' },
            plugins : [
              { name : 'plugin-a', source : './plugins/a', version : '1.0.0' },
              { name : 'plugin-b', source : './plugins/b', version : '2.0.0' },
            ],
          },
        },
      ]

      const changes = await updateSettings(settingsPath, providers)

      expect(changes.added).toEqual(['plugin-a', 'plugin-b'])

      const settings = await readSettings(settingsPath)

      expect(settings.plugins.enabled).toContain('plugin-a@multi-marketplace')
      expect(settings.plugins.enabled).toContain('plugin-b@multi-marketplace')
      expect(settings.plugins.marketplaces['multi-marketplace'].plugins['plugin-a']).toBeDefined()
      expect(settings.plugins.marketplaces['multi-marketplace'].plugins['plugin-b']).toBeDefined()
    })

    it('should not write settings if no changes', async () => {
      // Set up existing settings with marketplace entry already present
      const existingSettings = {
        plugins : {
          enabled      : [],
          disabled     : ['test-plugin@test-marketplace'],
          marketplaces : {
            'test-marketplace' : {
              source : {
                type : 'directory',
                path : '/path/to/test-package',
              },
              plugins : {
                'test-plugin' : {
                  version : '1.0.0',
                  source  : './plugin',
                },
              },
            },
          },
        },
      }
      await fs.writeFile(settingsPath, JSON.stringify(existingSettings), 'utf8')

      const mtime1 = (await fs.stat(settingsPath)).mtimeMs

      await new Promise((resolve) => setTimeout(resolve, 10))

      const providers = [
        {
          packageName            : 'test-package',
          path                   : '/path/to/test-package',
          version                : '1.0.0',
          marketplaceDeclaration : {
            name    : 'test-marketplace',
            owner   : { name : 'Test Owner' },
            plugins : [
              {
                name        : 'test-plugin',
                source      : './plugin',
                version     : '1.0.0',
                description : 'Test plugin',
              },
            ],
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
          packageName            : 'test-package',
          path                   : '/path/to/test-package',
          version                : '1.0.0',
          marketplaceDeclaration : {
            name    : 'test-marketplace',
            owner   : { name : 'Test Owner' },
            plugins : [
              {
                name        : 'test-plugin',
                source      : './plugin',
                version     : '1.0.0',
                description : 'Test plugin',
              },
            ],
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
          packageName            : 'test-package',
          path                   : '/path/to/test-package',
          version                : '1.0.0',
          marketplaceDeclaration : {
            name    : 'test-marketplace',
            owner   : { name : 'Test Owner' },
            plugins : [
              {
                name        : 'test-plugin',
                source      : './plugin',
                version     : '1.0.0',
                description : 'Test plugin',
              },
            ],
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
    it.each([
      {
        description    : 'enabled plugin',
        enabled        : ['test-plugin@test-marketplace'],
        disabled       : [],
        expectedStatus : PLUGIN_STATUSES.ENABLED,
      },
      {
        description    : 'disabled plugin',
        enabled        : [],
        disabled       : ['test-plugin@test-marketplace'],
        expectedStatus : PLUGIN_STATUSES.DISABLED,
      },
      {
        description    : 'unknown plugin',
        enabled        : [],
        disabled       : [],
        pluginName     : 'unknown-plugin',
        marketplace    : 'unknown-marketplace',
        expectedStatus : PLUGIN_STATUSES.NOT_INSTALLED,
      },
    ])(
      'should return $expectedStatus for $description',
      ({ enabled, disabled, pluginName = 'test-plugin', marketplace = 'test-marketplace', expectedStatus }) => {
        const settings = {
          plugins : {
            enabled,
            disabled,
            marketplaces : {},
          },
        }

        expect(getPluginState(pluginName, marketplace, settings)).toBe(expectedStatus)
      }
    )
  })

  describe('getPluginStates', () => {
    it('should return states for all plugins in providers', () => {
      const providers = [
        {
          packageName            : 'package-a',
          path                   : '/path/a',
          version                : '1.0.0',
          marketplaceDeclaration : {
            name    : 'marketplace-a',
            owner   : { name : 'Test' },
            plugins : [
              {
                name        : 'plugin-a',
                source      : './plugin',
                version     : '1.0.0',
                description : 'Plugin A',
              },
            ],
          },
        },
        {
          packageName            : 'package-b',
          path                   : '/path/b',
          version                : '2.0.0',
          marketplaceDeclaration : {
            name    : 'marketplace-b',
            owner   : { name : 'Test' },
            plugins : [
              {
                name        : 'plugin-b',
                source      : './plugin',
                version     : '2.0.0',
                description : 'Plugin B',
              },
            ],
          },
        },
      ]

      const settings = {
        plugins : {
          enabled      : ['plugin-a@marketplace-a'],
          disabled     : ['plugin-b@marketplace-b'],
          marketplaces : {},
        },
      }

      const states = getPluginStates(providers, settings)

      expect(states).toHaveLength(2)
      expect(states[0]).toMatchObject({
        name        : 'plugin-a',
        status      : PLUGIN_STATUSES.ENABLED,
        source      : './plugin',
        version     : '1.0.0',
        description : 'Plugin A',
        marketplace : 'marketplace-a',
      })
      expect(states[1]).toMatchObject({
        name        : 'plugin-b',
        status      : PLUGIN_STATUSES.DISABLED,
        source      : './plugin',
        version     : '2.0.0',
        description : 'Plugin B',
        marketplace : 'marketplace-b',
      })
    })

    it('should handle marketplace with multiple plugins', () => {
      const providers = [
        {
          packageName            : 'multi-package',
          path                   : '/path/multi',
          version                : '1.0.0',
          marketplaceDeclaration : {
            name    : 'multi-marketplace',
            owner   : { name : 'Test' },
            plugins : [
              { name : 'plugin-a', source : './plugins/a', version : '1.0.0', description : 'Plugin A' },
              { name : 'plugin-b', source : './plugins/b', version : '2.0.0', description : 'Plugin B' },
            ],
          },
        },
      ]

      const settings = {
        plugins : {
          enabled      : ['plugin-a@multi-marketplace'],
          disabled     : [],
          marketplaces : {},
        },
      }

      const states = getPluginStates(providers, settings)

      expect(states).toHaveLength(2)
      expect(states[0].name).toBe('plugin-a')
      expect(states[0].status).toBe(PLUGIN_STATUSES.ENABLED)
      expect(states[1].name).toBe('plugin-b')
      expect(states[1].status).toBe(PLUGIN_STATUSES.NOT_INSTALLED)
    })
  })
})
