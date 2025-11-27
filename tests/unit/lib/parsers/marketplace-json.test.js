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
    it('should accept valid declaration', () => {
      const valid = {
        name        : 'my-plugin',
        version     : '1.0.0',
        description : 'Test plugin',
        skillPath   : '.claude-plugin/skill',
      }
      expect(validateMarketplaceJson(valid).valid).toBe(true)
    })

    it('should accept declaration with optional fields', () => {
      const valid = {
        name        : 'my-plugin',
        version     : '1.0.0',
        description : 'Test plugin',
        skillPath   : '.claude-plugin/skill',
        author      : 'Test Author',
        license     : 'MIT',
        homepage    : 'https://example.com',
      }
      expect(validateMarketplaceJson(valid).valid).toBe(true)
    })

    it('should reject missing required fields', () => {
      const invalid = { name : 'my-plugin' }
      expect(validateMarketplaceJson(invalid).valid).toBe(false)
    })

    it('should reject missing name', () => {
      const invalid = {
        version     : '1.0.0',
        description : 'Test',
        skillPath   : '.claude-plugin/skill',
      }
      expect(validateMarketplaceJson(invalid).valid).toBe(false)
    })

    it('should reject empty name', () => {
      const invalid = {
        name        : '',
        version     : '1.0.0',
        description : 'Test',
        skillPath   : '.claude-plugin/skill',
      }
      expect(validateMarketplaceJson(invalid).valid).toBe(false)
    })

    it('should reject missing version', () => {
      const invalid = {
        name        : 'my-plugin',
        description : 'Test',
        skillPath   : '.claude-plugin/skill',
      }
      expect(validateMarketplaceJson(invalid).valid).toBe(false)
    })

    it('should reject missing description', () => {
      const invalid = {
        name      : 'my-plugin',
        version   : '1.0.0',
        skillPath : '.claude-plugin/skill',
      }
      expect(validateMarketplaceJson(invalid).valid).toBe(false)
    })

    it('should reject missing skillPath', () => {
      const invalid = {
        name        : 'my-plugin',
        version     : '1.0.0',
        description : 'Test',
      }
      expect(validateMarketplaceJson(invalid).valid).toBe(false)
    })

    it('should reject path traversal in skillPath', () => {
      const invalid = {
        name        : 'my-plugin',
        version     : '1.0.0',
        description : 'Test',
        skillPath   : '../../../etc/passwd',
      }
      expect(validateMarketplaceJson(invalid).valid).toBe(false)
    })

    it('should reject absolute path in skillPath', () => {
      const invalid = {
        name        : 'my-plugin',
        version     : '1.0.0',
        description : 'Test',
        skillPath   : '/absolute/path',
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
        name        : 'test-plugin',
        version     : '1.0.0',
        description : 'Test',
        skillPath   : '.claude-plugin/skill',
      }
      await fs.writeFile(jsonPath, JSON.stringify(data))

      const result = await parseMarketplaceJson(jsonPath)
      expect(result).toEqual(data)
    })

    it('should parse file with optional fields', async () => {
      const jsonPath = path.join(tempDir, 'marketplace.json')
      const data = {
        name        : 'test-plugin',
        version     : '1.0.0',
        description : 'Test',
        skillPath   : '.claude-plugin/skill',
        author      : 'Test Author',
        license     : 'MIT',
        homepage    : 'https://example.com',
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
        name    : 'test-plugin',
        version : '1.0.0',
        // missing description and skillPath
      }
      await fs.writeFile(jsonPath, JSON.stringify(data))

      const result = await parseMarketplaceJson(jsonPath)
      expect(result).toBeNull()
    })

    it('should return null for path traversal attempt', async () => {
      const jsonPath = path.join(tempDir, 'evil.json')
      const data = {
        name        : 'evil-plugin',
        version     : '1.0.0',
        description : 'Evil',
        skillPath   : '../../../etc/passwd',
      }
      await fs.writeFile(jsonPath, JSON.stringify(data))

      const result = await parseMarketplaceJson(jsonPath)
      expect(result).toBeNull()
    })

    it('should return null for absolute path attempt', async () => {
      const jsonPath = path.join(tempDir, 'absolute.json')
      const data = {
        name        : 'abs-plugin',
        version     : '1.0.0',
        description : 'Absolute',
        skillPath   : '/absolute/path',
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
        name        : 'test-plugin',
        version     : '1.0.0',
        description : 'Test',
        skillPath   : '.claude-plugin/skill',
        customField : 'custom value',
      }
      await fs.writeFile(jsonPath, JSON.stringify(data))

      const result = await parseMarketplaceJson(jsonPath)
      expect(result).toEqual(data)
      expect(result.customField).toBe('custom value')
    })
  })
})
