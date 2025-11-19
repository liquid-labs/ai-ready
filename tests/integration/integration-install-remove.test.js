/**
 * Integration tests for install/remove workflows
 * These tests verify behavior in a clean, isolated environment
 */
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals'

import { readFile, readJsonFile, runCLI, setupTestProject } from './test-helpers'

describe('Integration: Install and Remove workflows', () => {
  let testDir
  let originalHome

  beforeAll(async () => {
    // Create isolated test environment
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-int-test-'))
    originalHome = process.env.HOME

    // Set HOME to test directory (isolates Claude plugin directory)
    // NOTE: This requires tests to run sequentially (--runInBand in Jest config)
    // to prevent parallel test conflicts. The modified HOME is passed to child
    // processes via runCLI() helper which explicitly includes process.env.
    process.env.HOME = testDir

    // Setup test project with fixture package
    await setupTestProject(testDir)
  })

  beforeEach(async () => {
    // Clean up test directory before each test
    const entries = await fs.readdir(testDir)
    for (const entry of entries) {
      const fullPath = path.join(testDir, entry)
      const stat = await fs.stat(fullPath)
      if (stat.isDirectory()) {
        await fs.rm(fullPath, { recursive : true, force : true })
      }
      else {
        await fs.unlink(fullPath)
      }
    }
    await setupTestProject(testDir)
  })

  afterAll(async () => {
    // Restore HOME
    process.env.HOME = originalHome

    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive : true, force : true })
    }
    catch (error) {
      console.warn('Failed to cleanup test directory:', error.message)
    }
  })

  describe('Real npm install → air install workflow', () => {
    it('should discover integrations after npm install', async () => {
      const { stdout } = await runCLI(['list'], testDir)

      expect(stdout).toContain('test-air-package')
      expect(stdout).toContain('DualType')
      expect(stdout).toContain('SkillOnly')
      expect(stdout).toContain('GenericOnly')
    })

    it('should install Claude Skill to global plugin directory', async () => {
      await runCLI(['install', 'test-air-package/SkillOnly'], testDir)

      // Verify plugin registry in $HOME/.claude/plugins/
      const pluginRegistry = await readJsonFile(path.join(testDir, '.claude/plugins/installed_plugins.json'))
      expect(pluginRegistry).toBeTruthy()
      expect(Object.keys(pluginRegistry.plugins)).toContain('skill-only@test-air-package-marketplace')
    })

    it('should install generic integration to project directory', async () => {
      await runCLI(['install', 'test-air-package/GenericOnly'], testDir)

      // Verify AGENTS.md in project directory
      const agentsContent = await fs.readFile(path.join(testDir, 'AGENTS.md'), 'utf8')
      expect(agentsContent).toContain('GenericOnly')
      expect(agentsContent).toContain('test-air-package')
    })

    it('should remove Claude Skill from global plugin directory', async () => {
      // Install first
      await runCLI(['install', 'test-air-package/SkillOnly'], testDir)

      // Remove
      await runCLI(['remove', 'test-air-package/SkillOnly'], testDir)

      // Verify removed
      const pluginRegistry = await readJsonFile(path.join(testDir, '.claude/plugins/installed_plugins.json'))
      expect(Object.keys(pluginRegistry?.plugins || {})).not.toContain('skill-only@test-air-package-marketplace')
    })

    it('should remove generic integration from project directory', async () => {
      // Install first
      await runCLI(['install', 'test-air-package/GenericOnly'], testDir)

      // Remove
      await runCLI(['remove', 'test-air-package/GenericOnly'], testDir)

      // Verify removed
      const agentsContent = await readFile(path.join(testDir, 'AGENTS.md'))
      if (agentsContent) {
        expect(agentsContent).not.toContain('GenericOnly')
      }
    })
  })

  describe('Dual-type integration workflows', () => {
    it('should install both types by default', async () => {
      await runCLI(['install', 'test-air-package/DualTypeIntegration'], testDir)

      // Verify skill installed
      const pluginRegistry = await readJsonFile(path.join(testDir, '.claude/plugins/installed_plugins.json'))
      expect(Object.keys(pluginRegistry?.plugins || {})).toContain('dual-type-integration@test-air-package-marketplace')

      // Verify generic installed
      const agentsContent = await fs.readFile(path.join(testDir, 'AGENTS.md'), 'utf8')
      expect(agentsContent).toContain('DualTypeIntegration')
    })

    it('should allow selective installation with --skill flag', async () => {
      await runCLI(['install', 'test-air-package/DualTypeIntegration', '--skill'], testDir)

      // Verify skill installed
      const pluginRegistry = await readJsonFile(path.join(testDir, '.claude/plugins/installed_plugins.json'))
      expect(Object.keys(pluginRegistry?.plugins || {})).toContain('dual-type-integration@test-air-package-marketplace')

      // Verify generic NOT installed (file may not exist if only skill was installed)
      const agentsContent = await readFile(path.join(testDir, 'AGENTS.md'))
      if (agentsContent) {
        expect(agentsContent).not.toContain('DualTypeIntegration')
      }
    })

    it('should allow selective installation with --generic flag', async () => {
      await runCLI(['install', 'test-air-package/DualTypeIntegration', '--generic'], testDir)

      // Verify generic installed
      const agentsContent = await fs.readFile(path.join(testDir, 'AGENTS.md'), 'utf8')
      expect(agentsContent).toContain('DualTypeIntegration')

      // Verify skill NOT installed
      const pluginRegistry = await readJsonFile(path.join(testDir, '.claude/plugins/installed_plugins.json'))
      expect(Object.keys(pluginRegistry?.plugins || {})).not.toContain(
        'dual-type-integration@test-air-package-marketplace'
      )
    })

    it('should allow removing only skill type', async () => {
      // Install both
      await runCLI(['install', 'test-air-package/DualTypeIntegration'], testDir)

      // Remove only skill
      await runCLI(['remove', 'test-air-package/DualTypeIntegration', '--skill'], testDir)

      // Verify skill removed
      const pluginRegistry = await readJsonFile(path.join(testDir, '.claude/plugins/installed_plugins.json'))
      expect(Object.keys(pluginRegistry?.plugins || {})).not.toContain(
        'dual-type-integration@test-air-package-marketplace'
      )

      // Verify generic still installed
      const agentsContent = await fs.readFile(path.join(testDir, 'AGENTS.md'), 'utf8')
      expect(agentsContent).toContain('DualTypeIntegration')
    })

    it('should allow removing only generic type', async () => {
      // Install both
      await runCLI(['install', 'test-air-package/DualTypeIntegration'], testDir)

      // Remove only generic
      await runCLI(['remove', 'test-air-package/DualTypeIntegration', '--generic'], testDir)

      // Verify generic removed
      const agentsContent = await readFile(path.join(testDir, 'AGENTS.md'))
      expect(agentsContent).not.toContain('DualTypeIntegration')

      // Verify skill still installed
      const pluginRegistry = await readJsonFile(path.join(testDir, '.claude/plugins/installed_plugins.json'))
      expect(Object.keys(pluginRegistry?.plugins || {})).toContain('dual-type-integration@test-air-package-marketplace')
    })
  })

  describe('State persistence', () => {
    it('should persist installations across CLI invocations', async () => {
      // Install
      await runCLI(['install', 'test-air-package/SkillOnly'], testDir)

      // List (separate CLI invocation)
      const { stdout } = await runCLI(['list', '--installed'], testDir)
      expect(stdout).toContain('SkillOnly')
    })

    it('should maintain state after removal', async () => {
      // Install
      await runCLI(['install', 'test-air-package/SkillOnly'], testDir)

      // Remove
      await runCLI(['remove', 'test-air-package/SkillOnly'], testDir)

      // List (should not show as installed)
      const { stdout } = await runCLI(['list', '--installed'], testDir)
      expect(stdout).not.toContain('SkillOnly')
    })
  })
})
