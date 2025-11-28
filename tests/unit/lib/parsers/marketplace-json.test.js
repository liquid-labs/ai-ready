import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { parseMarketplaceJson, validateMarketplaceJson } from '_lib/parsers/marketplace-json'

describe('marketplace-json parser', () => {
  let tempDir

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive : true, force : true })
  })

  describe('validateMarketplaceJson', () => {
    it('should accept valid marketplace declaration', () => {
      const valid = {
        name    : 'my-marketplace',
        owner   : { name : 'Test Owner' },
        plugins : [
          {
            name   : 'my-plugin',
            source : './plugins/my-plugin',
          },
        ],
      }
      expect(validateMarketplaceJson(valid).valid).toBe(true)
    })

    it('should accept marketplace with optional fields', () => {
      const valid = {
        name     : 'my-marketplace',
        owner    : { name : 'Test Owner', email : 'test@example.com' },
        metadata : { description : 'A test marketplace' },
        plugins  : [
          {
            name        : 'my-plugin',
            source      : './plugins/my-plugin',
            version     : '1.0.0',
            description : 'A test plugin',
            author      : 'Test Author',
            license     : 'MIT',
            homepage    : 'https://example.com',
          },
        ],
      }
      expect(validateMarketplaceJson(valid).valid).toBe(true)
    })

    it('should reject missing required fields', () => {
      const invalid = { name : 'my-marketplace' }
      expect(validateMarketplaceJson(invalid).valid).toBe(false)
    })

    it('should reject missing name', () => {
      const invalid = {
        owner   : { name : 'Test' },
        plugins : [],
      }
      expect(validateMarketplaceJson(invalid).valid).toBe(false)
    })

    it('should reject empty name', () => {
      const invalid = {
        name    : '',
        owner   : { name : 'Test' },
        plugins : [],
      }
      expect(validateMarketplaceJson(invalid).valid).toBe(false)
    })

    it('should reject missing owner', () => {
      const invalid = {
        name    : 'my-marketplace',
        plugins : [],
      }
      expect(validateMarketplaceJson(invalid).valid).toBe(false)
    })

    it('should reject missing plugins', () => {
      const invalid = {
        name  : 'my-marketplace',
        owner : { name : 'Test' },
      }
      expect(validateMarketplaceJson(invalid).valid).toBe(false)
    })

    it('should reject plugin without name', () => {
      const invalid = {
        name    : 'my-marketplace',
        owner   : { name : 'Test' },
        plugins : [{ source : './plugin' }],
      }
      expect(validateMarketplaceJson(invalid).valid).toBe(false)
    })

    it('should reject plugin without source', () => {
      const invalid = {
        name    : 'my-marketplace',
        owner   : { name : 'Test' },
        plugins : [{ name : 'my-plugin' }],
      }
      expect(validateMarketplaceJson(invalid).valid).toBe(false)
    })

    it('should reject null', () => {
      expect(validateMarketplaceJson(null).valid).toBe(false)
    })

    it('should reject undefined', () => {
      expect(validateMarketplaceJson(undefined).valid).toBe(false)
    })

    it('should reject non-object', () => {
      expect(validateMarketplaceJson('string').valid).toBe(false)
      expect(validateMarketplaceJson(123).valid).toBe(false)
      expect(validateMarketplaceJson([]).valid).toBe(false)
    })
  })

  describe('parseMarketplaceJson', () => {
    it('should parse valid JSON file', async () => {
      const jsonPath = path.join(tempDir, 'marketplace.json')
      const data = {
        name    : 'test-marketplace',
        owner   : { name : 'Test Owner' },
        plugins : [
          {
            name   : 'test-plugin',
            source : './plugins/test',
          },
        ],
      }
      await fs.writeFile(jsonPath, JSON.stringify(data))

      const result = await parseMarketplaceJson(jsonPath)
      expect(result).toEqual(data)
    })

    it('should parse file with optional fields', async () => {
      const jsonPath = path.join(tempDir, 'marketplace.json')
      const data = {
        name    : 'test-marketplace',
        owner   : { name : 'Test Owner', email : 'test@example.com' },
        plugins : [
          {
            name     : 'test-plugin',
            source   : './plugins/test',
            version  : '1.0.0',
            author   : 'Test Author',
            license  : 'MIT',
            homepage : 'https://example.com',
          },
        ],
      }
      await fs.writeFile(jsonPath, JSON.stringify(data))

      const result = await parseMarketplaceJson(jsonPath)
      expect(result).toEqual(data)
    })

    it('should return null for malformed JSON', async () => {
      const jsonPath = path.join(tempDir, 'bad.json')
      await fs.writeFile(jsonPath, '{invalid json}')

      const result = await parseMarketplaceJson(jsonPath)
      expect(result).toBeNull()
    })

    it('should return null for missing file', async () => {
      const result = await parseMarketplaceJson('/nonexistent/marketplace.json')
      expect(result).toBeNull()
    })

    it('should return null for invalid data', async () => {
      const jsonPath = path.join(tempDir, 'invalid.json')
      const data = {
        name : 'test-marketplace',
        // missing owner and plugins
      }
      await fs.writeFile(jsonPath, JSON.stringify(data))

      const result = await parseMarketplaceJson(jsonPath)
      expect(result).toBeNull()
    })

    it('should handle empty file', async () => {
      const jsonPath = path.join(tempDir, 'empty.json')
      await fs.writeFile(jsonPath, '')

      const result = await parseMarketplaceJson(jsonPath)
      expect(result).toBeNull()
    })

    it('should handle file with only whitespace', async () => {
      const jsonPath = path.join(tempDir, 'whitespace.json')
      await fs.writeFile(jsonPath, '   \n  \t  ')

      const result = await parseMarketplaceJson(jsonPath)
      expect(result).toBeNull()
    })

    it('should preserve extra fields not in schema', async () => {
      const jsonPath = path.join(tempDir, 'extra.json')
      const data = {
        name        : 'test-marketplace',
        owner       : { name : 'Test' },
        plugins     : [{ name : 'test', source : './test' }],
        customField : 'custom value',
      }
      await fs.writeFile(jsonPath, JSON.stringify(data))

      const result = await parseMarketplaceJson(jsonPath)
      expect(result).toEqual(data)
      expect(result.customField).toBe('custom value')
    })

    it('should parse marketplace with multiple plugins', async () => {
      const jsonPath = path.join(tempDir, 'marketplace.json')
      const data = {
        name    : 'multi-marketplace',
        owner   : { name : 'Test' },
        plugins : [
          { name : 'plugin-a', source : './plugins/a' },
          { name : 'plugin-b', source : './plugins/b', version : '2.0.0' },
          { name : 'plugin-c', source : { source : 'github', repo : 'owner/repo' } },
        ],
      }
      await fs.writeFile(jsonPath, JSON.stringify(data))

      const result = await parseMarketplaceJson(jsonPath)
      expect(result).toEqual(data)
      expect(result.plugins).toHaveLength(3)
    })
  })
})
