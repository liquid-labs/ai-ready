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
    it.each([
      [
        'valid file',
        'skills:\n  - library: lib\n    integration: Int\n    installedAt: 2025-11-07T12:00:00Z\n',
        false,
        (skills) => {
          expect(skills).toHaveLength(1)
          expect(skills[0].library).toBe('lib')
          expect(skills[0].installedAt).toBeDefined()
        },
      ],
      ['invalid YAML', 'invalid: [yaml', true, null],
      ['non-existent file', null, false, (skills) => expect(skills).toEqual([])],
      ['not an array', 'skills: not-an-array', false, (skills) => expect(skills).toEqual([])],
      ['empty array', 'skills: []', false, (skills) => expect(skills).toEqual([])],
      [
        'filtered invalids',
        yaml.dump({
          skills : [
            { library : 'valid', integration : 'Int' },
            { library : 'missing-int' },
            null,
          ],
        }),
        false,
        (skills) => expect(skills).toMatchObject([{ library : 'valid', integration : 'Int' }]),
      ],
    ])('should handle %s', async (_desc, content, shouldThrow, assertion) => {
      if (content) await fs.writeFile(path.join(tempDir, '.claude'), content, 'utf8')

      if (shouldThrow) {
        await expect(readClaudeRegistry('.claude', tempDir)).rejects.toThrow()
      }
      else {
        const skills = await readClaudeRegistry('.claude', tempDir)
        assertion(skills)
      }
    })
  })

  describe('writeClaudeRegistry', () => {
    it.each([
      [
        'skills with installedAt',
        [{ library : 'lib', integration : 'Int', installedAt : '2025-11-07T12:00:00Z' }],
        (data) => {
          expect(data.skills).toHaveLength(1)
          expect(data.skills[0].installedAt).toBe('2025-11-07T12:00:00Z')
        },
      ],
      [
        'skills without installedAt (auto-added)',
        [{ library : 'lib', integration : 'Int' }],
        (data) => {
          expect(data.skills[0].installedAt).toBeDefined()
          expect(typeof data.skills[0].installedAt).toBe('string')
        },
      ],
      ['empty array', [], (data) => expect(data.skills).toEqual([])],
    ])('should write %s', async (_desc, skills, assertion) => {
      const claudeFile = '.claude'
      await writeClaudeRegistry(claudeFile, skills, tempDir)

      const content = await fs.readFile(path.join(tempDir, claudeFile), 'utf8')
      const data = yaml.load(content)

      assertion(data)
      expect(content).toContain('skills:')
      if (skills.length > 0) expect(content).toContain('  - library:')
    })
  })

  describe('readGenericRegistry', () => {
    const mkTable = (rows) =>
      `| Library | Integration | Summary | Installed |\n|---------|-------------|---------|-----------|${rows}`

    it('should read entries from markdown table', async () => {
      await fs.writeFile(path.join(tempDir, 'AGENTS.md'), mkTable('\n| lib | Int | Test | yes |'), 'utf8')
      const entries = await readGenericRegistry(['AGENTS.md'], tempDir)
      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({ library : 'lib', integration : 'Int' })
    })

    it('should read from multiple files', async () => {
      await fs.writeFile(path.join(tempDir, 'AGENTS.md'), mkTable('\n| lib-1 | Int1 | T | yes |'), 'utf8')
      await fs.writeFile(path.join(tempDir, 'CLAUDE.md'), mkTable('\n| lib-2 | Int2 | T | yes |'), 'utf8')
      const entries = await readGenericRegistry(['AGENTS.md', 'CLAUDE.md'], tempDir)
      expect(entries).toHaveLength(2)
      expect(entries.find((e) => e.library === 'lib-1')).toBeDefined()
      expect(entries.find((e) => e.library === 'lib-2')).toBeDefined()
    })

    it.each([
      ['non-existent', null, []],
      ['skip non-installed', '\n| lib | Yes | T | yes |\n| lib | No | T | |', [{ integration : 'Yes' }]],
      ['whitespace', '\n|  lib  |  int  |  T  |  yes  |', [{ library : 'lib', integration : 'int' }]],
      ['after content', '\n| lib | int | T | yes |\n\n## More', [{ library : 'lib', integration : 'int' }]],
    ])('should handle %s', async (_desc, rows, expected) => {
      if (rows) await fs.writeFile(path.join(tempDir, 'AGENTS.md'), mkTable(rows), 'utf8')
      const entries = await readGenericRegistry(['AGENTS.md'], tempDir)
      expected.length === 0 ? expect(entries).toEqual([]) : expect(entries).toMatchObject(expected)
    })
  })

  describe('writeGenericRegistry', () => {
    it.each([
      [
        'single entry',
        [{ library : 'lib', integration : 'Int', summary : 'Test' }],
        ['lib', 'Int', 'Test'],
      ],
      [
        'multiple entries',
        [
          { library : 'lib-1', integration : 'Int1', summary : 'First' },
          { library : 'lib-2', integration : 'Int2', summary : 'Second' },
        ],
        ['lib-1', 'lib-2'],
      ],
      ['empty entries', [], ['# Generic AI Integrations']],
    ])('should write %s', async (_desc, entries, expectedContent) => {
      await writeGenericRegistry('AGENTS.md', entries, tempDir)

      const content = await fs.readFile(path.join(tempDir, 'AGENTS.md'), 'utf8')
      expect(content).toContain('| Library')
      expectedContent.forEach((str) => expect(content).toContain(str))
    })
  })

  describe('loadInstallationStatus', () => {
    const makeProvider = (integrations) => ({
      libraryName  : 'test-lib',
      version      : '1.0.0',
      path         : '/path',
      integrations : integrations.map((int) => ({
        name           : int.name,
        summary        : int.summary || 'Test',
        types          : int.types,
        installedTypes : [],
      })),
    })

    const setupRegistries = async (claudeSkills, genericEntries) => {
      if (claudeSkills) {
        await writeClaudeRegistry('.claude', claudeSkills, tempDir)
      }
      if (genericEntries) {
        const table = `# Table
| Library | Integration | Summary | Installed |
|---------|-------------|---------|-----------|
${genericEntries.map((e) => `| ${e.library} | ${e.integration} | Test | yes |`).join('\n')}
`
        await fs.writeFile(path.join(tempDir, 'AGENTS.md'), table, 'utf8')
      }
    }

    it('should mark installed types based on registries', async () => {
      await setupRegistries(
        [{ library : 'test-lib', integration : 'Integration1' }],
        [{ library : 'test-lib', integration : 'Integration2' }]
      )

      const providers = [
        makeProvider([
          { name : 'Integration1', types : [INTEGRATION_TYPES.CLAUDE_SKILL] },
          { name : 'Integration2', types : [INTEGRATION_TYPES.GENERIC] },
          {
            name  : 'Integration3',
            types : [INTEGRATION_TYPES.GENERIC, INTEGRATION_TYPES.CLAUDE_SKILL],
          },
        ]),
      ]

      const updated = await loadInstallationStatus(providers, '.claude', ['AGENTS.md'], tempDir)

      expect(updated[0].integrations[0].installedTypes).toEqual([INTEGRATION_TYPES.CLAUDE_SKILL])
      expect(updated[0].integrations[1].installedTypes).toEqual([INTEGRATION_TYPES.GENERIC])
      expect(updated[0].integrations[2].installedTypes).toEqual([])
    })

    it('should handle both types installed', async () => {
      await setupRegistries(
        [{ library : 'test-lib', integration : 'Dual' }],
        [{ library : 'test-lib', integration : 'Dual' }]
      )

      const providers = [
        makeProvider([
          {
            name  : 'Dual',
            types : [INTEGRATION_TYPES.GENERIC, INTEGRATION_TYPES.CLAUDE_SKILL],
          },
        ]),
      ]

      const updated = await loadInstallationStatus(providers, '.claude', ['AGENTS.md'], tempDir)

      expect(updated[0].integrations[0].installedTypes).toEqual([
        INTEGRATION_TYPES.GENERIC,
        INTEGRATION_TYPES.CLAUDE_SKILL,
      ])
    })

    it('should handle missing registry files', async () => {
      const providers = [
        makeProvider([{ name : 'Integration1', types : [INTEGRATION_TYPES.CLAUDE_SKILL] }]),
      ]

      const updated = await loadInstallationStatus(providers, '.claude', ['AGENTS.md'], tempDir)

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
