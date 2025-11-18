import { cmdView } from '../../../../src/lib/commands/view'
import * as cache from '../storage/cache'
import * as registry from '../storage/registry'
import { INTEGRATION_TYPES } from '../types'

jest.mock('../scanner.js')
jest.mock('../storage/cache.js')
jest.mock('../storage/registry.js')

describe('view command', () => {
  let consoleLogSpy
  let consoleErrorSpy
  let processExitSpy

  const mockProviders = [
    {
      libraryName  : 'test-lib',
      version      : '1.0.0',
      path         : '/path/to/test-lib',
      integrations : [
        {
          name           : 'Integration1',
          summary        : 'First integration',
          types          : [INTEGRATION_TYPES.GENERIC],
          installedTypes : [INTEGRATION_TYPES.GENERIC],
        },
        {
          name           : 'Integration2',
          summary        : 'Second integration',
          types          : [INTEGRATION_TYPES.CLAUDE_SKILL],
          installedTypes : [],
        },
      ],
    },
    {
      libraryName  : 'other-lib',
      version      : '2.0.0',
      path         : '/path/to/other-lib',
      integrations : [],
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
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
    jest.clearAllMocks()
  })

  describe('viewing library', () => {
    it('should display library details', async () => {
      await cmdView('test-lib')

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('Library : test-lib (v1.0.0)')
      expect(output).toContain('Path    : /path/to/test-lib')
      expect(output).toContain('Integrations:')
    })

    it('should list integrations in library', async () => {
      await cmdView('test-lib')

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('Integration1')
      expect(output).toContain('First integration')
      expect(output).toContain('Integration2')
      expect(output).toContain('Second integration')
    })

    it('should mark installed integrations', async () => {
      await cmdView('test-lib')

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('Integration1 [installed]')
      expect(output).not.toContain('Integration2 [installed]')
    })

    it('should show (none) for library with no integrations', async () => {
      await cmdView('other-lib')

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('(none)')
    })

    it('should error for non-existent library', async () => {
      await cmdView('nonexistent-lib')

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: Library 'nonexistent-lib' not found")
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('viewing integration', () => {
    it('should display integration details', async () => {
      await cmdView('test-lib/Integration1')

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('Library      : test-lib (v1.0.0)')
      expect(output).toContain('Integration  : Integration1')
      expect(output).toContain('Summary      : First integration')
      expect(output).toContain('Types        : [genericIntegration]')
      expect(output).toContain('Installed    : [genericIntegration]')
    })

    it('should display not installed integration', async () => {
      await cmdView('test-lib/Integration2')

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('Integration  : Integration2')
      expect(output).toContain('Installed    : (none)')
    })

    it('should error for non-existent integration', async () => {
      await cmdView('test-lib/NonExistent')

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: Integration 'NonExistent' not found in library 'test-lib'")
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should error when library does not exist', async () => {
      await cmdView('nonexistent/Integration')

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: Library 'nonexistent' not found")
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should format multiple types correctly', async () => {
      const providersWithDual = [
        {
          libraryName  : 'dual-lib',
          version      : '1.0.0',
          path         : '/path',
          integrations : [
            {
              name           : 'Dual',
              summary        : 'Dual type',
              types          : [INTEGRATION_TYPES.GENERIC, INTEGRATION_TYPES.CLAUDE_SKILL],
              installedTypes : [INTEGRATION_TYPES.GENERIC],
            },
          ],
        },
      ]

      cache.loadProvidersWithCache.mockResolvedValue({
        npmProviders    : providersWithDual,
        remoteProviders : [],
      })
      registry.loadInstallationStatus.mockResolvedValue(providersWithDual)

      await cmdView('dual-lib/Dual')

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('Types        : [genericIntegration, claudeSkill]')
      expect(output).toContain('Installed    : [genericIntegration]')
    })
  })

  describe('error handling', () => {
    it('should error when no argument provided', async () => {
      await cmdView(undefined)

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Please specify a library or library/integration')
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should handle cache errors', async () => {
      cache.loadProvidersWithCache.mockRejectedValue(new Error('Cache error'))

      await cmdView('test-lib')

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error viewing details:', 'Cache error')
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should handle registry errors', async () => {
      registry.loadInstallationStatus.mockRejectedValue(new Error('Registry error'))

      await cmdView('test-lib')

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error viewing details:', 'Registry error')
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })
})
