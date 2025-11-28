/**
 * Integration tests for complete sync workflow
 * Tests end-to-end behavior of `air sync` command with settings verification
 * @module tests/integration/sync-workflow
 */
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import {
  createTestPackage,
  fileExists,
  readJsonFile,
  runCLI,
  setupTestProject,
  verifySettingsStructure
} from './test-helpers'

describe('Integration: Sync Workflow', () => {
  let testDir
  let originalHome

  beforeAll(async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-int-sync-'))
    // Resolve symlinks to get canonical path (e.g., /var -> /private/var on macOS)
    testDir = await fs.realpath(tempDir)
    originalHome = process.env.HOME
    process.env.HOME = testDir
  })

  afterAll(async () => {
    process.env.HOME = originalHome
    await fs.rm(testDir, { recursive : true, force : true })
  })

  describe('Initial sync with empty settings', () => {
    it('should discover and enable plugins from dependencies', async () => {
      await setupTestProject(testDir, { projectName : 'test-project' })

      const result = await runCLI(['sync'], testDir)

      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(testDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Verify plugins were enabled
      expect(settings.plugins.enabled).toContain('test-plugin@test-plugin-marketplace')
      expect(settings.plugins.enabled).toContain('scoped-plugin@scoped-plugin-marketplace')

      // Verify marketplaces were created
      expect(settings.plugins.marketplaces['test-plugin-marketplace']).toBeDefined()
      expect(settings.plugins.marketplaces['scoped-plugin-marketplace']).toBeDefined()

      // Verify marketplace structure
      const testMarketplace = settings.plugins.marketplaces['test-plugin-marketplace']
      expect(testMarketplace.source.type).toBe('directory')
      expect(testMarketplace.source.path).toBe(path.join(testDir, 'node_modules/test-plugin'))
      expect(testMarketplace.plugins['test-plugin']).toBeDefined()
      expect(testMarketplace.plugins['test-plugin'].version).toBe('1.0.0')
      expect(testMarketplace.plugins['test-plugin'].source).toBe('./')
    })

    it('should create settings file if it does not exist', async () => {
      const projectDir = path.join(testDir, 'no-settings-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'no-settings-project' })

      // Remove settings file
      const settingsPath = path.join(projectDir, '.claude/settings.json')
      await fs.rm(settingsPath, { force : true })

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      // Verify settings file was created
      expect(await fileExists(settingsPath)).toBe(true)

      const settings = await readJsonFile(settingsPath)
      expect(settings.plugins).toBeDefined()
      expect(settings.plugins.enabled).toContain('test-plugin@test-plugin-marketplace')
    })

    it('should handle projects with no plugins gracefully', async () => {
      const projectDir = path.join(testDir, 'no-plugins-project')
      await fs.mkdir(projectDir, { recursive : true })

      // Create package.json with no dependencies
      const packageJson = {
        name    : 'no-plugins-project',
        version : '1.0.0',
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      // Create empty node_modules
      await fs.mkdir(path.join(projectDir, 'node_modules'), { recursive : true })

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Verify empty but valid structure
      expect(settings.plugins.enabled).toEqual([])
      expect(settings.plugins.disabled).toEqual([])
      expect(settings.plugins.marketplaces).toEqual({})
    })
  })

  describe('Idempotent behavior', () => {
    it('should not duplicate entries when run multiple times', async () => {
      const projectDir = path.join(testDir, 'idempotent-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'idempotent-project' })

      // Run sync first time
      const result1 = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })
      expect(result1.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings1 = await readJsonFile(settingsPath)
      const enabledCount1 = settings1.plugins.enabled.length
      const marketplaceCount1 = Object.keys(settings1.plugins.marketplaces).length

      // Run sync second time
      const result2 = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })
      expect(result2.exitCode).toBe(0)

      const settings2 = await readJsonFile(settingsPath)
      const enabledCount2 = settings2.plugins.enabled.length
      const marketplaceCount2 = Object.keys(settings2.plugins.marketplaces).length

      // Verify no duplicates
      expect(enabledCount2).toBe(enabledCount1)
      expect(marketplaceCount2).toBe(marketplaceCount1)

      // Verify plugins are still there
      expect(settings2.plugins.enabled).toContain('test-plugin@test-plugin-marketplace')
      expect(settings2.plugins.enabled).toContain('scoped-plugin@scoped-plugin-marketplace')
    })

    it('should update marketplace entries if package content changes', async () => {
      const projectDir = path.join(testDir, 'update-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'update-project' })

      // Run sync first time
      const result1 = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })
      expect(result1.exitCode).toBe(0)

      // Update the plugin declaration
      await createTestPackage(projectDir, 'test-plugin', {
        name        : 'test-plugin',
        version     : '2.0.0', // Updated version
        description : 'Updated test plugin',
        source      : './',
      })

      // Run sync again
      const result2 = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })
      expect(result2.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Verify version was updated in marketplace
      const marketplace = settings.plugins.marketplaces['test-plugin-marketplace']
      expect(marketplace.plugins['test-plugin'].version).toBe('2.0.0')

      // Verify plugin remains enabled (no disruption)
      expect(settings.plugins.enabled).toContain('test-plugin@test-plugin-marketplace')
    })
  })

  describe('Settings structure validation', () => {
    it('should create valid settings structure matching schema', async () => {
      const projectDir = path.join(testDir, 'schema-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'schema-project' })

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })
      expect(result.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Use helper to verify structure
      const verification = verifySettingsStructure(settings, {
        enabled      : ['test-plugin@test-plugin-marketplace', 'scoped-plugin@scoped-plugin-marketplace'],
        disabled     : [],
        marketplaces : {
          'test-plugin-marketplace' : {
            sourcePath : path.join(projectDir, 'node_modules/test-plugin'),
            plugins    : { 'test-plugin' : {} },
          },
          'scoped-plugin-marketplace' : {
            sourcePath : path.join(projectDir, 'node_modules/@scoped/plugin'),
            plugins    : { 'scoped-plugin' : {} },
          },
        },
      })

      expect(verification.valid).toBe(true)
      if (!verification.valid) {
        process.stderr.write(`Validation errors: ${JSON.stringify(verification.errors, null, 2)}\n`)
      }
    })
  })

  describe('Quiet mode', () => {
    it('should suppress output with --quiet flag', async () => {
      const projectDir = path.join(testDir, 'quiet-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'quiet-project' })

      const result = await runCLI(['sync', '--quiet'], projectDir, { env : { HOME : projectDir } })

      expect(result.exitCode).toBe(0)
      expect(result.stdout.trim()).toBe('')

      // Verify sync still happened despite no output
      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)
      expect(settings.plugins.enabled).toContain('test-plugin@test-plugin-marketplace')
    })
  })

  describe('Error handling', () => {
    it('should handle missing package.json gracefully', async () => {
      const projectDir = path.join(testDir, 'missing-package-json')
      await fs.mkdir(projectDir, { recursive : true })

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Should succeed with 0 plugins found (not an error condition)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Found 0 marketplaces with 0 plugins')
    })

    it('should fail gracefully when node_modules is missing', async () => {
      const projectDir = path.join(testDir, 'missing-node-modules')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'missing-node-modules',
        version      : '1.0.0',
        dependencies : {
          'test-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      const result = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Should succeed but with no plugins enabled (no node_modules to scan)
      expect(result.exitCode).toBe(0)
    })
  })
})
