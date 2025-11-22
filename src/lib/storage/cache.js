import fs from 'fs/promises'
import path from 'path'

/**
 * @import { PluginProvider } from '../types.js'
 */

/**
 * @typedef {object} CacheData
 * @property {string} scannedAt - ISO timestamp
 * @property {number} packageJsonMTime - package.json mtime (ms)
 * @property {number} packageLockMTime - package-lock.json mtime (ms)
 * @property {PluginProvider[]} providers - Discovered plugin providers
 */

const CACHE_FILE_NAME = '.air-plugin-cache.json'

/**
 * Loads providers with caching
 * @param {Function} scanFunction - Function to call if cache is invalid: () => Promise<PluginProvider[]>
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<PluginProvider[]>} Array of plugin providers
 */
export async function loadProvidersWithCache(scanFunction, baseDir = process.cwd()) {
  const cachePath = path.join(baseDir, CACHE_FILE_NAME)

  // Try to read cache
  const cache = await readCache(cachePath)

  // Validate cache
  if (cache && (await isCacheValid(cache, baseDir))) {
    return cache.providers
  }

  // Cache invalid or missing, perform scan
  const providers = await scanFunction()

  // Write new cache
  await writeCache(providers, baseDir)

  return providers
}

/**
 * Reads cache from file
 * @param {string} cachePath - Absolute path to cache file
 * @returns {Promise<CacheData|null>} Cache data or null if invalid/missing
 */
async function readCache(cachePath) {
  try {
    const content = await fs.readFile(cachePath, 'utf8')
    const data = JSON.parse(content)

    if (!isValidCacheStructure(data)) {
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
 * @param {PluginProvider[]} providers - Plugin providers to cache
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<void>}
 */
async function writeCache(providers, baseDir = process.cwd()) {
  const packageJsonPath = path.join(baseDir, 'package.json')
  const packageLockPath = path.join(baseDir, 'package-lock.json')

  const [packageJsonStat, packageLockStat] = await Promise.all([
    fs.stat(packageJsonPath).catch(() => null),
    fs.stat(packageLockPath).catch(() => null),
  ])

  const cacheData = {
    scannedAt        : new Date().toISOString(),
    packageJsonMTime : packageJsonStat?.mtimeMs || 0,
    packageLockMTime : packageLockStat?.mtimeMs || 0,
    providers,
  }

  const cachePath = path.join(baseDir, CACHE_FILE_NAME)
  await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2), 'utf8')
}

/**
 * Validates cache structure
 * @param {CacheData} data - Cache data to validate
 * @returns {boolean} True if structure is valid
 */
function isValidCacheStructure(data) {
  return !!(
    data
    && typeof data.scannedAt === 'string'
    && typeof data.packageJsonMTime === 'number'
    && typeof data.packageLockMTime === 'number'
    && Array.isArray(data.providers)
  )
}

/**
 * Checks if cache is valid based on package.json and package-lock.json mtimes
 * @param {CacheData} cache - Cache data to validate
 * @param {string} baseDir - Base directory
 * @returns {Promise<boolean>} True if cache is valid
 */
async function isCacheValid(cache, baseDir) {
  const packageJsonPath = path.join(baseDir, 'package.json')
  const packageLockPath = path.join(baseDir, 'package-lock.json')

  try {
    const [packageJsonStat, packageLockStat] = await Promise.all([
      fs.stat(packageJsonPath),
      fs.stat(packageLockPath).catch(() => null),
    ])

    // Check if package.json mtime changed
    if (packageJsonStat.mtimeMs !== cache.packageJsonMTime) {
      return false
    }

    // Check if package-lock.json mtime changed (if it exists)
    if (packageLockStat && packageLockStat.mtimeMs !== cache.packageLockMTime) {
      return false
    }

    // If package-lock.json was deleted or created
    if ((packageLockStat === null) !== (cache.packageLockMTime === 0)) {
      return false
    }

    return true
  }
  catch {
    // package.json doesn't exist or error reading
    return false
  }
}

/**
 * Invalidates the cache by deleting the cache file
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<void>}
 */
export async function invalidateCache(baseDir = process.cwd()) {
  const cachePath = path.join(baseDir, CACHE_FILE_NAME)

  try {
    await fs.unlink(cachePath)
  }
  catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
    // File doesn't exist, already invalid
  }
}
