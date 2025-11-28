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

    it.each([
      {
        description : 'missing packageName',
        provider    : {
          version                : '1.0.0',
          path                   : '/path',
          marketplaceDeclaration : { name : 'test', owner : {}, plugins : [] },
        },
      },
      {
        description : 'empty packageName',
        provider    : {
          packageName            : '',
          version                : '1.0.0',
          path                   : '/path',
          marketplaceDeclaration : { name : 'test', owner : {}, plugins : [] },
        },
      },
      {
        description : 'missing marketplaceDeclaration',
        provider    : {
          packageName : 'test-lib',
          version     : '1.0.0',
          path        : '/path',
        },
      },
      {
        description : 'incomplete marketplaceDeclaration',
        provider    : {
          packageName            : 'test-lib',
          version                : '1.0.0',
          path                   : '/path',
          marketplaceDeclaration : { name : 'test' },
        },
      },
      {
        description : 'non-array plugins',
        provider    : {
          packageName            : 'test-lib',
          version                : '1.0.0',
          path                   : '/path',
          marketplaceDeclaration : { name : 'test', owner : {}, plugins : 'not-an-array' },
        },
      },
    ])('should reject provider with $description', ({ provider }) => {
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

    it.each([
      {
        description : 'missing name',
        plugin      : { source : './plugins/test' },
      },
      {
        description : 'empty name',
        plugin      : { name : '', source : './plugins/test' },
      },
      {
        description : 'missing source',
        plugin      : { name : 'test-plugin' },
      },
    ])('should reject plugin with $description', ({ plugin }) => {
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

    const baseState = {
      name        : 'test',
      source      : '/path',
      version     : '1.0.0',
      description : 'Test',
    }

    it.each([
      {
        description : 'invalid status',
        state       : { ...baseState, status : 'invalid-status' },
      },
      {
        description : 'missing name',
        state       : { status : 'enabled', source : '/path', version : '1.0.0', description : 'Test' },
      },
      {
        description : 'empty name',
        state       : { ...baseState, name : '', status : 'enabled' },
      },
    ])('should reject state with $description', ({ state }) => {
      expect(isValidPluginState(state)).toBe(false)
    })
  })
})
