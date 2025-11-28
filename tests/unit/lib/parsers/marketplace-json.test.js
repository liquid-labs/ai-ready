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

    describe('invalid inputs', () => {
      it.each([
        {
          description : 'missing required fields',
          data        : { name : 'my-marketplace' },
        },
        {
          description : 'missing name',
          data        : { owner : { name : 'Test' }, plugins : [] },
        },
        {
          description : 'empty name',
          data        : { name : '', owner : { name : 'Test' }, plugins : [] },
        },
        {
          description : 'missing owner',
          data        : { name : 'my-marketplace', plugins : [] },
        },
        {
          description : 'missing plugins',
          data        : { name : 'my-marketplace', owner : { name : 'Test' } },
        },
        {
          description : 'plugin without name',
          data        : { name : 'my-marketplace', owner : { name : 'Test' }, plugins : [{ source : './plugin' }] },
        },
        {
          description : 'plugin without source',
          data        : { name : 'my-marketplace', owner : { name : 'Test' }, plugins : [{ name : 'my-plugin' }] },
        },
      ])('should reject $description', ({ data }) => {
        expect(validateMarketplaceJson(data).valid).toBe(false)
      })

      it.each([
        { description : 'null', data : null },
        { description : 'undefined', data : undefined },
        { description : 'string', data : 'string' },
        { description : 'number', data : 123 },
        { description : 'array', data : [] },
      ])('should reject $description', ({ data }) => {
        expect(validateMarketplaceJson(data).valid).toBe(false)
      })
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

    it.each([
      {
        description : 'malformed JSON',
        filename    : 'bad.json',
        content     : '{invalid json}',
      },
      {
        description : 'invalid data (missing fields)',
        filename    : 'invalid.json',
        content     : JSON.stringify({ name : 'test-marketplace' }),
      },
      {
        description : 'empty file',
        filename    : 'empty.json',
        content     : '',
      },
      {
        description : 'whitespace only',
        filename    : 'whitespace.json',
        content     : '   \n  \t  ',
      },
    ])('should return null for $description', async ({ filename, content }) => {
      const jsonPath = path.join(tempDir, filename)
      await fs.writeFile(jsonPath, content)

      const result = await parseMarketplaceJson(jsonPath)
      expect(result).toBeNull()
    })

    it('should return null for missing file', async () => {
      const result = await parseMarketplaceJson('/nonexistent/marketplace.json')
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
