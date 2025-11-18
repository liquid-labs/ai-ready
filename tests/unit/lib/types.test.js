import { DEFAULT_CONFIG, INTEGRATION_TYPES, isValidIntegration, isValidProvider, isValidCache } from '../../../../src/lib/types'

describe('types', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_CONFIG.scanPaths).toEqual(['node_modules'])
      expect(DEFAULT_CONFIG.registryFiles.claudeSkillsDir).toBe('.claude/skills')
      expect(DEFAULT_CONFIG.registryFiles.generic).toEqual(['AGENTS.md', 'CLAUDE.md'])
      expect(DEFAULT_CONFIG.cacheFile).toBe('.aircache.json')
    })
  })

  describe('INTEGRATION_TYPES', () => {
    it('should define integration type constants', () => {
      expect(INTEGRATION_TYPES.GENERIC).toBe('genericIntegration')
      expect(INTEGRATION_TYPES.CLAUDE_SKILL).toBe('claudeSkill')
    })
  })

  describe('isValidIntegration', () => {
    it('should validate a correct integration', () => {
      const integration = {
        name    : 'TestIntegration',
        summary : 'A test integration',
        types   : ['genericIntegration'],
      }
      expect(isValidIntegration(integration)).toBe(true)
    })

    it('should reject integration with missing name', () => {
      const integration = {
        summary : 'A test integration',
        types   : ['genericIntegration'],
      }
      expect(isValidIntegration(integration)).toBe(false)
    })

    it('should reject integration with empty name', () => {
      const integration = {
        name    : '',
        summary : 'A test integration',
        types   : ['genericIntegration'],
      }
      expect(isValidIntegration(integration)).toBe(false)
    })

    it('should reject integration with non-array types', () => {
      const integration = {
        name    : 'TestIntegration',
        summary : 'A test integration',
        types   : 'genericIntegration',
      }
      expect(isValidIntegration(integration)).toBe(false)
    })

    it('should reject integration with empty types array', () => {
      const integration = {
        name    : 'TestIntegration',
        summary : 'A test integration',
        types   : [],
      }
      expect(isValidIntegration(integration)).toBe(false)
    })

    it('should reject null or undefined', () => {
      expect(isValidIntegration(null)).toBe(false)
      expect(isValidIntegration(undefined)).toBe(false)
    })
  })

  describe('isValidProvider', () => {
    it('should validate a correct provider', () => {
      const provider = {
        libraryName  : 'test-lib',
        version      : '1.0.0',
        path         : '/path/to/test-lib',
        integrations : [
          {
            name    : 'TestIntegration',
            summary : 'A test integration',
            types   : ['genericIntegration'],
          },
        ],
      }
      expect(isValidProvider(provider)).toBe(true)
    })

    it('should reject provider with missing libraryName', () => {
      const provider = {
        version      : '1.0.0',
        path         : '/path/to/test-lib',
        integrations : [],
      }
      expect(isValidProvider(provider)).toBe(false)
    })

    it('should reject provider with empty libraryName', () => {
      const provider = {
        libraryName  : '',
        version      : '1.0.0',
        path         : '/path/to/test-lib',
        integrations : [],
      }
      expect(isValidProvider(provider)).toBe(false)
    })

    it('should reject provider with invalid integrations', () => {
      const provider = {
        libraryName  : 'test-lib',
        version      : '1.0.0',
        path         : '/path/to/test-lib',
        integrations : [
          {
            name    : '',
            summary : 'Invalid',
            types   : [],
          },
        ],
      }
      expect(isValidProvider(provider)).toBe(false)
    })

    it('should accept provider with empty integrations array', () => {
      const provider = {
        libraryName  : 'test-lib',
        version      : '1.0.0',
        path         : '/path/to/test-lib',
        integrations : [],
      }
      expect(isValidProvider(provider)).toBe(true)
    })

    it('should reject null or undefined', () => {
      expect(isValidProvider(null)).toBe(false)
      expect(isValidProvider(undefined)).toBe(false)
    })
  })

  describe('isValidCache', () => {
    it('should validate correct cache data', () => {
      const cache = {
        scannedAt        : '2025-11-07T12:00:00Z',
        packageJsonMTime : 1234567890,
        packageLockMTime : 1234567890,
        npmProviders     : [
          {
            libraryName  : 'test-lib',
            version      : '1.0.0',
            path         : '/path/to/test-lib',
            integrations : [],
          },
        ],
        remoteProviders : [],
      }
      expect(isValidCache(cache)).toBe(true)
    })

    it('should reject cache with missing scannedAt', () => {
      const cache = {
        packageJsonMTime : 1234567890,
        packageLockMTime : 1234567890,
        providers        : [],
      }
      expect(isValidCache(cache)).toBe(false)
    })

    it('should reject cache with invalid packageJsonMTime', () => {
      const cache = {
        scannedAt        : '2025-11-07T12:00:00Z',
        packageJsonMTime : '1234567890',
        packageLockMTime : 1234567890,
        providers        : [],
      }
      expect(isValidCache(cache)).toBe(false)
    })

    it('should reject cache with missing npmProviders', () => {
      const cache = {
        scannedAt        : '2025-11-07T12:00:00Z',
        packageJsonMTime : 1234567890,
        packageLockMTime : 1234567890,
        remoteProviders  : [],
      }
      expect(isValidCache(cache)).toBe(false)
    })

    it('should reject cache with missing remoteProviders', () => {
      const cache = {
        scannedAt        : '2025-11-07T12:00:00Z',
        packageJsonMTime : 1234567890,
        packageLockMTime : 1234567890,
        npmProviders     : [],
      }
      expect(isValidCache(cache)).toBe(false)
    })

    it('should reject null or undefined', () => {
      expect(isValidCache(null)).toBe(false)
      expect(isValidCache(undefined)).toBe(false)
    })
  })
})
