import { cmdRemove } from '../../../lib/commands/remove'
import * as cache from '../../../lib/storage/cache'
import * as registry from '../../../lib/storage/registry'
import * as pluginRegistry from '../../../lib/storage/claude-plugin-registry'
import { INTEGRATION_TYPES } from '../../../lib/types'

jest.mock('../../../lib/scanner')
jest.mock('../../../lib/storage/cache')
jest.mock('../../../lib/storage/registry')
jest.mock('../../../lib/storage/claude-plugin-registry')

describe('remove command', () => {
  let consoleLogSpy
  let consoleErrorSpy
  let processExitSpy
  let mockRegistryInstance

  const mockProviders = [
    {
      libraryName  : 'test-lib',
      version      : '1.0.0',
      path         : '/path',
      integrations : [
        {
          name           : 'SkillInstalled',
          summary        : 'Installed skill',
          types          : [INTEGRATION_TYPES.CLAUDE_SKILL],
          installedTypes : [INTEGRATION_TYPES.CLAUDE_SKILL],
        },
        {
          name           : 'GenericInstalled',
          summary        : 'Installed generic',
          types          : [INTEGRATION_TYPES.GENERIC],
          installedTypes : [INTEGRATION_TYPES.GENERIC],
        },
        {
          name           : 'BothInstalled',
          summary        : 'Both types installed',
          types          : [INTEGRATION_TYPES.GENERIC, INTEGRATION_TYPES.CLAUDE_SKILL],
          installedTypes : [INTEGRATION_TYPES.GENERIC, INTEGRATION_TYPES.CLAUDE_SKILL],
        },
        {
          name           : 'NotInstalled',
          summary        : 'Not installed',
          types          : [INTEGRATION_TYPES.GENERIC],
          installedTypes : [],
        },
      ],
    },
  ]

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation()

    // Create mock registry instance
    mockRegistryInstance = {
      removePlugin      : jest.fn().mockResolvedValue(undefined),
      isPluginInstalled : jest.fn().mockResolvedValue(false),
    }

    // Mock getDefaultRegistry to return our mock instance
    // eslint-disable-next-line no-import-assign
    pluginRegistry.getDefaultRegistry = jest.fn().mockReturnValue(mockRegistryInstance)

    cache.loadProvidersWithCache.mockResolvedValue({
      npmProviders    : mockProviders,
      remoteProviders : [],
    })
    registry.loadInstallationStatus.mockResolvedValue(mockProviders)
    registry.createBackup.mockResolvedValue(undefined)
    registry.readGenericRegistry.mockResolvedValue([
      { library : 'test-lib', integration : 'GenericInstalled' },
      { library : 'test-lib', integration : 'BothInstalled' },
    ])
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
      await cmdRemove(undefined, {})

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error: Please specify library/integration format (e.g., my-lib/MyIntegration)'
      )
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should error without slash in argument', async () => {
      await cmdRemove('test-lib', {})

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error: Please specify library/integration format (e.g., my-lib/MyIntegration)'
      )
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should error for non-existent library', async () => {
      await cmdRemove('nonexistent/Integration', {})

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: Library 'nonexistent' not found")
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should error for non-existent integration', async () => {
      await cmdRemove('test-lib/NonExistent', {})

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: Integration 'NonExistent' not found in library 'test-lib'")
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('removing Claude Skills', () => {
    it('should remove Claude Skill type', async () => {
      await cmdRemove('test-lib/SkillInstalled', {})

      expect(mockRegistryInstance.removePlugin).toHaveBeenCalledWith('test-lib', 'SkillInstalled')
      expect(consoleLogSpy).toHaveBeenCalledWith('✔ Claude Skill removed')
    })

    it('should remove Claude Skill with --skill flag', async () => {
      await cmdRemove('test-lib/BothInstalled', { skill : true })

      expect(mockRegistryInstance.removePlugin).toHaveBeenCalled()
      expect(registry.writeGenericRegistry).not.toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith('✔ Claude Skill removed')
    })

    it('should not remove Claude Skill for generic-only installed integration', async () => {
      await cmdRemove('test-lib/GenericInstalled', { skill : true })

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('No installed types to remove')
    })
  })

  describe('removing generic integrations', () => {
    it('should remove generic integration type', async () => {
      await cmdRemove('test-lib/GenericInstalled', {})

      expect(registry.writeGenericRegistry).toHaveBeenCalledWith(
        'AGENTS.md',
        expect.arrayContaining([{ library : 'test-lib', integration : 'BothInstalled' }])
      )
      expect(consoleLogSpy).toHaveBeenCalledWith('✔ Generic integration removed')
    })

    it('should remove generic with --generic flag', async () => {
      await cmdRemove('test-lib/BothInstalled', { generic : true })

      expect(registry.writeGenericRegistry).toHaveBeenCalled()
      expect(mockRegistryInstance.removePlugin).not.toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith('✔ Generic integration removed')
    })

    it('should not remove generic for skill-only installed integration', async () => {
      await cmdRemove('test-lib/SkillInstalled', { generic : true })

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('No installed types to remove')
    })
  })

  describe('removing both types', () => {
    it('should remove all types when no flags specified', async () => {
      await cmdRemove('test-lib/BothInstalled', {})

      expect(mockRegistryInstance.removePlugin).toHaveBeenCalled()
      expect(registry.writeGenericRegistry).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith('✔ Claude Skill removed')
      expect(consoleLogSpy).toHaveBeenCalledWith('✔ Generic integration removed')
    })

    it('should remove all types when both flags specified', async () => {
      await cmdRemove('test-lib/BothInstalled', { skill : true, generic : true })

      expect(mockRegistryInstance.removePlugin).toHaveBeenCalled()
      expect(registry.writeGenericRegistry).toHaveBeenCalled()
    })
  })

  describe('handling not installed types', () => {
    it('should show message when nothing to remove', async () => {
      await cmdRemove('test-lib/NotInstalled', {})

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('No installed types to remove')
    })
  })

  describe('backup creation', () => {
    it('should create backups before modifying generic files', async () => {
      await cmdRemove('test-lib/BothInstalled', {})

      expect(registry.createBackup).toHaveBeenCalledWith('AGENTS.md')
    })
  })

  describe('filtering entries', () => {
    it('should remove only the specified integration from generic registry', async () => {
      await cmdRemove('test-lib/GenericInstalled', {})

      const writtenEntries = registry.writeGenericRegistry.mock.calls[0][1]
      expect(writtenEntries).not.toContainEqual(
        expect.objectContaining({
          library     : 'test-lib',
          integration : 'GenericInstalled',
        })
      )
      expect(writtenEntries).toContainEqual({
        library     : 'test-lib',
        integration : 'BothInstalled',
      })
    })
  })

  describe('error handling', () => {
    it('should handle cache errors', async () => {
      cache.loadProvidersWithCache.mockRejectedValue(new Error('Cache error'))

      await cmdRemove('test-lib/Integration', {})

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error removing integration: Cache error')
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should handle plugin removal errors', async () => {
      mockRegistryInstance.removePlugin.mockRejectedValue(new Error('Plugin error'))

      await cmdRemove('test-lib/SkillInstalled', {})

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error removing integration: Plugin error')
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('output messages', () => {
    it('should show removal progress message', async () => {
      await cmdRemove('test-lib/SkillInstalled', {})

      expect(consoleLogSpy).toHaveBeenCalledWith('Removing test-lib/SkillInstalled ...')
      expect(consoleLogSpy).toHaveBeenCalledWith('✔ Removal complete')
    })
  })
})
