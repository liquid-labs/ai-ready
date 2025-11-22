import {
  DEFAULT_CONFIG,
  INTEGRATION_TYPES,
  MARKETPLACE_JSON_SCHEMA,
  // New v2.0.0 types
  PLUGIN_STATUSES,
  isValidCache,
  isValidIntegration,
  isValidMarketplaceReference,
  isValidPluginProvider,
  isValidPluginState,
  isValidProvider
} from '_lib/types'

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

  // ============================================================================
  // NEW TYPE TESTS (Phase 1 - v2.0.0 Architecture)
  // ============================================================================

  describe('PLUGIN_STATUSES', () => {
    it('should define plugin status constants', () => {
      expect(PLUGIN_STATUSES.ENABLED).toBe('enabled')
      expect(PLUGIN_STATUSES.DISABLED).toBe('disabled')
      expect(PLUGIN_STATUSES.NOT_INSTALLED).toBe('not-installed')
    })
  })

  describe('MARKETPLACE_JSON_SCHEMA', () => {
    it('should define required and optional fields', () => {
      expect(MARKETPLACE_JSON_SCHEMA.requiredFields).toEqual(['name', 'version', 'description', 'skillPath'])
      expect(MARKETPLACE_JSON_SCHEMA.optionalFields).toEqual(['author', 'license', 'homepage'])
    })
  })

  describe('isValidPluginProvider', () => {
    it('should validate a correct plugin provider', () => {
      const provider = {
        packageName       : 'test-package',
        version           : '1.0.0',
        path              : '/path/to/package',
        pluginDeclaration : {
          name        : 'test-plugin',
          version     : '1.0.0',
          description : 'Test plugin',
          skillPath   : '.claude-plugin/skill',
        },
      }
      expect(isValidPluginProvider(provider)).toBe(true)
    })

    it('should reject provider with missing packageName', () => {
      const provider = {
        version           : '1.0.0',
        path              : '/path/to/package',
        pluginDeclaration : {
          name        : 'test-plugin',
          version     : '1.0.0',
          description : 'Test plugin',
          skillPath   : '.claude-plugin/skill',
        },
      }
      expect(isValidPluginProvider(provider)).toBe(false)
    })

    it('should reject provider with empty packageName', () => {
      const provider = {
        packageName       : '',
        version           : '1.0.0',
        path              : '/path/to/package',
        pluginDeclaration : {
          name        : 'test-plugin',
          version     : '1.0.0',
          description : 'Test plugin',
          skillPath   : '.claude-plugin/skill',
        },
      }
      expect(isValidPluginProvider(provider)).toBe(false)
    })

    it('should reject provider with missing pluginDeclaration', () => {
      const provider = {
        packageName : 'test-package',
        version     : '1.0.0',
        path        : '/path/to/package',
      }
      expect(isValidPluginProvider(provider)).toBe(false)
    })

    it('should reject provider with incomplete pluginDeclaration', () => {
      const provider = {
        packageName       : 'test-package',
        version           : '1.0.0',
        path              : '/path/to/package',
        pluginDeclaration : {
          name    : 'test-plugin',
          version : '1.0.0',
          // missing description and skillPath
        },
      }
      expect(isValidPluginProvider(provider)).toBe(false)
    })

    it('should reject null or undefined', () => {
      expect(isValidPluginProvider(null)).toBe(false)
      expect(isValidPluginProvider(undefined)).toBe(false)
    })
  })

  describe('isValidPluginState', () => {
    it('should validate a correct plugin state with enabled status', () => {
      const state = {
        name        : 'test-plugin',
        status      : 'enabled',
        source      : '/path/to/plugin',
        version     : '1.0.0',
        description : 'Test plugin',
      }
      expect(isValidPluginState(state)).toBe(true)
    })

    it('should validate a correct plugin state with disabled status', () => {
      const state = {
        name        : 'test-plugin',
        status      : 'disabled',
        source      : '/path/to/plugin',
        version     : '1.0.0',
        description : 'Test plugin',
      }
      expect(isValidPluginState(state)).toBe(true)
    })

    it('should validate a correct plugin state with not-installed status', () => {
      const state = {
        name        : 'test-plugin',
        status      : 'not-installed',
        source      : '/path/to/plugin',
        version     : '1.0.0',
        description : 'Test plugin',
      }
      expect(isValidPluginState(state)).toBe(true)
    })

    it('should reject state with invalid status', () => {
      const state = {
        name        : 'test-plugin',
        status      : 'invalid-status',
        source      : '/path/to/plugin',
        version     : '1.0.0',
        description : 'Test plugin',
      }
      expect(isValidPluginState(state)).toBe(false)
    })

    it('should reject state with missing name', () => {
      const state = {
        status      : 'enabled',
        source      : '/path/to/plugin',
        version     : '1.0.0',
        description : 'Test plugin',
      }
      expect(isValidPluginState(state)).toBe(false)
    })

    it('should reject state with empty name', () => {
      const state = {
        name        : '',
        status      : 'enabled',
        source      : '/path/to/plugin',
        version     : '1.0.0',
        description : 'Test plugin',
      }
      expect(isValidPluginState(state)).toBe(false)
    })

    it('should reject null or undefined', () => {
      expect(isValidPluginState(null)).toBe(false)
      expect(isValidPluginState(undefined)).toBe(false)
    })
  })

  describe('isValidMarketplaceReference', () => {
    it('should validate a github marketplace reference', () => {
      const marketplace = {
        name       : 'team-tools',
        sourceType : 'github',
        repo       : 'myorg/claude-plugins',
      }
      expect(isValidMarketplaceReference(marketplace)).toBe(true)
    })

    it('should validate a git marketplace reference', () => {
      const marketplace = {
        name       : 'project-tools',
        sourceType : 'git',
        url        : 'https://git.company.com/plugins.git',
      }
      expect(isValidMarketplaceReference(marketplace)).toBe(true)
    })

    it('should validate a directory marketplace reference', () => {
      const marketplace = {
        name       : 'local-tools',
        sourceType : 'directory',
        path       : '/shared/claude-plugins',
      }
      expect(isValidMarketplaceReference(marketplace)).toBe(true)
    })

    it('should reject marketplace with missing name', () => {
      const marketplace = {
        sourceType : 'github',
        repo       : 'myorg/claude-plugins',
      }
      expect(isValidMarketplaceReference(marketplace)).toBe(false)
    })

    it('should reject marketplace with empty name', () => {
      const marketplace = {
        name       : '',
        sourceType : 'github',
        repo       : 'myorg/claude-plugins',
      }
      expect(isValidMarketplaceReference(marketplace)).toBe(false)
    })

    it('should reject marketplace with invalid source type', () => {
      const marketplace = {
        name       : 'test',
        sourceType : 'invalid',
        repo       : 'myorg/claude-plugins',
      }
      expect(isValidMarketplaceReference(marketplace)).toBe(false)
    })

    it('should reject github marketplace without repo', () => {
      const marketplace = {
        name       : 'test',
        sourceType : 'github',
      }
      expect(isValidMarketplaceReference(marketplace)).toBe(false)
    })

    it('should reject github marketplace with invalid repo format', () => {
      const marketplace = {
        name       : 'test',
        sourceType : 'github',
        repo       : 'invalid-no-slash',
      }
      expect(isValidMarketplaceReference(marketplace)).toBe(false)
    })

    it('should reject git marketplace without url', () => {
      const marketplace = {
        name       : 'test',
        sourceType : 'git',
      }
      expect(isValidMarketplaceReference(marketplace)).toBe(false)
    })

    it('should reject git marketplace with non-http url', () => {
      const marketplace = {
        name       : 'test',
        sourceType : 'git',
        url        : 'file:///local/path',
      }
      expect(isValidMarketplaceReference(marketplace)).toBe(false)
    })

    it('should reject directory marketplace without path', () => {
      const marketplace = {
        name       : 'test',
        sourceType : 'directory',
      }
      expect(isValidMarketplaceReference(marketplace)).toBe(false)
    })

    it('should reject directory marketplace with empty path', () => {
      const marketplace = {
        name       : 'test',
        sourceType : 'directory',
        path       : '',
      }
      expect(isValidMarketplaceReference(marketplace)).toBe(false)
    })

    it('should reject null or undefined', () => {
      expect(isValidMarketplaceReference(null)).toBe(false)
      expect(isValidMarketplaceReference(undefined)).toBe(false)
    })
  })
})
