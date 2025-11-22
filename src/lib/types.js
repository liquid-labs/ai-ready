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

// ============================================================================
// NEW TYPES (Phase 1 - v2.0.0 Architecture)
// Old types above will be removed in Phase 5
// ============================================================================

/**
 * @typedef {object} PluginProvider
 * @property {string} packageName - npm package name
 * @property {string} version - Package version from package.json
 * @property {string} path - Absolute path to package directory
 * @property {PluginDeclaration} pluginDeclaration - Parsed marketplace.json
 */

/**
 * @typedef {object} PluginDeclaration
 * @property {string} name - Plugin name
 * @property {string} version - Plugin version
 * @property {string} description - Plugin description
 * @property {string} skillPath - Relative path to skill directory
 */

/**
 * @typedef {object} PluginState
 * @property {string} name - Plugin name
 * @property {'enabled'|'disabled'|'not-installed'} status - Current status
 * @property {string} source - Absolute path to plugin source
 * @property {string} version - Plugin version
 * @property {string} description - Plugin description
 */

/**
 * @typedef {object} ClaudeSettings
 * @property {ClaudePluginSettings} plugins - Plugin configuration
 */

/**
 * @typedef {object} ClaudePluginSettings
 * @property {string[]} enabled - List of enabled plugin names
 * @property {string[]} disabled - List of disabled plugin names
 * @property {Record<string, MarketplaceEntry>} marketplaces - Marketplace entries
 */

/**
 * @typedef {object} MarketplaceEntry
 * @property {MarketplaceSource} source - Marketplace source
 * @property {Record<string, PluginMetadata>} plugins - Plugin metadata by name
 */

/**
 * @typedef {object} MarketplaceSource
 * @property {'directory'} type - Source type
 * @property {string} path - Absolute path to source directory
 */

/**
 * @typedef {object} PluginMetadata
 * @property {string} version - Plugin version
 * @property {string} skillPath - Relative path to skill directory
 */

/**
 * @typedef {object} LocalSettings
 * @property {Record<string, ExtraMarketplace>} extraKnownMarketplaces - Team/org marketplace configuration
 * @property {Record<string, boolean>} [enabledPlugins] - Project-specific plugin overrides (plugin-key@marketplace-name: boolean)
 */

/**
 * @typedef {object} ExtraMarketplace
 * @property {ExtraMarketplaceSource} source - Marketplace source configuration
 */

/**
 * @typedef {object} ExtraMarketplaceSource
 * @property {'github'|'git'|'directory'} source - Source type
 * @property {string} [repo] - GitHub repository (org/repo) - for github type
 * @property {string} [url] - Git repository URL - for git type
 * @property {string} [path] - Absolute path - for directory type
 */

/**
 * @typedef {object} MarketplaceReference
 * @property {string} name - Marketplace name
 * @property {'github'|'git'|'directory'} sourceType - Source type
 * @property {string} [repo] - GitHub repository (org/repo) - for github type
 * @property {string} [url] - Git repository URL - for git type
 * @property {string} [path] - Absolute path - for directory type
 */

/**
 * Plugin status constants
 */
export const PLUGIN_STATUSES = {
  ENABLED       : 'enabled',
  DISABLED      : 'disabled',
  NOT_INSTALLED : 'not-installed',
}

/**
 * Marketplace JSON schema validation
 */
export const MARKETPLACE_JSON_SCHEMA = {
  requiredFields : ['name', 'version', 'description', 'skillPath'],
  optionalFields : ['author', 'license', 'homepage'],
}

/**
 * Validates a PluginProvider object
 * @param {PluginProvider} provider - The PluginProvider to validate
 * @returns {boolean} - True if valid
 */
export function isValidPluginProvider(provider) {
  return !!(
    provider
    && typeof provider.packageName === 'string'
    && provider.packageName.length > 0
    && typeof provider.version === 'string'
    && typeof provider.path === 'string'
    && provider.pluginDeclaration
    && typeof provider.pluginDeclaration.name === 'string'
    && typeof provider.pluginDeclaration.version === 'string'
    && typeof provider.pluginDeclaration.description === 'string'
    && typeof provider.pluginDeclaration.skillPath === 'string'
  )
}

/**
 * Validates a PluginState object
 * @param {PluginState} state - The PluginState to validate
 * @returns {boolean} - True if valid
 */
export function isValidPluginState(state) {
  return !!(
    state
    && typeof state.name === 'string'
    && state.name.length > 0
    && typeof state.status === 'string'
    && Object.values(PLUGIN_STATUSES).includes(state.status)
    && typeof state.source === 'string'
    && typeof state.version === 'string'
    && typeof state.description === 'string'
  )
}

/**
 * Validates marketplace reference object
 * @param {MarketplaceReference} marketplace - The marketplace reference to validate
 * @returns {boolean} - True if valid
 */
export function isValidMarketplaceReference(marketplace) {
  if (!marketplace || typeof marketplace.name !== 'string' || !marketplace.name.length) {
    return false
  }

  const validSourceTypes = ['github', 'git', 'directory']
  if (!validSourceTypes.includes(marketplace.sourceType)) {
    return false
  }

  // Validate based on source type
  if (marketplace.sourceType === 'github') {
    return typeof marketplace.repo === 'string' && marketplace.repo.includes('/')
  }

  if (marketplace.sourceType === 'git') {
    return typeof marketplace.url === 'string' && marketplace.url.startsWith('http')
  }

  if (marketplace.sourceType === 'directory') {
    return typeof marketplace.path === 'string' && marketplace.path.length > 0
  }

  return false
}
