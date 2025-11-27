import { PLUGIN_STATUSES, isValidPluginProvider, isValidPluginState } from '_lib/types'

describe('types', () => {
  describe('PLUGIN_STATUSES', () => {
    it('should define status constants', () => {
      expect(PLUGIN_STATUSES.ENABLED).toBe('enabled')
      expect(PLUGIN_STATUSES.DISABLED).toBe('disabled')
      expect(PLUGIN_STATUSES.NOT_INSTALLED).toBe('not-installed')
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
})
