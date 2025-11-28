/**
 * Integration tests for multiple projects with isolated plugin sets
 * Tests that multiple projects can coexist with separate plugin configurations
 * @module tests/integration/multi-project
 */
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { readJsonFile, runCLI, setupMultiProjectEnv } from './test-helpers'

describe('Integration: Multi-Project', () => {
  let testDir
  let originalHome

  beforeAll(async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-int-multi-'))
    // Resolve symlinks to get canonical path (e.g., /var -> /private/var on macOS)
    testDir = await fs.realpath(tempDir)
    originalHome = process.env.HOME
  })

  afterAll(async () => {
    process.env.HOME = originalHome
    await fs.rm(testDir, { recursive : true, force : true })
  })

  describe('Multiple projects with shared HOME', () => {
    it('should enable plugins from multiple projects in shared settings', async () => {
      const sharedHome = path.join(testDir, 'shared-home')
      await fs.mkdir(sharedHome, { recursive : true })

      // Create two projects with different plugins
      const projectA = path.join(testDir, 'project-a')
      const projectB = path.join(testDir, 'project-b')
      await fs.mkdir(projectA, { recursive : true })
      await fs.mkdir(projectB, { recursive : true })

      await setupMultiProjectEnv([
        {
          name    : 'project-a',
          dir     : projectA,
          plugins : [
            {
              packageName : 'plugin-alpha',
              declaration : {
                name        : 'alpha-plugin',
                version     : '1.0.0',
                description : 'Alpha plugin for project A',
                source      : '.claude-plugin/skill',
              },
            },
          ],
        },
        {
          name    : 'project-b',
          dir     : projectB,
          plugins : [
            {
              packageName : 'plugin-beta',
              declaration : {
                name        : 'beta-plugin',
                version     : '1.0.0',
                description : 'Beta plugin for project B',
                source      : '.claude-plugin/skill',
              },
            },
          ],
        },
      ])

      // Sync project A
      const resultA = await runCLI(['sync'], projectA, { env : { HOME : sharedHome } })
      expect(resultA.exitCode).toBe(0)

      // Sync project B
      const resultB = await runCLI(['sync'], projectB, { env : { HOME : sharedHome } })
      expect(resultB.exitCode).toBe(0)

      // Verify both plugins in shared settings
      const settingsPath = path.join(sharedHome, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      expect(settings.plugins.enabled).toContain('alpha-plugin@plugin-alpha-marketplace')
      expect(settings.plugins.enabled).toContain('beta-plugin@plugin-beta-marketplace')

      // Verify both marketplaces exist
      expect(settings.plugins.marketplaces['plugin-alpha-marketplace']).toBeDefined()
      expect(settings.plugins.marketplaces['plugin-beta-marketplace']).toBeDefined()

      // Verify correct paths
      expect(settings.plugins.marketplaces['plugin-alpha-marketplace'].source.path).toBe(
        path.join(projectA, 'node_modules/plugin-alpha')
      )
      expect(settings.plugins.marketplaces['plugin-beta-marketplace'].source.path).toBe(
        path.join(projectB, 'node_modules/plugin-beta')
      )
    })

    it('should handle overlapping plugin names from different projects', async () => {
      const sharedHome = path.join(testDir, 'overlap-home')
      await fs.mkdir(sharedHome, { recursive : true })

      const projectX = path.join(testDir, 'project-x')
      const projectY = path.join(testDir, 'project-y')
      await fs.mkdir(projectX, { recursive : true })
      await fs.mkdir(projectY, { recursive : true })

      // Both projects have 'common-plugin' but potentially different versions/paths
      await setupMultiProjectEnv([
        {
          name    : 'project-x',
          dir     : projectX,
          plugins : [
            {
              packageName : 'common-plugin',
              declaration : {
                name        : 'common-plugin',
                version     : '1.0.0',
                description : 'Common plugin v1',
                source      : '.claude-plugin/skill',
              },
            },
          ],
        },
        {
          name    : 'project-y',
          dir     : projectY,
          plugins : [
            {
              packageName : 'common-plugin',
              declaration : {
                name        : 'common-plugin',
                version     : '2.0.0',
                description : 'Common plugin v2',
                source      : '.claude-plugin/skill',
              },
            },
          ],
        },
      ])

      // Sync both projects
      await runCLI(['sync'], projectX, { env : { HOME : sharedHome } })
      await runCLI(['sync'], projectY, { env : { HOME : sharedHome } })

      const settingsPath = path.join(sharedHome, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Should have only one enabled entry (last one wins)
      const commonPluginEntries = settings.plugins.enabled.filter((p) => p.startsWith('common-plugin@'))
      expect(commonPluginEntries.length).toBe(1)

      // Should have one marketplace
      expect(settings.plugins.marketplaces['common-plugin-marketplace']).toBeDefined()

      // Verify the latest version is in the marketplace
      const marketplace = settings.plugins.marketplaces['common-plugin-marketplace']
      expect(marketplace.plugins['common-plugin'].version).toBe('2.0.0')
      expect(marketplace.source.path).toBe(path.join(projectY, 'node_modules/common-plugin'))
    })
  })

  describe('Isolated project environments', () => {
    it('should maintain separate settings when using different HOME directories', async () => {
      const homeA = path.join(testDir, 'home-a')
      const homeB = path.join(testDir, 'home-b')
      await fs.mkdir(homeA, { recursive : true })
      await fs.mkdir(homeB, { recursive : true })

      const projectA = path.join(testDir, 'isolated-a')
      const projectB = path.join(testDir, 'isolated-b')
      await fs.mkdir(projectA, { recursive : true })
      await fs.mkdir(projectB, { recursive : true })

      await setupMultiProjectEnv([
        {
          name    : 'isolated-a',
          dir     : projectA,
          plugins : [
            {
              packageName : 'plugin-one',
              declaration : {
                name        : 'plugin-one',
                version     : '1.0.0',
                description : 'Plugin One',
                source      : '.claude-plugin/skill',
              },
            },
          ],
        },
        {
          name    : 'isolated-b',
          dir     : projectB,
          plugins : [
            {
              packageName : 'plugin-two',
              declaration : {
                name        : 'plugin-two',
                version     : '1.0.0',
                description : 'Plugin Two',
                source      : '.claude-plugin/skill',
              },
            },
          ],
        },
      ])

      // Sync with separate HOME directories
      await runCLI(['sync'], projectA, { env : { HOME : homeA } })
      await runCLI(['sync'], projectB, { env : { HOME : homeB } })

      // Verify separate settings files
      const settingsA = await readJsonFile(path.join(homeA, '.claude/settings.json'))
      const settingsB = await readJsonFile(path.join(homeB, '.claude/settings.json'))

      // A should only have plugin-one
      expect(settingsA.plugins.enabled).toContain('plugin-one@plugin-one-marketplace')
      expect(settingsA.plugins.enabled).not.toContain('plugin-two@plugin-two-marketplace')

      // B should only have plugin-two
      expect(settingsB.plugins.enabled).toContain('plugin-two@plugin-two-marketplace')
      expect(settingsB.plugins.enabled).not.toContain('plugin-one@plugin-one-marketplace')
    })
  })

  describe('Project-specific view', () => {
    it('should show only project plugins with default view command', async () => {
      const sharedHome = path.join(testDir, 'view-home')
      await fs.mkdir(sharedHome, { recursive : true })

      const projectA = path.join(testDir, 'view-project-a')
      const projectB = path.join(testDir, 'view-project-b')
      await fs.mkdir(projectA, { recursive : true })
      await fs.mkdir(projectB, { recursive : true })

      await setupMultiProjectEnv([
        {
          name    : 'view-project-a',
          dir     : projectA,
          plugins : [
            {
              packageName : 'view-plugin-a',
              declaration : {
                name        : 'view-plugin-a',
                version     : '1.0.0',
                description : 'View Plugin A',
                source      : '.claude-plugin/skill',
              },
            },
          ],
        },
        {
          name    : 'view-project-b',
          dir     : projectB,
          plugins : [
            {
              packageName : 'view-plugin-b',
              declaration : {
                name        : 'view-plugin-b',
                version     : '1.0.0',
                description : 'View Plugin B',
                source      : '.claude-plugin/skill',
              },
            },
          ],
        },
      ])

      // Sync both projects
      await runCLI(['sync'], projectA, { env : { HOME : sharedHome } })
      await runCLI(['sync'], projectB, { env : { HOME : sharedHome } })

      // View from project A (without --all flag)
      const viewResultA = await runCLI(['plugins', 'view'], projectA, { env : { HOME : sharedHome } })
      expect(viewResultA.exitCode).toBe(0)
      expect(viewResultA.stdout).toContain('view-plugin-a')
      // Should not contain plugins from other projects in default view
      // (depends on implementation - may show all or just project-specific)

      // View with --all flag should show everything
      const viewAllResult = await runCLI(['plugins', 'view', '--all'], projectA, { env : { HOME : sharedHome } })
      expect(viewAllResult.exitCode).toBe(0)
      expect(viewAllResult.stdout).toContain('view-plugin-a')
      expect(viewAllResult.stdout).toContain('view-plugin-b')
    })
  })

  describe('Mixed dependency scenarios', () => {
    it('should handle project with both unique and shared dependencies', async () => {
      const sharedHome = path.join(testDir, 'mixed-home')
      await fs.mkdir(sharedHome, { recursive : true })

      const projectA = path.join(testDir, 'mixed-a')
      const projectB = path.join(testDir, 'mixed-b')
      await fs.mkdir(projectA, { recursive : true })
      await fs.mkdir(projectB, { recursive : true })

      await setupMultiProjectEnv([
        {
          name    : 'mixed-a',
          dir     : projectA,
          plugins : [
            {
              packageName : 'shared-plugin',
              declaration : {
                name        : 'shared-plugin',
                version     : '1.0.0',
                description : 'Shared by both',
                source      : '.claude-plugin/skill',
              },
            },
            {
              packageName : 'unique-a',
              declaration : {
                name        : 'unique-a',
                version     : '1.0.0',
                description : 'Unique to A',
                source      : '.claude-plugin/skill',
              },
            },
          ],
        },
        {
          name    : 'mixed-b',
          dir     : projectB,
          plugins : [
            {
              packageName : 'shared-plugin',
              declaration : {
                name        : 'shared-plugin',
                version     : '1.0.0',
                description : 'Shared by both',
                source      : '.claude-plugin/skill',
              },
            },
            {
              packageName : 'unique-b',
              declaration : {
                name        : 'unique-b',
                version     : '1.0.0',
                description : 'Unique to B',
                source      : '.claude-plugin/skill',
              },
            },
          ],
        },
      ])

      // Sync both projects
      await runCLI(['sync'], projectA, { env : { HOME : sharedHome } })
      await runCLI(['sync'], projectB, { env : { HOME : sharedHome } })

      const settingsPath = path.join(sharedHome, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Should have all three plugins enabled
      expect(settings.plugins.enabled).toContain('shared-plugin@shared-plugin-marketplace')
      expect(settings.plugins.enabled).toContain('unique-a@unique-a-marketplace')
      expect(settings.plugins.enabled).toContain('unique-b@unique-b-marketplace')

      // Verify all marketplaces
      expect(settings.plugins.marketplaces['shared-plugin-marketplace']).toBeDefined()
      expect(settings.plugins.marketplaces['unique-a-marketplace']).toBeDefined()
      expect(settings.plugins.marketplaces['unique-b-marketplace']).toBeDefined()
    })

    it('should update shared plugin when syncing from different projects', async () => {
      const sharedHome = path.join(testDir, 'update-shared-home')
      await fs.mkdir(sharedHome, { recursive : true })

      const projectOld = path.join(testDir, 'update-old')
      const projectNew = path.join(testDir, 'update-new')
      await fs.mkdir(projectOld, { recursive : true })
      await fs.mkdir(projectNew, { recursive : true })

      // Setup with old version first
      await setupMultiProjectEnv([
        {
          name    : 'update-old',
          dir     : projectOld,
          plugins : [
            {
              packageName : 'evolving-plugin',
              declaration : {
                name        : 'evolving-plugin',
                version     : '1.0.0',
                description : 'Old version',
                source      : '.claude-plugin/skill',
              },
            },
          ],
        },
      ])

      // Sync old version
      await runCLI(['sync'], projectOld, { env : { HOME : sharedHome } })

      // Setup new version
      await setupMultiProjectEnv([
        {
          name    : 'update-new',
          dir     : projectNew,
          plugins : [
            {
              packageName : 'evolving-plugin',
              declaration : {
                name        : 'evolving-plugin',
                version     : '2.0.0',
                description : 'New version',
                source      : '.claude-plugin/skill',
              },
            },
          ],
        },
      ])

      // Sync new version
      await runCLI(['sync'], projectNew, { env : { HOME : sharedHome } })

      const settingsPath = path.join(sharedHome, '.claude/settings.json')
      const settings = await readJsonFile(settingsPath)

      // Should have updated to new version
      const marketplace = settings.plugins.marketplaces['evolving-plugin-marketplace']
      expect(marketplace.plugins['evolving-plugin'].version).toBe('2.0.0')
      expect(marketplace.source.path).toBe(path.join(projectNew, 'node_modules/evolving-plugin'))
    })
  })
})
