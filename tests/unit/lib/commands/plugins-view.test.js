import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { pluginsViewCommand } from '_lib/commands/plugins-view'
import { ClaudePluginConfig } from '_lib/storage/claude-config'
import { updateSettings } from '_lib/storage/claude-settings'

import { createPackageJson, createTestPackage } from '../test-lib'

describe('plugins view command', () => {
  let tempDir
  let claudeDir
  let settingsPath

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-view-test-'))
    claudeDir = path.join(tempDir, '.claude')
    await fs.mkdir(claudeDir, { recursive : true })
    settingsPath = path.join(claudeDir, 'settings.json')
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive : true, force : true })
  })

  describe('viewProjectPlugins', () => {
    it('should display plugins for project', async () => {
      await createTestPackage(tempDir, 'test-lib', {
        name        : 'test-plugin',
        version     : '1.0.0',
        description : 'Test plugin',
        skillPath   : '.claude-plugin/skill',
      })
      await createPackageJson(tempDir, ['test-lib'])

      // Capture console output
      const logs = []
      // eslint-disable-next-line no-console
      const originalLog = console.log
      // eslint-disable-next-line no-console
      console.log = (...args) => logs.push(args.join(' '))

      const config = ClaudePluginConfig.createForTest(tempDir)
      await pluginsViewCommand({ path : tempDir, config })

      // eslint-disable-next-line no-console
      console.log = originalLog

      const output = logs.join('\n')

      expect(output).toContain('test-plugin')
      expect(output).toContain('• Not installed')
      expect(output).toContain('Test plugin')
      expect(output).toContain('Summary: 0 enabled, 0 disabled, 1 available')
    })

    it('should show enabled plugin status', async () => {
      await createTestPackage(tempDir, 'enabled-lib', {
        name        : 'enabled-plugin',
        version     : '1.0.0',
        description : 'Enabled plugin',
        skillPath   : '.claude-plugin/skill',
      })
      await createPackageJson(tempDir, ['enabled-lib'])

      // Mark plugin as enabled
      await updateSettings(settingsPath, [
        {
          packageName       : 'enabled-lib',
          path              : path.join(tempDir, 'node_modules', 'enabled-lib'),
          version           : '1.0.0',
          pluginDeclaration : {
            name        : 'enabled-plugin',
            version     : '1.0.0',
            description : 'Enabled plugin',
            skillPath   : '.claude-plugin/skill',
          },
        },
      ])

      const logs = []
      // eslint-disable-next-line no-console
      const originalLog = console.log
      // eslint-disable-next-line no-console
      console.log = (...args) => logs.push(args.join(' '))

      const config = ClaudePluginConfig.createForTest(tempDir)
      await pluginsViewCommand({ path : tempDir, config })

      // eslint-disable-next-line no-console
      console.log = originalLog

      const output = logs.join('\n')

      expect(output).toContain('✓ Enabled')
      expect(output).toContain('Summary: 1 enabled, 0 disabled, 0 available')
    })

    it('should show disabled plugin status', async () => {
      await createTestPackage(tempDir, 'disabled-lib', {
        name        : 'disabled-plugin',
        version     : '1.0.0',
        description : 'Disabled plugin',
        skillPath   : '.claude-plugin/skill',
      })
      await createPackageJson(tempDir, ['disabled-lib'])

      // Create settings with disabled plugin
      await fs.writeFile(
        settingsPath,
        JSON.stringify({
          plugins : {
            enabled      : [],
            disabled     : ['disabled-plugin@disabled-lib-marketplace'],
            marketplaces : {},
          },
        }),
        'utf8'
      )

      const logs = []
      // eslint-disable-next-line no-console
      const originalLog = console.log
      // eslint-disable-next-line no-console
      console.log = (...args) => logs.push(args.join(' '))

      const config = ClaudePluginConfig.createForTest(tempDir)
      await pluginsViewCommand({ path : tempDir, config })

      // eslint-disable-next-line no-console
      console.log = originalLog

      const output = logs.join('\n')

      expect(output).toContain('⊗ Disabled (by user)')
      expect(output).toContain('Summary: 0 enabled, 1 disabled, 0 available')
    })

    it('should handle no plugins found', async () => {
      const logs = []
      // eslint-disable-next-line no-console
      const originalLog = console.log
      // eslint-disable-next-line no-console
      console.log = (...args) => logs.push(args.join(' '))

      const config = ClaudePluginConfig.createForTest(tempDir)
      await pluginsViewCommand({ path : tempDir, config })

      // eslint-disable-next-line no-console
      console.log = originalLog

      const output = logs.join('\n')

      expect(output).toContain('No Claude Code plugins found in dependencies.')
    })

    it('should handle multiple plugins', async () => {
      await createTestPackage(tempDir, 'lib-1', {
        name        : 'plugin-1',
        version     : '1.0.0',
        description : 'First plugin',
        skillPath   : '.claude-plugin/skill',
      })

      await createTestPackage(tempDir, 'lib-2', {
        name        : 'plugin-2',
        version     : '2.0.0',
        description : 'Second plugin',
        skillPath   : '.claude-plugin/skill',
      })
      await createPackageJson(tempDir, ['lib-1', 'lib-2'])

      const logs = []
      // eslint-disable-next-line no-console
      const originalLog = console.log
      // eslint-disable-next-line no-console
      console.log = (...args) => logs.push(args.join(' '))

      const config = ClaudePluginConfig.createForTest(tempDir)
      await pluginsViewCommand({ path : tempDir, config })

      // eslint-disable-next-line no-console
      console.log = originalLog

      const output = logs.join('\n')

      expect(output).toContain('plugin-1')
      expect(output).toContain('plugin-2')
      expect(output).toContain('Summary: 0 enabled, 0 disabled, 2 available')
    })

    it('should show sync warning for not installed plugins', async () => {
      await createTestPackage(tempDir, 'new-lib', {
        name        : 'new-plugin',
        version     : '1.0.0',
        description : 'New plugin',
        skillPath   : '.claude-plugin/skill',
      })
      await createPackageJson(tempDir, ['new-lib'])

      const logs = []
      // eslint-disable-next-line no-console
      const originalLog = console.log
      // eslint-disable-next-line no-console
      console.log = (...args) => logs.push(args.join(' '))

      const config = ClaudePluginConfig.createForTest(tempDir)
      await pluginsViewCommand({ path : tempDir, config })

      // eslint-disable-next-line no-console
      console.log = originalLog

      const output = logs.join('\n')

      expect(output).toContain('⚠️  Run `air sync` to enable new plugins, then restart Claude Code')
    })
  })

  describe('viewAllPlugins', () => {
    it('should display all plugins in settings', async () => {
      // Create settings with plugins
      await fs.writeFile(
        settingsPath,
        JSON.stringify({
          plugins : {
            enabled      : ['plugin-a', 'plugin-b'],
            disabled     : ['plugin-c'],
            marketplaces : {
              'lib-a-marketplace' : {
                source : {
                  type : 'directory',
                  path : '/path/to/lib-a',
                },
                plugins : {
                  'plugin-a' : {
                    version   : '1.0.0',
                    skillPath : '.claude-plugin/skill',
                  },
                },
              },
              'lib-b-marketplace' : {
                source : {
                  type : 'directory',
                  path : '/path/to/lib-b',
                },
                plugins : {
                  'plugin-b' : {
                    version   : '2.0.0',
                    skillPath : '.claude-plugin/skill',
                  },
                },
              },
              'lib-c-marketplace' : {
                source : {
                  type : 'directory',
                  path : '/path/to/lib-c',
                },
                plugins : {
                  'plugin-c' : {
                    version   : '3.0.0',
                    skillPath : '.claude-plugin/skill',
                  },
                },
              },
            },
          },
        }),
        'utf8'
      )

      const logs = []
      // eslint-disable-next-line no-console
      const originalLog = console.log
      // eslint-disable-next-line no-console
      console.log = (...args) => logs.push(args.join(' '))

      const config = ClaudePluginConfig.createForTest(tempDir)
      await pluginsViewCommand({ all : true, config })

      // eslint-disable-next-line no-console
      console.log = originalLog

      const output = logs.join('\n')

      expect(output).toContain('plugin-a')
      expect(output).toContain('plugin-b')
      expect(output).toContain('plugin-c')
      expect(output).toContain('✓ Enabled')
      expect(output).toContain('⊗ Disabled (by user)')
      expect(output).toContain('Summary: 2 enabled, 1 disabled')
    })

    it('should handle no plugins configured', async () => {
      const logs = []
      // eslint-disable-next-line no-console
      const originalLog = console.log
      // eslint-disable-next-line no-console
      console.log = (...args) => logs.push(args.join(' '))

      const config = ClaudePluginConfig.createForTest(tempDir)
      await pluginsViewCommand({ all : true, config })

      // eslint-disable-next-line no-console
      console.log = originalLog

      const output = logs.join('\n')

      expect(output).toContain('No plugins configured.')
    })

    it('should show (not found) for plugins without marketplace entry', async () => {
      // Create settings with plugin but no marketplace
      await fs.writeFile(
        settingsPath,
        JSON.stringify({
          plugins : {
            enabled      : ['orphan-plugin'],
            disabled     : [],
            marketplaces : {},
          },
        }),
        'utf8'
      )

      const logs = []
      // eslint-disable-next-line no-console
      const originalLog = console.log
      // eslint-disable-next-line no-console
      console.log = (...args) => logs.push(args.join(' '))

      const config = ClaudePluginConfig.createForTest(tempDir)
      await pluginsViewCommand({ all : true, config })

      // eslint-disable-next-line no-console
      console.log = originalLog

      const output = logs.join('\n')

      expect(output).toContain('orphan-plugin')
      expect(output).toContain('(not found)')
    })
  })

  describe('error handling', () => {
    it('should handle cache read errors gracefully', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation()

      // Create invalid package.json to trigger error
      await fs.writeFile(path.join(tempDir, 'package.json'), '{invalid json}', 'utf8')

      const config = ClaudePluginConfig.createForTest(tempDir)
      await pluginsViewCommand({ path : tempDir, config })

      expect(exitSpy).toHaveBeenCalledWith(1)

      errorSpy.mockRestore()
      exitSpy.mockRestore()
    })
  })
})
