/**
 * Functional tests for 'air install' command
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import path from 'path'
import {
  setupTestEnv,
  setupClaudePluginDir,
  runCLI,
  readJsonFile,
  readFile,
  parseMarkdownTable
} from './helpers.js'

describe('air install (functional)', () => {
  let testDir
  let cleanup
  let pluginDir

  beforeEach(async () => {
    const env = await setupTestEnv()
    testDir = env.testDir
    cleanup = env.cleanup

    // Setup mock Claude plugin directory in test dir
    const { pluginsDir } = await setupClaudePluginDir(testDir)
    pluginDir = pluginsDir
  })

  afterEach(async () => {
    await cleanup()
  })

  describe('Basic installation', () => {
    it('should install a Claude Skill', async () => {
      const { stdout, exitCode } = await runCLI(
        ['install', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      expect(stdout).toContain('Installation complete')

      // Verify plugin registry
      const installedPlugins = await readJsonFile(
        path.join(pluginDir, 'installed_plugins.json')
      )
      expect(installedPlugins).toBeTruthy()
      expect(Object.keys(installedPlugins.plugins)).toContain('skill-only@test-air-package-marketplace')
    })

    it('should install a generic integration', async () => {
      const { stdout, exitCode } = await runCLI(
        ['install', 'test-air-package/GenericOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      expect(stdout).toContain('Installation complete')

      // Verify AGENTS.md created and contains entry
      const agentsContent = await readFile(path.join(testDir, 'AGENTS.md'))
      expect(agentsContent).toBeTruthy()

      const entries = parseMarkdownTable(agentsContent)
      expect(entries).toHaveLength(1)
      expect(entries[0].name).toBe('GenericOnly')
      expect(entries[0].library).toBe('test-air-package')
    })

    it('should install dual-type integration (both types by default)', async () => {
      const { stdout, exitCode } = await runCLI(
        ['install', 'test-air-package/DualTypeIntegration'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      expect(stdout).toContain('Installation complete')

      // Verify skill installed
      const installedPlugins = await readJsonFile(
        path.join(pluginDir, 'installed_plugins.json')
      )
      expect(Object.keys(installedPlugins.plugins)).toContain('dual-type-integration@test-air-package-marketplace')

      // Verify generic installed
      const agentsContent = await readFile(path.join(testDir, 'AGENTS.md'))
      const entries = parseMarkdownTable(agentsContent)
      const dualTypeEntry = entries.find(e => e.name === 'DualTypeIntegration')
      expect(dualTypeEntry).toBeTruthy()
    })
  })

  describe('Selective installation with flags', () => {
    it('should install only skill with --skill flag', async () => {
      const { stdout, exitCode } = await runCLI(
        ['install', 'test-air-package/DualTypeIntegration', '--skill'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)

      // Verify skill installed
      const installedPlugins = await readJsonFile(
        path.join(pluginDir, 'installed_plugins.json')
      )
      expect(Object.keys(installedPlugins.plugins)).toContain('dual-type-integration@test-air-package-marketplace')

      // Verify generic NOT installed
      const agentsContent = await readFile(path.join(testDir, 'AGENTS.md'))
      if (agentsContent) {
        const entries = parseMarkdownTable(agentsContent)
        const dualTypeEntry = entries.find(e => e.name === 'DualTypeIntegration')
        expect(dualTypeEntry).toBeFalsy()
      }
    })

    it('should install only generic with --generic flag', async () => {
      const { stdout, exitCode } = await runCLI(
        ['install', 'test-air-package/DualTypeIntegration', '--generic'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)

      // Verify generic installed
      const agentsContent = await readFile(path.join(testDir, 'AGENTS.md'))
      expect(agentsContent).toBeTruthy()
      const entries = parseMarkdownTable(agentsContent)
      const dualTypeEntry = entries.find(e => e.name === 'DualTypeIntegration')
      expect(dualTypeEntry).toBeTruthy()

      // Verify skill NOT installed
      const installedPlugins = await readJsonFile(
        path.join(pluginDir, 'installed_plugins.json')
      )
      expect(Object.keys(installedPlugins.plugins)).not.toContain('dual-type-integration@test-air-package-marketplace')
    })
  })

  describe('Error handling', () => {
    it('should fail gracefully for non-existent integration', async () => {
      const { stderr, exitCode } = await runCLI(
        ['install', 'test-air-package/NonExistent'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).not.toBe(0)
      expect(stderr).toContain('not found')
    })

    it('should handle already-installed integration', async () => {
      // Install once
      await runCLI(
        ['install', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Try to install again
      const { stdout, exitCode } = await runCLI(
        ['install', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Should succeed but indicate already installed
      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).toMatch(/no types available to install/)
    })

    it('should succeed silently when trying to install skill-only type with --generic flag', async () => {
      const { stdout, exitCode } = await runCLI(
        ['install', 'test-air-package/SkillOnly', '--generic'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0) // Idempotent - succeeds silently
      expect(stdout.toLowerCase()).toMatch(/no types available to install/)
    })

    it('should succeed silently when trying to install generic-only type with --skill flag', async () => {
      const { stdout, exitCode } = await runCLI(
        ['install', 'test-air-package/GenericOnly', '--skill'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0) // Idempotent - succeeds silently
      expect(stdout.toLowerCase()).toMatch(/no types available to install/)
    })
  })

  describe('Marketplace registration', () => {
    it('should register marketplace in known_marketplaces.json', async () => {
      await runCLI(
        ['install', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      const marketplaces = await readJsonFile(
        path.join(pluginDir, 'known_marketplaces.json')
      )
      expect(marketplaces).toBeTruthy()
      expect(marketplaces['test-air-package-marketplace']).toBeTruthy()
      expect(marketplaces['test-air-package-marketplace'].source).toBeTruthy()
      expect(marketplaces['test-air-package-marketplace'].installLocation).toBeTruthy()
    })
  })

  describe('Multiple installations', () => {
    it('should install multiple integrations from same package', async () => {
      // Install skill-only
      await runCLI(
        ['install', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Install generic-only
      await runCLI(
        ['install', 'test-air-package/GenericOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Verify both installed
      const installedPlugins = await readJsonFile(
        path.join(pluginDir, 'installed_plugins.json')
      )
      expect(Object.keys(installedPlugins.plugins)).toContain('skill-only@test-air-package-marketplace')

      const agentsContent = await readFile(path.join(testDir, 'AGENTS.md'))
      const entries = parseMarkdownTable(agentsContent)
      expect(entries).toHaveLength(1)
      expect(entries[0].name).toBe('GenericOnly')
    })

    it('should install different types from dual-type integration separately', async () => {
      // Install skill only
      await runCLI(
        ['install', 'test-air-package/DualTypeIntegration', '--skill'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Install generic only
      await runCLI(
        ['install', 'test-air-package/DualTypeIntegration', '--generic'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      // Verify both types installed
      const installedPlugins = await readJsonFile(
        path.join(pluginDir, 'installed_plugins.json')
      )
      expect(Object.keys(installedPlugins.plugins)).toContain('dual-type-integration@test-air-package-marketplace')

      const agentsContent = await readFile(path.join(testDir, 'AGENTS.md'))
      const entries = parseMarkdownTable(agentsContent)
      const dualTypeEntry = entries.find(e => e.name === 'DualTypeIntegration')
      expect(dualTypeEntry).toBeTruthy()
    })
  })

  describe('Scoped package support', () => {
    it('should install skill from scoped package', async () => {
      const { stdout, exitCode } = await runCLI(
        ['install', '@ai-ready/scoped-package/SkillOnly', '--skill'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      expect(stdout).toContain('Installing @ai-ready/scoped-package/SkillOnly')
      expect(stdout).toContain('Installation complete')

      // Verify skill was registered
      const installedPlugins = await readJsonFile(
        path.join(pluginDir, 'installed_plugins.json')
      )
      expect(Object.keys(installedPlugins.plugins)).toContain('skill-only@@ai-ready/scoped-package-marketplace')
    })

    it('should install generic integration from scoped package', async () => {
      const { stdout, exitCode } = await runCLI(
        ['install', '@ai-ready/scoped-package/GenericOnly', '--generic'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      expect(stdout).toContain('Installing @ai-ready/scoped-package/GenericOnly')

      // Verify entry in AGENTS.md
      const agentsContent = await readFile(path.join(testDir, 'AGENTS.md'))
      const entries = parseMarkdownTable(agentsContent)
      const entry = entries.find(e => e.library === '@ai-ready/scoped-package' && e.name === 'GenericOnly')
      expect(entry).toBeTruthy()
    })
  })
})
