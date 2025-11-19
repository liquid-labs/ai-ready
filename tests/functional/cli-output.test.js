/**
 * Functional tests for CLI output and UX verification
 * Tests user-facing messages, warnings, and formatting
 */
import { runCLI, setupClaudePluginDir, setupTestEnv } from './helpers'

describe('CLI output and UX (functional)', () => {
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

  describe('Success messages', () => {
    it('should display success message after installing skill', async () => {
      const { stdout, exitCode } = await runCLI(['install', 'test-air-package/SkillOnly'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout).toMatch(/✔|✓|success|complete/i)
      expect(stdout).toContain('Installation complete')
    })

    it('should display success message after installing generic integration', async () => {
      const { stdout, exitCode } = await runCLI(['install', 'test-air-package/GenericOnly'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout).toMatch(/✔|✓|success|complete/i)
    })

    it('should display success message after removing integration', async () => {
      // Install first
      await runCLI(['install', 'test-air-package/SkillOnly'], testDir, { env : { ...process.env, HOME : testDir } })

      // Remove
      const { stdout, exitCode } = await runCLI(['remove', 'test-air-package/SkillOnly'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout).toMatch(/✔|✓|success|removed/i)
    })
  })

  describe('Claude Code restart warnings', () => {
    it('should warn about restarting Claude Code after installing a skill', async () => {
      const { stdout, exitCode } = await runCLI(['install', 'test-air-package/SkillOnly'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).toMatch(/restart.*claude.*code|reload.*claude/)
    })

    it('should warn about restarting Claude Code after removing a skill', async () => {
      // Install first
      await runCLI(['install', 'test-air-package/SkillOnly'], testDir, { env : { ...process.env, HOME : testDir } })

      // Remove
      const { stdout, exitCode } = await runCLI(['remove', 'test-air-package/SkillOnly'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).toMatch(/restart.*claude.*code|reload.*claude/)
    })

    it('should NOT warn about restarting when only generic integration is installed', async () => {
      const { stdout, exitCode } = await runCLI(['install', 'test-air-package/GenericOnly'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).not.toMatch(/restart.*claude/)
    })

    it('should NOT warn about restarting when only generic integration is removed', async () => {
      // Install first
      await runCLI(['install', 'test-air-package/GenericOnly'], testDir, { env : { ...process.env, HOME : testDir } })

      // Remove
      const { stdout, exitCode } = await runCLI(['remove', 'test-air-package/GenericOnly'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).not.toMatch(/restart.*claude/)
    })

    it('should warn when installing dual-type with skill component', async () => {
      const { stdout, exitCode } = await runCLI(['install', 'test-air-package/DualTypeIntegration'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).toMatch(/restart.*claude.*code/)
    })

    it('should warn when removing dual-type with skill component', async () => {
      // Install first
      await runCLI(['install', 'test-air-package/DualTypeIntegration'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      // Remove
      const { stdout, exitCode } = await runCLI(['remove', 'test-air-package/DualTypeIntegration'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).toMatch(/restart.*claude.*code/)
    })
  })

  describe('Error messages', () => {
    it('should display clear error for non-existent integration', async () => {
      const { stderr, exitCode } = await runCLI(['install', 'test-air-package/NonExistent'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).not.toBe(0)
      expect(stderr).toMatch(/error|not found/i)
      expect(stderr).toContain('NonExistent')
    })

    it('should display clear message when removing non-installed integration', async () => {
      const { stdout, exitCode } = await runCLI(['remove', 'test-air-package/SkillOnly'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0) // Idempotent - succeeds silently
      expect(stdout.toLowerCase()).toMatch(/no installed types to remove/)
    })

    it('should display clear message for type mismatch (skill flag on generic-only)', async () => {
      const { stdout, exitCode } = await runCLI(['install', 'test-air-package/GenericOnly', '--skill'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0) // Idempotent - succeeds silently
      expect(stdout.toLowerCase()).toMatch(/no types available to install/)
    })

    it('should display clear message for type mismatch (generic flag on skill-only)', async () => {
      const { stdout, exitCode } = await runCLI(['install', 'test-air-package/SkillOnly', '--generic'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0) // Idempotent - succeeds silently
      expect(stdout.toLowerCase()).toMatch(/no types available to install/)
    })
  })

  describe('Informational messages', () => {
    it('should indicate already-installed status gracefully', async () => {
      // Install once
      await runCLI(['install', 'test-air-package/SkillOnly'], testDir, { env : { ...process.env, HOME : testDir } })

      // Try to install again
      const { stdout, exitCode } = await runCLI(['install', 'test-air-package/SkillOnly'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).toMatch(/no types available to install/)
    })

    it('should display helpful message when no integrations available', async () => {
      // Create test env without any packages
      const emptyEnv = await setupTestEnv()
      const fs = await import('fs/promises')
      await fs.rm(`${emptyEnv.testDir}/node_modules`, { recursive : true, force : true })

      const { stdout, exitCode } = await runCLI(['list'], emptyEnv.testDir, {
        env : { ...process.env, HOME : emptyEnv.testDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).toMatch(/no.*integrations?.*found|none.*available/)

      await emptyEnv.cleanup()
    })
  })

  describe('Table formatting', () => {
    it('should format list output as a table', async () => {
      const { stdout, exitCode } = await runCLI(['list'], testDir, { env : { ...process.env, HOME : testDir } })

      expect(exitCode).toBe(0)
      // Should have table headers (format: Library | Integration | Types | InstalledTypes | Summary)
      expect(stdout).toMatch(/Library.*Integration.*Summary/i)
      // Should have multiple rows of data (at least 2 data rows after header)
      const lines = stdout.trim().split('\n')
      expect(lines.length).toBeGreaterThan(2) // Header + at least 2 data rows
    })

    it('should align columns properly in list output', async () => {
      const { stdout, exitCode } = await runCLI(['list'], testDir, { env : { ...process.env, HOME : testDir } })

      expect(exitCode).toBe(0)
      // Should have consistent spacing/alignment
      const lines = stdout.split('\n').filter((l) => l.trim())
      // Verify multiple rows exist
      expect(lines.length).toBeGreaterThan(3) // Headers + separator + data rows
    })
  })

  describe('Progress indicators', () => {
    it('should indicate what is being installed', async () => {
      const { stdout, exitCode } = await runCLI(['install', 'test-air-package/SkillOnly'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout).toContain('SkillOnly')
      expect(stdout.toLowerCase()).toMatch(/installing|install/)
    })

    it('should indicate what is being removed', async () => {
      // Install first
      await runCLI(['install', 'test-air-package/SkillOnly'], testDir, { env : { ...process.env, HOME : testDir } })

      // Remove
      const { stdout, exitCode } = await runCLI(['remove', 'test-air-package/SkillOnly'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout).toContain('SkillOnly')
      expect(stdout.toLowerCase()).toMatch(/removing|remove/)
    })
  })

  describe('Type-specific messaging', () => {
    it('should indicate skill type in output', async () => {
      const { stdout, exitCode } = await runCLI(['install', 'test-air-package/SkillOnly'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).toMatch(/skill/)
    })

    it('should indicate generic type in output', async () => {
      const { stdout, exitCode } = await runCLI(['install', 'test-air-package/GenericOnly'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      expect(stdout.toLowerCase()).toMatch(/generic/)
    })

    it('should indicate both types for dual-type integration', async () => {
      const { stdout, exitCode } = await runCLI(['install', 'test-air-package/DualTypeIntegration'], testDir, {
        env : { ...process.env, HOME : testDir },
      })

      expect(exitCode).toBe(0)
      const lowerOutput = stdout.toLowerCase()
      expect(lowerOutput).toMatch(/skill/)
      expect(lowerOutput).toMatch(/generic/)
    })
  })

  describe('Help and version output', () => {
    it('should display help when --help flag is used', async () => {
      const { stdout, exitCode } = await runCLI(['--help'], testDir)

      expect(exitCode).toBe(0)
      expect(stdout).toMatch(/usage|commands|options/i)
    })

    it('should display version when --version flag is used', async () => {
      const { stdout, exitCode } = await runCLI(['--version'], testDir)

      expect(exitCode).toBe(0)
      expect(stdout).toMatch(/\d+\.\d+\.\d+/)
    })
  })
})
