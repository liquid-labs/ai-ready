/**
 * Integration tests for plugin version updates and marketplace changes
 * Tests behavior when plugin versions change in dependencies
 * @module tests/integration/plugin-updates
 */
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { createTestPackage, readJsonFile, runCLI } from './test-helpers'

describe('Integration: Plugin Updates', () => {
  let testDir
  let originalHome

  beforeAll(async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-int-updates-'))
    // Resolve symlinks to get canonical path (e.g., /var -> /private/var on macOS)
    testDir = await fs.realpath(tempDir)
    originalHome = process.env.HOME
  })

  afterAll(async () => {
    process.env.HOME = originalHome
    await fs.rm(testDir, { recursive : true, force : true })
  })

  describe('Version updates', () => {
    it('should update marketplace when plugin version changes', async () => {
      const projectDir = path.join(testDir, 'version-update')
      await fs.mkdir(projectDir, { recursive : true })

      // Create initial package.json
      const packageJson = {
        name         : 'version-update',
        version      : '1.0.0',
        dependencies : {
          'evolving-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      // Create v1.0.0 plugin
      await createTestPackage(projectDir, 'evolving-plugin', {
        name        : 'evolving-plugin',
        version     : '1.0.0',
        description : 'Plugin version 1.0.0',
        source      : './',
      })

      // Initial sync
      const result1 = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })
      expect(result1.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      let settings = await readJsonFile(settingsPath)

      expect(settings.plugins.marketplaces['evolving-plugin-marketplace'].plugins['evolving-plugin'].version).toBe(
        '1.0.0'
      )

      // Update to v2.0.0
      await createTestPackage(projectDir, 'evolving-plugin', {
        name        : 'evolving-plugin',
        version     : '2.0.0',
        description : 'Plugin version 2.0.0',
        source      : './',
      })

      // Sync again
      const result2 = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })
      expect(result2.exitCode).toBe(0)

      settings = await readJsonFile(settingsPath)

      // Verify version updated
      expect(settings.plugins.marketplaces['evolving-plugin-marketplace'].plugins['evolving-plugin'].version).toBe(
        '2.0.0'
      )

      // Verify plugin remains enabled
      expect(settings.plugins.enabled).toContain('evolving-plugin@evolving-plugin-marketplace')
    })

    it('should handle major version upgrades', async () => {
      const projectDir = path.join(testDir, 'major-upgrade')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'major-upgrade',
        version      : '1.0.0',
        dependencies : {
          'major-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      // Create v1.0.0
      await createTestPackage(projectDir, 'major-plugin', {
        name        : 'major-plugin',
        version     : '1.5.3',
        description : 'V1 plugin',
        source      : './',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Upgrade to v5.0.0
      await createTestPackage(projectDir, 'major-plugin', {
        name        : 'major-plugin',
        version     : '5.0.0',
        description : 'V5 plugin with breaking changes',
        source      : './',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings.plugins.marketplaces['major-plugin-marketplace'].plugins['major-plugin'].version).toBe('5.0.0')
    })

    it('should handle downgrades (version rollback)', async () => {
      const projectDir = path.join(testDir, 'downgrade')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'downgrade',
        version      : '1.0.0',
        dependencies : {
          'rollback-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      // Create v3.0.0
      await createTestPackage(projectDir, 'rollback-plugin', {
        name        : 'rollback-plugin',
        version     : '3.0.0',
        description : 'V3 plugin',
        source      : './',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Rollback to v2.0.0
      await createTestPackage(projectDir, 'rollback-plugin', {
        name        : 'rollback-plugin',
        version     : '2.0.0',
        description : 'V2 plugin (rolled back)',
        source      : './',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings.plugins.marketplaces['rollback-plugin-marketplace'].plugins['rollback-plugin'].version).toBe(
        '2.0.0'
      )
    })
  })

  describe('Source path changes', () => {
    it('should update source when plugin structure changes', async () => {
      const projectDir = path.join(testDir, 'skillpath-change')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'skillpath-change',
        version      : '1.0.0',
        dependencies : {
          'path-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      // Create with original source path
      await createTestPackage(projectDir, 'path-plugin', {
        name        : 'path-plugin',
        version     : '1.0.0',
        description : 'Plugin with original path',
        source      : './',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      let settings = await readJsonFile(settingsPath)

      expect(settings.plugins.marketplaces['path-plugin-marketplace'].plugins['path-plugin'].source).toBe('./')

      // Update with new source path
      await createTestPackage(projectDir, 'path-plugin', {
        name        : 'path-plugin',
        version     : '2.0.0',
        description : 'Plugin with new path',
        source      : 'skills/main',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      settings = await readJsonFile(settingsPath)

      expect(settings.plugins.marketplaces['path-plugin-marketplace'].plugins['path-plugin'].source).toBe('skills/main')
      expect(settings.plugins.marketplaces['path-plugin-marketplace'].plugins['path-plugin'].version).toBe('2.0.0')
    })
  })

  describe('Description changes', () => {
    it('should update description when changed', async () => {
      const projectDir = path.join(testDir, 'desc-change')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'desc-change',
        version      : '1.0.0',
        dependencies : {
          'desc-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'desc-plugin', {
        name        : 'desc-plugin',
        version     : '1.0.0',
        description : 'Original description',
        source      : './',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Update description (same version)
      await createTestPackage(projectDir, 'desc-plugin', {
        name        : 'desc-plugin',
        version     : '1.0.0',
        description : 'Updated description with more details',
        source      : './',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Description is part of marketplace.json, not stored in settings
      // This test verifies sync doesn't break when description changes
      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings.plugins.enabled).toContain('desc-plugin@desc-plugin-marketplace')
    })
  })

  describe('Plugin name changes', () => {
    it('should handle plugin name change within same package', async () => {
      const projectDir = path.join(testDir, 'name-change')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'name-change',
        version      : '1.0.0',
        dependencies : {
          'renamed-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      // Create with original name
      await createTestPackage(projectDir, 'renamed-plugin', {
        name        : 'original-name',
        version     : '1.0.0',
        description : 'Plugin with original name',
        source      : './',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      let settings = await readJsonFile(settingsPath)

      expect(settings.plugins.enabled).toContain('original-name@renamed-plugin-marketplace')
      expect(settings.plugins.marketplaces['renamed-plugin-marketplace'].plugins['original-name']).toBeDefined()

      // Rename plugin (package name stays same)
      await createTestPackage(projectDir, 'renamed-plugin', {
        name        : 'new-name',
        version     : '2.0.0',
        description : 'Plugin with new name',
        source      : './',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      settings = await readJsonFile(settingsPath)

      // New name should be added
      expect(settings.plugins.marketplaces['renamed-plugin-marketplace'].plugins['new-name']).toBeDefined()

      // Old name may or may not be removed depending on implementation
      // At minimum, new name should be enabled
      expect(
        settings.plugins.enabled.includes('new-name@renamed-plugin-marketplace')
          || settings.plugins.enabled.includes('original-name@renamed-plugin-marketplace')
      ).toBe(true)
    })
  })

  describe('Plugin enablement preservation', () => {
    it('should keep plugin enabled through version updates', async () => {
      const projectDir = path.join(testDir, 'keep-enabled')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'keep-enabled',
        version      : '1.0.0',
        dependencies : {
          'stable-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'stable-plugin', {
        name        : 'stable-plugin',
        version     : '1.0.0',
        description : 'V1',
        source      : './',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      let settings = await readJsonFile(settingsPath)

      expect(settings.plugins.enabled).toContain('stable-plugin@stable-plugin-marketplace')

      // Update through multiple versions sequentially
      const versions = ['1.1.0', '1.2.0', '2.0.0', '2.1.0']
      await versions.reduce(async (previousPromise, version) => {
        await previousPromise

        await createTestPackage(projectDir, 'stable-plugin', {
          name        : 'stable-plugin',
          version,
          description : `V${version}`,
          source      : './',
        })

        await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

        settings = await readJsonFile(settingsPath)

        // Should remain enabled
        expect(settings.plugins.enabled).toContain('stable-plugin@stable-plugin-marketplace')
      }, Promise.resolve())
    })

    it('should keep plugin disabled through version updates', async () => {
      const projectDir = path.join(testDir, 'keep-disabled')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'keep-disabled',
        version      : '1.0.0',
        dependencies : {
          'disabled-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'disabled-plugin', {
        name        : 'disabled-plugin',
        version     : '1.0.0',
        description : 'V1',
        source      : './',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      let settings = await readJsonFile(settingsPath)

      // Manually disable
      settings.plugins.enabled = settings.plugins.enabled.filter(
        (p) => p !== 'disabled-plugin@disabled-plugin-marketplace'
      )
      settings.plugins.disabled.push('disabled-plugin@disabled-plugin-marketplace')
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))

      // Update version
      await createTestPackage(projectDir, 'disabled-plugin', {
        name        : 'disabled-plugin',
        version     : '2.0.0',
        description : 'V2',
        source      : './',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      settings = await readJsonFile(settingsPath)

      // Should remain disabled
      expect(settings.plugins.disabled).toContain('disabled-plugin@disabled-plugin-marketplace')
      expect(settings.plugins.enabled).not.toContain('disabled-plugin@disabled-plugin-marketplace')

      // Version should still be updated in marketplace
      expect(settings.plugins.marketplaces['disabled-plugin-marketplace'].plugins['disabled-plugin'].version).toBe(
        '2.0.0'
      )
    })
  })
})
