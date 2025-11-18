/**
 * @typedef {'npm' | 'remote'} SourceType
 */

/**
 * @typedef {object} NpmSource
 * @property {'npm'} type - Source type identifier
 * @property {string} packageName - NPM package name
 * @property {string} packageVersion - Package version
 * @property {string} path - Absolute path to package
 */

/**
 * @typedef {object} RemoteSource
 * @property {'remote'} type - Source type identifier
 * @property {string} repoId - Unique identifier (hash)
 * @property {string} repoName - Display name
 * @property {string} repoUrl - Original URL
 * @property {string} commitSHA - Current commit
 * @property {string} path - Absolute path to local clone
 */

/**
 * @typedef {NpmSource | RemoteSource} IntegrationSource
 */

/**
 * @typedef {object} Integration
 * @property {string} name - Integration name (from metadata or directory)
 * @property {string} [dirName] - Actual directory name on filesystem (for constructing paths)
 * @property {string} summary - One-line summary of the integration
 * @property {string[]} types - Available integration types (e.g., ['genericIntegration', 'claudeSkill'])
 * @property {IntegrationSource} [source] - Source information (npm or remote)
 */

/**
 * @typedef {object} IntegrationProvider
 * @property {string} libraryName - Name of the library/package
 * @property {string} version - Version from package.json
 * @property {string} path - Absolute path to library root
 * @property {Integration[]} integrations - Array of integrations provided
 */

/**
 * @typedef {object} RemoteRepoProvider
 * @property {string} repoId - Repository identifier
 * @property {string} repoUrl - Repository URL
 * @property {string} repoName - Repository display name
 * @property {string} commitSHA - Current commit at scan time
 * @property {string} scannedAt - ISO timestamp
 * @property {Integration[]} integrations - Array of integrations in repository
 */

/**
 * @typedef {object} CacheData
 * @property {string} scannedAt - Timestamp of last scan
 * @property {number} packageJsonMTime - Modified time of package.json
 * @property {number} packageLockMTime - Modified time of package-lock.json
 * @property {IntegrationProvider[]} npmProviders - Cached npm provider data
 * @property {RemoteRepoProvider[]} remoteProviders - Cached remote repo provider data
 */

/**
 * @typedef {object} Config
 * @property {string[]} scanPaths - Paths to scan for ai-ready libraries
 * @property {RegistryFiles} registryFiles - Registry file paths
 * @property {string} cacheFile - Cache file path
 */

/**
 * @typedef {object} RegistryFiles
 * @property {string} claudeSkillsDir - Path to .claude/skills directory
 * @property {string[]} generic - Paths to generic integration files
 */

/**
 * @typedef {object} RemoteRepo
 * @property {string} id - SHA-256 hash of normalized URL
 * @property {string} url - Original URL as provided by user
 * @property {string} normalizedUrl - Canonical URL
 * @property {string} name - Display name (derived from URL)
 * @property {string} addedAt - ISO timestamp
 * @property {string|null} clonedAt - ISO timestamp (null if not cloned)
 * @property {string|null} lastUpdated - ISO timestamp of last pull
 * @property {string|null} lastReviewedCommit - Commit SHA user last reviewed
 * @property {boolean} allowAutoUpdate - Whether to auto-update (default false)
 */

/**
 * @typedef {object} RemoteRepoConfig
 * @property {string} version - Config schema version
 * @property {SourceType[]} sourcePriority - Order for conflict resolution
 * @property {RemoteRepo[]} repos - Remote repositories
 */

/**
 * Default configuration
 * @type {Config}
 */
export const DEFAULT_CONFIG = {
  scanPaths     : ['node_modules'],
  registryFiles : {
    claudeSkillsDir : '.claude/skills',
    generic         : ['AGENTS.md', 'CLAUDE.md'],
  },
  cacheFile : '.aircache.json',
}

/**
 * Default remote repo configuration
 * @type {RemoteRepoConfig}
 */
export const DEFAULT_REMOTE_CONFIG = {
  version        : '1.0.0',
  sourcePriority : ['npm', 'remote'],
  repos          : [],
}

/**
 * Integration types constants
 */
export const INTEGRATION_TYPES = {
  GENERIC      : 'genericIntegration',
  CLAUDE_SKILL : 'claudeSkill',
}

/**
 * Source type constants
 */
export const SOURCE_TYPE = {
  NPM    : 'npm',
  REMOTE : 'remote',
  ALL    : 'all',
}

/**
 * Config version
 */
export const CONFIG_VERSION = '1.0.0'

/**
 * Standard repository sources
 */
export const STANDARD_REPOS = ['https://github.com/anthropics/skills']

/**
 * Validates an Integration object
 * @param {Integration} integration - The Integration to validate
 * @returns {boolean} - True if the Integration is valid, false otherwise
 */
export function isValidIntegration(integration) {
  return !!(
    integration
    && typeof integration.name === 'string'
    && integration.name.length > 0
    && typeof integration.summary === 'string'
    && Array.isArray(integration.types)
    && integration.types.length > 0
  )
}

/**
 * Validates an IntegrationProvider object
 * @param {IntegrationProvider} provider - The IntegrationProvider to validate
 * @returns {boolean} - True if the IntegrationProvider is valid, false otherwise
 */
export function isValidProvider(provider) {
  return !!(
    provider
    && typeof provider.libraryName === 'string'
    && provider.libraryName.length > 0
    && typeof provider.version === 'string'
    && typeof provider.path === 'string'
    && Array.isArray(provider.integrations)
    && provider.integrations.every(isValidIntegration)
  )
}

/**
 * Validates cache data structure
 * @param {CacheData} cache - The CacheData to validate
 * @returns {boolean} - True if the CacheData is valid, false otherwise
 */
export function isValidCache(cache) {
  return !!(
    cache
    && typeof cache.scannedAt === 'string'
    && typeof cache.packageJsonMTime === 'number'
    && typeof cache.packageLockMTime === 'number'
    && Array.isArray(cache.npmProviders)
    && Array.isArray(cache.remoteProviders)
  )
}
