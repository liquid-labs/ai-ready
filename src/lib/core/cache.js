import fs from 'fs/promises'
import path from 'path'
import simpleGit from 'simple-git'
import { isValidCache } from './types.js'
import { SOURCE_TYPE } from './types.js'
import { loadConfig } from './config.js'
import { getRepoPath, isRepoCloned } from './remote-repos.js'

/**
 * @import { CacheData, IntegrationProvider, RemoteRepoProvider } from './types.js'
 */

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

    // Handle legacy format migration
    if (data.providers && !data.npmProviders) {
      // Old format: { providers: [...] }
      // New format: { npmProviders: [...], remoteProviders: [] }
      return {
        scannedAt        : data.scannedAt,
        packageJsonMTime : data.packageJsonMTime,
        packageLockMTime : data.packageLockMTime,
        npmProviders     : data.providers,
        remoteProviders  : [],
      }
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
 * Checks if cache is valid based on package.json, lock file, and remote repo commits
 * @param {CacheData|null} cache - Cache data to validate
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @param {string} [source='all'] - Source type to validate ('npm', 'remote', or 'all')
 * @returns {Promise<boolean>} True if cache is valid
 */
export async function isCacheValid(
  cache,
  baseDir = process.cwd(),
  source = SOURCE_TYPE.ALL
) {
  if (!cache) {
    return false
  }

  // Check npm cache validity
  if (source === SOURCE_TYPE.ALL || source === SOURCE_TYPE.NPM) {
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
    }
    catch (error) {
      if (error.code === 'ENOENT') {
        return false
      }
      throw error
    }
  }

  // Check remote cache validity
  if (source === SOURCE_TYPE.ALL || source === SOURCE_TYPE.REMOTE) {
    const config = await loadConfig()
    const remoteProviders = cache.remoteProviders || []

    // Check if any repos were added/removed
    const cachedRepoIds = new Set(remoteProviders.map((p) => p.repoId))
    const clonedRepos = []

    for (const repo of config.repos) {
      if (await isRepoCloned(repo)) {
        clonedRepos.push(repo)
      }
    }

    const currentRepoIds = new Set(clonedRepos.map((r) => r.id))

    // Check for added/removed repos
    if (cachedRepoIds.size !== currentRepoIds.size) {
      return false
    }

    for (const repoId of cachedRepoIds) {
      if (!currentRepoIds.has(repoId)) {
        return false // Repo was removed
      }
    }

    // Check if any cached repos have new commits
    for (const remoteProvider of remoteProviders) {
      const repo = config.repos.find((r) => r.id === remoteProvider.repoId)
      if (!repo) {
        return false // Repo removed from config
      }

      try {
        const repoPath = getRepoPath(repo.id)
        const git = simpleGit(repoPath)
        const log = await git.log({ maxCount : 1 })
        const currentSHA = log.latest?.hash

        if (currentSHA !== remoteProvider.commitSHA) {
          return false // Commit changed
        }
      }
      catch {
        return false // Git error or repo inaccessible
      }
    }
  }

  return true
}

/**
 * Creates cache data from scan results
 * @param {{npmProviders: IntegrationProvider[], remoteProviders: RemoteRepoProvider[]}} data - Scan results
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @returns {Promise<CacheData>} Cache data object
 */
export async function createCacheData(data, baseDir = process.cwd()) {
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
    scannedAt       : new Date().toISOString(),
    packageJsonMTime,
    packageLockMTime,
    npmProviders    : data.npmProviders || [],
    remoteProviders : data.remoteProviders || [],
  }
}

/**
 * Loads providers with caching
 * @param {string} cacheFilePath - Path to cache file
 * @param {Function} scanFunction - Function to call if cache is invalid: () => Promise<{npmProviders, remoteProviders}>
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @param {string} [source='all'] - Source type to load ('npm', 'remote', or 'all')
 * @returns {Promise<{npmProviders: IntegrationProvider[], remoteProviders: RemoteRepoProvider[]}>} Providers object
 */
export async function loadProvidersWithCache(
  cacheFilePath,
  scanFunction,
  baseDir = process.cwd(),
  source = SOURCE_TYPE.ALL
) {
  const cache = await readCache(cacheFilePath, baseDir)

  if (await isCacheValid(cache, baseDir, source)) {
    return {
      npmProviders    : cache.npmProviders || [],
      remoteProviders : cache.remoteProviders || [],
    }
  }

  // Cache invalid or missing, perform scan
  const scanResults = await scanFunction()

  // Write new cache
  const cacheData = await createCacheData(scanResults, baseDir)
  await writeCache(cacheFilePath, cacheData, baseDir)

  return scanResults
}

/**
 * Invalidates the cache by deleting the cache file
 * @param {string} [baseDir=process.cwd()] - Base directory
 * @param {string} [cacheFilePath='.aircache.json'] - Path to cache file
 * @returns {Promise<void>}
 */
export async function invalidateCache(
  baseDir = process.cwd(),
  cacheFilePath = '.aircache.json'
) {
  const fullPath = path.resolve(baseDir, cacheFilePath)

  try {
    await fs.unlink(fullPath)
  }
  catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
    // File doesn't exist, already invalid
  }
}
