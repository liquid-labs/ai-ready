/**
 * Configuration management for remote repositories using XDG Base Directory specification.
 * @import { RemoteRepoConfig, RemoteRepo } from '../core/types.js'
 */

import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import xdg from '@folder/xdg'
import { DEFAULT_REMOTE_CONFIG } from '../core/types.js'

const xdgDirs = xdg()
const CONFIG_DIR = xdgDirs.config
const AI_READY_CONFIG_DIR = path.join(CONFIG_DIR, 'ai-ready')
const CONFIG_FILE = path.join(AI_READY_CONFIG_DIR, 'config.json')

/**
 * Ensures the configuration directory exists
 * @returns {Promise<void>}
 */
async function ensureConfigDir() {
  await fs.mkdir(AI_READY_CONFIG_DIR, { recursive : true })
}

/**
 * Loads the remote repository configuration
 * @returns {Promise<RemoteRepoConfig>} Remote repository configuration
 */
export async function loadConfig() {
  await ensureConfigDir()

  try {
    const content = await fs.readFile(CONFIG_FILE, 'utf8')

    return JSON.parse(content)
  }
  catch (error) {
    if (error.code === 'ENOENT') {
      // Config file doesn't exist, create default
      await saveConfig(DEFAULT_REMOTE_CONFIG)

      return DEFAULT_REMOTE_CONFIG
    }
    throw error
  }
}

/**
 * Saves the remote repository configuration
 * @param {RemoteRepoConfig} config - Configuration to save
 * @returns {Promise<void>}
 */
export async function saveConfig(config) {
  await ensureConfigDir()
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8')
}

/**
 * Finds a repository by ID, name, or URL
 * @param {RemoteRepoConfig} config - Configuration to search
 * @param {string} identifier - Repository ID, name, or URL to find
 * @returns {RemoteRepo|null} Found repository or null
 */
export function findRepo(config, identifier) {
  const normalizedIdentifier = normalizeGitUrl(identifier)
  const identifierId = generateRepoId(normalizedIdentifier)

  return (
    config.repos.find((r) => r.id === identifier)
    || config.repos.find((r) => r.name === identifier)
    || config.repos.find((r) => normalizeGitUrl(r.url) === normalizedIdentifier)
    || config.repos.find((r) => r.id === identifierId)
    || null
  )
}

/**
 * Normalizes a Git URL to canonical form
 * @param {string} url - Git repository URL
 * @returns {string} Normalized URL
 */
export function normalizeGitUrl(url) {
  // Remove trailing .git
  url = url.replace(/\.git$/, '')

  // Convert SSH to HTTPS format
  url = url.replace(/^git@([^:]+):/, 'https://$1/')

  // Remove trailing slash
  url = url.replace(/\/$/, '')

  return url
}

/**
 * Generates a unique repository ID from a normalized URL
 * @param {string} normalizedUrl - Normalized Git URL
 * @returns {string} Repository ID (12-character SHA-256 hash prefix)
 */
export function generateRepoId(normalizedUrl) {
  return crypto.createHash('sha256').update(normalizedUrl).digest('hex').substring(0, 12)
}

/**
 * Derives a display name from a Git URL
 * @param {string} url - Git repository URL
 * @returns {string} Derived name
 */
export function deriveRepoName(url) {
  // Remove .git suffix
  url = url.replace(/\.git$/, '')

  // Extract path component
  let match = url.match(/\/([^/]+)$/)
  if (match) {
    return match[1]
  }

  // Fallback to last component after @
  match = url.match(/@([^:/]+)/)
  if (match) {
    return match[1]
  }

  // Last resort: use the whole URL
  return url
}
