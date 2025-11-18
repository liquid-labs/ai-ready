import fs from 'fs/promises'
import path from 'path'
import os from 'os'

import { readGenericRegistry, writeGenericRegistry, loadInstallationStatus, createBackup } from '../../../../lib/storage/registry'
import { ClaudePluginRegistry } from '../../../../lib/storage/claude-plugin-registry'
import { mkTable, makeProvider } from '../test-lib'
import { INTEGRATION_TYPES } from '../../../../lib/types'

describe('registry', () => {
  let tempDir
  let testRegistry

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-registry-test-'))

    // Create a test-specific plugin registry using factory method
    testRegistry = ClaudePluginRegistry.createForTest(tempDir)
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

  const setupRegistries = async (claudeSkills = [], genericEntries = [], fileName = 'AGENTS.md') => {
    if (claudeSkills?.length > 0) {
      // Install skills via test plugin registry
      for (const skill of normalizeEntries(claudeSkills)) {
        // Create fake library directory structure
        const libraryPath = path.join(tempDir, 'node_modules', skill.library)
        const integrationDirName = skill.integration
          .replace(/([a-z])([A-Z])/g, '$1-$2')
          .replace(/[\s_]+/g, '-')
          .toLowerCase()
        const skillPath = path.join(libraryPath, 'ai-ready', 'integrations', integrationDirName, 'claude-skill')
        await fs.mkdir(skillPath, { recursive : true }) // eslint-disable-line no-await-in-loop

        // Install via test plugin registry
        // eslint-disable-next-line no-await-in-loop
        await testRegistry.installPlugin(skill.library, skill.integration, libraryPath, '1.0.0')
      }
    }
    if (genericEntries?.length > 0) {
      genericEntries = normalizeEntries(genericEntries)
      const rows = genericEntries
        .map((e) => `| ${e.library} | ${e.integration} | Test | ${e.installed || ''} |`)
        .join('\n')
      await fs.writeFile(path.join(tempDir, fileName), `# Table\n${mkTable(`\n${rows}`)}`, 'utf8')
    }
  }

  describe('Claude Skill plugins', () => {
    it('should check if skill is installed (plugin exists)', async () => {
      await setupRegistries([{ library : 'lib', integration : 'TestIntegration' }])

      const isInstalled = await testRegistry.isPluginInstalled('lib', 'TestIntegration')

      expect(isInstalled).toBe(true)
    })

    it('should return false when skill is not installed', async () => {
      const isInstalled = await testRegistry.isPluginInstalled('lib', 'NonExistent')

      expect(isInstalled).toBe(false)
    })

    it('should install skill via plugin registry', async () => {
      const libraryPath = path.join(tempDir, 'node_modules', 'test-lib')
      const skillPath = path.join(libraryPath, 'ai-ready', 'integrations', 'test-skill', 'claude-skill')
      await fs.mkdir(skillPath, { recursive : true })

      await testRegistry.installPlugin('test-lib', 'TestSkill', libraryPath, '1.0.0')

      const isInstalled = await testRegistry.isPluginInstalled('test-lib', 'TestSkill')
      expect(isInstalled).toBe(true)
    })

    it('should remove skill from plugin registry', async () => {
      await setupRegistries([{ library : 'lib', integration : 'ToRemove' }])

      await testRegistry.removePlugin('lib', 'ToRemove')

      const isInstalled = await testRegistry.isPluginInstalled('lib', 'ToRemove')
      expect(isInstalled).toBe(false)
    })

    it('should not throw when removing non-existent skill', async () => {
      await expect(testRegistry.removePlugin('lib', 'NonExistent')).resolves.not.toThrow()
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
      const entries = await readGenericRegistry(['AGENTS.md', 'CLAUDE.md'], tempDir)
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
      ['whitespace', [['lib', 'int', 'T', 'yes']], [{ library : 'lib', integration : 'int' }]],
      ['after content', [['lib', 'int', 'T', 'yes']], [{ library : 'lib', integration : 'int' }]],
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
      ['single entry', [{ library : 'lib', integration : 'Int', summary : 'Test' }], ['lib', 'Int', 'Test']],
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

      const updated = await loadInstallationStatus(providers, '.claude/skills', ['AGENTS.md'], tempDir, testRegistry)

      expect(updated[0].integrations[0].installedTypes).toEqual([INTEGRATION_TYPES.CLAUDE_SKILL])
      expect(updated[0].integrations[1].installedTypes).toEqual([INTEGRATION_TYPES.GENERIC])
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

      const updated = await loadInstallationStatus(providers, '.claude/skills', ['AGENTS.md'], tempDir, testRegistry)

      expect(updated[0].integrations[0].installedTypes).toEqual([
        INTEGRATION_TYPES.GENERIC,
        INTEGRATION_TYPES.CLAUDE_SKILL,
      ])
    })

    it('should handle missing registry files', async () => {
      const providers = [makeProvider([{ name : 'Integration1', types : [INTEGRATION_TYPES.CLAUDE_SKILL] }])]

      const updated = await loadInstallationStatus(providers, '.claude/skills', ['AGENTS.md'], tempDir, testRegistry)

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
      await expect(createBackup('nonexistent.txt', tempDir)).resolves.not.toThrow()
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
