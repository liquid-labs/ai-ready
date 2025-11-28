import {
  formatValidationSummary,
  getInvalidFields,
  getMissingFields,
  validateMarketplaceSchema,
  validatePluginManifestSchema
} from '_lib/schemas/marketplace-validator'

describe('marketplace-validator', () => {
  describe('validateMarketplaceSchema', () => {
    describe('valid schemas', () => {
      it('should accept a valid minimal marketplace.json', () => {
        const data = {
          name    : 'my-marketplace',
          owner   : { name : 'Test Owner' },
          plugins : [
            {
              name   : 'test-plugin',
              source : './plugins/test',
            },
          ],
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should accept a valid marketplace.json with optional fields', () => {
        const data = {
          name     : 'my-marketplace',
          owner    : { name : 'Test Owner', email : 'test@example.com' },
          metadata : {
            description : 'A test marketplace',
            version     : '1.0.0',
          },
          plugins : [
            {
              name        : 'test-plugin',
              source      : './plugins/test',
              version     : '1.0.0',
              description : 'A test plugin',
              author      : 'Test Author',
              license     : 'MIT',
              homepage    : 'https://example.com',
              keywords    : ['test', 'plugin'],
              category    : 'development',
            },
          ],
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should accept plugin author as object', () => {
        const data = {
          name    : 'my-marketplace',
          owner   : { name : 'Test Owner' },
          plugins : [
            {
              name   : 'test-plugin',
              source : './plugins/test',
              author : {
                name  : 'Test Author',
                email : 'test@example.com',
              },
            },
          ],
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(true)
      })

      it('should accept various valid marketplace name formats', () => {
        const validNames = ['my-marketplace', 'plugin-1', 'test123', 'a1-b2-c3']

        for (const name of validNames) {
          const data = {
            name,
            owner   : { name : 'Test' },
            plugins : [{ name : 'plugin', source : './plugin' }],
          }

          const result = validateMarketplaceSchema(data)
          expect(result.valid).toBe(true)
        }
      })

      it('should accept plugin source as object', () => {
        const data = {
          name    : 'my-marketplace',
          owner   : { name : 'Test Owner' },
          plugins : [
            {
              name   : 'github-plugin',
              source : { source : 'github', repo : 'owner/repo' },
            },
          ],
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(true)
      })

      it('should accept multiple plugins', () => {
        const data = {
          name    : 'my-marketplace',
          owner   : { name : 'Test Owner' },
          plugins : [
            { name : 'plugin-a', source : './plugins/a' },
            { name : 'plugin-b', source : './plugins/b' },
            { name : 'plugin-c', source : { source : 'github', repo : 'owner/repo' } },
          ],
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(true)
      })
    })

    describe('missing required fields', () => {
      it('should reject empty object and list all missing fields', () => {
        const result = validateMarketplaceSchema({})

        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThanOrEqual(3)

        const missingFields = getMissingFields(result.errors)
        expect(missingFields).toContain('name')
        expect(missingFields).toContain('owner')
        expect(missingFields).toContain('plugins')
      })

      it('should report missing name field', () => {
        const data = {
          owner   : { name : 'Test' },
          plugins : [{ name : 'plugin', source : './plugin' }],
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        expect(getMissingFields(result.errors)).toContain('name')
      })

      it('should report missing owner field', () => {
        const data = {
          name    : 'my-marketplace',
          plugins : [{ name : 'plugin', source : './plugin' }],
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        expect(getMissingFields(result.errors)).toContain('owner')
      })

      it('should report missing plugins field', () => {
        const data = {
          name  : 'my-marketplace',
          owner : { name : 'Test' },
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        expect(getMissingFields(result.errors)).toContain('plugins')
      })

      it('should report multiple missing fields', () => {
        const data = {
          name : 'my-marketplace',
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)

        const missingFields = getMissingFields(result.errors)
        expect(missingFields).toContain('owner')
        expect(missingFields).toContain('plugins')
      })

      it('should report missing plugin name in array', () => {
        const data = {
          name    : 'my-marketplace',
          owner   : { name : 'Test' },
          plugins : [{ source : './plugin' }],
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        // The error should indicate a problem with the plugins array item
        expect(result.errors.some((e) => e.field.includes('plugins') && e.message.includes('name'))).toBe(true)
      })

      it('should report missing plugin source in array', () => {
        const data = {
          name    : 'my-marketplace',
          owner   : { name : 'Test' },
          plugins : [{ name : 'plugin' }],
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        // The error should indicate a problem with the plugins array item
        expect(result.errors.some((e) => e.field.includes('plugins') && e.message.includes('source'))).toBe(true)
      })
    })

    describe('invalid field values', () => {
      it('should reject invalid marketplace name format', () => {
        const invalidNames = [
          '-my-marketplace', // leading hyphen
          '1marketplace', // starts with number
          'my marketplace', // space
          'marketplace@name', // special character
          'MyMarketplace', // uppercase
        ]

        for (const name of invalidNames) {
          const data = {
            name,
            owner   : { name : 'Test' },
            plugins : [{ name : 'plugin', source : './plugin' }],
          }

          const result = validateMarketplaceSchema(data)
          expect(result.valid).toBe(false)

          const invalidFields = getInvalidFields(result.errors)
          expect(invalidFields).toContain('name')
        }
      })

      it('should reject empty name', () => {
        const data = {
          name    : '',
          owner   : { name : 'Test' },
          plugins : [{ name : 'plugin', source : './plugin' }],
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        expect(getInvalidFields(result.errors)).toContain('name')
      })

      it('should reject invalid plugin name format', () => {
        const data = {
          name    : 'my-marketplace',
          owner   : { name : 'Test' },
          plugins : [{ name : '-invalid-name', source : './plugin' }],
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        expect(getInvalidFields(result.errors)).toContain('plugins.0.name')
      })

      it('should reject wrong type for name', () => {
        const data = {
          name    : 123,
          owner   : { name : 'Test' },
          plugins : [{ name : 'plugin', source : './plugin' }],
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        expect(getInvalidFields(result.errors)).toContain('name')
      })

      it('should reject wrong type for owner', () => {
        const data = {
          name    : 'my-marketplace',
          owner   : 'not-an-object',
          plugins : [{ name : 'plugin', source : './plugin' }],
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        expect(getInvalidFields(result.errors)).toContain('owner')
      })

      it('should reject wrong type for plugins', () => {
        const data = {
          name    : 'my-marketplace',
          owner   : { name : 'Test' },
          plugins : 'not-an-array',
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        expect(getInvalidFields(result.errors)).toContain('plugins')
      })
    })

    describe('error messages', () => {
      it('should provide helpful message for missing required field', () => {
        const data = {
          owner   : { name : 'Test' },
          plugins : [],
        }

        const result = validateMarketplaceSchema(data)
        const nameError = result.errors.find((e) => e.field === 'name')

        expect(nameError).toBeDefined()
        expect(nameError.message).toContain('Missing required field')
        expect(nameError.message).toContain('name')
      })

      it('should provide helpful message for invalid name format', () => {
        const data = {
          name    : '-invalid-name',
          owner   : { name : 'Test' },
          plugins : [],
        }

        const result = validateMarketplaceSchema(data)
        const nameError = result.errors.find((e) => e.field === 'name')

        expect(nameError).toBeDefined()
        expect(nameError.message).toContain('kebab-case')
        expect(nameError.message).toContain('-invalid-name')
      })

      it('should include the invalid value in error', () => {
        const data = {
          name    : '@invalid',
          owner   : { name : 'Test' },
          plugins : [],
        }

        const result = validateMarketplaceSchema(data)
        const nameError = result.errors.find((e) => e.field === 'name')

        expect(nameError.value).toBe('@invalid')
      })
    })
  })

  describe('validatePluginManifestSchema', () => {
    describe('valid schemas', () => {
      it('should accept a valid minimal plugin.json', () => {
        const data = {
          name : 'my-plugin',
        }

        const result = validatePluginManifestSchema(data)

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should accept a valid plugin.json with all optional fields', () => {
        const data = {
          name        : 'my-plugin',
          version     : '1.0.0',
          description : 'A test plugin',
          author      : {
            name  : 'Test Author',
            email : 'test@example.com',
          },
          homepage   : 'https://example.com',
          repository : 'https://github.com/test/plugin',
          license    : 'MIT',
          keywords   : ['test', 'plugin'],
          commands   : './commands/',
          agents     : ['./agents/agent1.md', './agents/agent2.md'],
          hooks      : './hooks.json',
          mcpServers : { server1 : { command : 'node' } },
        }

        const result = validatePluginManifestSchema(data)

        expect(result.valid).toBe(true)
      })
    })

    describe('invalid schemas', () => {
      it('should reject missing name', () => {
        const data = {
          version : '1.0.0',
        }

        const result = validatePluginManifestSchema(data)

        expect(result.valid).toBe(false)
        expect(getMissingFields(result.errors)).toContain('name')
      })

      it('should reject invalid name format', () => {
        const data = {
          name : '-invalid-name',
        }

        const result = validatePluginManifestSchema(data)

        expect(result.valid).toBe(false)
        expect(getInvalidFields(result.errors)).toContain('name')
      })
    })
  })

  describe('formatValidationSummary', () => {
    it('should return "No errors" for empty array', () => {
      const summary = formatValidationSummary([])

      expect(summary).toBe('No errors')
    })

    it('should return single error message directly', () => {
      const errors = [{ field : 'name', message : 'Missing required field: "name"', keyword : 'required' }]

      const summary = formatValidationSummary(errors)

      expect(summary).toBe('Missing required field: "name"')
    })

    it('should format multiple errors with count', () => {
      const errors = [
        { field : 'name', message : 'Missing required field: "name"', keyword : 'required' },
        { field : 'owner', message : 'Missing required field: "owner"', keyword : 'required' },
      ]

      const summary = formatValidationSummary(errors)

      expect(summary).toContain('Found 2 validation errors')
      expect(summary).toContain('Missing required field: "name"')
      expect(summary).toContain('Missing required field: "owner"')
    })
  })

  describe('getMissingFields', () => {
    it('should extract missing field names from required errors', () => {
      const errors = [
        { field : 'name', message : 'Missing required field: "name"', keyword : 'required' },
        { field : 'owner', message : 'Missing required field: "owner"', keyword : 'required' },
        { field : 'plugins', message : 'Field "plugins" has invalid format', keyword : 'type' },
      ]

      const missing = getMissingFields(errors)

      expect(missing).toEqual(['name', 'owner'])
    })
  })

  describe('getInvalidFields', () => {
    it('should extract fields with non-required errors', () => {
      const errors = [
        { field : 'name', message : 'Missing required field: "name"', keyword : 'required' },
        { field : 'plugins', message : 'Field "plugins" has invalid format', keyword : 'type' },
        { field : 'owner', message : 'Field "owner" must be object', keyword : 'type' },
      ]

      const invalid = getInvalidFields(errors)

      expect(invalid).toEqual(['plugins', 'owner'])
    })
  })
})
