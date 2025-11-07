import fs from 'fs/promises'
import path from 'path'
import { isValidCache } from './types.js'

/**
 * Reads cache from file
 * @param {string} cacheFilePath - Path to cache file
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<CacheData|null>} Cache data or null if invalid/missing
 */
export async function readCache(cacheFilePath, baseDir = process.cwd()) {
  const fullPath = path.resolve(baseDir, cacheFilePath)

  try {
    const content = await fs.readFile(fullPath, 'utf8')
    const data = JSON.parse(content)

    if (!isValidCache(data)) {
      return null
    }

    return data
  }
  catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      return null
    }
    throw error
  }
}

/**
 * Writes cache to file
 * @param {string} cacheFilePath - Path to cache file
 * @param {CacheData} cacheData - Cache data to write
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<void>}
 */
export async function writeCache(
  cacheFilePath,
  cacheData,
  baseDir = process.cwd()
) {
  const fullPath = path.resolve(baseDir, cacheFilePath)

  if (!isValidCache(cacheData)) {
    throw new Error('Invalid cache data')
  }

  await fs.writeFile(fullPath, JSON.stringify(cacheData, null, 2), 'utf8')
}

/**
 * Checks if cache is valid based on package.json and lock file timestamps
 * @param {CacheData|null} cache - Cache data to validate
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<boolean>} True if cache is valid
 */
export async function isCacheValid(cache, baseDir = process.cwd()) {
  if (!cache) {
    return false
  }

  try {
    // Check package.json
    const packageJsonPath = path.resolve(baseDir, 'package.json')
    const packageJsonStat = await fs.stat(packageJsonPath)
    const packageJsonMTime = Math.floor(packageJsonStat.mtimeMs)

    if (packageJsonMTime !== cache.packageJsonMTime) {
      return false
    }

    // Check package-lock.json
    const packageLockPath = path.resolve(baseDir, 'package-lock.json')
    try {
      const packageLockStat = await fs.stat(packageLockPath)
      const packageLockMTime = Math.floor(packageLockStat.mtimeMs)

      if (packageLockMTime !== cache.packageLockMTime) {
        return false
      }
    }
    catch (error) {
      // package-lock.json doesn't exist
      if (error.code === 'ENOENT') {
        // If cache expects a lock file but it doesn't exist, invalid
        if (cache.packageLockMTime !== 0) {
          return false
        }
      }
      else {
        throw error
      }
    }

    return true
  }
  catch (error) {
    if (error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

/**
 * Creates cache data from providers
 * @param {IntegrationProvider[]} providers - Providers to cache
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<CacheData>} Cache data object
 */
export async function createCacheData(providers, baseDir = process.cwd()) {
  const packageJsonPath = path.resolve(baseDir, 'package.json')
  const packageLockPath = path.resolve(baseDir, 'package-lock.json')

  let packageJsonMTime = 0
  let packageLockMTime = 0

  try {
    const packageJsonStat = await fs.stat(packageJsonPath)
    packageJsonMTime = Math.floor(packageJsonStat.mtimeMs)
  }
  catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }

  try {
    const packageLockStat = await fs.stat(packageLockPath)
    packageLockMTime = Math.floor(packageLockStat.mtimeMs)
  }
  catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }

  return {
    scannedAt : new Date().toISOString(),
    packageJsonMTime,
    packageLockMTime,
    providers,
  }
}

/**
 * Loads providers with caching
 * @param {string} cacheFilePath - Path to cache file
 * @param {Function} scanFunction - Function to call if cache is invalid: () => Promise<IntegrationProvider[]>
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<IntegrationProvider[]>} Providers array
 */
export async function loadProvidersWithCache(
  cacheFilePath,
  scanFunction,
  baseDir = process.cwd()
) {
  const cache = await readCache(cacheFilePath, baseDir)

  if (await isCacheValid(cache, baseDir)) {
    return cache.providers
  }

  // Cache invalid or missing, perform scan
  const providers = await scanFunction()

  // Write new cache
  const cacheData = await createCacheData(providers, baseDir)
  await writeCache(cacheFilePath, cacheData, baseDir)

  return providers
}
