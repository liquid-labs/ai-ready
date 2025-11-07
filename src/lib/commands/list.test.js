import { cmdList } from './list.js'
import * as scanner from '../core/scanner.js'
import * as cache from '../core/cache.js'
import * as registry from '../core/registry.js'
import { INTEGRATION_TYPES } from '../core/types.js'

// Mock modules
jest.mock('../core/scanner.js')
jest.mock('../core/cache.js')
jest.mock('../core/registry.js')

describe('list command', () => {
  let consoleLogSpy
  let consoleErrorSpy
  let processExitSpy

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation()

    // Default mock implementations
    cache.loadProvidersWithCache.mockResolvedValue([])
    registry.loadInstallationStatus.mockImplementation(
      async (providers) => providers
    )
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
    jest.clearAllMocks()
  })

  it('should display integrations in table format', async () => {
    const providers = [
      {
        libraryName  : 'test-lib',
        version      : '1.0.0',
        path         : '/path',
        integrations : [
          {
            name           : 'TestIntegration',
            summary        : 'A test integration',
            types          : [INTEGRATION_TYPES.GENERIC],
            installedTypes : [],
          },
        ],
      },
    ]

    cache.loadProvidersWithCache.mockResolvedValue(providers)
    registry.loadInstallationStatus.mockResolvedValue(providers)

    await cmdList({})

    expect(consoleLogSpy).toHaveBeenCalled()
    const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('Library')
    expect(output).toContain('Integration')
    expect(output).toContain('test-lib')
    expect(output).toContain('TestIntegration')
  })

  it('should show only installed integrations with --installed flag', async () => {
    const providers = [
      {
        libraryName  : 'test-lib',
        version      : '1.0.0',
        path         : '/path',
        integrations : [
          {
            name           : 'Installed',
            summary        : 'Installed integration',
            types          : [INTEGRATION_TYPES.GENERIC],
            installedTypes : [INTEGRATION_TYPES.GENERIC],
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

    cache.loadProvidersWithCache.mockResolvedValue(providers)
    registry.loadInstallationStatus.mockResolvedValue(providers)

    await cmdList({ installed : true })

    const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('Installed')
    expect(output).not.toContain('NotInstalled')
  })

  it('should show only available integrations with --available flag', async () => {
    const providers = [
      {
        libraryName  : 'test-lib',
        version      : '1.0.0',
        path         : '/path',
        integrations : [
          {
            name           : 'FullyInstalled',
            summary        : 'Fully installed',
            types          : [INTEGRATION_TYPES.GENERIC],
            installedTypes : [INTEGRATION_TYPES.GENERIC],
          },
          {
            name           : 'NotInstalled',
            summary        : 'Not installed',
            types          : [INTEGRATION_TYPES.GENERIC],
            installedTypes : [],
          },
          {
            name           : 'PartiallyInstalled',
            summary        : 'Partially installed',
            types          : [INTEGRATION_TYPES.GENERIC, INTEGRATION_TYPES.CLAUDE_SKILL],
            installedTypes : [INTEGRATION_TYPES.GENERIC],
          },
        ],
      },
    ]

    cache.loadProvidersWithCache.mockResolvedValue(providers)
    registry.loadInstallationStatus.mockResolvedValue(providers)

    await cmdList({ available : true })

    const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
    expect(output).not.toContain('FullyInstalled')
    expect(output).toContain('NotInstalled')
    expect(output).toContain('PartiallyInstalled')
  })

  it('should filter by library name', async () => {
    const providers = [
      {
        libraryName  : 'lib-a',
        version      : '1.0.0',
        path         : '/path',
        integrations : [
          {
            name           : 'IntegrationA',
            summary        : 'Integration A',
            types          : [INTEGRATION_TYPES.GENERIC],
            installedTypes : [],
          },
        ],
      },
      {
        libraryName  : 'lib-b',
        version      : '1.0.0',
        path         : '/path',
        integrations : [
          {
            name           : 'IntegrationB',
            summary        : 'Integration B',
            types          : [INTEGRATION_TYPES.GENERIC],
            installedTypes : [],
          },
        ],
      },
    ]

    cache.loadProvidersWithCache.mockResolvedValue(providers)
    registry.loadInstallationStatus.mockResolvedValue(providers)

    await cmdList({ library : 'lib-a' })

    const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('IntegrationA')
    expect(output).not.toContain('IntegrationB')
  })

  it('should show message when no integrations found', async () => {
    cache.loadProvidersWithCache.mockResolvedValue([])
    registry.loadInstallationStatus.mockResolvedValue([])

    await cmdList({})

    expect(consoleLogSpy).toHaveBeenCalledWith('No integrations found.')
  })

  it('should format types correctly', async () => {
    const providers = [
      {
        libraryName  : 'test-lib',
        version      : '1.0.0',
        path         : '/path',
        integrations : [
          {
            name           : 'DualType',
            summary        : 'Dual type integration',
            types          : [INTEGRATION_TYPES.GENERIC, INTEGRATION_TYPES.CLAUDE_SKILL],
            installedTypes : [INTEGRATION_TYPES.GENERIC],
          },
        ],
      },
    ]

    cache.loadProvidersWithCache.mockResolvedValue(providers)
    registry.loadInstallationStatus.mockResolvedValue(providers)

    await cmdList({})

    const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('[genericIntegration,claudeSkill]')
    expect(output).toContain('[genericIntegration]')
  })

  it('should handle errors gracefully', async () => {
    cache.loadProvidersWithCache.mockRejectedValue(new Error('Test error'))

    await cmdList({})

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error listing integrations:',
      'Test error'
    )
    expect(processExitSpy).toHaveBeenCalledWith(1)
  })

  it('should call loadProvidersWithCache with correct parameters', async () => {
    cache.loadProvidersWithCache.mockResolvedValue([])
    registry.loadInstallationStatus.mockResolvedValue([])

    await cmdList({})

    expect(cache.loadProvidersWithCache).toHaveBeenCalledWith(
      '.aircache.json',
      expect.any(Function)
    )
  })

  it('should call loadInstallationStatus with correct parameters', async () => {
    const providers = []
    cache.loadProvidersWithCache.mockResolvedValue(providers)
    registry.loadInstallationStatus.mockResolvedValue(providers)

    await cmdList({})

    expect(registry.loadInstallationStatus).toHaveBeenCalledWith(
      providers,
      '.claude',
      ['AGENTS.md', 'CLAUDE.md']
    )
  })

  it('should handle empty installedTypes', async () => {
    const providers = [
      {
        libraryName  : 'test-lib',
        version      : '1.0.0',
        path         : '/path',
        integrations : [
          {
            name           : 'NotInstalled',
            summary        : 'Not installed',
            types          : [INTEGRATION_TYPES.GENERIC],
            installedTypes : [],
          },
        ],
      },
    ]

    cache.loadProvidersWithCache.mockResolvedValue(providers)
    registry.loadInstallationStatus.mockResolvedValue(providers)

    await cmdList({})

    const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('[]')
  })
})
