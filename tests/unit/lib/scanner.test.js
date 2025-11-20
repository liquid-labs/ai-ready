import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { scanForProviders } from '_lib/scanner'
import { INTEGRATION_TYPES } from '_lib/types'
import { createTestLibrary } from './test-lib'

describe('scanner', () => {
  let tempDir

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-scanner-test-'))
  })

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive : true, force : true })
    }
  })

  describe('scanForProviders', () => {
    it('should discover library with generic integration', async () => {
      await createTestLibrary(tempDir, 'test-lib-1', [
        {
          dirName : 'TestIntegration',
          generic : {
            name    : 'TestIntegration',
            summary : 'A test integration',
          },
        },
      ])

      const providers = await scanForProviders(['node_modules'], tempDir)

      expect(providers).toHaveLength(1)
      expect(providers[0]).toMatchObject({
        libraryName : 'test-lib-1',
        version     : '1.0.0',
        path        : path.join(tempDir, 'node_modules', 'test-lib-1'),
      })
      expect(providers[0].integrations).toHaveLength(1)
      expect(providers[0].integrations[0]).toMatchObject({
        name           : 'TestIntegration',
        summary        : 'A test integration',
        types          : [INTEGRATION_TYPES.GENERIC],
        installedTypes : [],
      })
    })

    it('should discover library with Claude Skill', async () => {
      await createTestLibrary(tempDir, 'test-lib-2', [
        {
          dirName : 'SkillIntegration',
          skill   : {
            name    : 'SkillIntegration',
            summary : 'A skill integration',
          },
        },
      ])

      const providers = await scanForProviders(['node_modules'], tempDir)

      expect(providers).toHaveLength(1)
      expect(providers[0].integrations[0]).toMatchObject({
        name           : 'SkillIntegration',
        summary        : 'A skill integration',
        types          : [INTEGRATION_TYPES.CLAUDE_SKILL],
        installedTypes : [],
      })
    })

    it('should discover library with both integration types', async () => {
      await createTestLibrary(tempDir, 'test-lib-3', [
        {
          dirName : 'DualIntegration',
          generic : {
            name    : 'DualIntegration',
            summary : 'A dual-type integration',
          },
          skill : {
            name    : 'DualIntegration',
            summary : 'A dual-type integration',
          },
        },
      ])

      const providers = await scanForProviders(['node_modules'], tempDir)

      expect(providers).toHaveLength(1)
      expect(providers[0].integrations[0]).toMatchObject({
        name           : 'DualIntegration',
        summary        : 'A dual-type integration',
        types          : [INTEGRATION_TYPES.GENERIC, INTEGRATION_TYPES.CLAUDE_SKILL],
        installedTypes : [],
      })
    })

    it('should discover multiple integrations in one library', async () => {
      await createTestLibrary(tempDir, 'test-lib-4', [
        {
          dirName : 'Integration1',
          generic : {
            name    : 'Integration1',
            summary : 'First integration',
          },
        },
        {
          dirName : 'Integration2',
          skill   : {
            name    : 'Integration2',
            summary : 'Second integration',
          },
        },
      ])

      const providers = await scanForProviders(['node_modules'], tempDir)

      expect(providers).toHaveLength(1)
      expect(providers[0].integrations).toHaveLength(2)
      expect(providers[0].integrations[0].name).toBe('Integration1')
      expect(providers[0].integrations[1].name).toBe('Integration2')
    })

    it('should discover multiple libraries', async () => {
      await createTestLibrary(tempDir, 'lib-a', [
        {
          dirName : 'IntegrationA',
          generic : {
            name    : 'IntegrationA',
            summary : 'Integration A',
          },
        },
      ])

      await createTestLibrary(tempDir, 'lib-b', [
        {
          dirName : 'IntegrationB',
          skill   : {
            name    : 'IntegrationB',
            summary : 'Integration B',
          },
        },
      ])

      const providers = await scanForProviders(['node_modules'], tempDir)

      expect(providers).toHaveLength(2)
      expect(providers.find((p) => p.libraryName === 'lib-a')).toBeDefined()
      expect(providers.find((p) => p.libraryName === 'lib-b')).toBeDefined()
    })

    it('should skip libraries without ai-ready directory', async () => {
      const libraryPath = path.join(tempDir, 'node_modules', 'regular-lib')
      await fs.mkdir(libraryPath, { recursive : true })
      await fs.writeFile(
        path.join(libraryPath, 'package.json'),
        JSON.stringify({ name : 'regular-lib', version : '1.0.0' }),
        'utf8'
      )

      const providers = await scanForProviders(['node_modules'], tempDir)

      expect(providers).toHaveLength(0)
    })

    it('should skip integration directories without metadata files', async () => {
      const libraryPath = path.join(tempDir, 'node_modules', 'test-lib')
      const integrationPath = path.join(libraryPath, 'ai-ready', 'integrations', 'InvalidIntegration')
      await fs.mkdir(integrationPath, { recursive : true })
      await fs.writeFile(
        path.join(libraryPath, 'package.json'),
        JSON.stringify({ name : 'test-lib', version : '1.0.0' }),
        'utf8'
      )

      const providers = await scanForProviders(['node_modules'], tempDir)

      expect(providers).toHaveLength(0)
    })

    it('should handle missing package.json gracefully', async () => {
      const libraryPath = path.join(tempDir, 'node_modules', 'no-package-lib')
      const integrationPath = path.join(libraryPath, 'ai-ready', 'integrations', 'TestIntegration')
      await fs.mkdir(integrationPath, { recursive : true })
      await fs.writeFile(path.join(integrationPath, 'AI_INTEGRATION.md'), '---\nname: Test\nsummary: Test\n---', 'utf8')

      const providers = await scanForProviders(['node_modules'], tempDir)

      expect(providers).toHaveLength(1)
      expect(providers[0].version).toBe('unknown')
    })

    it('should handle non-existent scan path gracefully', async () => {
      const providers = await scanForProviders(['non-existent-path'], tempDir)
      expect(providers).toHaveLength(0)
    })

    it('should scan multiple scan paths', async () => {
      // Create library in first path
      await createTestLibrary(tempDir, 'lib-1', [
        {
          dirName : 'Integration1',
          generic : { name : 'Integration1', summary : 'Test 1' },
        },
      ])

      // Create library in second path
      const otherPath = path.join(tempDir, 'other-modules')
      await fs.mkdir(otherPath, { recursive : true })
      const lib2Path = path.join(otherPath, 'lib-2')
      await fs.mkdir(path.join(lib2Path, 'ai-ready', 'integrations', 'Integration2'), {
        recursive : true,
      })
      await fs.writeFile(
        path.join(lib2Path, 'package.json'),
        JSON.stringify({ name : 'lib-2', version : '2.0.0' }),
        'utf8'
      )
      await fs.writeFile(
        path.join(lib2Path, 'ai-ready', 'integrations', 'Integration2', 'AI_INTEGRATION.md'),
        '---\nname: Integration2\nsummary: Test 2\n---',
        'utf8'
      )

      const providers = await scanForProviders(['node_modules', 'other-modules'], tempDir)

      expect(providers).toHaveLength(2)
      expect(providers.find((p) => p.libraryName === 'lib-1')).toBeDefined()
      expect(providers.find((p) => p.libraryName === 'lib-2')).toBeDefined()
    })

    it('should skip non-directory entries in scan path', async () => {
      await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive : true })
      await fs.writeFile(path.join(tempDir, 'node_modules', 'file.txt'), 'test', 'utf8')

      const providers = await scanForProviders(['node_modules'], tempDir)
      expect(providers).toHaveLength(0)
    })

    it('should use skill metadata when generic is missing', async () => {
      await createTestLibrary(tempDir, 'test-lib', [
        {
          dirName : 'SkillOnly',
          skill   : {
            name    : 'SkillOnlyName',
            summary : 'Skill only summary',
          },
        },
      ])

      const providers = await scanForProviders(['node_modules'], tempDir)

      expect(providers[0].integrations[0]).toMatchObject({
        name    : 'SkillOnlyName',
        summary : 'Skill only summary',
      })
    })

    it('should prefer generic metadata when both exist', async () => {
      await createTestLibrary(tempDir, 'test-lib', [
        {
          dirName : 'Both',
          generic : {
            name    : 'GenericName',
            summary : 'Generic summary',
          },
          skill : {
            name    : 'SkillName',
            summary : 'Skill summary',
          },
        },
      ])

      const providers = await scanForProviders(['node_modules'], tempDir)

      expect(providers[0].integrations[0]).toMatchObject({
        name    : 'GenericName',
        summary : 'Generic summary',
      })
    })
  })
})
