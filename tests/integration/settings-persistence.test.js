/**
 * Integration tests for settings persistence across commands
 * Tests cross-command state management and user choice respect
 * @module tests/integration/settings-persistence
 */
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { readJsonFile, runCLI, setupTestProject } from './test-helpers'

describe('Integration: Settings Persistence', () => {
  let testDir
  let originalHome

  beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-int-persist-'))
    originalHome = process.env.HOME
    process.env.HOME = testDir
  })

  afterAll(async () => {
    process.env.HOME = originalHome
    await fs.rm(testDir, { recursive : true, force : true })
  })

  describe('Cross-command state persistence', () => {
    it('should persist state between sync and view commands', async () => {
      const projectDir = path.join(testDir, 'persist-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'persist-project' })

      // Run sync to enable plugins
      const syncResult = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })
      expect(syncResult.exitCode).toBe(0)

      // Run view to check status
      const viewResult = await runCLI(['view'], projectDir, { env : { HOME : projectDir } })
      expect(viewResult.exitCode).toBe(0)
      expect(viewResult.stdout).toContain('TestPlugin')
      expect(viewResult.stdout).toContain('enabled')
    })

    it('should maintain settings across multiple sync invocations', async () => {
      const projectDir = path.join(testDir, 'multi-sync-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'multi-sync-project' })

      // First sync
      const result1 = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })
      expect(result1.exitCode).toBe(0)

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings1 = await readJsonFile(settingsPath)
      const timestamp1 = (await fs.stat(settingsPath)).mtime

      // Second sync (after small delay)
      await new Promise((resolve) => setTimeout(resolve, 100))
      const result2 = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })
      expect(result2.exitCode).toBe(0)

      const settings2 = await readJsonFile(settingsPath)

      // Verify settings are identical (no unwanted changes)
      expect(settings2.plugins.enabled).toEqual(settings1.plugins.enabled)
      expect(settings2.plugins.disabled).toEqual(settings1.plugins.disabled)
      expect(Object.keys(settings2.plugins.marketplaces)).toEqual(Object.keys(settings1.plugins.marketplaces))
    })
  })

  describe('Respecting user choice - disabled plugins', () => {
    it('should never re-enable a plugin that user has disabled', async () => {
      const projectDir = path.join(testDir, 'disabled-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'disabled-project' })

      // Initial sync to enable plugins
      const syncResult1 = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })
      expect(syncResult1.exitCode).toBe(0)

      // Manually disable a plugin (simulating user action)
      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      const pluginToDisable = 'TestPlugin@test-plugin-marketplace'
      settings.plugins.enabled = settings.plugins.enabled.filter((p) => p !== pluginToDisable)
      settings.plugins.disabled.push(pluginToDisable)

      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))

      // Run sync again
      const syncResult2 = await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })
      expect(syncResult2.exitCode).toBe(0)

      // Verify plugin remains disabled
      const settingsAfter = await readJsonFile(settingsPath)
      expect(settingsAfter.plugins.disabled).toContain(pluginToDisable)
      expect(settingsAfter.plugins.enabled).not.toContain(pluginToDisable)
    })

    it('should respect disabled plugins across multiple sync runs', async () => {
      const projectDir = path.join(testDir, 'multi-disabled-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'multi-disabled-project' })

      // Initial sync
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Disable both plugins
      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      settings.plugins.disabled = [...settings.plugins.enabled]
      settings.plugins.enabled = []

      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))

      // Run sync 3 more times
      for (let i = 0; i < 3; i++) {
        await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })
      }

      // Verify plugins still disabled
      const finalSettings = await readJsonFile(settingsPath)
      expect(finalSettings.plugins.enabled).toHaveLength(0)
      expect(finalSettings.plugins.disabled.length).toBeGreaterThan(0)
    })

    it('should allow re-enabling a previously disabled plugin', async () => {
      const projectDir = path.join(testDir, 're-enable-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 're-enable-project' })

      // Initial sync
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Disable plugin
      const settingsPath = path.join(projectDir, '.claude/settings.json')
      let settings = await readJsonFile(settingsPath)

      const pluginKey = 'TestPlugin@test-plugin-marketplace'
      settings.plugins.enabled = settings.plugins.enabled.filter((p) => p !== pluginKey)
      settings.plugins.disabled.push(pluginKey)

      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))

      // Verify disabled
      settings = await readJsonFile(settingsPath)
      expect(settings.plugins.disabled).toContain(pluginKey)

      // Manually re-enable (simulating user action)
      settings.plugins.disabled = settings.plugins.disabled.filter((p) => p !== pluginKey)
      settings.plugins.enabled.push(pluginKey)

      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))

      // Run sync again
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Verify remains enabled
      const finalSettings = await readJsonFile(settingsPath)
      expect(finalSettings.plugins.enabled).toContain(pluginKey)
      expect(finalSettings.plugins.disabled).not.toContain(pluginKey)
    })
  })

  describe('Manual settings edits', () => {
    it('should preserve manually added settings sections', async () => {
      const projectDir = path.join(testDir, 'manual-edit-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'manual-edit-project' })

      // Initial sync
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Manually add custom settings
      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      settings.customUserSetting = 'my-custom-value'
      settings.plugins.customPluginSetting = 'another-value'

      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))

      // Run sync again
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Verify custom settings preserved
      const finalSettings = await readJsonFile(settingsPath)
      expect(finalSettings.customUserSetting).toBe('my-custom-value')
      expect(finalSettings.plugins.customPluginSetting).toBe('another-value')
    })

    it('should preserve manually added marketplaces', async () => {
      const projectDir = path.join(testDir, 'manual-marketplace-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'manual-marketplace-project' })

      // Initial sync
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Manually add a marketplace
      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      settings.plugins.marketplaces['my-custom-marketplace'] = {
        source  : { type : 'directory', path : '/some/custom/path' },
        plugins : {
          CustomPlugin : {
            version   : '1.0.0',
            skillPath : 'skills/',
          },
        },
      }

      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))

      // Run sync again
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Verify custom marketplace preserved
      const finalSettings = await readJsonFile(settingsPath)
      expect(finalSettings.plugins.marketplaces['my-custom-marketplace']).toBeDefined()
      expect(finalSettings.plugins.marketplaces['my-custom-marketplace'].source.path).toBe('/some/custom/path')
    })

    it('should update project marketplaces without affecting others', async () => {
      const projectDir = path.join(testDir, 'selective-update-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'selective-update-project' })

      // Initial sync
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Add manual marketplace
      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      const originalMarketplaceCount = Object.keys(settings.plugins.marketplaces).length

      settings.plugins.marketplaces['external-marketplace'] = {
        source  : { type : 'directory', path : '/external/path' },
        plugins : {
          ExternalPlugin : {
            version   : '1.0.0',
            skillPath : 'ext/',
          },
        },
      }

      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))

      // Run sync again
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      // Verify both auto and manual marketplaces exist
      const finalSettings = await readJsonFile(settingsPath)
      expect(Object.keys(finalSettings.plugins.marketplaces).length).toBe(originalMarketplaceCount + 1)
      expect(finalSettings.plugins.marketplaces['external-marketplace']).toBeDefined()
      expect(finalSettings.plugins.marketplaces['test-plugin-marketplace']).toBeDefined()
    })
  })

  describe('View command integration', () => {
    it('should display correct status after manual disable', async () => {
      const projectDir = path.join(testDir, 'view-status-project')
      await fs.mkdir(projectDir, { recursive : true })

      await setupTestProject(projectDir, { projectName : 'view-status-project' })

      // Sync then disable
      await runCLI(['sync'], projectDir, { env : { HOME : projectDir } })

      const settingsPath = path.join(projectDir, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      const pluginKey = 'TestPlugin@test-plugin-marketplace'
      settings.plugins.enabled = settings.plugins.enabled.filter((p) => p !== pluginKey)
      settings.plugins.disabled.push(pluginKey)

      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))

      // Run view
      const viewResult = await runCLI(['view'], projectDir, { env : { HOME : projectDir } })

      expect(viewResult.exitCode).toBe(0)
      expect(viewResult.stdout).toContain('TestPlugin')
      expect(viewResult.stdout).toContain('disabled')
    })
  })
})
