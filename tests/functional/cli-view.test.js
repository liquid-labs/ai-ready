/**
 * Functional tests for 'air view' command
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  setupTestEnv,
  setupClaudePluginDir,
  runCLI
} from './helpers.js'

describe('air view (functional)', () => {
  let testDir
  let cleanup

  beforeEach(async () => {
    const env = await setupTestEnv()
    testDir = env.testDir
    cleanup = env.cleanup

    // Setup mock Claude plugin directory in test dir
    await setupClaudePluginDir(testDir)
  })

  afterEach(async () => {
    await cleanup()
  })

  describe('View integration details', () => {
    it('should display details for a skill-only integration', async () => {
      const { stdout, exitCode } = await runCLI(
        ['view', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      expect(stdout).toContain('SkillOnly')
      expect(stdout).toContain('A Claude Skill without generic component')
      expect(stdout).toContain('test-air-package')
    })

    it('should display details for a generic-only integration', async () => {
      const { stdout, exitCode } = await runCLI(
        ['view', 'test-air-package/GenericOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      expect(stdout).toContain('GenericOnly')
      expect(stdout).toContain('Generic instructions without Claude Skill component')
      expect(stdout).toContain('test-air-package')
    })

    it('should display details for a dual-type integration', async () => {
      const { stdout, exitCode } = await runCLI(
        ['view', 'test-air-package/DualTypeIntegration'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      // Should show integration name and both types
      expect(stdout).toContain('DualTypeIntegration')
      expect(stdout).toContain('genericIntegration')
      expect(stdout).toContain('claudeSkill')
      expect(stdout).toContain('test-air-package')
    })
  })

  describe('Installation status in view', () => {
    it('should indicate when integration is not installed', async () => {
      const { stdout, exitCode } = await runCLI(
        ['view', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      // Should show (none) for not installed
      expect(stdout.toLowerCase()).toMatch(/\(none\)|not.*installed/)
    })

    it('should indicate when skill-only integration is installed', async () => {
      // Install first
      await runCLI(
        ['install', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      const { stdout, exitCode } = await runCLI(
        ['view', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).toMatch(/installed/)
    })

    it('should indicate when generic-only integration is installed', async () => {
      // Install first
      await runCLI(
        ['install', 'test-air-package/GenericOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      const { stdout, exitCode } = await runCLI(
        ['view', 'test-air-package/GenericOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).toMatch(/installed/)
    })

    it('should show partial installation status for dual-type integration', async () => {
      // Install only skill
      await runCLI(
        ['install', 'test-air-package/DualTypeIntegration', '--skill'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      const { stdout, exitCode } = await runCLI(
        ['view', 'test-air-package/DualTypeIntegration'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      // Should show installed types including claudeSkill
      expect(stdout.toLowerCase()).toMatch(/installed.*claudeskill|claudeskill.*installed/)
    })

    it('should show full installation status for dual-type integration', async () => {
      // Install both types
      await runCLI(
        ['install', 'test-air-package/DualTypeIntegration'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      const { stdout, exitCode } = await runCLI(
        ['view', 'test-air-package/DualTypeIntegration'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      // Should indicate both types are installed
      const lines = stdout.toLowerCase()
      expect(lines).toMatch(/installed/)
    })
  })

  describe('Content display', () => {
    it('should display integration metadata', async () => {
      const { stdout, exitCode } = await runCLI(
        ['view', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      // Should show metadata summary format
      expect(stdout).toContain('Library')
      expect(stdout).toContain('Integration')
      expect(stdout).toContain('Summary')
      expect(stdout).toContain('Types')
      expect(stdout).toContain('Installed')
    })

    it('should display integration name and summary', async () => {
      const { stdout, exitCode } = await runCLI(
        ['view', 'test-air-package/GenericOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      expect(stdout).toContain('GenericOnly')
      expect(stdout).toContain('Generic instructions')
    })
  })

  describe('Error handling', () => {
    it('should fail gracefully for non-existent integration', async () => {
      const { stderr, exitCode } = await runCLI(
        ['view', 'test-air-package/NonExistent'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).not.toBe(0)
      expect(stderr).toContain('not found')
    })

    it('should fail gracefully for invalid integration path', async () => {
      const { stderr, exitCode } = await runCLI(
        ['view', 'invalid-format'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).not.toBe(0)
      expect(stderr.toLowerCase()).toMatch(/invalid|not found/)
    })
  })

  describe('Library information', () => {
    it('should display library name and version', async () => {
      const { stdout, exitCode } = await runCLI(
        ['view', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      expect(stdout).toContain('test-air-package')
      expect(stdout).toContain('1.0.0')
    })

    it('should display library name and version', async () => {
      const { stdout, exitCode } = await runCLI(
        ['view', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      // Should show library name and version in format "Library : name (vX.X.X)"
      expect(stdout).toMatch(/test-air-package/)
      expect(stdout).toMatch(/v1\.0\.0/)
    })
  })

  describe('Type-specific views', () => {
    it('should show skill-specific information for Claude Skills', async () => {
      const { stdout, exitCode } = await runCLI(
        ['view', 'test-air-package/SkillOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      // Should indicate it's a Claude Skill
      expect(stdout.toLowerCase()).toMatch(/claude.*skill|skill/)
    })

    it('should show generic-specific information for generic integrations', async () => {
      const { stdout, exitCode } = await runCLI(
        ['view', 'test-air-package/GenericOnly'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      // Should indicate it's a generic integration
      expect(stdout.toLowerCase()).toMatch(/generic|instructions/)
    })

    it('should show both type information for dual-type integrations', async () => {
      const { stdout, exitCode } = await runCLI(
        ['view', 'test-air-package/DualTypeIntegration'],
        testDir,
        { env: { ...process.env, HOME: testDir } }
      )

      expect(exitCode).toBe(0)
      // Should show information about both types
      expect(stdout.toLowerCase()).toMatch(/skill/)
      expect(stdout.toLowerCase()).toMatch(/generic/)
    })
  })
})
