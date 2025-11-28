/**
 * @typedef {object} MarketplaceProvider
 * @property {string} packageName - npm package name
 * @property {string} version - Package version from package.json
 * @property {string} path - Absolute path to package directory
 * @property {MarketplaceDeclaration} marketplaceDeclaration - Parsed marketplace.json
 */

/**
 * @typedef {object} MarketplaceDeclaration
 * @property {string} name - Marketplace identifier (kebab-case)
 * @property {MarketplaceOwner} owner - Marketplace maintainer information
 * @property {PluginEntry[]} plugins - List of available plugins
 * @property {MarketplaceMetadata} [metadata] - Optional marketplace metadata
 */

/**
 * @typedef {object} MarketplaceOwner
 * @property {string} [name] - Maintainer name
 * @property {string} [email] - Maintainer email
 * @property {string} [url] - Maintainer URL
 */

/**
 * @typedef {object} MarketplaceMetadata
 * @property {string} [description] - Brief marketplace description
 * @property {string} [version] - Marketplace version
 * @property {string} [pluginRoot] - Base path for relative plugin sources
 */

/**
 * @typedef {object} PluginEntry
 * @property {string} name - Plugin identifier (kebab-case)
 * @property {string|PluginSourceObject} source - Plugin location
 * @property {string} [description] - Brief description of what the plugin does
 * @property {string} [version] - Plugin version
 * @property {string|AuthorObject} [author] - Plugin author information
 * @property {string} [homepage] - URL to plugin documentation
 * @property {string|RepositoryObject} [repository] - Source code repository
 * @property {string} [license] - SPDX license identifier
 * @property {string[]} [keywords] - Discovery tags
 * @property {string} [category] - Plugin category
 * @property {string[]} [tags] - Additional tags
 * @property {boolean} [strict] - Requires plugin.json presence (default: true)
 * @property {string|string[]|object} [commands] - Custom command paths
 * @property {string|string[]|object} [agents] - Custom agent paths
 * @property {string|object} [hooks] - Hook configuration
 * @property {string|object} [mcpServers] - MCP server configuration
 */

/**
 * @typedef {object} PluginSourceObject
 * @property {'github'|'url'} source - Source type
 * @property {string} [repo] - GitHub repository (owner/repo format)
 * @property {string} [url] - Git URL
 * @property {string} [ref] - Git ref (branch, tag, or commit)
 */

/**
 * @typedef {object} AuthorObject
 * @property {string} [name] - Author name
 * @property {string} [email] - Author email
 * @property {string} [url] - Author URL
 */

/**
 * @typedef {object} RepositoryObject
 * @property {string} [type] - Repository type (e.g., "git")
 * @property {string} [url] - Repository URL
 */

/**
 * @typedef {object} PluginManifest
 * @property {string} name - Unique plugin identifier (kebab-case)
 * @property {string} [version] - Plugin version
 * @property {string} [description] - Brief description
 * @property {string|AuthorObject} [author] - Plugin author
 * @property {string} [homepage] - Documentation URL
 * @property {string|RepositoryObject} [repository] - Source code repository
 * @property {string} [license] - SPDX license identifier
 * @property {string[]} [keywords] - Discovery tags
 * @property {string|string[]} [commands] - Command file/directory paths
 * @property {string|string[]} [agents] - Agent definition paths
 * @property {string|object} [hooks] - Hook configuration
 * @property {string|object} [mcpServers] - MCP server configuration
 */

/**
 * @typedef {object} PluginState
 * @property {string} name - Plugin name
 * @property {'enabled'|'disabled'|'not-installed'} status - Current status
 * @property {string} source - Plugin source location
 * @property {string} version - Plugin version
 * @property {string} description - Plugin description
 * @property {string} marketplace - Marketplace name this plugin belongs to
 */

/**
 * @typedef {object} ClaudeSettings
 * @property {ClaudePluginSettings} plugins - Plugin configuration
 */

/**
 * @typedef {object} ClaudePluginSettings
 * @property {string[]} enabled - List of enabled plugin names
 * @property {string[]} disabled - List of disabled plugin names
 * @property {Record<string, ClaudeMarketplaceEntry>} marketplaces - Marketplace entries
 */

/**
 * @typedef {object} ClaudeMarketplaceEntry
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
 * @property {string} source - Plugin source (relative path or source object)
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
 * Validates a MarketplaceProvider object
 * @param {MarketplaceProvider} provider - The MarketplaceProvider to validate
 * @returns {boolean} - True if valid
 */
export function isValidMarketplaceProvider(provider) {
  return !!(
    provider
    && typeof provider.packageName === 'string'
    && provider.packageName.length > 0
    && typeof provider.version === 'string'
    && typeof provider.path === 'string'
    && provider.marketplaceDeclaration
    && typeof provider.marketplaceDeclaration.name === 'string'
    && typeof provider.marketplaceDeclaration.owner === 'object'
    && Array.isArray(provider.marketplaceDeclaration.plugins)
  )
}

/**
 * Validates a PluginEntry object
 * @param {PluginEntry} plugin - The PluginEntry to validate
 * @returns {boolean} - True if valid
 */
export function isValidPluginEntry(plugin) {
  return !!(
    plugin
    && typeof plugin.name === 'string'
    && plugin.name.length > 0
    && (typeof plugin.source === 'string' || typeof plugin.source === 'object')
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
