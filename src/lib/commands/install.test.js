import { cmdInstall } from './install'
import * as cache from '../core/cache'
import * as registry from '../core/registry'
import { INTEGRATION_TYPES } from '../core/types'

jest.mock('../core/scanner')
jest.mock('../core/cache')
jest.mock('../core/registry')

describe('install command', () => {
  let consoleLogSpy
  let consoleErrorSpy
  let processExitSpy

  const mockProviders = [
    {
      libraryName  : 'test-lib',
      version      : '1.0.0',
      path         : '/path',
      integrations : [
        {
          name           : 'SkillOnly',
          summary        : 'Skill only integration',
          types          : [INTEGRATION_TYPES.CLAUDE_SKILL],
          installedTypes : [],
        },
        {
          name           : 'GenericOnly',
          summary        : 'Generic only integration',
          types          : [INTEGRATION_TYPES.GENERIC],
          installedTypes : [],
        },
        {
          name           : 'DualType',
          summary        : 'Dual type integration',
          types          : [INTEGRATION_TYPES.GENERIC, INTEGRATION_TYPES.CLAUDE_SKILL],
          installedTypes : [],
        },
        {
          name           : 'AlreadyInstalled',
          summary        : 'Already installed',
          types          : [INTEGRATION_TYPES.GENERIC],
          installedTypes : [INTEGRATION_TYPES.GENERIC],
        },
      ],
    },
  ]

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation()

    cache.loadProvidersWithCache.mockResolvedValue({
      npmProviders    : mockProviders,
      remoteProviders : [],
    })
    registry.loadInstallationStatus.mockResolvedValue(mockProviders)
    registry.createBackup.mockResolvedValue(undefined)
    registry.installClaudeSkillSymlink.mockResolvedValue(undefined)
    registry.readGenericRegistry.mockResolvedValue([])
    registry.writeGenericRegistry.mockResolvedValue(undefined)
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
    jest.clearAllMocks()
  })

  describe('input validation', () => {
    it('should error without library/integration argument', async () => {
      await cmdInstall(undefined, {})

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error: Please specify library/integration format (e.g., my-lib/MyIntegration)'
      )
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should error without slash in argument', async () => {
      await cmdInstall('test-lib', {})

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error: Please specify library/integration format (e.g., my-lib/MyIntegration)'
      )
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should error for non-existent library', async () => {
      await cmdInstall('nonexistent/Integration', {})

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: Library 'nonexistent' not found"
      )
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should error for non-existent integration', async () => {
      await cmdInstall('test-lib/NonExistent', {})

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error: Integration 'NonExistent' not found in library 'test-lib'"
      )
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('installing Claude Skills', () => {
    it('should install Claude Skill type', async () => {
      await cmdInstall('test-lib/SkillOnly', {})

      expect(registry.installClaudeSkillSymlink).toHaveBeenCalledWith(
        '.claude/skills',
        'SkillOnly',
        expect.stringContaining(
          '/ai-ready/integrations/skill-only/claude-skill'
        )
      )
      expect(consoleLogSpy).toHaveBeenCalledWith('✔ Claude Skill installed')
    })

    it('should install Claude Skill with --skill flag', async () => {
      await cmdInstall('test-lib/DualType', { skill : true })

      expect(registry.installClaudeSkillSymlink).toHaveBeenCalled()
      expect(registry.writeGenericRegistry).not.toHaveBeenCalled()
    })

    it('should not install Claude Skill for generic-only integration', async () => {
      await cmdInstall('test-lib/GenericOnly', { skill : true })

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('No types available to install')
      expect(registry.installClaudeSkillSymlink).not.toHaveBeenCalled()
    })
  })

  describe('installing generic integrations', () => {
    it('should install generic integration type', async () => {
      await cmdInstall('test-lib/GenericOnly', {})

      expect(registry.createBackup).toHaveBeenCalledWith('AGENTS.md')
      expect(registry.writeGenericRegistry).toHaveBeenCalledWith(
        'AGENTS.md',
        expect.arrayContaining([
          expect.objectContaining({
            library     : 'test-lib',
            integration : 'GenericOnly',
            summary     : 'Generic only integration',
          }),
        ])
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '✔ Generic integration installed'
      )
    })

    it('should install generic with --generic flag', async () => {
      await cmdInstall('test-lib/DualType', { generic : true })

      expect(registry.writeGenericRegistry).toHaveBeenCalled()
      expect(registry.installClaudeSkillSymlink).not.toHaveBeenCalled()
    })

    it('should not install generic for skill-only integration', async () => {
      await cmdInstall('test-lib/SkillOnly', { generic : true })

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('No types available to install')
      expect(registry.writeGenericRegistry).not.toHaveBeenCalled()
    })
  })

  describe('installing both types', () => {
    it('should install all types when no flags specified', async () => {
      await cmdInstall('test-lib/DualType', {})

      expect(registry.installClaudeSkillSymlink).toHaveBeenCalled()
      expect(registry.writeGenericRegistry).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith('✔ Claude Skill installed')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '✔ Generic integration installed'
      )
    })

    it('should install all types when both flags specified', async () => {
      await cmdInstall('test-lib/DualType', { skill : true, generic : true })

      expect(registry.installClaudeSkillSymlink).toHaveBeenCalled()
      expect(registry.writeGenericRegistry).toHaveBeenCalled()
    })
  })

  describe('handling already installed types', () => {
    it('should skip already installed types', async () => {
      await cmdInstall('test-lib/AlreadyInstalled', {})

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('No types available to install')
    })
  })

  describe('backup creation', () => {
    it('should create backups before modifying generic files', async () => {
      await cmdInstall('test-lib/DualType', {})

      expect(registry.createBackup).toHaveBeenCalledWith('AGENTS.md')
    })
  })

  describe('error handling', () => {
    it('should handle cache errors', async () => {
      cache.loadProvidersWithCache.mockRejectedValue(new Error('Cache error'))

      await cmdInstall('test-lib/Integration', {})

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error installing integration: Cache error'
      )
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should handle symlink errors', async () => {
      registry.installClaudeSkillSymlink.mockRejectedValue(
        new Error('Symlink error')
      )

      await cmdInstall('test-lib/SkillOnly', {})

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error installing integration: Symlink error'
      )
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('output messages', () => {
    it('should show installation progress message', async () => {
      await cmdInstall('test-lib/SkillOnly', {})

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Installing test-lib/SkillOnly ...'
      )
      expect(consoleLogSpy).toHaveBeenCalledWith('✔ Installation complete')
    })
  })
})
