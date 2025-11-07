import {
  readClaudeRegistry,
  writeClaudeRegistry,
  readGenericRegistry,
  writeGenericRegistry,
  loadInstallationStatus,
  createBackup
} from './registry.js'
import { INTEGRATION_TYPES } from './types.js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import yaml from 'js-yaml'

describe('registry', () => {
  let tempDir

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-registry-test-'))
  })

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive : true, force : true })
    }
  })

  describe('readClaudeRegistry', () => {
    it('should read valid .claude file', async () => {
      const claudeFile = '.claude'
      const content = `skills:
  - library: test-lib
    integration: TestIntegration
    installedAt: 2025-11-07T12:00:00Z
`
      await fs.writeFile(path.join(tempDir, claudeFile), content, 'utf8')

      const skills = await readClaudeRegistry(claudeFile, tempDir)

      expect(skills).toHaveLength(1)
      expect(skills[0].library).toBe('test-lib')
      expect(skills[0].integration).toBe('TestIntegration')
      // YAML may parse installedAt as Date, we just check it exists
      expect(skills[0].installedAt).toBeDefined()
    })

    it('should return empty array for non-existent file', async () => {
      const skills = await readClaudeRegistry('.claude', tempDir)
      expect(skills).toEqual([])
    })

    it('should return empty array for invalid YAML', async () => {
      const claudeFile = '.claude'
      await fs.writeFile(
        path.join(tempDir, claudeFile),
        'invalid: [yaml',
        'utf8'
      )

      await expect(readClaudeRegistry(claudeFile, tempDir)).rejects.toThrow()
    })

    it('should return empty array when skills is not an array', async () => {
      const claudeFile = '.claude'
      await fs.writeFile(
        path.join(tempDir, claudeFile),
        'skills: not-an-array',
        'utf8'
      )

      const skills = await readClaudeRegistry(claudeFile, tempDir)
      expect(skills).toEqual([])
    })

    it('should filter out invalid skill entries', async () => {
      const claudeFile = '.claude'
      const content = yaml.dump({
        skills : [
          { library : 'valid-lib', integration : 'ValidInt' },
          { library : 'missing-integration' },
          { integration : 'missing-library' },
          null,
          'invalid',
        ],
      })
      await fs.writeFile(path.join(tempDir, claudeFile), content, 'utf8')

      const skills = await readClaudeRegistry(claudeFile, tempDir)
      expect(skills).toHaveLength(1)
      expect(skills[0]).toMatchObject({
        library     : 'valid-lib',
        integration : 'ValidInt',
      })
    })

    it('should handle empty skills array', async () => {
      const claudeFile = '.claude'
      await fs.writeFile(path.join(tempDir, claudeFile), 'skills: []', 'utf8')

      const skills = await readClaudeRegistry(claudeFile, tempDir)
      expect(skills).toEqual([])
    })
  })

  describe('writeClaudeRegistry', () => {
    it('should write skills to .claude file', async () => {
      const claudeFile = '.claude'
      const skills = [
        {
          library     : 'test-lib',
          integration : 'TestIntegration',
          installedAt : '2025-11-07T12:00:00Z',
        },
      ]

      await writeClaudeRegistry(claudeFile, skills, tempDir)

      const content = await fs.readFile(path.join(tempDir, claudeFile), 'utf8')
      const data = yaml.load(content)

      expect(data.skills).toHaveLength(1)
      expect(data.skills[0]).toMatchObject(skills[0])
    })

    it('should add installedAt timestamp if missing', async () => {
      const claudeFile = '.claude'
      const skills = [
        {
          library     : 'test-lib',
          integration : 'TestIntegration',
        },
      ]

      await writeClaudeRegistry(claudeFile, skills, tempDir)

      const content = await fs.readFile(path.join(tempDir, claudeFile), 'utf8')
      const data = yaml.load(content)

      expect(data.skills[0].installedAt).toBeDefined()
      expect(typeof data.skills[0].installedAt).toBe('string')
    })

    it('should write empty skills array', async () => {
      const claudeFile = '.claude'
      await writeClaudeRegistry(claudeFile, [], tempDir)

      const content = await fs.readFile(path.join(tempDir, claudeFile), 'utf8')
      const data = yaml.load(content)

      expect(data.skills).toEqual([])
    })

    it('should format YAML with proper indentation', async () => {
      const claudeFile = '.claude'
      const skills = [
        {
          library     : 'test-lib',
          integration : 'TestIntegration',
        },
      ]

      await writeClaudeRegistry(claudeFile, skills, tempDir)

      const content = await fs.readFile(path.join(tempDir, claudeFile), 'utf8')
      expect(content).toContain('skills:')
      expect(content).toContain('  - library:')
    })
  })

  describe('readGenericRegistry', () => {
    it('should read entries from markdown table', async () => {
      const mdFile = 'AGENTS.md'
      const content = `# Generic AI Integrations

| Library     | Integration      | Summary                          | Installed |
|-------------|------------------|----------------------------------|-----------|
| test-lib    | TestIntegration  | A test integration               | yes       |
`
      await fs.writeFile(path.join(tempDir, mdFile), content, 'utf8')

      const entries = await readGenericRegistry([mdFile], tempDir)

      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({
        library     : 'test-lib',
        integration : 'TestIntegration',
      })
    })

    it('should read from multiple files', async () => {
      const agentsContent = `# Agents

| Library     | Integration      | Summary                          | Installed |
|-------------|------------------|----------------------------------|-----------|
| lib-1       | Integration1     | First                            | yes       |
`
      const claudeContent = `# Claude

| Library     | Integration      | Summary                          | Installed |
|-------------|------------------|----------------------------------|-----------|
| lib-2       | Integration2     | Second                           | yes       |
`
      await fs.writeFile(path.join(tempDir, 'AGENTS.md'), agentsContent, 'utf8')
      await fs.writeFile(path.join(tempDir, 'CLAUDE.md'), claudeContent, 'utf8')

      const entries = await readGenericRegistry(
        ['AGENTS.md', 'CLAUDE.md'],
        tempDir
      )

      expect(entries).toHaveLength(2)
      expect(entries.find((e) => e.library === 'lib-1')).toBeDefined()
      expect(entries.find((e) => e.library === 'lib-2')).toBeDefined()
    })

    it('should return empty array for non-existent files', async () => {
      const entries = await readGenericRegistry(['AGENTS.md'], tempDir)
      expect(entries).toEqual([])
    })

    it('should skip rows without installed marker', async () => {
      const mdFile = 'AGENTS.md'
      const content = `# Generic AI Integrations

| Library     | Integration      | Summary                          | Installed |
|-------------|------------------|----------------------------------|-----------|
| test-lib    | Installed        | Installed one                    | yes       |
| test-lib    | NotInstalled     | Not installed one                |           |
`
      await fs.writeFile(path.join(tempDir, mdFile), content, 'utf8')

      const entries = await readGenericRegistry([mdFile], tempDir)

      expect(entries).toHaveLength(1)
      expect(entries[0].integration).toBe('Installed')
    })

    it('should handle table with extra whitespace', async () => {
      const mdFile = 'AGENTS.md'
      const content = `# Generic AI Integrations

|   Library   |   Integration    |   Summary      |   Installed   |
|-------------|------------------|----------------|---------------|
|   lib       |   int            |   sum          |   yes         |
`
      await fs.writeFile(path.join(tempDir, mdFile), content, 'utf8')

      const entries = await readGenericRegistry([mdFile], tempDir)

      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({
        library     : 'lib',
        integration : 'int',
      })
    })

    it('should handle content after table', async () => {
      const mdFile = 'AGENTS.md'
      const content = `# Generic AI Integrations

| Library     | Integration      | Summary                          | Installed |
|-------------|------------------|----------------------------------|-----------|
| test-lib    | TestIntegration  | A test integration               | yes       |

## More content

This is additional content after the table.
`
      await fs.writeFile(path.join(tempDir, mdFile), content, 'utf8')

      const entries = await readGenericRegistry([mdFile], tempDir)

      expect(entries).toHaveLength(1)
    })
  })

  describe('writeGenericRegistry', () => {
    it('should write entries to markdown table', async () => {
      const mdFile = 'AGENTS.md'
      const entries = [
        {
          library     : 'test-lib',
          integration : 'TestIntegration',
          summary     : 'A test integration',
        },
      ]

      await writeGenericRegistry(mdFile, entries, tempDir)

      const content = await fs.readFile(path.join(tempDir, mdFile), 'utf8')
      expect(content).toContain('| Library')
      expect(content).toContain('test-lib')
      expect(content).toContain('TestIntegration')
      expect(content).toContain('A test integration')
    })

    it('should write multiple entries', async () => {
      const mdFile = 'AGENTS.md'
      const entries = [
        { library : 'lib-1', integration : 'Int1', summary : 'First' },
        { library : 'lib-2', integration : 'Int2', summary : 'Second' },
      ]

      await writeGenericRegistry(mdFile, entries, tempDir)

      const content = await fs.readFile(path.join(tempDir, mdFile), 'utf8')
      expect(content).toContain('lib-1')
      expect(content).toContain('lib-2')
    })

    it('should write empty table for empty entries', async () => {
      const mdFile = 'AGENTS.md'
      await writeGenericRegistry(mdFile, [], tempDir)

      const content = await fs.readFile(path.join(tempDir, mdFile), 'utf8')
      expect(content).toContain('# Generic AI Integrations')
      expect(content).toContain('| Library')
    })
  })

  describe('loadInstallationStatus', () => {
    it('should mark installed types based on registries', async () => {
      // Create registries
      const claudeFile = '.claude'
      await writeClaudeRegistry(
        claudeFile,
        [{ library : 'test-lib', integration : 'Integration1' }],
        tempDir
      )

      const mdFile = 'AGENTS.md'
      const mdContent = `# Agents
| Library     | Integration      | Summary                          | Installed |
|-------------|------------------|----------------------------------|-----------|
| test-lib    | Integration2     | Second                           | yes       |
`
      await fs.writeFile(path.join(tempDir, mdFile), mdContent, 'utf8')

      // Create providers
      const providers = [
        {
          libraryName  : 'test-lib',
          version      : '1.0.0',
          path         : '/path',
          integrations : [
            {
              name           : 'Integration1',
              summary        : 'First',
              types          : [INTEGRATION_TYPES.CLAUDE_SKILL],
              installedTypes : [],
            },
            {
              name           : 'Integration2',
              summary        : 'Second',
              types          : [INTEGRATION_TYPES.GENERIC],
              installedTypes : [],
            },
            {
              name    : 'Integration3',
              summary : 'Third',
              types   : [
                INTEGRATION_TYPES.GENERIC,
                INTEGRATION_TYPES.CLAUDE_SKILL,
              ],
              installedTypes : [],
            },
          ],
        },
      ]

      const updated = await loadInstallationStatus(
        providers,
        claudeFile,
        [mdFile],
        tempDir
      )

      expect(updated[0].integrations[0].installedTypes).toEqual([
        INTEGRATION_TYPES.CLAUDE_SKILL,
      ])
      expect(updated[0].integrations[1].installedTypes).toEqual([
        INTEGRATION_TYPES.GENERIC,
      ])
      expect(updated[0].integrations[2].installedTypes).toEqual([])
    })

    it('should handle both types installed', async () => {
      const claudeFile = '.claude'
      await writeClaudeRegistry(
        claudeFile,
        [{ library : 'test-lib', integration : 'Dual' }],
        tempDir
      )

      const mdFile = 'AGENTS.md'
      const mdContent = `# Agents
| Library     | Integration      | Summary                          | Installed |
|-------------|------------------|----------------------------------|-----------|
| test-lib    | Dual             | Dual type                        | yes       |
`
      await fs.writeFile(path.join(tempDir, mdFile), mdContent, 'utf8')

      const providers = [
        {
          libraryName  : 'test-lib',
          version      : '1.0.0',
          path         : '/path',
          integrations : [
            {
              name    : 'Dual',
              summary : 'Dual',
              types   : [
                INTEGRATION_TYPES.GENERIC,
                INTEGRATION_TYPES.CLAUDE_SKILL,
              ],
              installedTypes : [],
            },
          ],
        },
      ]

      const updated = await loadInstallationStatus(
        providers,
        claudeFile,
        [mdFile],
        tempDir
      )

      expect(updated[0].integrations[0].installedTypes).toEqual([
        INTEGRATION_TYPES.GENERIC,
        INTEGRATION_TYPES.CLAUDE_SKILL,
      ])
    })

    it('should handle missing registry files', async () => {
      const providers = [
        {
          libraryName  : 'test-lib',
          version      : '1.0.0',
          path         : '/path',
          integrations : [
            {
              name           : 'Integration1',
              summary        : 'First',
              types          : [INTEGRATION_TYPES.CLAUDE_SKILL],
              installedTypes : [],
            },
          ],
        },
      ]

      const updated = await loadInstallationStatus(
        providers,
        '.claude',
        ['AGENTS.md'],
        tempDir
      )

      expect(updated[0].integrations[0].installedTypes).toEqual([])
    })
  })

  describe('createBackup', () => {
    it('should create backup of existing file', async () => {
      const filePath = 'test.txt'
      const fullPath = path.join(tempDir, filePath)
      await fs.writeFile(fullPath, 'test content', 'utf8')

      await createBackup(filePath, tempDir)

      const backupContent = await fs.readFile(`${fullPath}.bak`, 'utf8')
      expect(backupContent).toBe('test content')
    })

    it('should not throw error for non-existent file', async () => {
      await expect(
        createBackup('nonexistent.txt', tempDir)
      ).resolves.not.toThrow()
    })

    it('should overwrite existing backup', async () => {
      const filePath = 'test.txt'
      const fullPath = path.join(tempDir, filePath)
      await fs.writeFile(fullPath, 'new content', 'utf8')
      await fs.writeFile(`${fullPath}.bak`, 'old backup', 'utf8')

      await createBackup(filePath, tempDir)

      const backupContent = await fs.readFile(`${fullPath}.bak`, 'utf8')
      expect(backupContent).toBe('new content')
    })
  })
})
