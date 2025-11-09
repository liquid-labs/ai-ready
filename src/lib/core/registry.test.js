import fs from 'fs/promises'
import path from 'path'
import os from 'os'

import {
  isClaudeSkillInstalled,
  installClaudeSkillSymlink,
  removeClaudeSkillSymlink,
  readGenericRegistry,
  writeGenericRegistry,
  loadInstallationStatus,
  createBackup
} from './registry'
import { mkTable, makeProvider } from './test-lib'
import { INTEGRATION_TYPES } from './types'

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

  const normalizeEntries = (entries) => {
    return entries.map((entry) =>
      Array.isArray(entry)
        ? {
            library     : entry[0],
            integration : entry[1],
            summary     : entry[2] !== undefined ? entry[2] : 'Test',
            installed   : entry[3],
          }
        : entry)
  }

  const setupRegistries = async (
    claudeSkills = [],
    genericEntries = [],
    fileName = 'AGENTS.md'
  ) => {
    if (claudeSkills?.length > 0) {
      // Create .claude/skills directory and symlinks
      const skillsDir = path.join(tempDir, '.claude', 'skills')
      await fs.mkdir(skillsDir, { recursive : true })

      for (const skill of normalizeEntries(claudeSkills)) {
        // Create fake source directory
        const sourcePath = path.join(tempDir, 'fake-source', skill.integration)
        await fs.mkdir(sourcePath, { recursive : true })

        // Convert integration name to kebab-case for symlink
        const skillName = skill.integration
          .replace(/([a-z])([A-Z])/g, '$1-$2')
          .replace(/[\s_]+/g, '-')
          .toLowerCase()

        // Create symlink
        await fs.symlink(sourcePath, path.join(skillsDir, skillName), 'dir')
      }
    }
    if (genericEntries?.length > 0) {
      genericEntries = normalizeEntries(genericEntries)
      const rows = genericEntries
        .map((e) => `| ${e.library} | ${e.integration} | Test | ${e.installed || ''} |`)
        .join('\n')
      await fs.writeFile(
        path.join(tempDir, fileName),
        `# Table\n${mkTable(`\n${rows}`)}`,
        'utf8'
      )
    }
  }

  describe('Claude Skill symlinks', () => {
    it('should check if skill is installed (symlink exists)', async () => {
      await setupRegistries([{ library : 'lib', integration : 'TestIntegration' }])

      const isInstalled = await isClaudeSkillInstalled(
        '.claude/skills',
        'TestIntegration',
        tempDir
      )

      expect(isInstalled).toBe(true)
    })

    it('should return false when skill is not installed', async () => {
      const isInstalled = await isClaudeSkillInstalled(
        '.claude/skills',
        'NonExistent',
        tempDir
      )

      expect(isInstalled).toBe(false)
    })

    it('should install skill by creating symlink', async () => {
      const sourcePath = path.join(tempDir, 'source-skill')
      await fs.mkdir(sourcePath, { recursive : true })

      await installClaudeSkillSymlink(
        '.claude/skills',
        'TestSkill',
        sourcePath,
        tempDir
      )

      const symlinkPath = path.join(tempDir, '.claude/skills/test-skill')
      const stats = await fs.lstat(symlinkPath)
      expect(stats.isSymbolicLink()).toBe(true)

      const targetPath = await fs.readlink(symlinkPath)
      expect(targetPath).toBe(sourcePath)
    })

    it('should remove skill by deleting symlink', async () => {
      await setupRegistries([{ library : 'lib', integration : 'ToRemove' }])

      await removeClaudeSkillSymlink('.claude/skills', 'ToRemove', tempDir)

      const symlinkPath = path.join(tempDir, '.claude/skills/to-remove')
      await expect(fs.access(symlinkPath)).rejects.toThrow()
    })

    it('should not throw when removing non-existent skill', async () => {
      await expect(
        removeClaudeSkillSymlink('.claude/skills', 'NonExistent', tempDir)
      ).resolves.not.toThrow()
    })
  })


  describe('readGenericRegistry', () => {
    it('should read entries from markdown table', async () => {
      await setupRegistries(null, [['lib', 'Int', 'Test', 'yes']])
      const entries = await readGenericRegistry(['AGENTS.md'], tempDir)
      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({ library : 'lib', integration : 'Int' })
    })

    it('should read from multiple files', async () => {
      await setupRegistries(null, [['lib-1', 'Int1', 'T', 'yes']], 'AGENTS.md')
      await setupRegistries(null, [['lib-2', 'Int2', 'T', 'yes']], 'CLAUDE.md')
      const entries = await readGenericRegistry(
        ['AGENTS.md', 'CLAUDE.md'],
        tempDir
      )
      expect(entries).toHaveLength(2)
      expect(entries.find((e) => e.library === 'lib-1')).toBeDefined()
      expect(entries.find((e) => e.library === 'lib-2')).toBeDefined()
    })

    it.each([
      ['non-existent', [], []],
      [
        'skip non-installed',
        [
          ['lib', 'Yes', 'T', 'yes'],
          ['lib', 'No', 'T', ''],
        ],
        [{ integration : 'Yes' }],
      ],
      [
        'whitespace',
        [['lib', 'int', 'T', 'yes']],
        [{ library : 'lib', integration : 'int' }],
      ],
      [
        'after content',
        [['lib', 'int', 'T', 'yes']],
        [{ library : 'lib', integration : 'int' }],
      ],
    ])('should handle %s', async (_desc, rows, expected) => {
      await setupRegistries(null, rows)
      
      const entries = await readGenericRegistry(['AGENTS.md'], tempDir)
      if (expected.length === 0) {
        expect(entries).toEqual([])
      }
      else {
        expect(entries).toMatchObject(expected)
      }
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
    it('should mark installed types based on registries', async () => {
      await setupRegistries(
        [{ library : 'test-lib', integration : 'Integration1' }],
        [{ library : 'test-lib', integration : 'Integration2', installed : 'yes' }]
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

      const updated = await loadInstallationStatus(
        providers,
        '.claude/skills',
        ['AGENTS.md'],
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
      await setupRegistries(
        [{ library : 'test-lib', integration : 'Dual' }],
        [{ library : 'test-lib', integration : 'Dual', installed : 'yes' }]
      )

      const providers = [
        makeProvider([
          {
            name  : 'Dual',
            types : [INTEGRATION_TYPES.GENERIC, INTEGRATION_TYPES.CLAUDE_SKILL],
          },
        ]),
      ]

      const updated = await loadInstallationStatus(
        providers,
        '.claude/skills',
        ['AGENTS.md'],
        tempDir
      )

      expect(updated[0].integrations[0].installedTypes).toEqual([
        INTEGRATION_TYPES.GENERIC,
        INTEGRATION_TYPES.CLAUDE_SKILL,
      ])
    })

    it('should handle missing registry files', async () => {
      const providers = [
        makeProvider([
          { name : 'Integration1', types : [INTEGRATION_TYPES.CLAUDE_SKILL] },
        ]),
      ]

      const updated = await loadInstallationStatus(
        providers,
        '.claude/skills',
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
