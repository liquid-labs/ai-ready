import {
  formatValidationSummary,
  getInvalidFields,
  getMissingFields,
  validateMarketplaceSchema
} from '_lib/schemas/marketplace-validator'

describe('marketplace-validator', () => {
  describe('validateMarketplaceSchema', () => {
    describe('valid schemas', () => {
      it('should accept a valid minimal marketplace.json', () => {
        const data = {
          name        : 'my-plugin',
          version     : '1.0.0',
          description : 'A test plugin',
          skillPath   : '.claude-plugin/skill',
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should accept a valid marketplace.json with optional fields', () => {
        const data = {
          name        : 'my-plugin',
          version     : '1.0.0',
          description : 'A test plugin',
          skillPath   : '.claude-plugin/skill',
          author      : 'Test Author',
          license     : 'MIT',
          homepage    : 'https://example.com',
          keywords    : ['test', 'plugin'],
          category    : 'development',
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should accept author as object', () => {
        const data = {
          name        : 'my-plugin',
          version     : '1.0.0',
          description : 'A test plugin',
          skillPath   : '.claude-plugin/skill',
          author      : {
            name  : 'Test Author',
            email : 'test@example.com',
          },
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(true)
      })

      it('should accept kebab-case names with numbers', () => {
        const validNames = ['plugin-1', 'my-plugin-v2', 'test123', 'a1-b2-c3']

        for (const name of validNames) {
          const data = {
            name,
            version     : '1.0.0',
            description : 'Test',
            skillPath   : 'skill',
          }

          const result = validateMarketplaceSchema(data)
          expect(result.valid).toBe(true)
        }
      })
    })

    describe('missing required fields', () => {
      it('should reject empty object and list all missing fields', () => {
        const result = validateMarketplaceSchema({})

        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThanOrEqual(4)

        const missingFields = getMissingFields(result.errors)
        expect(missingFields).toContain('name')
        expect(missingFields).toContain('version')
        expect(missingFields).toContain('description')
        expect(missingFields).toContain('skillPath')
      })

      it('should report missing name field', () => {
        const data = {
          version     : '1.0.0',
          description : 'A test plugin',
          skillPath   : '.claude-plugin/skill',
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        expect(getMissingFields(result.errors)).toContain('name')
      })

      it('should report missing version field', () => {
        const data = {
          name        : 'my-plugin',
          description : 'A test plugin',
          skillPath   : '.claude-plugin/skill',
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        expect(getMissingFields(result.errors)).toContain('version')
      })

      it('should report missing description field', () => {
        const data = {
          name      : 'my-plugin',
          version   : '1.0.0',
          skillPath : '.claude-plugin/skill',
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        expect(getMissingFields(result.errors)).toContain('description')
      })

      it('should report missing skillPath field', () => {
        const data = {
          name        : 'my-plugin',
          version     : '1.0.0',
          description : 'A test plugin',
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        expect(getMissingFields(result.errors)).toContain('skillPath')
      })

      it('should report multiple missing fields', () => {
        const data = {
          name : 'my-plugin',
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)

        const missingFields = getMissingFields(result.errors)
        expect(missingFields).toContain('version')
        expect(missingFields).toContain('description')
        expect(missingFields).toContain('skillPath')
      })
    })

    describe('invalid field values', () => {
      it('should reject invalid name format (not kebab-case)', () => {
        const invalidNames = [
          'MyPlugin', // uppercase
          'my_plugin', // underscore
          'my plugin', // space
          'My-Plugin', // uppercase with hyphen
          '-my-plugin', // leading hyphen
          'my-plugin-', // trailing hyphen
        ]

        for (const name of invalidNames) {
          const data = {
            name,
            version     : '1.0.0',
            description : 'Test',
            skillPath   : 'skill',
          }

          const result = validateMarketplaceSchema(data)
          expect(result.valid).toBe(false)

          const invalidFields = getInvalidFields(result.errors)
          expect(invalidFields).toContain('name')
        }
      })

      it('should reject empty name', () => {
        const data = {
          name        : '',
          version     : '1.0.0',
          description : 'Test',
          skillPath   : 'skill',
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        expect(getInvalidFields(result.errors)).toContain('name')
      })

      it('should reject empty description', () => {
        const data = {
          name        : 'my-plugin',
          version     : '1.0.0',
          description : '',
          skillPath   : 'skill',
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        expect(getInvalidFields(result.errors)).toContain('description')
      })

      it('should reject absolute skillPath', () => {
        const data = {
          name        : 'my-plugin',
          version     : '1.0.0',
          description : 'Test',
          skillPath   : '/absolute/path/skill',
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        expect(getInvalidFields(result.errors)).toContain('skillPath')
      })

      it('should reject skillPath with parent directory traversal', () => {
        const data = {
          name        : 'my-plugin',
          version     : '1.0.0',
          description : 'Test',
          skillPath   : '../outside/skill',
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        expect(getInvalidFields(result.errors)).toContain('skillPath')
      })

      it('should reject skillPath starting with ../', () => {
        const data = {
          name        : 'my-plugin',
          version     : '1.0.0',
          description : 'Test',
          skillPath   : '../skill',
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
      })

      it('should reject wrong type for name', () => {
        const data = {
          name        : 123,
          version     : '1.0.0',
          description : 'Test',
          skillPath   : 'skill',
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        expect(getInvalidFields(result.errors)).toContain('name')
      })

      it('should reject wrong type for version', () => {
        const data = {
          name        : 'my-plugin',
          version     : 1.0,
          description : 'Test',
          skillPath   : 'skill',
        }

        const result = validateMarketplaceSchema(data)

        expect(result.valid).toBe(false)
        expect(getInvalidFields(result.errors)).toContain('version')
      })
    })

    describe('error messages', () => {
      it('should provide helpful message for missing required field', () => {
        const data = {
          version     : '1.0.0',
          description : 'Test',
          skillPath   : 'skill',
        }

        const result = validateMarketplaceSchema(data)
        const nameError = result.errors.find((e) => e.field === 'name')

        expect(nameError).toBeDefined()
        expect(nameError.message).toContain('Missing required field')
        expect(nameError.message).toContain('name')
      })

      it('should provide helpful message for invalid name format', () => {
        const data = {
          name        : 'Invalid_Name',
          version     : '1.0.0',
          description : 'Test',
          skillPath   : 'skill',
        }

        const result = validateMarketplaceSchema(data)
        const nameError = result.errors.find((e) => e.field === 'name')

        expect(nameError).toBeDefined()
        expect(nameError.message).toContain('kebab-case')
        expect(nameError.message).toContain('Invalid_Name')
      })

      it('should provide helpful message for invalid skillPath', () => {
        const data = {
          name        : 'my-plugin',
          version     : '1.0.0',
          description : 'Test',
          skillPath   : '../escape/path',
        }

        const result = validateMarketplaceSchema(data)
        const skillPathError = result.errors.find((e) => e.field === 'skillPath')

        expect(skillPathError).toBeDefined()
        expect(skillPathError.message).toContain('relative path')
      })

      it('should include the invalid value in error', () => {
        const data = {
          name        : 'BadName',
          version     : '1.0.0',
          description : 'Test',
          skillPath   : 'skill',
        }

        const result = validateMarketplaceSchema(data)
        const nameError = result.errors.find((e) => e.field === 'name')

        expect(nameError.value).toBe('BadName')
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
        { field : 'version', message : 'Missing required field: "version"', keyword : 'required' },
      ]

      const summary = formatValidationSummary(errors)

      expect(summary).toContain('Found 2 validation errors')
      expect(summary).toContain('Missing required field: "name"')
      expect(summary).toContain('Missing required field: "version"')
    })
  })

  describe('getMissingFields', () => {
    it('should extract missing field names from required errors', () => {
      const errors = [
        { field : 'name', keyword : 'required' },
        { field : 'version', keyword : 'required' },
        { field : 'skillPath', keyword : 'pattern' },
      ]

      const missing = getMissingFields(errors)

      expect(missing).toEqual(['name', 'version'])
    })
  })

  describe('getInvalidFields', () => {
    it('should extract fields with non-required errors', () => {
      const errors = [
        { field : 'name', keyword : 'required' },
        { field : 'skillPath', keyword : 'pattern' },
        { field : 'version', keyword : 'type' },
      ]

      const invalid = getInvalidFields(errors)

      expect(invalid).toEqual(['skillPath', 'version'])
    })
  })
})
