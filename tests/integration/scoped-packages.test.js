/**
 * Integration tests for scoped package resolution (@scope/package)
 * Tests proper handling of npm scoped packages in plugin discovery and settings
 * @module tests/integration/scoped-packages
 */
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { createTestPackage, readJsonFile, runCLI } from './test-helpers'

describe('Integration: Scoped Packages', () => {
  let testDir
  let originalHome

  beforeAll(async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-int-scoped-'))
    // Resolve symlinks to get canonical path (e.g., /var -> /private/var on macOS)
    testDir = await fs.realpath(tempDir)
    originalHome = process.env.HOME
    process.env.HOME = testDir
  })

  afterAll(async () => {
    process.env.HOME = originalHome
    await fs.rm(testDir, { recursive : true, force : true })
  })

  describe('Basic scoped package handling', () => {
    it('should discover and enable plugin from scoped package', async () => {
      const projectDir = path.join(testDir, 'basic-scoped')
      await fs.mkdir(projectDir, { recursive : true })

      // Create package.json with scoped dependency
      const packageJson = {
        name         : 'basic-scoped',
        version      : '1.0.0',
        dependencies : {
          '@myorg/ai-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      // Create scoped package
      await createTestPackage(projectDir, '@myorg/ai-plugin', {
        name        : 'my-org-plugin',
        version     : '1.0.0',
        description : 'Scoped organization plugin',
        source      : '.claude-plugin/skill',
      })

      // Run sync
      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Verify plugin was enabled with correct marketplace name
      expect(settings.plugins.enabled).toContain('my-org-plugin@myorg-ai-plugin-marketplace')

      // Verify marketplace was created with correct name (scope removed from marketplace name)
      expect(settings.plugins.marketplaces['myorg-ai-plugin-marketplace']).toBeDefined()

      // Verify path resolution is correct for scoped package
      const marketplace = settings.plugins.marketplaces['myorg-ai-plugin-marketplace']
      expect(marketplace.source.path).toBe(path.join(projectDir, 'node_modules/@myorg/ai-plugin'))
      expect(marketplace.plugins['my-org-plugin']).toBeDefined()
    })

    it('should handle multiple scoped packages from different orgs', async () => {
      const projectDir = path.join(testDir, 'multi-org')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'multi-org',
        version      : '1.0.0',
        dependencies : {
          '@orgA/plugin' : '1.0.0',
          '@orgB/plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, '@orgA/plugin', {
        name        : 'org-a-plugin',
        version     : '1.0.0',
        description : 'Organization A plugin',
        source      : '.claude-plugin/skill',
      })

      await createTestPackage(projectDir, '@orgB/plugin', {
        name        : 'org-b-plugin',
        version     : '1.0.0',
        description : 'Organization B plugin',
        source      : '.claude-plugin/skill',
      })

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Verify both plugins enabled
      expect(settings.plugins.enabled).toContain('org-a-plugin@orga-plugin-marketplace')
      expect(settings.plugins.enabled).toContain('org-b-plugin@orgb-plugin-marketplace')

      // Verify both marketplaces
      expect(settings.plugins.marketplaces['orga-plugin-marketplace']).toBeDefined()
      expect(settings.plugins.marketplaces['orgb-plugin-marketplace']).toBeDefined()
    })

    it('should handle scoped and non-scoped packages together', async () => {
      const projectDir = path.join(testDir, 'mixed-scoped')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'mixed-scoped',
        version      : '1.0.0',
        dependencies : {
          '@scoped/plugin' : '1.0.0',
          'regular-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, '@scoped/plugin', {
        name        : 'scoped-plugin',
        version     : '1.0.0',
        description : 'Scoped plugin',
        source      : '.claude-plugin/skill',
      })

      await createTestPackage(projectDir, 'regular-plugin', {
        name        : 'regular-plugin',
        version     : '1.0.0',
        description : 'Regular plugin',
        source      : '.claude-plugin/skill',
      })

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Both should be enabled
      expect(settings.plugins.enabled).toContain('scoped-plugin@scoped-plugin-marketplace')
      expect(settings.plugins.enabled).toContain('regular-plugin@regular-plugin-marketplace')
    })
  })

  describe('Scoped package marketplace naming', () => {
    it('should use correct marketplace name format for scoped packages', async () => {
      const projectDir = path.join(testDir, 'marketplace-naming')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'marketplace-naming',
        version      : '1.0.0',
        dependencies : {
          '@company/awesome-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, '@company/awesome-plugin', {
        name        : 'awesome-plugin',
        version     : '1.0.0',
        description : 'Awesome plugin',
        source      : '.claude-plugin/skill',
      })

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Marketplace name should be: scope-package-marketplace (kebab-case)
      expect(settings.plugins.marketplaces['company-awesome-plugin-marketplace']).toBeDefined()

      // Plugin key should reference correct marketplace
      expect(settings.plugins.enabled).toContain('awesome-plugin@company-awesome-plugin-marketplace')
    })

    it('should handle complex scoped package names', async () => {
      const projectDir = path.join(testDir, 'complex-scoped')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'complex-scoped',
        version      : '1.0.0',
        dependencies : {
          '@my-org/my-ai-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, '@my-org/my-ai-plugin', {
        name        : 'my-ai-plugin',
        version     : '1.0.0',
        description : 'AI plugin with hyphens',
        source      : '.claude-plugin/skill',
      })

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Should handle hyphens in both scope and package name
      expect(settings.plugins.marketplaces['my-org-my-ai-plugin-marketplace']).toBeDefined()
    })
  })

  describe('Scoped package path resolution', () => {
    it('should resolve correct file paths for scoped packages', async () => {
      const projectDir = path.join(testDir, 'path-resolution')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'path-resolution',
        version      : '1.0.0',
        dependencies : {
          '@test/scoped-path' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, '@test/scoped-path', {
        name        : 'scoped-path-plugin',
        version     : '1.0.0',
        description : 'Plugin for path testing',
        source      : '.claude-plugin/skill',
      })

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      const marketplace = settings.plugins.marketplaces['test-scoped-path-marketplace']

      // Source path should include scope directory
      expect(marketplace.source.path).toBe(path.join(projectDir, 'node_modules/@test/scoped-path'))

      // Plugin source should be relative within the package
      expect(marketplace.plugins['scoped-path-plugin'].source).toBe('.claude-plugin/skill')
    })

    it('should verify skill directory exists in scoped package', async () => {
      const projectDir = path.join(testDir, 'verify-skill')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'verify-skill',
        version      : '1.0.0',
        dependencies : {
          '@verify/plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, '@verify/plugin', {
        name        : 'verify-plugin',
        version     : '1.0.0',
        description : 'Plugin to verify skill',
        source      : '.claude-plugin/skill',
      })

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      // Verify SKILL.md was created in correct location
      const skillFilePath = path.join(projectDir, 'node_modules/@verify/plugin/.claude-plugin/skill/SKILL.md')
      const skillContent = await fs.readFile(skillFilePath, 'utf8')

      expect(skillContent).toContain('verify-plugin')
    })
  })

  describe('View command with scoped packages', () => {
    it('should display scoped packages correctly in view output', async () => {
      const projectDir = path.join(testDir, 'view-scoped')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'view-scoped',
        version      : '1.0.0',
        dependencies : {
          '@view/test-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, '@view/test-plugin', {
        name        : 'view-test-plugin',
        version     : '1.0.0',
        description : 'Plugin for view testing',
        source      : '.claude-plugin/skill',
      })

      // Sync first
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Run view
      const viewResult = await runCLI(['plugins', 'view'], projectDir, { env : { HOME : projectDir } })

      expect(viewResult.exitCode).toBe(0)
      expect(viewResult.stdout).toContain('view-test-plugin')
      expect(viewResult.stdout).toContain('enabled')
    })
  })

  describe('Error handling with scoped packages', () => {
    it('should handle missing scoped package gracefully', async () => {
      const projectDir = path.join(testDir, 'missing-scoped')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'missing-scoped',
        version      : '1.0.0',
        dependencies : {
          '@missing/plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      // Don't create the package (simulate missing node_modules)

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Should succeed but not enable the missing plugin
      expect(result.exitCode).toBe(0)
    })

    it('should handle scoped package without plugin declaration', async () => {
      const projectDir = path.join(testDir, 'no-plugin-decl')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'no-plugin-decl',
        version      : '1.0.0',
        dependencies : {
          '@noplugin/package' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      // Create package without .claude-plugin
      const packagePath = path.join(projectDir, 'node_modules/@noplugin/package')
      await fs.mkdir(packagePath, { recursive : true })

      const pkgJson = {
        name    : '@noplugin/package',
        version : '1.0.0',
      }
      await fs.writeFile(path.join(packagePath, 'package.json'), JSON.stringify(pkgJson, null, 2))

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Should not create marketplace for package without plugin
      expect(settings.plugins.marketplaces['noplugin-package-marketplace']).toBeUndefined()
    })
  })
})
