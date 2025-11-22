import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { invalidateCache, loadProvidersWithCache } from '_lib/storage/cache'

const writeTestPackageJson = async (tempDir) => {
  const pkgPath = path.join(tempDir, 'package.json')
  await fs.writeFile(pkgPath, JSON.stringify({ name : 'test' }), 'utf8')

  return pkgPath
}

const writeTestPackageLockJson = async (tempDir) => {
  const lockPath = path.join(tempDir, 'package-lock.json')
  await fs.writeFile(lockPath, JSON.stringify({ version : '1.0.0' }), 'utf8')

  return lockPath
}

describe('cache', () => {
  let tempDir

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-cache-test-'))
  })

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive : true, force : true })
    }
  })

  const sampleProviders = [
    {
      packageName       : 'test-lib',
      version           : '1.0.0',
      path              : '/path/to/test-lib',
      pluginDeclaration : {
        name        : 'test-plugin',
        version     : '1.0.0',
        description : 'Test plugin',
        skillPath   : '.claude-plugin/skill',
      },
    },
  ]

  describe('loadProvidersWithCache', () => {
    it('should return cached providers when cache is valid', async () => {
      // Setup package files
      await writeTestPackageJson(tempDir)
      await writeTestPackageLockJson(tempDir)

      // First call - creates cache
      const scanFn1 = jest.fn().mockResolvedValue(sampleProviders)
      const providers1 = await loadProvidersWithCache(scanFn1, tempDir)

      expect(providers1).toEqual(sampleProviders)
      expect(scanFn1).toHaveBeenCalledTimes(1)

      // Second call - should use cache
      const scanFn2 = jest.fn()
      const providers2 = await loadProvidersWithCache(scanFn2, tempDir)

      expect(providers2).toEqual(sampleProviders)
      expect(scanFn2).not.toHaveBeenCalled()
    })

    it('should call scan function when cache does not exist', async () => {
      await writeTestPackageJson(tempDir)

      const scanFn = jest.fn().mockResolvedValue(sampleProviders)
      const providers = await loadProvidersWithCache(scanFn, tempDir)

      expect(providers).toEqual(sampleProviders)
      expect(scanFn).toHaveBeenCalledTimes(1)
    })

    it('should invalidate cache when package.json changes', async () => {
      const packageJsonPath = await writeTestPackageJson(tempDir)
      await writeTestPackageLockJson(tempDir)

      // First call - creates cache
      const scanFn1 = jest.fn().mockResolvedValue(sampleProviders)
      await loadProvidersWithCache(scanFn1, tempDir)

      // Modify package.json (change mtime)
      await new Promise((resolve) => setTimeout(resolve, 10))
      await fs.writeFile(packageJsonPath, JSON.stringify({ name : 'test', version : '2.0.0' }), 'utf8')

      // Second call - cache should be invalid
      const newProviders = [
        {
          packageName       : 'new-lib',
          version           : '2.0.0',
          path              : '/path/to/new-lib',
          pluginDeclaration : {
            name        : 'new-plugin',
            version     : '2.0.0',
            description : 'New plugin',
            skillPath   : '.claude-plugin/skill',
          },
        },
      ]
      const scanFn2 = jest.fn().mockResolvedValue(newProviders)
      const providers = await loadProvidersWithCache(scanFn2, tempDir)

      expect(providers).toEqual(newProviders)
      expect(scanFn2).toHaveBeenCalledTimes(1)
    })

    it('should invalidate cache when package-lock.json changes', async () => {
      await writeTestPackageJson(tempDir)
      const packageLockPath = await writeTestPackageLockJson(tempDir)

      // First call - creates cache
      const scanFn1 = jest.fn().mockResolvedValue(sampleProviders)
      await loadProvidersWithCache(scanFn1, tempDir)

      // Modify package-lock.json (change mtime)
      await new Promise((resolve) => setTimeout(resolve, 10))
      await fs.writeFile(packageLockPath, JSON.stringify({ version : '2.0.0' }), 'utf8')

      // Second call - cache should be invalid
      const newProviders = [
        {
          packageName       : 'new-lib',
          version           : '2.0.0',
          path              : '/path/to/new-lib',
          pluginDeclaration : {
            name        : 'new-plugin',
            version     : '2.0.0',
            description : 'New plugin',
            skillPath   : '.claude-plugin/skill',
          },
        },
      ]
      const scanFn2 = jest.fn().mockResolvedValue(newProviders)
      const providers = await loadProvidersWithCache(scanFn2, tempDir)

      expect(providers).toEqual(newProviders)
      expect(scanFn2).toHaveBeenCalledTimes(1)
    })

    it('should handle missing package.json', async () => {
      // No package files created

      const scanFn = jest.fn().mockResolvedValue(sampleProviders)
      const providers = await loadProvidersWithCache(scanFn, tempDir)

      expect(providers).toEqual(sampleProviders)
      expect(scanFn).toHaveBeenCalledTimes(1)
    })

    it('should handle missing package-lock.json', async () => {
      await writeTestPackageJson(tempDir)
      // No package-lock.json created

      const scanFn = jest.fn().mockResolvedValue(sampleProviders)
      const providers = await loadProvidersWithCache(scanFn, tempDir)

      expect(providers).toEqual(sampleProviders)
      expect(scanFn).toHaveBeenCalledTimes(1)
    })

    it('should write cache to .air-plugin-cache.json', async () => {
      await writeTestPackageJson(tempDir)

      const scanFn = jest.fn().mockResolvedValue(sampleProviders)
      await loadProvidersWithCache(scanFn, tempDir)

      const cacheFile = path.join(tempDir, '.air-plugin-cache.json')
      const cacheExists = await fs
        .access(cacheFile)
        .then(() => true)
        .catch(() => false)

      expect(cacheExists).toBe(true)

      const cacheContent = await fs.readFile(cacheFile, 'utf8')
      const cache = JSON.parse(cacheContent)

      expect(cache.providers).toEqual(sampleProviders)
      expect(typeof cache.scannedAt).toBe('string')
      expect(typeof cache.packageJsonMTime).toBe('number')
      expect(typeof cache.packageLockMTime).toBe('number')
    })

    it('should return empty array when scan function returns empty', async () => {
      await writeTestPackageJson(tempDir)

      const scanFn = jest.fn().mockResolvedValue([])
      const providers = await loadProvidersWithCache(scanFn, tempDir)

      expect(providers).toEqual([])
      expect(scanFn).toHaveBeenCalledTimes(1)
    })

    it('should handle malformed cache file gracefully', async () => {
      await writeTestPackageJson(tempDir)

      // Write invalid cache file
      const cacheFile = path.join(tempDir, '.air-plugin-cache.json')
      await fs.writeFile(cacheFile, '{invalid json}', 'utf8')

      const scanFn = jest.fn().mockResolvedValue(sampleProviders)
      const providers = await loadProvidersWithCache(scanFn, tempDir)

      expect(providers).toEqual(sampleProviders)
      expect(scanFn).toHaveBeenCalledTimes(1)
    })

    it('should invalidate cache when package-lock.json is deleted', async () => {
      await writeTestPackageJson(tempDir)
      const packageLockPath = await writeTestPackageLockJson(tempDir)

      // First call - creates cache with lock file
      const scanFn1 = jest.fn().mockResolvedValue(sampleProviders)
      await loadProvidersWithCache(scanFn1, tempDir)

      // Delete package-lock.json
      await fs.unlink(packageLockPath)

      // Second call - cache should be invalid
      const scanFn2 = jest.fn().mockResolvedValue(sampleProviders)
      await loadProvidersWithCache(scanFn2, tempDir)

      expect(scanFn2).toHaveBeenCalledTimes(1)
    })

    it('should invalidate cache when package-lock.json is created', async () => {
      await writeTestPackageJson(tempDir)
      // No package-lock.json initially

      // First call - creates cache without lock file
      const scanFn1 = jest.fn().mockResolvedValue(sampleProviders)
      await loadProvidersWithCache(scanFn1, tempDir)

      // Create package-lock.json
      await new Promise((resolve) => setTimeout(resolve, 10))
      await writeTestPackageLockJson(tempDir)

      // Second call - cache should be invalid
      const scanFn2 = jest.fn().mockResolvedValue(sampleProviders)
      await loadProvidersWithCache(scanFn2, tempDir)

      expect(scanFn2).toHaveBeenCalledTimes(1)
    })
  })

  describe('invalidateCache', () => {
    it('should delete cache file', async () => {
      await writeTestPackageJson(tempDir)

      // Create cache
      const scanFn = jest.fn().mockResolvedValue(sampleProviders)
      await loadProvidersWithCache(scanFn, tempDir)

      const cacheFile = path.join(tempDir, '.air-plugin-cache.json')
      let cacheExists = await fs
        .access(cacheFile)
        .then(() => true)
        .catch(() => false)

      expect(cacheExists).toBe(true)

      // Invalidate cache
      await invalidateCache(tempDir)

      cacheExists = await fs
        .access(cacheFile)
        .then(() => true)
        .catch(() => false)

      expect(cacheExists).toBe(false)
    })

    it('should not throw error when cache file does not exist', async () => {
      await expect(invalidateCache(tempDir)).resolves.not.toThrow()
    })
  })
})
