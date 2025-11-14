import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { cmdVerify } from './verify'

describe('verify command', () => {
  let tempDir
  let consoleLogSpy
  let consoleErrorSpy
  let processExitSpy

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-verify-test-'))
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()

    if (tempDir) {
      // await fs.rm(tempDir, { recursive : true, force : true })
    }
  })

  describe('directory validation', () => {
    it('should fail if ai-ready/integrations directory does not exist', async () => {
      await cmdVerify({ path : tempDir })

      expect(consoleErrorSpy).toHaveBeenCalledWith('✗ No ai-ready/integrations directory found')
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should fail if ai-ready/integrations is not a directory', async () => {
      const integrationsPath = path.join(tempDir, 'ai-ready', 'integrations')
      await fs.mkdir(path.dirname(integrationsPath), { recursive : true })
      await fs.writeFile(integrationsPath, 'not a directory', 'utf8')

      await cmdVerify({ path : tempDir })

      expect(consoleErrorSpy).toHaveBeenCalledWith('✗ ai-ready/integrations exists but is not a directory')
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should fail if ai-ready/integrations is empty', async () => {
      const integrationsPath = path.join(tempDir, 'ai-ready', 'integrations')
      await fs.mkdir(integrationsPath, { recursive : true })

      await cmdVerify({ path : tempDir })

      expect(consoleErrorSpy).toHaveBeenCalledWith('✗ No integration directories found in ai-ready/integrations/')
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('generic integration validation', () => {
    it('should verify valid generic integration', async () => {
      await createIntegration(tempDir, 'TestIntegration', {
        generic : {
          name    : 'TestIntegration',
          summary : 'A test integration',
        },
      })

      await cmdVerify({ path : tempDir })

      expect(consoleLogSpy).toHaveBeenCalledWith('✔ All integrations verified successfully')
      expect(processExitSpy).not.toHaveBeenCalled()
    })

    it('should fail if generic integration missing name', async () => {
      await createIntegration(tempDir, 'BadIntegration', {
        generic : {
          summary : 'Missing name',
        },
      })

      await cmdVerify({ path : tempDir })

      expect(consoleErrorSpy).toHaveBeenCalledWith('✗ Verification failed with errors')
      expect(processExitSpy).toHaveBeenCalledWith(1)

      const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('ERROR: AI_INTEGRATION.md: Missing or invalid "name"')
    })

    it('should fail if generic integration missing summary', async () => {
      await createIntegration(tempDir, 'BadIntegration', {
        generic : {
          name : 'BadIntegration',
        },
      })

      await cmdVerify({ path : tempDir })

      expect(consoleErrorSpy).toHaveBeenCalledWith('✗ Verification failed with errors')

      const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('ERROR: AI_INTEGRATION.md: Missing or invalid "summary"')
    })

    it('should fail if generic integration has empty name', async () => {
      await createIntegration(tempDir, 'BadIntegration', {
        generic : {
          name    : '',
          summary : 'Test',
        },
      })

      await cmdVerify({ path : tempDir })

      const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('ERROR: AI_INTEGRATION.md: Missing or invalid "name"')
    })

    it('should warn if generic integration has no content', async () => {
      const integrationPath = path.join(tempDir, 'ai-ready', 'integrations', 'NoContent')
      await fs.mkdir(integrationPath, { recursive : true })

      await fs.writeFile(
        path.join(integrationPath, 'AI_INTEGRATION.md'),
        '---\nname: NoContent\nsummary: Test\n---\n',
        'utf8'
      )

      await cmdVerify({ path : tempDir })

      const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('WARNING: AI_INTEGRATION.md: No content after frontmatter')
    })
  })

  describe('Claude Skill validation', () => {
    it('should verify valid Claude Skill', async () => {
      await createIntegration(tempDir, 'TestSkill', {
        skill : {
          name    : 'TestSkill',
          summary : 'A test skill',
        },
      })

      await cmdVerify({ path : tempDir })

      expect(consoleLogSpy).toHaveBeenCalledWith('✔ All integrations verified successfully')
    })

    it('should fail if skill missing name', async () => {
      await createIntegration(tempDir, 'BadSkill', {
        skill : {
          summary : 'Missing name',
        },
      })

      await cmdVerify({ path : tempDir })

      const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('ERROR: claude-skill/SKILL.md: Missing or invalid "name"')
    })

    it('should fail if skill missing summary', async () => {
      await createIntegration(tempDir, 'BadSkill', {
        skill : {
          name : 'BadSkill',
        },
      })

      await cmdVerify({ path : tempDir })

      const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('ERROR: claude-skill/SKILL.md: Missing or invalid "summary"')
    })

    it('should warn if skill has no content', async () => {
      const integrationPath = path.join(tempDir, 'ai-ready', 'integrations', 'NoContent')
      const skillPath = path.join(integrationPath, 'claude-skill')
      await fs.mkdir(skillPath, { recursive : true })

      await fs.writeFile(path.join(skillPath, 'SKILL.md'), '---\nname: NoContent\nsummary: Test\n---\n', 'utf8')

      await cmdVerify({ path : tempDir })

      const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('WARNING: claude-skill/SKILL.md: No content after frontmatter')
    })
  })

  describe('dual-type integration validation', () => {
    it('should verify integration with both types', async () => {
      await createIntegration(tempDir, 'DualType', {
        generic : {
          name    : 'DualType',
          summary : 'Test integration',
        },
        skill : {
          name    : 'DualType',
          summary : 'Test skill',
        },
      })

      await cmdVerify({ path : tempDir })

      expect(consoleLogSpy).toHaveBeenCalledWith('✔ All integrations verified successfully')

      const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('(generic, skill)')
    })

    it('should warn if names mismatch between types', async () => {
      await createIntegration(tempDir, 'MismatchNames', {
        generic : {
          name    : 'GenericName',
          summary : 'Test',
        },
        skill : {
          name    : 'SkillName',
          summary : 'Test',
        },
      })

      await cmdVerify({ path : tempDir })

      const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain(
        'WARNING: Name mismatch: AI_INTEGRATION.md has "GenericName" but claude-skill/SKILL.md has "SkillName"'
      )
    })
  })

  describe('integration without valid files', () => {
    it('should fail if integration has no valid metadata files', async () => {
      const integrationPath = path.join(tempDir, 'ai-ready', 'integrations', 'Empty')
      await fs.mkdir(integrationPath, { recursive : true })

      await cmdVerify({ path : tempDir })

      const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('ERROR: No valid integration files found')
    })
  })

  describe('multiple integrations', () => {
    it('should verify multiple integrations', async () => {
      await createIntegration(tempDir, 'Integration1', {
        generic : {
          name    : 'Integration1',
          summary : 'First integration',
        },
      })

      await createIntegration(tempDir, 'Integration2', {
        skill : {
          name    : 'Integration2',
          summary : 'Second integration',
        },
      })

      await cmdVerify({ path : tempDir })

      expect(consoleLogSpy).toHaveBeenCalledWith('✔ All integrations verified successfully')

      const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('Found 2 integration(s) to verify')
      expect(output).toContain('✔ Integration1')
      expect(output).toContain('✔ Integration2')
    })

    it('should show all errors across multiple integrations', async () => {
      await createIntegration(tempDir, 'Good', {
        generic : {
          name    : 'Good',
          summary : 'Valid',
        },
      })

      await createIntegration(tempDir, 'Bad', {
        generic : {
          summary : 'Missing name',
        },
      })

      await cmdVerify({ path : tempDir })

      const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('✔ Good')
      expect(output).toContain('✗ Bad')
      expect(output).toContain('ERROR:')
      expect(consoleErrorSpy).toHaveBeenCalledWith('✗ Verification failed with errors')
    })
  })

  describe('output formatting', () => {
    it('should show integration type in output', async () => {
      await createIntegration(tempDir, 'TestIntegration', {
        generic : {
          name    : 'TestIntegration',
          summary : 'Test',
        },
      })

      await cmdVerify({ path : tempDir })

      const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('✔ TestIntegration (generic)')
    })

    it('should show integration names in output', async () => {
      await createIntegration(tempDir, 'TestIntegration', {
        generic : {
          name    : 'MyGenericName',
          summary : 'Test',
        },
      })

      await cmdVerify({ path : tempDir })

      const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
      expect(output).toContain('Name: generic: "MyGenericName"')
    })
  })
})

/**
 * Helper to create a test integration
 * @param {string} baseDir - Base directory
 * @param {string} name - Integration name
 * @param {object} options - Integration options
 * @param {object} [options.generic] - Generic integration metadata
 * @param {object} [options.skill] - Skill metadata
 */
async function createIntegration(baseDir, name, options) {
  const integrationPath = path.join(baseDir, 'ai-ready', 'integrations', name)
  await fs.mkdir(integrationPath, { recursive : true })

  if (options.generic) {
    const frontmatter = Object.entries(options.generic)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')

    await fs.writeFile(
      path.join(integrationPath, 'AI_INTEGRATION.md'),
      `---\n${frontmatter}\n---\n\n# Generic Integration\n\nThis is content.\n`,
      'utf8'
    )
  }

  if (options.skill) {
    const skillPath = path.join(integrationPath, 'claude-skill')
    await fs.mkdir(skillPath, { recursive : true })

    const frontmatter = Object.entries(options.skill)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')

    await fs.writeFile(
      path.join(skillPath, 'SKILL.md'),
      `---\n${frontmatter}\n---\n\n# Claude Skill\n\nThis is content.\n`,
      'utf8'
    )
  }
}
