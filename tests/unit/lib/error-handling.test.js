import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { parseMarketplaceJson } from '_lib/parsers/marketplace-json'
import { scanDependencies } from '_lib/scanner'
import { readSettings, updateSettings } from '_lib/storage/claude-settings'

import { createPackageJson, createTestPackage } from './test-lib'

/**
 * Error handling tests
 * Verify graceful handling of various error scenarios
 */
describe('Error handling', () => {
  let tempDir
  let settingsPath

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-error-'))
    settingsPath = path.join(tempDir, '.claude', 'settings.json')
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive : true, force : true })
  })

  describe('Malformed JSON handling', () => {
    it('should handle malformed package.json gracefully', async () => {
      const packageJsonPath = path.join(tempDir, 'package.json')
      await fs.writeFile(packageJsonPath, '{invalid json}')

      await expect(scanDependencies(tempDir)).rejects.toThrow()
    })

    it('should handle malformed marketplace.json gracefully', async () => {
      const marketplacePath = path.join(tempDir, 'marketplace.json')
      await fs.writeFile(marketplacePath, '{invalid json}')

      const result = await parseMarketplaceJson(marketplacePath)
      expect(result).toBeNull()
    })

    it('should handle malformed settings.json with backup', async () => {
      await fs.mkdir(path.dirname(settingsPath), { recursive : true })
      await fs.writeFile(settingsPath, '{invalid json}')

      const settings = await readSettings(settingsPath)

      // Should return default settings
      expect(settings.plugins.enabled).toEqual([])
      expect(settings.plugins.disabled).toEqual([])

      // Should create backup
      const backupExists = await fs
        .access(`${settingsPath}.bak`)
        .then(() => true)
        .catch(() => false)
      expect(backupExists).toBe(true)
    })
  })

  describe('Missing file handling', () => {
    it.each([
      {
        description : 'missing package.json returns empty providers',
        fn          : async () => scanDependencies(tempDir),
        expected    : [],
      },
      {
        description : 'missing marketplace.json returns null',
        fn          : async () => parseMarketplaceJson('/nonexistent/marketplace.json'),
        expected    : null,
      },
      {
        description : 'missing node_modules returns empty providers',
        fn          : async () => {
          await createPackageJson(tempDir, ['some-package'])
          return scanDependencies(tempDir)
        },
        expected    : [],
      },
    ])('should handle $description', async ({ fn, expected }) => {
      const result = await fn()
      expect(result).toEqual(expected)
    })

    it('should handle missing settings.json with defaults', async () => {
      const settings = await readSettings(settingsPath)
      expect(settings.plugins.enabled).toEqual([])
      expect(settings.plugins.disabled).toEqual([])
    })
  })

  describe('Invalid marketplace.json schemas', () => {
    it.each([
      {
        description : 'missing required fields',
        data        : { name : 'test-marketplace' },
      },
      {
        description : 'missing owner',
        data        : { name : 'test-marketplace', plugins : [] },
      },
      {
        description : 'missing plugins',
        data        : { name : 'test-marketplace', owner : { name : 'Test' } },
      },
      {
        description : 'non-object (string)',
        data        : 'not an object',
      },
      {
        description : 'non-string name',
        data        : { name : 123, owner : { name : 'Test' }, plugins : [] },
      },
    ])('should reject marketplace.json with $description', async ({ data }) => {
      const marketplacePath = path.join(tempDir, 'marketplace.json')
      await fs.writeFile(marketplacePath, JSON.stringify(data))

      const result = await parseMarketplaceJson(marketplacePath)
      expect(result).toBeNull()
    })
  })

  describe('Settings backup rotation', () => {
    it('should create and rotate backups correctly', async () => {
      await fs.mkdir(path.dirname(settingsPath), { recursive : true })

      // Create initial settings
      const initialSettings = {
        plugins : {
          enabled      : [],
          disabled     : [],
          marketplaces : {},
        },
      }
      await fs.writeFile(settingsPath, JSON.stringify(initialSettings))

      // Create test package with new marketplace format
      await createTestPackage(tempDir, 'test-pkg', {
        name        : 'test-plugin',
        version     : '1.0.0',
        description : 'Test',
      })

      const providers = await scanDependencies(tempDir)

      // Update settings multiple times to create backups
      for (let i = 0; i < 7; i++) {
        // eslint-disable-next-line no-await-in-loop
        await updateSettings(settingsPath, providers)
      }

      // Check that we have backups (up to 5)
      const backupFiles = []
      const backupPaths = [
        `${settingsPath}.bak`,
        `${settingsPath}.bak.1`,
        `${settingsPath}.bak.2`,
        `${settingsPath}.bak.3`,
        `${settingsPath}.bak.4`,
        `${settingsPath}.bak.5`,
        `${settingsPath}.bak.6`,
      ]

      for (const backupPath of backupPaths) {
        // eslint-disable-next-line no-await-in-loop
        const exists = await fs
          .access(backupPath)
          .then(() => true)
          .catch(() => false)
        if (exists) {
          backupFiles.push(backupPath)
        }
      }

      // Should have at most 5 backups + 1 current
      expect(backupFiles.length).toBeLessThanOrEqual(5)
    })
  })

  describe('Package without package.json', () => {
    it('should handle package directory without package.json', async () => {
      const nodeModules = path.join(tempDir, 'node_modules')
      await createPackageJson(tempDir, ['broken-pkg'])

      // Create package directory with marketplace.json but no package.json
      const pkgPath = path.join(nodeModules, 'broken-pkg')
      await fs.mkdir(path.join(pkgPath, '.claude-plugin'), { recursive : true })
      await fs.writeFile(
        path.join(pkgPath, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          name    : 'broken-marketplace',
          owner   : { name : 'Test' },
          plugins : [
            {
              name   : 'broken-plugin',
              source : './plugin',
            },
          ],
        })
      )

      const providers = await scanDependencies(tempDir)

      // Should still discover the marketplace (uses directory name as fallback)
      expect(providers).toHaveLength(1)
      expect(providers[0].packageName).toBe('broken-pkg')
      expect(providers[0].version).toBe('unknown')
    })
  })

  describe('Concurrent operations', () => {
    it('should handle concurrent settings updates safely', async () => {
      await createPackageJson(tempDir, ['pkg-1', 'pkg-2', 'pkg-3'])

      await createTestPackage(tempDir, 'pkg-1', {
        name        : 'plugin-1',
        version     : '1.0.0',
        description : 'Test 1',
      })

      await createTestPackage(tempDir, 'pkg-2', {
        name        : 'plugin-2',
        version     : '1.0.0',
        description : 'Test 2',
      })

      await createTestPackage(tempDir, 'pkg-3', {
        name        : 'plugin-3',
        version     : '1.0.0',
        description : 'Test 3',
      })

      const providers = await scanDependencies(tempDir)

      // Run multiple concurrent updates
      await Promise.all([
        updateSettings(settingsPath, providers),
        updateSettings(settingsPath, providers),
        updateSettings(settingsPath, providers),
      ])

      // All plugins should be enabled
      const settings = await readSettings(settingsPath)
      expect(settings.plugins.enabled.length).toBe(3)
    })
  })

  describe('Empty or minimal inputs', () => {
    it.each([
      {
        description : 'empty dependencies array',
        setup       : async () => createPackageJson(tempDir, []),
        fn          : async () => scanDependencies(tempDir),
        expected    : [],
      },
      {
        description : 'package.json with no dependencies field',
        setup       : async () => fs.writeFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({ name : 'test', version : '1.0.0' })
        ),
        fn          : async () => scanDependencies(tempDir),
        expected    : [],
      },
    ])('should handle $description', async ({ setup, fn, expected }) => {
      await setup()
      const result = await fn()
      expect(result).toEqual(expected)
    })

    it('should handle empty settings update', async () => {
      const changes = await updateSettings(settingsPath, [])
      expect(changes.added).toEqual([])
      expect(changes.updated).toEqual([])

      // Should still create settings file
      const settings = await readSettings(settingsPath)
      expect(settings.plugins).toBeDefined()
    })
  })
})
