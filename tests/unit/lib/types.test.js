import {
  isValidMarketplaceReference,
  isValidPluginProvider,
  isValidPluginState,
  MARKETPLACE_JSON_SCHEMA,
  PLUGIN_STATUSES,
} from '_lib/types'

describe('types', () => {
  describe('PLUGIN_STATUSES', () => {
    it('should define status constants', () => {
      expect(PLUGIN_STATUSES.ENABLED).toBe('enabled')
      expect(PLUGIN_STATUSES.DISABLED).toBe('disabled')
      expect(PLUGIN_STATUSES.NOT_INSTALLED).toBe('not-installed')
    })
  })

  describe('MARKETPLACE_JSON_SCHEMA', () => {
    it('should define required fields', () => {
      expect(MARKETPLACE_JSON_SCHEMA.requiredFields).toEqual([
        'name',
        'version',
        'description',
        'skillPath',
      ])
    })

    it('should define optional fields', () => {
      expect(MARKETPLACE_JSON_SCHEMA.optionalFields).toEqual(['author', 'license', 'homepage'])
    })
  })

  describe('isValidPluginProvider', () => {
    it('should validate a valid PluginProvider', () => {
      const provider = {
        packageName       : 'test-lib',
        version           : '1.0.0',
        path              : '/path/to/lib',
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
        path              : '/path',
        pluginDeclaration : {
          name        : 'test',
          version     : '1.0.0',
          description : 'Test',
          skillPath   : 'skill',
        },
      }

      expect(isValidPluginProvider(provider)).toBe(false)
    })

    it('should reject provider with empty packageName', () => {
      const provider = {
        packageName       : '',
        version           : '1.0.0',
        path              : '/path',
        pluginDeclaration : {
          name        : 'test',
          version     : '1.0.0',
          description : 'Test',
          skillPath   : 'skill',
        },
      }

      expect(isValidPluginProvider(provider)).toBe(false)
    })

    it('should reject provider with missing pluginDeclaration', () => {
      const provider = {
        packageName : 'test-lib',
        version     : '1.0.0',
        path        : '/path',
      }

      expect(isValidPluginProvider(provider)).toBe(false)
    })

    it('should reject provider with incomplete pluginDeclaration', () => {
      const provider = {
        packageName       : 'test-lib',
        version           : '1.0.0',
        path              : '/path',
        pluginDeclaration : {
          name : 'test',
        },
      }

      expect(isValidPluginProvider(provider)).toBe(false)
    })
  })

  describe('isValidPluginState', () => {
    it('should validate a valid PluginState', () => {
      const state = {
        name        : 'test-plugin',
        status      : 'enabled',
        source      : '/path/to/plugin',
        version     : '1.0.0',
        description : 'Test plugin',
      }

      expect(isValidPluginState(state)).toBe(true)
    })

    it('should accept all valid statuses', () => {
      const baseState = {
        name        : 'test',
        source      : '/path',
        version     : '1.0.0',
        description : 'Test',
      }

      expect(isValidPluginState({ ...baseState, status : 'enabled' })).toBe(true)
      expect(isValidPluginState({ ...baseState, status : 'disabled' })).toBe(true)
      expect(isValidPluginState({ ...baseState, status : 'not-installed' })).toBe(true)
    })

    it('should reject invalid status', () => {
      const state = {
        name        : 'test',
        status      : 'invalid-status',
        source      : '/path',
        version     : '1.0.0',
        description : 'Test',
      }

      expect(isValidPluginState(state)).toBe(false)
    })

    it('should reject state with missing name', () => {
      const state = {
        status      : 'enabled',
        source      : '/path',
        version     : '1.0.0',
        description : 'Test',
      }

      expect(isValidPluginState(state)).toBe(false)
    })

    it('should reject state with empty name', () => {
      const state = {
        name        : '',
        status      : 'enabled',
        source      : '/path',
        version     : '1.0.0',
        description : 'Test',
      }

      expect(isValidPluginState(state)).toBe(false)
    })
  })

  describe('isValidMarketplaceReference', () => {
    it('should validate a valid github marketplace', () => {
      const marketplace = {
        name       : 'my-marketplace',
        sourceType : 'github',
        repo       : 'org/repo',
      }

      expect(isValidMarketplaceReference(marketplace)).toBe(true)
    })

    it('should validate a valid git marketplace', () => {
      const marketplace = {
        name       : 'my-marketplace',
        sourceType : 'git',
        url        : 'https://github.com/org/repo.git',
      }

      expect(isValidMarketplaceReference(marketplace)).toBe(true)
    })

    it('should validate a valid directory marketplace', () => {
      const marketplace = {
        name       : 'my-marketplace',
        sourceType : 'directory',
        path       : '/path/to/marketplace',
      }

      expect(isValidMarketplaceReference(marketplace)).toBe(true)
    })

    it('should reject marketplace with missing name', () => {
      const marketplace = {
        sourceType : 'github',
        repo       : 'org/repo',
      }

      expect(isValidMarketplaceReference(marketplace)).toBe(false)
    })

    it('should reject marketplace with empty name', () => {
      const marketplace = {
        name       : '',
        sourceType : 'github',
        repo       : 'org/repo',
      }

      expect(isValidMarketplaceReference(marketplace)).toBe(false)
    })

    it('should reject marketplace with invalid sourceType', () => {
      const marketplace = {
        name       : 'test',
        sourceType : 'invalid',
        repo       : 'org/repo',
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
        url        : 'git@github.com:org/repo.git',
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
  })
})
