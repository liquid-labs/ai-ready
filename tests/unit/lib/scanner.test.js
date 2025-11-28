import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { scanDependencies } from '_lib/scanner'

import { createPackageJson, createTestPackage } from './test-lib'

describe('scanner', () => {
  let tempDir

  beforeEach(async () => {
    const tempDirRaw = await fs.mkdtemp(path.join(os.tmpdir(), 'air-scanner-test-'))
    // Resolve symlinks to get canonical path (e.g., /var -> /private/var on macOS)
    tempDir = await fs.realpath(tempDirRaw)
  })

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive : true, force : true })
    }
  })

  describe('scanDependencies', () => {
    it('should discover packages with .claude-plugin/marketplace.json', async () => {
      await createTestPackage(tempDir, 'test-lib', {
        name        : 'test-plugin',
        version     : '1.0.0',
        description : 'Test plugin',
      })
      await createPackageJson(tempDir, ['test-lib'])

      const providers = await scanDependencies(tempDir)

      expect(providers).toHaveLength(1)
      expect(providers[0].packageName).toBe('test-lib')
      expect(providers[0].version).toBe('1.0.0')
      expect(providers[0].path).toBe(path.join(tempDir, 'node_modules', 'test-lib'))
      expect(providers[0].marketplaceDeclaration.name).toBe('test-lib-marketplace')
      expect(providers[0].marketplaceDeclaration.plugins).toHaveLength(1)
      expect(providers[0].marketplaceDeclaration.plugins[0].name).toBe('test-plugin')
    })

    it('should handle scoped packages', async () => {
      await createTestPackage(tempDir, '@myorg/test-lib', {
        name        : 'scoped-plugin',
        version     : '2.0.0',
        description : 'Scoped test',
      })
      await createPackageJson(tempDir, ['@myorg/test-lib'])

      const providers = await scanDependencies(tempDir)

      expect(providers).toHaveLength(1)
      expect(providers[0].packageName).toBe('@myorg/test-lib')
      expect(providers[0].marketplaceDeclaration.plugins[0].name).toBe('scoped-plugin')
    })

    it('should skip packages without marketplace.json', async () => {
      const nodeModules = path.join(tempDir, 'node_modules')
      await fs.mkdir(path.join(nodeModules, 'regular-package'), { recursive : true })
      await fs.writeFile(
        path.join(nodeModules, 'regular-package', 'package.json'),
        JSON.stringify({ name : 'regular-package', version : '1.0.0' }),
        'utf8'
      )
      await createPackageJson(tempDir, ['regular-package'])

      const providers = await scanDependencies(tempDir)
      expect(providers).toHaveLength(0)
    })

    it('should return empty array if node_modules missing', async () => {
      const providers = await scanDependencies(tempDir)
      expect(providers).toEqual([])
    })

    it('should discover multiple packages with marketplaces', async () => {
      await createTestPackage(tempDir, 'lib-1', {
        name        : 'plugin-1',
        version     : '1.0.0',
        description : 'Plugin 1',
      })

      await createTestPackage(tempDir, 'lib-2', {
        name        : 'plugin-2',
        version     : '2.0.0',
        description : 'Plugin 2',
      })
      await createPackageJson(tempDir, ['lib-1', 'lib-2'])

      const providers = await scanDependencies(tempDir)

      expect(providers).toHaveLength(2)
      expect(providers.find((p) => p.packageName === 'lib-1')).toBeDefined()
      expect(providers.find((p) => p.packageName === 'lib-2')).toBeDefined()
    })

    it('should handle packages with and without marketplaces', async () => {
      // Package with marketplace
      await createTestPackage(tempDir, 'plugin-lib', {
        name        : 'my-plugin',
        version     : '1.0.0',
        description : 'My plugin',
      })

      // Regular package without marketplace
      const nodeModules = path.join(tempDir, 'node_modules')
      await fs.mkdir(path.join(nodeModules, 'regular-lib'), { recursive : true })
      await fs.writeFile(
        path.join(nodeModules, 'regular-lib', 'package.json'),
        JSON.stringify({ name : 'regular-lib', version : '1.0.0' }),
        'utf8'
      )
      await createPackageJson(tempDir, ['plugin-lib', 'regular-lib'])

      const providers = await scanDependencies(tempDir)

      expect(providers).toHaveLength(1)
      expect(providers[0].packageName).toBe('plugin-lib')
    })

    it('should handle malformed marketplace.json gracefully', async () => {
      const nodeModules = path.join(tempDir, 'node_modules')
      const packagePath = path.join(nodeModules, 'bad-plugin')
      const pluginDir = path.join(packagePath, '.claude-plugin')
      await fs.mkdir(pluginDir, { recursive : true })
      await fs.writeFile(
        path.join(packagePath, 'package.json'),
        JSON.stringify({ name : 'bad-plugin', version : '1.0.0' }),
        'utf8'
      )
      await fs.writeFile(path.join(pluginDir, 'marketplace.json'), '{invalid json}', 'utf8')
      await createPackageJson(tempDir, ['bad-plugin'])

      const providers = await scanDependencies(tempDir)
      expect(providers).toHaveLength(0)
    })

    it('should handle missing package.json gracefully', async () => {
      const nodeModules = path.join(tempDir, 'node_modules')
      const packagePath = path.join(nodeModules, 'no-package-json')
      const pluginDir = path.join(packagePath, '.claude-plugin')
      await fs.mkdir(pluginDir, { recursive : true })
      await fs.writeFile(
        path.join(pluginDir, 'marketplace.json'),
        JSON.stringify({
          name    : 'test-marketplace',
          owner   : { name : 'Test' },
          plugins : [
            {
              name   : 'test-plugin',
              source : './plugin',
            },
          ],
        }),
        'utf8'
      )
      await createPackageJson(tempDir, ['no-package-json'])

      // Suppress console.warn for this test
      // eslint-disable-next-line no-console
      const originalWarn = console.warn
      // eslint-disable-next-line no-console
      console.warn = () => {}

      const providers = await scanDependencies(tempDir)

      // eslint-disable-next-line no-console
      console.warn = originalWarn

      expect(providers).toHaveLength(1)
      expect(providers[0].version).toBe('unknown')
      expect(providers[0].packageName).toBe('no-package-json')
    })

    it('should handle invalid marketplace.json (missing required fields)', async () => {
      const nodeModules = path.join(tempDir, 'node_modules')
      const packagePath = path.join(nodeModules, 'invalid-plugin')
      const pluginDir = path.join(packagePath, '.claude-plugin')
      await fs.mkdir(pluginDir, { recursive : true })
      await fs.writeFile(
        path.join(packagePath, 'package.json'),
        JSON.stringify({ name : 'invalid-plugin', version : '1.0.0' }),
        'utf8'
      )
      await fs.writeFile(
        path.join(pluginDir, 'marketplace.json'),
        JSON.stringify({ name : 'incomplete' }), // Missing required fields
        'utf8'
      )
      await createPackageJson(tempDir, ['invalid-plugin'])

      const providers = await scanDependencies(tempDir)
      expect(providers).toHaveLength(0)
    })

    it('should handle scoped packages with multiple subpackages', async () => {
      await createTestPackage(tempDir, '@myorg/pkg-1', {
        name        : 'plugin-1',
        version     : '1.0.0',
        description : 'Plugin 1',
      })

      await createTestPackage(tempDir, '@myorg/pkg-2', {
        name        : 'plugin-2',
        version     : '2.0.0',
        description : 'Plugin 2',
      })
      await createPackageJson(tempDir, ['@myorg/pkg-1', '@myorg/pkg-2'])

      const providers = await scanDependencies(tempDir)

      expect(providers).toHaveLength(2)
      expect(providers.find((p) => p.packageName === '@myorg/pkg-1')).toBeDefined()
      expect(providers.find((p) => p.packageName === '@myorg/pkg-2')).toBeDefined()
    })

    it('should use package.json name over directory name', async () => {
      const nodeModules = path.join(tempDir, 'node_modules')
      const packagePath = path.join(nodeModules, 'actual-package-name')
      await fs.mkdir(packagePath, { recursive : true })
      await fs.writeFile(
        path.join(packagePath, 'package.json'),
        JSON.stringify({ name : 'actual-package-name', version : '3.0.0' }),
        'utf8'
      )

      const pluginDir = path.join(packagePath, '.claude-plugin')
      await fs.mkdir(pluginDir, { recursive : true })
      await fs.writeFile(
        path.join(pluginDir, 'marketplace.json'),
        JSON.stringify({
          name    : 'my-marketplace',
          owner   : { name : 'Test' },
          plugins : [
            {
              name   : 'my-plugin',
              source : './plugin',
            },
          ],
        }),
        'utf8'
      )
      await createPackageJson(tempDir, ['actual-package-name'])

      const providers = await scanDependencies(tempDir)

      expect(providers).toHaveLength(1)
      expect(providers[0].packageName).toBe('actual-package-name')
      expect(providers[0].version).toBe('3.0.0')
    })

    it('should handle marketplace with multiple plugins', async () => {
      const nodeModules = path.join(tempDir, 'node_modules')
      const packagePath = path.join(nodeModules, 'multi-plugin')
      await fs.mkdir(packagePath, { recursive : true })
      await fs.writeFile(
        path.join(packagePath, 'package.json'),
        JSON.stringify({ name : 'multi-plugin', version : '1.0.0' }),
        'utf8'
      )

      const pluginDir = path.join(packagePath, '.claude-plugin')
      await fs.mkdir(pluginDir, { recursive : true })
      await fs.writeFile(
        path.join(pluginDir, 'marketplace.json'),
        JSON.stringify({
          name    : 'multi-marketplace',
          owner   : { name : 'Test' },
          plugins : [
            { name : 'plugin-a', source : './plugins/a', version : '1.0.0' },
            { name : 'plugin-b', source : './plugins/b', version : '2.0.0' },
            { name : 'plugin-c', source : { source : 'github', repo : 'owner/repo' } },
          ],
        }),
        'utf8'
      )
      await createPackageJson(tempDir, ['multi-plugin'])

      const providers = await scanDependencies(tempDir)

      expect(providers).toHaveLength(1)
      expect(providers[0].marketplaceDeclaration.plugins).toHaveLength(3)
      expect(providers[0].marketplaceDeclaration.plugins[0].name).toBe('plugin-a')
      expect(providers[0].marketplaceDeclaration.plugins[1].name).toBe('plugin-b')
      expect(providers[0].marketplaceDeclaration.plugins[2].name).toBe('plugin-c')
    })
  })
})
