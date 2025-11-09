/**
 * Git repository management for remote skills.
 * @import { RemoteRepo } from './types.js'
 */

import fs from 'fs/promises'
import path from 'path'
import xdg from '@folder/xdg'
import simpleGit from 'simple-git'
import checkDiskSpace from 'check-disk-space'

const xdgDirs = xdg()
const DATA_DIR = xdgDirs.data
const AI_READY_DATA_DIR = path.join(DATA_DIR, 'ai-ready')

const GIT_TIMEOUT_MS = 300000 // 5 minutes
const MIN_DISK_SPACE_MB = 100

/**
 * Ensures the data directory exists
 * @returns {Promise<void>}
 */
async function ensureDataDir() {
  await fs.mkdir(AI_READY_DATA_DIR, { recursive: true })
}

/**
 * Gets the local path for a repository
 * @param {string} repoId - Repository ID
 * @returns {string} Absolute path to repository
 */
export function getRepoPath(repoId) {
  return path.join(AI_READY_DATA_DIR, repoId)
}

/**
 * Checks if Git is available in PATH
 * @returns {Promise<boolean>} True if Git is available
 */
export async function isGitAvailable() {
  try {
    const git = simpleGit()
    await git.version()
    return true
  } catch {
    return false
  }
}

/**
 * Checks if a repository has been cloned locally
 * @param {RemoteRepo} repo - Repository to check
 * @returns {Promise<boolean>} True if repository is cloned
 */
export async function isRepoCloned(repo) {
  const localPath = getRepoPath(repo.id)
  try {
    await fs.access(path.join(localPath, '.git'))
    return true
  } catch {
    return false
  }
}

/**
 * Clones a repository
 * @param {RemoteRepo} repo - Repository to clone
 * @param {object} options - Clone options
 * @param {boolean} [options.shallow=true] - Whether to use shallow clone
 * @returns {Promise<{success: boolean, commitSHA?: string, error?: string}>} Clone result
 */
export async function cloneRepo(repo, options = {}) {
  const { shallow = true } = options

  // Check Git availability
  if (!(await isGitAvailable())) {
    return {
      success : false,
      error   : 'Git is not installed or not available in PATH. Please install Git and try again.',
    }
  }

  // Check disk space
  try {
    const { free } = await checkDiskSpace(DATA_DIR)
    const freeMB = free / (1024 * 1024)
    if (freeMB < MIN_DISK_SPACE_MB) {
      return {
        success : false,
        error   : `Insufficient disk space. Available: ${freeMB.toFixed(0)}MB, Required: ${MIN_DISK_SPACE_MB}MB`,
      }
    }
  } catch (error) {
    // Disk space check failed, but continue anyway
    console.warn(`Warning: Could not check disk space: ${error.message}`)
  }

  await ensureDataDir()

  const localPath = getRepoPath(repo.id)

  // Check if already exists
  if (await isRepoCloned(repo)) {
    return {
      success : false,
      error   : 'Repository already cloned locally',
    }
  }

  try {
    const git = simpleGit({ timeout: { block: GIT_TIMEOUT_MS } })
    const cloneOptions = shallow ? ['--depth', '1'] : []

    await git.clone(repo.url, localPath, cloneOptions)

    // Get current commit SHA
    const localGit = simpleGit(localPath)
    const log = await localGit.log({ maxCount: 1 })
    const commitSHA = log.latest?.hash || null

    return {
      success   : true,
      commitSHA,
    }
  } catch (error) {
    // Clean up partial clone
    try {
      await fs.rm(localPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }

    return {
      success : false,
      error   : error.message,
    }
  }
}

/**
 * Updates a repository by pulling latest changes
 * @param {RemoteRepo} repo - Repository to update
 * @returns {Promise<{success: boolean, changed?: boolean, commitSHA?: string, error?: string}>} Update result
 */
export async function updateRepo(repo) {
  // Check Git availability
  if (!(await isGitAvailable())) {
    return {
      success : false,
      error   : 'Git is not installed or not available in PATH',
    }
  }

  const localPath = getRepoPath(repo.id)

  // Check if cloned
  if (!(await isRepoCloned(repo))) {
    return {
      success : false,
      error   : 'Repository not cloned locally',
    }
  }

  try {
    const git = simpleGit(localPath, { timeout: { block: GIT_TIMEOUT_MS } })

    // Get current commit before pull
    const logBefore = await git.log({ maxCount: 1 })
    const beforeSHA = logBefore.latest?.hash

    // Pull latest changes
    await git.pull()

    // Get commit after pull
    const logAfter = await git.log({ maxCount: 1 })
    const afterSHA = logAfter.latest?.hash

    return {
      success   : true,
      changed   : beforeSHA !== afterSHA,
      commitSHA : afterSHA || null,
    }
  } catch (error) {
    return {
      success : false,
      error   : error.message,
    }
  }
}

/**
 * Removes a repository from local filesystem
 * @param {RemoteRepo} repo - Repository to remove
 * @returns {Promise<{success: boolean, error?: string}>} Removal result
 */
export async function removeRepo(repo) {
  const localPath = getRepoPath(repo.id)

  try {
    await fs.rm(localPath, { recursive: true, force: true })
    return { success: true }
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Already deleted
      return { success: true }
    }
    return {
      success : false,
      error   : error.message,
    }
  }
}

/**
 * Repairs a repository by deleting and re-cloning
 * @param {RemoteRepo} repo - Repository to repair
 * @returns {Promise<{success: boolean, commitSHA?: string, error?: string}>} Repair result
 */
export async function repairRepo(repo) {
  // Remove existing clone
  const removeResult = await removeRepo(repo)
  if (!removeResult.success) {
    return {
      success : false,
      error   : `Failed to remove existing clone: ${removeResult.error}`,
    }
  }

  // Clone fresh copy
  return await cloneRepo(repo)
}

/**
 * Gets the current commit SHA of a cloned repository
 * @param {RemoteRepo} repo - Repository to check
 * @returns {Promise<string|null>} Current commit SHA or null if not cloned
 */
export async function getCurrentCommitSHA(repo) {
  if (!(await isRepoCloned(repo))) {
    return null
  }

  try {
    const localPath = getRepoPath(repo.id)
    const git = simpleGit(localPath)
    const log = await git.log({ maxCount: 1 })
    return log.latest?.hash || null
  } catch {
    return null
  }
}
