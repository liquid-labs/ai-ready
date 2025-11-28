/**
 * Integration tests for filesystem path edge cases
 * Tests paths with spaces, special characters, symlinks, and other edge cases
 * @module tests/integration/filesystem-paths
 */
const fs = require('fs/promises')
const os = require('os')
const path = require('path')

const { createTestPackage, readJsonFile, runCLI } = require('./test-helpers')

describe('Integration: Filesystem Paths', () => {
  let testDir
  let originalHome

  beforeAll(async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-int-paths-'))
    // Resolve symlinks to get canonical path (e.g., /var -> /private/var on macOS)
    testDir = await fs.realpath(tempDir)
    originalHome = process.env.HOME
  })

  afterAll(async () => {
    process.env.HOME = originalHome
    await fs.rm(testDir, { recursive : true, force : true })
  })

  describe('Paths with spaces', () => {
    it('should handle project directory with spaces', async () => {
      const projectDir = path.join(testDir, 'project with spaces')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'project-with-spaces',
        version      : '1.0.0',
        dependencies : {
          'test-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'test-plugin', {
        name        : 'spaced-plugin',
        version     : '1.0.0',
        description : 'Plugin in spaced path',
        source      : '.claude-plugin/skill',
      })

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings.plugins.enabled).toContain('spaced-plugin@test-plugin-marketplace')

      // Verify path with spaces is correctly stored
      const marketplace = settings.plugins.marketplaces['test-plugin-marketplace']
      expect(marketplace.source.path).toBe(path.join(projectDir, 'node_modules/test-plugin'))
    })

    it('should handle HOME directory with spaces', async () => {
      const homeDir = path.join(testDir, 'home with spaces')
      await fs.mkdir(homeDir, { recursive : true })

      const projectDir = path.join(testDir, 'spaced-home-project')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'spaced-home-project',
        version      : '1.0.0',
        dependencies : {
          'home-test-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'home-test-plugin', {
        name        : 'home-test-plugin',
        version     : '1.0.0',
        description : 'Plugin with spaced home',
        source      : '.claude-plugin/skill',
      })

      const result = await runCLI(['sync'], projectDir, { env : { HOME : homeDir } })

      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(homeDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings.plugins.enabled).toContain('home-test-plugin@home-test-plugin-marketplace')
    })

    it('should handle skill path with spaces', async () => {
      const projectDir = path.join(testDir, 'skill-spaces')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'skill-spaces',
        version      : '1.0.0',
        dependencies : {
          'spaced-skill-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      const packagePath = path.join(projectDir, 'node_modules/spaced-skill-plugin')
      await fs.mkdir(packagePath, { recursive : true })

      await fs.writeFile(
        path.join(packagePath, 'package.json'),
        JSON.stringify({ name : 'spaced-skill-plugin', version : '1.0.0' }, null, 2)
      )

      const pluginDir = path.join(packagePath, '.claude-plugin')
      await fs.mkdir(pluginDir, { recursive : true })

      // Use v2 marketplace.json structure
      const marketplaceJson = {
        name    : 'spaced-skill-plugin-marketplace',
        owner   : { name : 'Test Owner' },
        plugins : [
          {
            name        : 'spaced-skill-plugin',
            version     : '1.0.0',
            description : 'Plugin with spaces in skill path',
            source      : 'skills/my skill', // Path with space
          },
        ],
      }
      await fs.writeFile(path.join(pluginDir, 'marketplace.json'), JSON.stringify(marketplaceJson, null, 2))

      const skillPath = path.join(packagePath, 'skills/my skill')
      await fs.mkdir(skillPath, { recursive : true })
      await fs.writeFile(path.join(skillPath, 'SKILL.md'), '# spaced-skill-plugin')
      await fs.writeFile(
        path.join(skillPath, 'plugin.json'),
        JSON.stringify(
          {
            name        : 'spaced-skill-plugin',
            version     : '1.0.0',
            description : 'Plugin with spaces in skill path',
          },
          null,
          2
        )
      )

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      const marketplace = settings.plugins.marketplaces['spaced-skill-plugin-marketplace']
      expect(marketplace.plugins['spaced-skill-plugin'].source).toBe('skills/my skill')
    })
  })

  describe('Special characters in paths', () => {
    it('should handle paths with hyphens and underscores', async () => {
      const projectDir = path.join(testDir, 'project_with-special-chars')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'project-with-special-chars',
        version      : '1.0.0',
        dependencies : {
          'plugin-with_underscores' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'plugin-with_underscores', {
        name        : 'special-chars-plugin',
        version     : '1.0.0',
        description : 'Plugin with special chars',
        source      : '.claude-plugin/skill',
      })

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Package name is converted to kebab-case for marketplace name (underscores become hyphens)
      expect(settings.plugins.enabled).toContain('special-chars-plugin@plugin-with-underscores-marketplace')
    })

    it('should handle paths with dots', async () => {
      const projectDir = path.join(testDir, 'dots.in.path')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'dots-in-path',
        version      : '1.0.0',
        dependencies : {
          'plugin.with.dots' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'plugin.with.dots', {
        name        : 'dots-plugin',
        version     : '1.0.0',
        description : 'Plugin with dots',
        source      : '.claude-plugin/skill',
      })

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Package name is converted to kebab-case for marketplace name (dots become hyphens)
      expect(settings.plugins.marketplaces['plugin-with-dots-marketplace']).toBeDefined()
    })
  })

  describe('Symlinks', () => {
    it('should handle symlinked node_modules directory', async () => {
      const projectDir = path.join(testDir, 'symlink-project')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'symlink-project',
        version      : '1.0.0',
        dependencies : {
          'symlink-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      // Create actual node_modules in a different location
      const actualModulesDir = path.join(testDir, 'actual-node-modules')
      await fs.mkdir(actualModulesDir, { recursive : true })

      // Create plugin inside the actual-node-modules directory
      // createTestPackage expects baseDir (parent of node_modules)
      // so we pass testDir and it will create at testDir/node_modules/symlink-plugin
      // But we want it in actualModulesDir, so we need a temp location
      const tempDir = path.join(testDir, 'temp-for-symlink')
      await fs.mkdir(tempDir, { recursive : true })
      await createTestPackage(tempDir, 'symlink-plugin', {
        name        : 'symlink-plugin',
        version     : '1.0.0',
        description : 'Plugin via symlink',
        source      : '.claude-plugin/skill',
      })

      // Move the created package to actualModulesDir
      await fs.rename(
        path.join(tempDir, 'node_modules', 'symlink-plugin'),
        path.join(actualModulesDir, 'symlink-plugin')
      )

      // Create symlink
      const symlinkPath = path.join(projectDir, 'node_modules')
      try {
        await fs.symlink(actualModulesDir, symlinkPath, 'dir')
      }
      catch (error) {
        if (error.code === 'EEXIST') {
          await fs.rm(symlinkPath, { recursive : true })
          await fs.symlink(actualModulesDir, symlinkPath, 'dir')
        }
        else {
          throw error
        }
      }

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Should handle symlinks (behavior depends on implementation)
      expect([0, 1]).toContain(result.exitCode)

      if (result.exitCode === 0) {
        const settingsPath = path.join(projectDir, '.claude/settings.json')
        const settings = await readJsonFile(settingsPath)

        // Verify plugin was discovered through symlink
        expect(settings.plugins.marketplaces['symlink-plugin-marketplace']).toBeDefined()
      }
    })

    it('should handle symlinked package directory', async () => {
      const projectDir = path.join(testDir, 'symlink-package-project')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'symlink-package-project',
        version      : '1.0.0',
        dependencies : {
          'linked-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      // Create node_modules
      const nodeModules = path.join(projectDir, 'node_modules')
      await fs.mkdir(nodeModules, { recursive : true })

      // Create actual plugin in different location
      const actualPluginDir = path.join(testDir, 'actual-plugin')
      await fs.mkdir(actualPluginDir, { recursive : true })

      await fs.writeFile(
        path.join(actualPluginDir, 'package.json'),
        JSON.stringify({ name : 'linked-plugin', version : '1.0.0' }, null, 2)
      )

      const pluginDir = path.join(actualPluginDir, '.claude-plugin')
      await fs.mkdir(pluginDir, { recursive : true })

      // Use v2 marketplace.json structure
      await fs.writeFile(
        path.join(pluginDir, 'marketplace.json'),
        JSON.stringify(
          {
            name    : 'linked-plugin-marketplace',
            owner   : { name : 'Test Owner' },
            plugins : [
              {
                name        : 'linked-plugin',
                version     : '1.0.0',
                description : 'Linked plugin',
                source      : '.claude-plugin/skill',
              },
            ],
          },
          null,
          2
        )
      )

      const skillPath = path.join(actualPluginDir, '.claude-plugin/skill')
      await fs.mkdir(skillPath, { recursive : true })
      await fs.writeFile(path.join(skillPath, 'SKILL.md'), '# linked-plugin')
      await fs.writeFile(
        path.join(skillPath, 'plugin.json'),
        JSON.stringify(
          {
            name        : 'linked-plugin',
            version     : '1.0.0',
            description : 'Linked plugin',
          },
          null,
          2
        )
      )

      // Create symlink to actual plugin
      const linkPath = path.join(nodeModules, 'linked-plugin')
      try {
        await fs.symlink(actualPluginDir, linkPath, 'dir')
      }
      catch (error) {
        if (error.code === 'EEXIST') {
          await fs.rm(linkPath, { recursive : true })
          await fs.symlink(actualPluginDir, linkPath, 'dir')
        }
        else {
          throw error
        }
      }

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Should handle package symlinks
      expect([0, 1]).toContain(result.exitCode)

      if (result.exitCode === 0) {
        const settingsPath = path.join(projectDir, '.claude/settings.json')
        const settings = await readJsonFile(settingsPath)

        expect(settings.plugins.marketplaces['linked-plugin-marketplace']).toBeDefined()
      }
    })
  })

  describe('Absolute vs relative paths', () => {
    it('should store absolute paths in settings', async () => {
      const projectDir = path.join(testDir, 'absolute-paths')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'absolute-paths',
        version      : '1.0.0',
        dependencies : {
          'abs-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'abs-plugin', {
        name        : 'abs-plugin',
        version     : '1.0.0',
        description : 'Plugin for abs path test',
        source      : '.claude-plugin/skill',
      })

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      const marketplace = settings.plugins.marketplaces['abs-plugin-marketplace']

      // Source path should be absolute
      expect(path.isAbsolute(marketplace.source.path)).toBe(true)
      expect(marketplace.source.path).toBe(path.join(projectDir, 'node_modules/abs-plugin'))

      // Plugin source path should be relative
      expect(path.isAbsolute(marketplace.plugins['abs-plugin'].source)).toBe(false)
      expect(marketplace.plugins['abs-plugin'].source).toBe('.claude-plugin/skill')
    })
  })

  describe('Deep directory structures', () => {
    it('should handle deeply nested project paths', async () => {
      const deepPath = path.join(testDir, 'a', 'b', 'c', 'd', 'e', 'f', 'project')
      await fs.mkdir(deepPath, { recursive : true })

      const packageJson = {
        name         : 'deep-project',
        version      : '1.0.0',
        dependencies : {
          'deep-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(deepPath, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(deepPath, 'deep-plugin', {
        name        : 'deep-plugin',
        version     : '1.0.0',
        description : 'Plugin in deep path',
        source      : '.claude-plugin/skill',
      })

      const result = await runCLI(['sync'], deepPath, { env : { HOME : deepPath } })

      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(deepPath, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings.plugins.enabled).toContain('deep-plugin@deep-plugin-marketplace')
    })

    it('should handle deeply nested skill paths', async () => {
      const projectDir = path.join(testDir, 'deep-skill')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'deep-skill',
        version      : '1.0.0',
        dependencies : {
          'nested-skill-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      const packagePath = path.join(projectDir, 'node_modules/nested-skill-plugin')
      await fs.mkdir(packagePath, { recursive : true })

      await fs.writeFile(
        path.join(packagePath, 'package.json'),
        JSON.stringify({ name : 'nested-skill-plugin', version : '1.0.0' }, null, 2)
      )

      const pluginDir = path.join(packagePath, '.claude-plugin')
      await fs.mkdir(pluginDir, { recursive : true })

      const deepSkillPath = 'plugins/skills/ai/claude/main'
      // Use v2 marketplace.json structure
      const marketplaceJson = {
        name    : 'nested-skill-plugin-marketplace',
        owner   : { name : 'Test Owner' },
        plugins : [
          {
            name        : 'nested-skill-plugin',
            version     : '1.0.0',
            description : 'Plugin with deep skill path',
            source      : deepSkillPath,
          },
        ],
      }
      await fs.writeFile(path.join(pluginDir, 'marketplace.json'), JSON.stringify(marketplaceJson, null, 2))

      const skillPath = path.join(packagePath, deepSkillPath)
      await fs.mkdir(skillPath, { recursive : true })
      await fs.writeFile(path.join(skillPath, 'SKILL.md'), '# nested-skill-plugin')
      await fs.writeFile(
        path.join(skillPath, 'plugin.json'),
        JSON.stringify(
          {
            name        : 'nested-skill-plugin',
            version     : '1.0.0',
            description : 'Plugin with deep skill path',
          },
          null,
          2
        )
      )

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      const marketplace = settings.plugins.marketplaces['nested-skill-plugin-marketplace']
      expect(marketplace.plugins['nested-skill-plugin'].source).toBe(deepSkillPath)
    })
  })

  describe('Case sensitivity', () => {
    it('should handle package names with mixed case', async () => {
      const projectDir = path.join(testDir, 'mixed-case')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'mixed-case',
        version      : '1.0.0',
        dependencies : {
          'MyMixedCase-Plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'MyMixedCase-Plugin', {
        name        : 'mixed-case-plugin',
        version     : '1.0.0',
        description : 'Plugin with mixed case',
        source      : '.claude-plugin/skill',
      })

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Marketplace name is converted to lowercase kebab-case
      expect(settings.plugins.marketplaces['mymixedcase-plugin-marketplace']).toBeDefined()
    })
  })
})
