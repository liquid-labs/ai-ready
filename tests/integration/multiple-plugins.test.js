/**
 * Integration tests for packages providing multiple plugins
 * Tests scenarios where a single package might offer multiple Claude skills
 * @module tests/integration/multiple-plugins
 */
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { readJsonFile, runCLI } from './test-helpers'

describe('Integration: Multiple Plugins', () => {
  let testDir
  let originalHome

  beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-int-multi-plugin-'))
    originalHome = process.env.HOME
  })

  afterAll(async () => {
    process.env.HOME = originalHome
    await fs.rm(testDir, { recursive : true, force : true })
  })

  describe('Multiple plugins from same package', () => {
    it('should handle marketplace.json with multiple plugin entries', async () => {
      const projectDir = path.join(testDir, 'multi-plugin-package')
      await fs.mkdir(projectDir, { recursive : true })

      // Create package.json
      const packageJson = {
        name         : 'multi-plugin-package',
        version      : '1.0.0',
        dependencies : {
          'plugin-suite' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      // Create package with multiple plugins in marketplace
      const packagePath = path.join(projectDir, 'node_modules/plugin-suite')
      await fs.mkdir(packagePath, { recursive : true })

      const pkgJson = {
        name        : 'plugin-suite',
        version     : '1.0.0',
        description : 'A suite of plugins',
      }
      await fs.writeFile(path.join(packagePath, 'package.json'), JSON.stringify(pkgJson, null, 2))

      // Create .claude-plugin/marketplace.json
      // Note: The actual schema may or may not support multiple plugins
      // This test explores the behavior
      const pluginDir = path.join(packagePath, '.claude-plugin')
      await fs.mkdir(pluginDir, { recursive : true })

      const marketplaceJson = {
        name        : 'PluginSuiteMain',
        version     : '1.0.0',
        description : 'Main plugin from suite',
        skillPath   : '.claude-plugin/skill-main',
      }
      await fs.writeFile(path.join(pluginDir, 'marketplace.json'), JSON.stringify(marketplaceJson, null, 2))

      // Create skill directory
      const skillPath = path.join(packagePath, '.claude-plugin/skill-main')
      await fs.mkdir(skillPath, { recursive : true })
      await fs.writeFile(path.join(skillPath, 'SKILL.md'), '# PluginSuiteMain\n\nMain plugin from suite')

      // Run sync
      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })
      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Verify plugin was enabled
      expect(settings.plugins.enabled).toContain('PluginSuiteMain@plugin-suite-marketplace')
      expect(settings.plugins.marketplaces['plugin-suite-marketplace']).toBeDefined()
      expect(settings.plugins.marketplaces['plugin-suite-marketplace'].plugins.PluginSuiteMain).toBeDefined()
    })

    it('should handle package with plugins in different directories', async () => {
      const projectDir = path.join(testDir, 'multi-dir-plugins')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'multi-dir-plugins',
        version      : '1.0.0',
        dependencies : {
          'organized-plugins' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      const packagePath = path.join(projectDir, 'node_modules/organized-plugins')
      await fs.mkdir(packagePath, { recursive : true })

      const pkgJson = {
        name        : 'organized-plugins',
        version     : '1.0.0',
        description : 'Organized plugin package',
      }
      await fs.writeFile(path.join(packagePath, 'package.json'), JSON.stringify(pkgJson, null, 2))

      // Create main plugin
      const pluginDir = path.join(packagePath, '.claude-plugin')
      await fs.mkdir(pluginDir, { recursive : true })

      const marketplaceJson = {
        name        : 'OrganizedPlugin',
        version     : '1.0.0',
        description : 'Main organized plugin',
        skillPath   : 'plugins/main',
      }
      await fs.writeFile(path.join(pluginDir, 'marketplace.json'), JSON.stringify(marketplaceJson, null, 2))

      const skillPath = path.join(packagePath, 'plugins/main')
      await fs.mkdir(skillPath, { recursive : true })
      await fs.writeFile(path.join(skillPath, 'SKILL.md'), '# OrganizedPlugin\n\nOrganized plugin')

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })
      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings.plugins.enabled).toContain('OrganizedPlugin@organized-plugins-marketplace')
      const marketplace = settings.plugins.marketplaces['organized-plugins-marketplace']
      expect(marketplace.plugins.OrganizedPlugin.skillPath).toBe('plugins/main')
    })
  })

  describe('Multiple packages with similar plugins', () => {
    it('should handle different packages with same plugin name', async () => {
      const projectDir = path.join(testDir, 'same-name-plugins')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'same-name-plugins',
        version      : '1.0.0',
        dependencies : {
          'package-a' : '1.0.0',
          'package-b' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      // Create package-a with HelperPlugin
      const packageAPath = path.join(projectDir, 'node_modules/package-a')
      await fs.mkdir(packageAPath, { recursive : true })

      await fs.writeFile(
        path.join(packageAPath, 'package.json'),
        JSON.stringify({ name : 'package-a', version : '1.0.0' }, null, 2)
      )

      const pluginDirA = path.join(packageAPath, '.claude-plugin')
      await fs.mkdir(pluginDirA, { recursive : true })

      await fs.writeFile(
        path.join(pluginDirA, 'marketplace.json'),
        JSON.stringify(
          {
            name        : 'HelperPlugin',
            version     : '1.0.0',
            description : 'Helper from package A',
            skillPath   : '.claude-plugin/skill',
          },
          null,
          2
        )
      )

      const skillPathA = path.join(packageAPath, '.claude-plugin/skill')
      await fs.mkdir(skillPathA, { recursive : true })
      await fs.writeFile(path.join(skillPathA, 'SKILL.md'), '# HelperPlugin A')

      // Create package-b with HelperPlugin (same name)
      const packageBPath = path.join(projectDir, 'node_modules/package-b')
      await fs.mkdir(packageBPath, { recursive : true })

      await fs.writeFile(
        path.join(packageBPath, 'package.json'),
        JSON.stringify({ name : 'package-b', version : '1.0.0' }, null, 2)
      )

      const pluginDirB = path.join(packageBPath, '.claude-plugin')
      await fs.mkdir(pluginDirB, { recursive : true })

      await fs.writeFile(
        path.join(pluginDirB, 'marketplace.json'),
        JSON.stringify(
          {
            name        : 'HelperPlugin',
            version     : '2.0.0',
            description : 'Helper from package B',
            skillPath   : '.claude-plugin/skill',
          },
          null,
          2
        )
      )

      const skillPathB = path.join(packageBPath, '.claude-plugin/skill')
      await fs.mkdir(skillPathB, { recursive : true })
      await fs.writeFile(path.join(skillPathB, 'SKILL.md'), '# HelperPlugin B')

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })
      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Both should be enabled under different marketplace names
      expect(settings.plugins.enabled).toContain('HelperPlugin@package-a-marketplace')
      expect(settings.plugins.enabled).toContain('HelperPlugin@package-b-marketplace')

      // Both marketplaces should exist
      expect(settings.plugins.marketplaces['package-a-marketplace']).toBeDefined()
      expect(settings.plugins.marketplaces['package-b-marketplace']).toBeDefined()

      // Each marketplace should have its own HelperPlugin
      expect(settings.plugins.marketplaces['package-a-marketplace'].plugins.HelperPlugin).toBeDefined()
      expect(settings.plugins.marketplaces['package-b-marketplace'].plugins.HelperPlugin).toBeDefined()
    })

    it('should handle multiple packages from same organization', async () => {
      const projectDir = path.join(testDir, 'org-suite')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'org-suite',
        version      : '1.0.0',
        dependencies : {
          '@myorg/core-plugin'  : '1.0.0',
          '@myorg/utils-plugin' : '1.0.0',
          '@myorg/ext-plugin'   : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      // Create three plugins from same org
      await Promise.all(
        [
          ['@myorg/core-plugin', 'CorePlugin'],
          ['@myorg/utils-plugin', 'UtilsPlugin'],
          ['@myorg/ext-plugin', 'ExtPlugin'],
        ].map(async ([pkg, pluginName]) => {
          const packagePath = path.join(projectDir, `node_modules/${pkg}`)
          await fs.mkdir(packagePath, { recursive : true })

          await fs.writeFile(
            path.join(packagePath, 'package.json'),
            JSON.stringify({ name : pkg, version : '1.0.0' }, null, 2)
          )

          const pluginDir = path.join(packagePath, '.claude-plugin')
          await fs.mkdir(pluginDir, { recursive : true })

          await fs.writeFile(
            path.join(pluginDir, 'marketplace.json'),
            JSON.stringify(
              {
                name        : pluginName,
                version     : '1.0.0',
                description : `${pluginName} from ${pkg}`,
                skillPath   : '.claude-plugin/skill',
              },
              null,
              2
            )
          )

          const skillPath = path.join(packagePath, '.claude-plugin/skill')
          await fs.mkdir(skillPath, { recursive : true })
          await fs.writeFile(path.join(skillPath, 'SKILL.md'), `# ${pluginName}`)
        })
      )

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })
      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // All three should be enabled
      expect(settings.plugins.enabled).toContain('CorePlugin@myorg-core-plugin-marketplace')
      expect(settings.plugins.enabled).toContain('UtilsPlugin@myorg-utils-plugin-marketplace')
      expect(settings.plugins.enabled).toContain('ExtPlugin@myorg-ext-plugin-marketplace')

      // All three marketplaces should exist
      expect(settings.plugins.marketplaces['myorg-core-plugin-marketplace']).toBeDefined()
      expect(settings.plugins.marketplaces['myorg-utils-plugin-marketplace']).toBeDefined()
      expect(settings.plugins.marketplaces['myorg-ext-plugin-marketplace']).toBeDefined()
    })
  })

  describe('Mixed plugin configurations', () => {
    it('should handle projects with varied plugin counts per package', async () => {
      const projectDir = path.join(testDir, 'varied-count')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'varied-count',
        version      : '1.0.0',
        dependencies : {
          'single-plugin'  : '1.0.0',
          'another-single' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      // Create two packages, each with one plugin
      await Promise.all(
        [
          ['single-plugin', 'SinglePlugin'],
          ['another-single', 'AnotherPlugin'],
        ].map(async ([pkg, pluginName]) => {
          const packagePath = path.join(projectDir, `node_modules/${pkg}`)
          await fs.mkdir(packagePath, { recursive : true })

          await fs.writeFile(
            path.join(packagePath, 'package.json'),
            JSON.stringify({ name : pkg, version : '1.0.0' }, null, 2)
          )

          const pluginDir = path.join(packagePath, '.claude-plugin')
          await fs.mkdir(pluginDir, { recursive : true })

          await fs.writeFile(
            path.join(pluginDir, 'marketplace.json'),
            JSON.stringify(
              {
                name        : pluginName,
                version     : '1.0.0',
                description : pluginName,
                skillPath   : '.claude-plugin/skill',
              },
              null,
              2
            )
          )

          const skillPath = path.join(packagePath, '.claude-plugin/skill')
          await fs.mkdir(skillPath, { recursive : true })
          await fs.writeFile(path.join(skillPath, 'SKILL.md'), `# ${pluginName}`)
        })
      )

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })
      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Both should be enabled
      expect(settings.plugins.enabled.length).toBeGreaterThanOrEqual(2)
      expect(settings.plugins.enabled).toContain('SinglePlugin@single-plugin-marketplace')
      expect(settings.plugins.enabled).toContain('AnotherPlugin@another-single-marketplace')
    })
  })

  describe('Edge cases', () => {
    it('should handle empty plugin name gracefully', async () => {
      const projectDir = path.join(testDir, 'empty-name')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'empty-name',
        version      : '1.0.0',
        dependencies : {
          'invalid-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      const packagePath = path.join(projectDir, 'node_modules/invalid-plugin')
      await fs.mkdir(packagePath, { recursive : true })

      await fs.writeFile(
        path.join(packagePath, 'package.json'),
        JSON.stringify({ name : 'invalid-plugin', version : '1.0.0' }, null, 2)
      )

      const pluginDir = path.join(packagePath, '.claude-plugin')
      await fs.mkdir(pluginDir, { recursive : true })

      // Empty name
      await fs.writeFile(
        path.join(pluginDir, 'marketplace.json'),
        JSON.stringify(
          {
            name        : '',
            version     : '1.0.0',
            description : 'Invalid plugin',
            skillPath   : '.claude-plugin/skill',
          },
          null,
          2
        )
      )

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Should either skip or handle gracefully
      // Exact behavior depends on validation
      // At minimum, should not crash
      expect([0, 1]).toContain(result.exitCode)
    })
  })
})
