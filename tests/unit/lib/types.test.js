import { PLUGIN_STATUSES, isValidMarketplaceProvider, isValidPluginEntry, isValidPluginState } from '_lib/types'

describe('types', () => {
  describe('PLUGIN_STATUSES', () => {
    it('should define status constants', () => {
      expect(PLUGIN_STATUSES.ENABLED).toBe('enabled')
      expect(PLUGIN_STATUSES.DISABLED).toBe('disabled')
      expect(PLUGIN_STATUSES.NOT_INSTALLED).toBe('not-installed')
    })
  })

  describe('isValidMarketplaceProvider', () => {
    it('should validate a valid MarketplaceProvider', () => {
      const provider = {
        packageName            : 'test-lib',
        version                : '1.0.0',
        path                   : '/path/to/lib',
        marketplaceDeclaration : {
          name    : 'test-marketplace',
          owner   : { name : 'Test Owner' },
          plugins : [
            {
              name   : 'test-plugin',
              source : './plugins/test',
            },
          ],
        },
      }

      expect(isValidMarketplaceProvider(provider)).toBe(true)
    })

    it('should reject provider with missing packageName', () => {
      const provider = {
        version                : '1.0.0',
        path                   : '/path',
        marketplaceDeclaration : {
          name    : 'test-marketplace',
          owner   : {},
          plugins : [],
        },
      }

      expect(isValidMarketplaceProvider(provider)).toBe(false)
    })

    it('should reject provider with empty packageName', () => {
      const provider = {
        packageName            : '',
        version                : '1.0.0',
        path                   : '/path',
        marketplaceDeclaration : {
          name    : 'test-marketplace',
          owner   : {},
          plugins : [],
        },
      }

      expect(isValidMarketplaceProvider(provider)).toBe(false)
    })

    it('should reject provider with missing marketplaceDeclaration', () => {
      const provider = {
        packageName : 'test-lib',
        version     : '1.0.0',
        path        : '/path',
      }

      expect(isValidMarketplaceProvider(provider)).toBe(false)
    })

    it('should reject provider with incomplete marketplaceDeclaration', () => {
      const provider = {
        packageName            : 'test-lib',
        version                : '1.0.0',
        path                   : '/path',
        marketplaceDeclaration : {
          name : 'test-marketplace',
        },
      }

      expect(isValidMarketplaceProvider(provider)).toBe(false)
    })

    it('should reject provider with non-array plugins', () => {
      const provider = {
        packageName            : 'test-lib',
        version                : '1.0.0',
        path                   : '/path',
        marketplaceDeclaration : {
          name    : 'test-marketplace',
          owner   : {},
          plugins : 'not-an-array',
        },
      }

      expect(isValidMarketplaceProvider(provider)).toBe(false)
    })
  })

  describe('isValidPluginEntry', () => {
    it('should validate a valid PluginEntry with string source', () => {
      const plugin = {
        name   : 'test-plugin',
        source : './plugins/test',
      }

      expect(isValidPluginEntry(plugin)).toBe(true)
    })

    it('should validate a valid PluginEntry with object source', () => {
      const plugin = {
        name   : 'test-plugin',
        source : { source : 'github', repo : 'owner/repo' },
      }

      expect(isValidPluginEntry(plugin)).toBe(true)
    })

    it('should reject plugin with missing name', () => {
      const plugin = {
        source : './plugins/test',
      }

      expect(isValidPluginEntry(plugin)).toBe(false)
    })

    it('should reject plugin with empty name', () => {
      const plugin = {
        name   : '',
        source : './plugins/test',
      }

      expect(isValidPluginEntry(plugin)).toBe(false)
    })

    it('should reject plugin with missing source', () => {
      const plugin = {
        name : 'test-plugin',
      }

      expect(isValidPluginEntry(plugin)).toBe(false)
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
})
