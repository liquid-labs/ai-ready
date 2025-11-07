import {
  readCache,
  writeCache,
  isCacheValid,
  createCacheData,
  loadProvidersWithCache
} from './cache.js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

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

  const validCacheData = {
    scannedAt        : '2025-11-07T12:00:00Z',
    packageJsonMTime : 1234567890,
    packageLockMTime : 1234567890,
    providers        : [
      {
        libraryName  : 'test-lib',
        version      : '1.0.0',
        path         : '/path/to/test-lib',
        integrations : [],
      },
    ],
  }

  describe('readCache', () => {
    it('should read valid cache file', async () => {
      const cacheFile = path.join(tempDir, '.aircache.json')
      await fs.writeFile(cacheFile, JSON.stringify(validCacheData), 'utf8')

      const cache = await readCache(cacheFile, tempDir)
      expect(cache).toEqual(validCacheData)
    })

    it('should return null for non-existent cache file', async () => {
      const cache = await readCache('.aircache.json', tempDir)
      expect(cache).toBeNull()
    })

    it('should return null for invalid cache data', async () => {
      const cacheFile = path.join(tempDir, '.aircache.json')
      await fs.writeFile(cacheFile, JSON.stringify({ invalid : 'data' }), 'utf8')

      const cache = await readCache(cacheFile, tempDir)
      expect(cache).toBeNull()
    })

    it('should return null for malformed JSON', async () => {
      const cacheFile = path.join(tempDir, '.aircache.json')
      await fs.writeFile(cacheFile, 'not json', 'utf8')

      const cache = await readCache(cacheFile, tempDir)
      expect(cache).toBeNull()
    })
  })

  describe('writeCache', () => {
    it('should write cache to file', async () => {
      const cacheFile = '.aircache.json'
      await writeCache(cacheFile, validCacheData, tempDir)

      const content = await fs.readFile(path.join(tempDir, cacheFile), 'utf8')
      expect(JSON.parse(content)).toEqual(validCacheData)
    })

    it('should throw error for invalid cache data', async () => {
      const invalidData = { invalid : 'data' }
      await expect(
        writeCache('.aircache.json', invalidData, tempDir)
      ).rejects.toThrow('Invalid cache data')
    })

    it('should format JSON with 2-space indentation', async () => {
      const cacheFile = '.aircache.json'
      await writeCache(cacheFile, validCacheData, tempDir)

      const content = await fs.readFile(path.join(tempDir, cacheFile), 'utf8')
      expect(content).toContain('  "scannedAt"')
    })
  })

  describe('isCacheValid', () => {
    it('should return false for null cache', async () => {
      const isValid = await isCacheValid(null, tempDir)
      expect(isValid).toBe(false)
    })

    it('should return false when package.json is missing', async () => {
      const isValid = await isCacheValid(validCacheData, tempDir)
      expect(isValid).toBe(false)
    })

    it('should return true when timestamps match', async () => {
      // Create package.json and package-lock.json
      const packageJsonPath = path.join(tempDir, 'package.json')
      const packageLockPath = path.join(tempDir, 'package-lock.json')

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({ name : 'test' }),
        'utf8'
      )
      await fs.writeFile(
        packageLockPath,
        JSON.stringify({ version : '1.0.0' }),
        'utf8'
      )

      // Get actual mtimes
      const packageJsonStat = await fs.stat(packageJsonPath)
      const packageLockStat = await fs.stat(packageLockPath)

      const cache = {
        ...validCacheData,
        packageJsonMTime : Math.floor(packageJsonStat.mtimeMs),
        packageLockMTime : Math.floor(packageLockStat.mtimeMs),
      }

      const isValid = await isCacheValid(cache, tempDir)
      expect(isValid).toBe(true)
    })

    it('should return false when package.json mtime differs', async () => {
      const packageJsonPath = path.join(tempDir, 'package.json')
      const packageLockPath = path.join(tempDir, 'package-lock.json')

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({ name : 'test' }),
        'utf8'
      )
      await fs.writeFile(
        packageLockPath,
        JSON.stringify({ version : '1.0.0' }),
        'utf8'
      )

      const cache = {
        ...validCacheData,
        packageJsonMTime : 999999999,
        packageLockMTime : Math.floor((await fs.stat(packageLockPath)).mtimeMs),
      }

      const isValid = await isCacheValid(cache, tempDir)
      expect(isValid).toBe(false)
    })

    it('should return false when package-lock.json mtime differs', async () => {
      const packageJsonPath = path.join(tempDir, 'package.json')
      const packageLockPath = path.join(tempDir, 'package-lock.json')

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({ name : 'test' }),
        'utf8'
      )
      await fs.writeFile(
        packageLockPath,
        JSON.stringify({ version : '1.0.0' }),
        'utf8'
      )

      const cache = {
        ...validCacheData,
        packageJsonMTime : Math.floor((await fs.stat(packageJsonPath)).mtimeMs),
        packageLockMTime : 999999999,
      }

      const isValid = await isCacheValid(cache, tempDir)
      expect(isValid).toBe(false)
    })

    it('should handle missing package-lock.json when cache expects it', async () => {
      const packageJsonPath = path.join(tempDir, 'package.json')
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({ name : 'test' }),
        'utf8'
      )

      const cache = {
        ...validCacheData,
        packageJsonMTime : Math.floor((await fs.stat(packageJsonPath)).mtimeMs),
        packageLockMTime : 1234567890, // non-zero, expects lock file
      }

      const isValid = await isCacheValid(cache, tempDir)
      expect(isValid).toBe(false)
    })

    it('should be valid when package-lock.json is missing and cache expects no lock file', async () => {
      const packageJsonPath = path.join(tempDir, 'package.json')
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({ name : 'test' }),
        'utf8'
      )

      const cache = {
        ...validCacheData,
        packageJsonMTime : Math.floor((await fs.stat(packageJsonPath)).mtimeMs),
        packageLockMTime : 0, // expects no lock file
      }

      const isValid = await isCacheValid(cache, tempDir)
      expect(isValid).toBe(true)
    })
  })

  describe('createCacheData', () => {
    it('should create cache data with current timestamps', async () => {
      const packageJsonPath = path.join(tempDir, 'package.json')
      const packageLockPath = path.join(tempDir, 'package-lock.json')

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({ name : 'test' }),
        'utf8'
      )
      await fs.writeFile(
        packageLockPath,
        JSON.stringify({ version : '1.0.0' }),
        'utf8'
      )

      const providers = [
        {
          libraryName  : 'test-lib',
          version      : '1.0.0',
          path         : '/path/to/test-lib',
          integrations : [],
        },
      ]

      const cache = await createCacheData(providers, tempDir)

      expect(cache.providers).toEqual(providers)
      expect(typeof cache.scannedAt).toBe('string')
      expect(cache.packageJsonMTime).toBeGreaterThan(0)
      expect(cache.packageLockMTime).toBeGreaterThan(0)
    })

    it('should set mtimes to 0 when files are missing', async () => {
      const providers = []
      const cache = await createCacheData(providers, tempDir)

      expect(cache.packageJsonMTime).toBe(0)
      expect(cache.packageLockMTime).toBe(0)
    })

    it('should create valid ISO timestamp', async () => {
      const cache = await createCacheData([], tempDir)
      expect(() => new Date(cache.scannedAt)).not.toThrow()
      expect(new Date(cache.scannedAt).toISOString()).toBe(cache.scannedAt)
    })
  })

  describe('loadProvidersWithCache', () => {
    it('should return cached providers when cache is valid', async () => {
      // Setup files
      const packageJsonPath = path.join(tempDir, 'package.json')
      const packageLockPath = path.join(tempDir, 'package-lock.json')
      const cacheFile = '.aircache.json'

      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({ name : 'test' }),
        'utf8'
      )
      await fs.writeFile(
        packageLockPath,
        JSON.stringify({ version : '1.0.0' }),
        'utf8'
      )

      const cache = {
        ...validCacheData,
        packageJsonMTime : Math.floor((await fs.stat(packageJsonPath)).mtimeMs),
        packageLockMTime : Math.floor((await fs.stat(packageLockPath)).mtimeMs),
      }

      await writeCache(cacheFile, cache, tempDir)

      const scanFn = jest.fn()
      const providers = await loadProvidersWithCache(cacheFile, scanFn, tempDir)

      expect(providers).toEqual(cache.providers)
      expect(scanFn).not.toHaveBeenCalled()
    })

    it('should call scan function when cache is invalid', async () => {
      const packageJsonPath = path.join(tempDir, 'package.json')
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({ name : 'test' }),
        'utf8'
      )

      const cacheFile = '.aircache.json'
      const newProviders = [
        {
          libraryName  : 'new-lib',
          version      : '2.0.0',
          path         : '/path/to/new-lib',
          integrations : [],
        },
      ]

      const scanFn = jest.fn().mockResolvedValue(newProviders)
      const providers = await loadProvidersWithCache(cacheFile, scanFn, tempDir)

      expect(providers).toEqual(newProviders)
      expect(scanFn).toHaveBeenCalledTimes(1)
    })

    it('should write new cache after scanning', async () => {
      const packageJsonPath = path.join(tempDir, 'package.json')
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({ name : 'test' }),
        'utf8'
      )

      const cacheFile = '.aircache.json'
      const newProviders = [
        {
          libraryName  : 'new-lib',
          version      : '2.0.0',
          path         : '/path/to/new-lib',
          integrations : [],
        },
      ]

      const scanFn = jest.fn().mockResolvedValue(newProviders)
      await loadProvidersWithCache(cacheFile, scanFn, tempDir)

      const cache = await readCache(cacheFile, tempDir)
      expect(cache).not.toBeNull()
      expect(cache.providers).toEqual(newProviders)
    })

    it('should call scan function when cache file does not exist', async () => {
      const packageJsonPath = path.join(tempDir, 'package.json')
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify({ name : 'test' }),
        'utf8'
      )

      const cacheFile = '.aircache.json'
      const newProviders = []

      const scanFn = jest.fn().mockResolvedValue(newProviders)
      await loadProvidersWithCache(cacheFile, scanFn, tempDir)

      expect(scanFn).toHaveBeenCalledTimes(1)
    })
  })
})
