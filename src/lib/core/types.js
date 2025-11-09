/**
 * @typedef {object} Integration
 * @property {string} name - Integration name
 * @property {string} summary - One-line summary of the integration
 * @property {string[]} types - Available integration types (e.g., ['genericIntegration', 'claudeSkill'])
 */

/**
 * @typedef {object} IntegrationProvider
 * @property {string} libraryName - Name of the library/package
 * @property {string} version - Version from package.json
 * @property {string} path - Absolute path to library root
 * @property {Integration[]} integrations - Array of integrations provided
 */

/**
 * @typedef {object} CacheData
 * @property {string} scannedAt - Timestamp of last scan
 * @property {number} packageJsonMTime - Modified time of package.json
 * @property {number} packageLockMTime - Modified time of package-lock.json
 * @property {IntegrationProvider[]} providers - Cached provider data
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
 * Integration types constants
 */
export const INTEGRATION_TYPES = {
  GENERIC      : 'genericIntegration',
  CLAUDE_SKILL : 'claudeSkill',
}

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
    && Array.isArray(cache.providers)
    && cache.providers.every(isValidProvider)
  )
}
