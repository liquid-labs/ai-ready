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
