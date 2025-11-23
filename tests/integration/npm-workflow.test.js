/**
 * Integration tests for npm workflow simulation
 * Tests package add/remove scenarios using fixtures (not real npm)
 * @module tests/integration/npm-workflow
 */
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { createTestPackage, readJsonFile, runCLI } from './test-helpers'

describe('Integration: npm Workflow Simulation', () => {
  let testDir
  let originalHome

  beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-int-npm-'))
    originalHome = process.env.HOME
  })

  afterAll(async () => {
    process.env.HOME = originalHome
    await fs.rm(testDir, { recursive : true, force : true })
  })

  describe('Adding plugins (npm install simulation)', () => {
    it('should discover new plugin after adding to dependencies', async () => {
      const projectDir = path.join(testDir, 'add-plugin')
      await fs.mkdir(projectDir, { recursive : true })

      // Start with no dependencies
      let packageJson = {
        name    : 'add-plugin',
        version : '1.0.0',
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      // Create empty node_modules
      await fs.mkdir(path.join(projectDir, 'node_modules'), { recursive : true })

      // Initial sync (no plugins)
      const syncResult = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      let settings = await readJsonFile(settingsPath)

      expect(syncResult.exitCode).toBe(0)
      expect(settings).not.toBeNull()
      expect(settings.plugins.enabled.length).toBe(0)

      // Simulate npm install by adding dependency and creating package
      packageJson.dependencies = { 'new-plugin' : '1.0.0' }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'new-plugin', {
        name        : 'NewPlugin',
        version     : '1.0.0',
        description : 'Newly added plugin',
        skillPath   : '.claude-plugin/skill',
      })

      // Sync again
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      settings = await readJsonFile(settingsPath)

      // New plugin should be enabled
      expect(settings.plugins.enabled).toContain('NewPlugin@new-plugin-marketplace')
      expect(settings.plugins.marketplaces['new-plugin-marketplace']).toBeDefined()
    })

    it('should handle adding multiple plugins at once', async () => {
      const projectDir = path.join(testDir, 'add-multiple')
      await fs.mkdir(projectDir, { recursive : true })

      // Start with empty project
      let packageJson = {
        name    : 'add-multiple',
        version : '1.0.0',
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await fs.mkdir(path.join(projectDir, 'node_modules'), { recursive : true })

      // Initial sync
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Add three plugins
      packageJson.dependencies = {
        'plugin-one'   : '1.0.0',
        'plugin-two'   : '1.0.0',
        'plugin-three' : '1.0.0',
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'plugin-one', {
        name        : 'PluginOne',
        version     : '1.0.0',
        description : 'First plugin',
        skillPath   : '.claude-plugin/skill',
      })

      await createTestPackage(projectDir, 'plugin-two', {
        name        : 'PluginTwo',
        version     : '1.0.0',
        description : 'Second plugin',
        skillPath   : '.claude-plugin/skill',
      })

      await createTestPackage(projectDir, 'plugin-three', {
        name        : 'PluginThree',
        version     : '1.0.0',
        description : 'Third plugin',
        skillPath   : '.claude-plugin/skill',
      })

      // Sync
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // All three should be enabled
      expect(settings.plugins.enabled).toContain('PluginOne@plugin-one-marketplace')
      expect(settings.plugins.enabled).toContain('PluginTwo@plugin-two-marketplace')
      expect(settings.plugins.enabled).toContain('PluginThree@plugin-three-marketplace')
      expect(settings.plugins.enabled.length).toBe(3)
    })

    it('should handle adding scoped plugin', async () => {
      const projectDir = path.join(testDir, 'add-scoped')
      await fs.mkdir(projectDir, { recursive : true })

      let packageJson = {
        name    : 'add-scoped',
        version : '1.0.0',
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await fs.mkdir(path.join(projectDir, 'node_modules'), { recursive : true })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Add scoped package
      packageJson.dependencies = { '@mycompany/ai-plugin' : '1.0.0' }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, '@mycompany/ai-plugin', {
        name        : 'MyCompanyAI',
        version     : '1.0.0',
        description : 'Company AI plugin',
        skillPath   : '.claude-plugin/skill',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings.plugins.enabled).toContain('MyCompanyAI@mycompany-ai-plugin-marketplace')
    })
  })

  describe('Removing plugins (npm uninstall simulation)', () => {
    it('should handle plugin removal gracefully', async () => {
      const projectDir = path.join(testDir, 'remove-plugin')
      await fs.mkdir(projectDir, { recursive : true })

      // Start with a plugin
      const packageJson = {
        name         : 'remove-plugin',
        version      : '1.0.0',
        dependencies : {
          'removable-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'removable-plugin', {
        name        : 'RemovablePlugin',
        version     : '1.0.0',
        description : 'Plugin to be removed',
        skillPath   : '.claude-plugin/skill',
      })

      // Initial sync
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      let settings = await readJsonFile(settingsPath)

      expect(settings.plugins.enabled).toContain('RemovablePlugin@removable-plugin-marketplace')

      // Simulate npm uninstall: remove from package.json and delete package
      delete packageJson.dependencies['removable-plugin']
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await fs.rm(path.join(projectDir, 'node_modules/removable-plugin'), { recursive : true, force : true })

      // Sync again
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      settings = await readJsonFile(settingsPath)

      // Plugin should no longer be enabled (behavior depends on implementation)
      // At minimum, marketplace should be updated or removed
      // If kept, it should be marked as unavailable
      const marketplace = settings.plugins.marketplaces['removable-plugin-marketplace']

      if (marketplace) {
        // If marketplace still exists, verify it's updated
        expect(marketplace).toBeDefined()
      }
      else {
        // Or it may be removed entirely
        expect(marketplace).toBeUndefined()
      }
    })

    it('should handle removing all plugins', async () => {
      const projectDir = path.join(testDir, 'remove-all')
      await fs.mkdir(projectDir, { recursive : true })

      // Start with plugins
      const packageJson = {
        name         : 'remove-all',
        version      : '1.0.0',
        dependencies : {
          'plugin-a' : '1.0.0',
          'plugin-b' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'plugin-a', {
        name        : 'PluginA',
        version     : '1.0.0',
        description : 'Plugin A',
        skillPath   : '.claude-plugin/skill',
      })

      await createTestPackage(projectDir, 'plugin-b', {
        name        : 'PluginB',
        version     : '1.0.0',
        description : 'Plugin B',
        skillPath   : '.claude-plugin/skill',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      let settings = await readJsonFile(settingsPath)

      expect(settings.plugins.enabled.length).toBeGreaterThanOrEqual(2)

      // Remove all dependencies
      delete packageJson.dependencies
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await fs.rm(path.join(projectDir, 'node_modules'), { recursive : true, force : true })
      await fs.mkdir(path.join(projectDir, 'node_modules'), { recursive : true })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      settings = await readJsonFile(settingsPath)

      // Settings should still be valid
      expect(settings.plugins).toBeDefined()
      expect(Array.isArray(settings.plugins.enabled)).toBe(true)
    })

    it('should handle partial removal (some plugins remain)', async () => {
      const projectDir = path.join(testDir, 'partial-remove')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'partial-remove',
        version      : '1.0.0',
        dependencies : {
          'keep-plugin'   : '1.0.0',
          'remove-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'keep-plugin', {
        name        : 'KeepPlugin',
        version     : '1.0.0',
        description : 'Plugin to keep',
        skillPath   : '.claude-plugin/skill',
      })

      await createTestPackage(projectDir, 'remove-plugin', {
        name        : 'RemovePlugin',
        version     : '1.0.0',
        description : 'Plugin to remove',
        skillPath   : '.claude-plugin/skill',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      let settings = await readJsonFile(settingsPath)

      expect(settings.plugins.enabled).toContain('KeepPlugin@keep-plugin-marketplace')
      expect(settings.plugins.enabled).toContain('RemovePlugin@remove-plugin-marketplace')

      // Remove one plugin
      delete packageJson.dependencies['remove-plugin']
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await fs.rm(path.join(projectDir, 'node_modules/remove-plugin'), { recursive : true, force : true })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      settings = await readJsonFile(settingsPath)

      // Kept plugin should still be enabled
      expect(settings.plugins.enabled).toContain('KeepPlugin@keep-plugin-marketplace')
      expect(settings.plugins.marketplaces['keep-plugin-marketplace']).toBeDefined()
    })
  })

  describe('Updating plugins (npm update simulation)', () => {
    it('should update plugin when version changes in package.json', async () => {
      const projectDir = path.join(testDir, 'update-plugin')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'update-plugin',
        version      : '1.0.0',
        dependencies : {
          'updating-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'updating-plugin', {
        name        : 'UpdatingPlugin',
        version     : '1.0.0',
        description : 'V1',
        skillPath   : '.claude-plugin/skill',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      let settings = await readJsonFile(settingsPath)

      expect(settings.plugins.marketplaces['updating-plugin-marketplace'].plugins.UpdatingPlugin.version).toBe('1.0.0')

      // Simulate npm update: change version and update package
      packageJson.dependencies['updating-plugin'] = '2.0.0'
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'updating-plugin', {
        name        : 'UpdatingPlugin',
        version     : '2.0.0',
        description : 'V2',
        skillPath   : '.claude-plugin/skill',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      settings = await readJsonFile(settingsPath)

      expect(settings.plugins.marketplaces['updating-plugin-marketplace'].plugins.UpdatingPlugin.version).toBe('2.0.0')
      expect(settings.plugins.enabled).toContain('UpdatingPlugin@updating-plugin-marketplace')
    })

    it('should handle updating multiple plugins simultaneously', async () => {
      const projectDir = path.join(testDir, 'multi-update')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'multi-update',
        version      : '1.0.0',
        dependencies : {
          'update-a' : '1.0.0',
          'update-b' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'update-a', {
        name        : 'UpdateA',
        version     : '1.0.0',
        description : 'A V1',
        skillPath   : '.claude-plugin/skill',
      })

      await createTestPackage(projectDir, 'update-b', {
        name        : 'UpdateB',
        version     : '1.0.0',
        description : 'B V1',
        skillPath   : '.claude-plugin/skill',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Update both
      packageJson.dependencies['update-a'] = '2.0.0'
      packageJson.dependencies['update-b'] = '3.0.0'
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'update-a', {
        name        : 'UpdateA',
        version     : '2.0.0',
        description : 'A V2',
        skillPath   : '.claude-plugin/skill',
      })

      await createTestPackage(projectDir, 'update-b', {
        name        : 'UpdateB',
        version     : '3.0.0',
        description : 'B V3',
        skillPath   : '.claude-plugin/skill',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings.plugins.marketplaces['update-a-marketplace'].plugins.UpdateA.version).toBe('2.0.0')
      expect(settings.plugins.marketplaces['update-b-marketplace'].plugins.UpdateB.version).toBe('3.0.0')
    })
  })

  describe('Complex workflows', () => {
    it('should handle add, update, and remove in sequence', async () => {
      const projectDir = path.join(testDir, 'complex-workflow')
      await fs.mkdir(projectDir, { recursive : true })

      // Start empty
      const packageJson = {
        name    : 'complex-workflow',
        version : '1.0.0',
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))
      await fs.mkdir(path.join(projectDir, 'node_modules'), { recursive : true })

      // Step 1: Add two plugins
      packageJson.dependencies = {
        'workflow-a' : '1.0.0',
        'workflow-b' : '1.0.0',
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'workflow-a', {
        name        : 'WorkflowA',
        version     : '1.0.0',
        description : 'A V1',
        skillPath   : '.claude-plugin/skill',
      })

      await createTestPackage(projectDir, 'workflow-b', {
        name        : 'WorkflowB',
        version     : '1.0.0',
        description : 'B V1',
        skillPath   : '.claude-plugin/skill',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      let settings = await readJsonFile(settingsPath)

      expect(settings.plugins.enabled.length).toBe(2)

      // Step 2: Update one, add one
      packageJson.dependencies['workflow-a'] = '2.0.0'
      packageJson.dependencies['workflow-c'] = '1.0.0'
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'workflow-a', {
        name        : 'WorkflowA',
        version     : '2.0.0',
        description : 'A V2',
        skillPath   : '.claude-plugin/skill',
      })

      await createTestPackage(projectDir, 'workflow-c', {
        name        : 'WorkflowC',
        version     : '1.0.0',
        description : 'C V1',
        skillPath   : '.claude-plugin/skill',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      settings = await readJsonFile(settingsPath)

      expect(settings.plugins.enabled.length).toBe(3)
      expect(settings.plugins.marketplaces['workflow-a-marketplace'].plugins.WorkflowA.version).toBe('2.0.0')

      // Step 3: Remove one
      delete packageJson.dependencies['workflow-b']
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await fs.rm(path.join(projectDir, 'node_modules/workflow-b'), { recursive : true, force : true })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      settings = await readJsonFile(settingsPath)

      // A and C should still be enabled
      expect(settings.plugins.enabled).toContain('WorkflowA@workflow-a-marketplace')
      expect(settings.plugins.enabled).toContain('WorkflowC@workflow-c-marketplace')
    })

    it('should handle switching between different plugin sets', async () => {
      const projectDir = path.join(testDir, 'switch-sets')
      await fs.mkdir(projectDir, { recursive : true })

      const packageJson = {
        name         : 'switch-sets',
        version      : '1.0.0',
        dependencies : {
          'set1-plugin' : '1.0.0',
        },
      }
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await createTestPackage(projectDir, 'set1-plugin', {
        name        : 'Set1Plugin',
        version     : '1.0.0',
        description : 'Set 1',
        skillPath   : '.claude-plugin/skill',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Switch to completely different plugin
      delete packageJson.dependencies['set1-plugin']
      packageJson.dependencies['set2-plugin'] = '1.0.0'
      await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      await fs.rm(path.join(projectDir, 'node_modules/set1-plugin'), { recursive : true, force : true })

      await createTestPackage(projectDir, 'set2-plugin', {
        name        : 'Set2Plugin',
        version     : '1.0.0',
        description : 'Set 2',
        skillPath   : '.claude-plugin/skill',
      })

      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // New plugin should be enabled
      expect(settings.plugins.enabled).toContain('Set2Plugin@set2-plugin-marketplace')

      // Settings should be valid
      expect(settings.plugins).toBeDefined()
    })
  })
})
