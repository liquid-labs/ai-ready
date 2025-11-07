import { cmdInstall } from './install.js'
import * as cache from '../core/cache.js'
import * as registry from '../core/registry.js'
import { INTEGRATION_TYPES } from '../core/types.js'

jest.mock('../core/scanner.js')
jest.mock('../core/cache.js')
jest.mock('../core/registry.js')

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

    cache.loadProvidersWithCache.mockResolvedValue(mockProviders)
    registry.loadInstallationStatus.mockResolvedValue(mockProviders)
    registry.createBackup.mockResolvedValue(undefined)
    registry.readClaudeRegistry.mockResolvedValue([])
    registry.writeClaudeRegistry.mockResolvedValue(undefined)
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

      expect(registry.createBackup).toHaveBeenCalledWith('.claude')
      expect(registry.writeClaudeRegistry).toHaveBeenCalledWith(
        '.claude',
        expect.arrayContaining([
          expect.objectContaining({
            library     : 'test-lib',
            integration : 'SkillOnly',
          }),
        ])
      )
      expect(consoleLogSpy).toHaveBeenCalledWith('✔ Claude Skill installed')
    })

    it('should install Claude Skill with --skill flag', async () => {
      await cmdInstall('test-lib/DualType', { skill : true })

      expect(registry.writeClaudeRegistry).toHaveBeenCalled()
      expect(registry.writeGenericRegistry).not.toHaveBeenCalled()
    })

    it('should not install Claude Skill for generic-only integration', async () => {
      await cmdInstall('test-lib/GenericOnly', { skill : true })

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('No types available to install')
      expect(registry.writeClaudeRegistry).not.toHaveBeenCalled()
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
      expect(registry.writeClaudeRegistry).not.toHaveBeenCalled()
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

      expect(registry.writeClaudeRegistry).toHaveBeenCalled()
      expect(registry.writeGenericRegistry).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith('✔ Claude Skill installed')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '✔ Generic integration installed'
      )
    })

    it('should install all types when both flags specified', async () => {
      await cmdInstall('test-lib/DualType', { skill : true, generic : true })

      expect(registry.writeClaudeRegistry).toHaveBeenCalled()
      expect(registry.writeGenericRegistry).toHaveBeenCalled()
    })
  })

  describe('handling already installed types', () => {
    it('should skip already installed types', async () => {
      await cmdInstall('test-lib/AlreadyInstalled', {})

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('No types available to install')
    })

    it('should not re-add existing Claude Skill entries', async () => {
      // Start with one entry already in registry
      registry.readClaudeRegistry.mockResolvedValue([
        { library : 'other-lib', integration : 'Other' },
      ])

      const providers = [
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
          ],
        },
      ]

      registry.loadInstallationStatus.mockResolvedValue(providers)

      await cmdInstall('test-lib/SkillOnly', {})

      // Should add new entry without duplicating
      expect(registry.writeClaudeRegistry).toHaveBeenCalledWith(
        '.claude',
        expect.arrayContaining([
          { library : 'other-lib', integration : 'Other' },
          expect.objectContaining({
            library     : 'test-lib',
            integration : 'SkillOnly',
          }),
        ])
      )
    })

    it('should not re-add existing generic entries', async () => {
      // Start with one entry already in registry
      registry.readGenericRegistry.mockResolvedValue([
        { library : 'other-lib', integration : 'Other' },
      ])

      const providers = [
        {
          libraryName  : 'test-lib',
          version      : '1.0.0',
          path         : '/path',
          integrations : [
            {
              name           : 'GenericOnly',
              summary        : 'Generic only integration',
              types          : [INTEGRATION_TYPES.GENERIC],
              installedTypes : [],
            },
          ],
        },
      ]

      registry.loadInstallationStatus.mockResolvedValue(providers)

      await cmdInstall('test-lib/GenericOnly', {})

      // Should add new entry without duplicating
      expect(registry.writeGenericRegistry).toHaveBeenCalledWith(
        'AGENTS.md',
        expect.arrayContaining([
          { library : 'other-lib', integration : 'Other' },
          expect.objectContaining({
            library     : 'test-lib',
            integration : 'GenericOnly',
            summary     : 'Generic only integration',
          }),
        ])
      )
    })
  })

  describe('backup creation', () => {
    it('should create backups before modifying files', async () => {
      await cmdInstall('test-lib/DualType', {})

      expect(registry.createBackup).toHaveBeenCalledWith('.claude')
      expect(registry.createBackup).toHaveBeenCalledWith('AGENTS.md')
    })
  })

  describe('error handling', () => {
    it('should handle cache errors', async () => {
      cache.loadProvidersWithCache.mockRejectedValue(new Error('Cache error'))

      await cmdInstall('test-lib/Integration', {})

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error installing integration:',
        'Cache error'
      )
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should handle write errors', async () => {
      registry.writeClaudeRegistry.mockRejectedValue(new Error('Write error'))

      await cmdInstall('test-lib/SkillOnly', {})

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error installing integration:',
        'Write error'
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
