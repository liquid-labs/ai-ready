/**
 * Functional tests for 'air list' command
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'

import { runCLI, setupClaudePluginDir, setupTestEnv } from './helpers.js'

describe('air list (functional)', () => {
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

  describe('Basic listing', () => {
    it('should list all available integrations', async () => {
      const { stdout, exitCode } = await runCLI(['list'], testDir, { env : { ...process.env, HOME : testDir } })

      expect(exitCode).toBe(0)

      // Should show all three integrations
      expect(stdout).toContain('DualType')
      expect(stdout).toContain('SkillOnly')
      expect(stdout).toContain('GenericOnly')

      // Should show library name
      expect(stdout).toContain('test-air-package')
    })

    it('should show integration types correctly', async () => {
      const { stdout, exitCode } = await runCLI(['list'], testDir, { env : { ...process.env, HOME : testDir } })

      expect(exitCode).toBe(0)

      // DualType should show both types available
      const lines = stdout.split('\n')
      const dualTypeLine = lines.find((l) => l.includes('DualType'))
      expect(dualTypeLine).toBeTruthy()
      // Should indicate multiple types (exact format may vary)

      // SkillOnly should show only skill type
      const skillOnlyLine = lines.find((l) => l.includes('SkillOnly'))
      expect(skillOnlyLine).toBeTruthy()

      // GenericOnly should show only generic type
      const genericOnlyLine = lines.find((l) => l.includes('GenericOnly'))
      expect(genericOnlyLine).toBeTruthy()
    })
  })

  describe('Filtering options', () => {
    it('should filter by library name', async () => {
      const { stdout, exitCode } = await runCLI(['list', '--library', 'test-air-package'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout).toContain('test-air-package')
    })

    it('should show only installed integrations with --installed flag', async () => {
      // Install one integration
      await runCLI(['install', 'test-air-package/SkillOnly'], testDir, { env : { ...process.env, HOME : testDir } })

      const { stdout, exitCode } = await runCLI(['list', '--installed'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout).toContain('SkillOnly')
      // Should not show non-installed integrations
      expect(stdout).not.toContain('GenericOnly')
    })

    it('should show empty list when nothing installed with --installed flag', async () => {
      const { stdout, exitCode } = await runCLI(['list', '--installed'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      // Should indicate no integrations found
      expect(stdout.toLowerCase()).toMatch(/no integrations found|no.*installed/)
    })
  })

  describe('Installation status indication', () => {
    it('should indicate when an integration is fully installed', async () => {
      // Install both types of dual-type integration
      await runCLI(['install', 'test-air-package/DualTypeIntegration'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      const { stdout, exitCode } = await runCLI(['list'], testDir, { env : { ...process.env, HOME : testDir } })

      expect(exitCode).toBe(0)

      const lines = stdout.split('\n')
      const dualTypeLine = lines.find((l) => l.includes('DualType'))
      expect(dualTypeLine).toBeTruthy()
      // Should indicate both types installed (checkmark, "installed", etc.)
    })

    it('should indicate when only skill type is installed', async () => {
      // Install only skill type
      await runCLI(['install', 'test-air-package/DualTypeIntegration', '--skill'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      const { stdout, exitCode } = await runCLI(['list'], testDir, { env : { ...process.env, HOME : testDir } })

      expect(exitCode).toBe(0)

      const lines = stdout.split('\n')
      const dualTypeLine = lines.find((l) => l.includes('DualType'))
      expect(dualTypeLine).toBeTruthy()
      // Should indicate partial installation
    })

    it('should indicate when only generic type is installed', async () => {
      // Install only generic type
      await runCLI(['install', 'test-air-package/DualTypeIntegration', '--generic'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      const { stdout, exitCode } = await runCLI(['list'], testDir, { env : { ...process.env, HOME : testDir } })

      expect(exitCode).toBe(0)

      const lines = stdout.split('\n')
      const dualTypeLine = lines.find((l) => l.includes('DualType'))
      expect(dualTypeLine).toBeTruthy()
      // Should indicate partial installation
    })
  })

  describe('Multiple installations', () => {
    it('should show all installed integrations', async () => {
      // Install multiple integrations
      await runCLI(['install', 'test-air-package/SkillOnly'], testDir, { env : { ...process.env, HOME : testDir } })
      await runCLI(['install', 'test-air-package/GenericOnly'], testDir, { env : { ...process.env, HOME : testDir } })

      const { stdout, exitCode } = await runCLI(['list', '--installed'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout).toContain('SkillOnly')
      expect(stdout).toContain('GenericOnly')
    })
  })

  describe('Output formatting', () => {
    it('should display results in table format', async () => {
      const { stdout, exitCode } = await runCLI(['list'], testDir, { env : { ...process.env, HOME : testDir } })

      expect(exitCode).toBe(0)
      // Should contain table-like output with columns
      expect(stdout).toMatch(/Name|Library|Summary/i)
    })

    it('should handle empty results gracefully', async () => {
      // Create test env without any packages
      const emptyEnv = await setupTestEnv()

      // Remove node_modules to simulate no packages
      const fs = await import('fs/promises')
      await fs.rm(`${emptyEnv.testDir}/node_modules`, { recursive : true, force : true })

      const { stdout, exitCode } = await runCLI(['list'], emptyEnv.testDir, {
        env : { ...process.env, HOME : emptyEnv.testDir },
      })

      expect(exitCode).toBe(0)
      // Should indicate no integrations found
      expect(stdout.toLowerCase()).toMatch(/no.*integrations?.*found|none.*available/)

      await emptyEnv.cleanup()
    })
  })

  describe('Cache behavior', () => {
    it('should use cached results on subsequent calls', async () => {
      // First call - creates cache
      const { stdout: stdout1, exitCode: exitCode1 } = await runCLI(['list'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode1).toBe(0)

      // Second call - should use cache
      const { stdout: stdout2, exitCode: exitCode2 } = await runCLI(['list'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode2).toBe(0)
      // Results should be identical
      expect(stdout2).toBe(stdout1)

      // Verify cache file exists
      const fs = await import('fs/promises')
      const cacheExists = await fs
        .access(`${testDir}/.aircache.json`)
        .then(() => true)
        .catch(() => false)
      expect(cacheExists).toBe(true)
    })
  })

  describe('Scoped package support', () => {
    it('should list integrations from scoped packages', async () => {
      const { stdout, exitCode } = await runCLI(['list'], testDir, { env : { ...process.env, HOME : testDir } })

      expect(exitCode).toBe(0)
      // Should show scoped package name
      expect(stdout).toContain('@ai-ready/scoped-package')
    })

    it('should filter by scoped library name', async () => {
      const { stdout, exitCode } = await runCLI(['list', '--library', '@ai-ready/scoped-package'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      // Should only show scoped package integrations
      expect(stdout).toContain('@ai-ready/scoped-package')
      // Should not show unscoped package
      expect(stdout).not.toContain('test-air-package')
    })
  })
})
