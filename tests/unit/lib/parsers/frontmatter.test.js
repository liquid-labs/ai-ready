import { parseFrontmatter, parseFrontmatterFromString } from '../../../../src/lib/parsers/frontmatter'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('frontmatter parser', () => {
  let tempDir

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-test-'))
  })

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive : true, force : true })
    }
  })

  describe('parseFrontmatterFromString', () => {
    it('should parse valid frontmatter', () => {
      const content = `---
name: TestIntegration
summary: A test integration
---

# Rest of the document
`
      const result = parseFrontmatterFromString(content)
      expect(result).toEqual({
        name    : 'TestIntegration',
        summary : 'A test integration',
      })
    })

    it('should return null when name is missing', () => {
      const content = `---
summary: A test integration
---

# Rest of the document
`
      const result = parseFrontmatterFromString(content)
      expect(result).toBeNull()
    })

    it('should return null when summary is missing', () => {
      const content = `---
name: TestIntegration
---

# Rest of the document
`
      const result = parseFrontmatterFromString(content)
      expect(result).toBeNull()
    })

    it('should return null when frontmatter is missing', () => {
      const content = '# Just a regular markdown file'
      const result = parseFrontmatterFromString(content)
      expect(result).toBeNull()
    })

    it('should handle extra fields in frontmatter', () => {
      const content = `---
name: TestIntegration
summary: A test integration
author: John Doe
version: 1.0.0
---

# Rest of the document
`
      const result = parseFrontmatterFromString(content)
      expect(result).toEqual({
        name    : 'TestIntegration',
        summary : 'A test integration',
      })
    })

    it('should convert non-string values to strings', () => {
      const content = `---
name: 123
summary: 456
---`
      const result = parseFrontmatterFromString(content)
      expect(result).toEqual({
        name    : '123',
        summary : '456',
      })
    })

    it('should handle invalid YAML', () => {
      const content = `---
name: [unclosed array
summary: test
---`
      const result = parseFrontmatterFromString(content)
      expect(result).toBeNull()
    })
  })

  describe('parseFrontmatter', () => {
    it('should parse valid frontmatter from file', async () => {
      const filePath = path.join(tempDir, 'test.md')
      const content = `---
name: FileIntegration
summary: Integration from file
---

# Content
`
      await fs.writeFile(filePath, content, 'utf8')

      const result = await parseFrontmatter(filePath)
      expect(result).toEqual({
        name    : 'FileIntegration',
        summary : 'Integration from file',
      })
    })

    it('should return null when file does not exist', async () => {
      const filePath = path.join(tempDir, 'nonexistent.md')
      const result = await parseFrontmatter(filePath)
      expect(result).toBeNull()
    })

    it('should return null when frontmatter is invalid', async () => {
      const filePath = path.join(tempDir, 'invalid.md')
      const content = `---
name: OnlyName
---`
      await fs.writeFile(filePath, content, 'utf8')

      const result = await parseFrontmatter(filePath)
      expect(result).toBeNull()
    })

    it('should throw error for permission issues', async () => {
      const filePath = path.join(tempDir, 'test.md')
      await fs.writeFile(filePath, '---\nname: Test\nsummary: Test\n---', 'utf8')

      // Make file unreadable (Unix-like systems)
      if (process.platform !== 'win32') {
        await fs.chmod(filePath, 0o000)

        await expect(parseFrontmatter(filePath)).rejects.toThrow()

        // Restore permissions for cleanup
        await fs.chmod(filePath, 0o644)
      }
    })

    it('should handle empty file', async () => {
      const filePath = path.join(tempDir, 'empty.md')
      await fs.writeFile(filePath, '', 'utf8')

      const result = await parseFrontmatter(filePath)
      expect(result).toBeNull()
    })
  })
})
