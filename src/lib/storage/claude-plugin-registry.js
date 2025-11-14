import fs from 'fs/promises'
import path from 'path'
import { ClaudePluginConfig } from './claude-config'
import { getGitCommitSha } from '../utils/git'

/**
 * @import { IntegrationProvider } from '../types.js'
 */

/**
 * @typedef {object} MarketplaceSource
 * @property {'directory'|'github'} source - Source type
 * @property {string} [path] - Path for directory source
 * @property {string} [repo] - Repository for github source
 */

/**
 * @typedef {object} MarketplaceEntry
 * @property {MarketplaceSource} source - Source information
 * @property {string} installLocation - Where the marketplace is installed
 * @property {string} lastUpdated - ISO timestamp
 */

/**
 * @typedef {object} PluginEntry
 * @property {string} version - Plugin version
 * @property {string} installedAt - ISO timestamp
 * @property {string} lastUpdated - ISO timestamp
 * @property {string} installPath - Absolute path to plugin
 * @property {string} gitCommitSha - Git commit SHA
 * @property {boolean} isLocal - Whether it's a local plugin
 */

/**
 * @typedef {object} PluginsConfig
 * @property {number} version - Config version
 * @property {Record<string, PluginEntry>} plugins - Installed plugins
 */

/**
 * Claude Plugin Registry Manager
 * Handles registration of Claude Skills in the plugin system
 * @example
 * // Production usage with default config
 * const registry = ClaudePluginRegistry.createDefault()
 * await registry.installPlugin('my-lib', 'MySkill', '/path/to/lib', '1.0.0')
 * @example
 * // Testing with temporary directory
 * const registry = ClaudePluginRegistry.createForTest('/tmp/test-dir')
 * await registry.installPlugin('test-lib', 'TestSkill', '/path', '1.0.0')
 */
export class ClaudePluginRegistry {
  /**
   * Creates a new ClaudePluginRegistry
   * @param {ClaudePluginConfig} [config] - Plugin configuration
   */
  constructor(config = null) {
    this.config = config || ClaudePluginConfig.createDefault()
  }

  /**
   * Creates a default registry instance for production use
   * Uses ~/.claude/plugins for plugin storage
   * @returns {ClaudePluginRegistry} Default registry instance
   * @example
   * const registry = ClaudePluginRegistry.createDefault()
   * await registry.installPlugin('my-lib', 'MySkill', '/path', '1.0.0')
   */
  static createDefault() {
    return new ClaudePluginRegistry(ClaudePluginConfig.createDefault())
  }

  /**
   * Creates a test registry instance with custom directory
   * Used for testing to avoid modifying global plugin registry
   * @param {string} testDir - Temporary directory for test plugins
   * @returns {ClaudePluginRegistry} Test registry instance
   * @example
   * const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'))
   * const registry = ClaudePluginRegistry.createForTest(tempDir)
   * await registry.installPlugin('test-lib', 'TestSkill', '/path', '1.0.0')
   */
  static createForTest(testDir) {
    return new ClaudePluginRegistry(ClaudePluginConfig.createForTest(testDir))
  }

  /**
   * Converts integration name to kebab-case
   * @param {string} name - Integration name
   * @returns {string} Kebab-case name
   */
  toKebabCase(name) {
    return name
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase()
  }

  /**
   * Ensures the plugins directory exists
   * @returns {Promise<void>}
   */
  async ensurePluginsDir() {
    await fs.mkdir(this.config.pluginsDir, { recursive : true })
  }

  /**
   * Reads known_marketplaces.json, creating it if it doesn't exist
   * @returns {Promise<Record<string, MarketplaceEntry>>} Marketplace entries
   */
  async readKnownMarketplaces() {
    await this.ensurePluginsDir()

    try {
      const content = await fs.readFile(this.config.knownMarketplacesPath, 'utf8')

      return JSON.parse(content)
    }
    catch (error) {
      if (error.code === 'ENOENT') {
        return {}
      }
      throw error
    }
  }

  /**
   * Writes known_marketplaces.json
   * @param {Record<string, MarketplaceEntry>} marketplaces - Marketplace entries
   * @returns {Promise<void>}
   */
  async writeKnownMarketplaces(marketplaces) {
    await this.ensurePluginsDir()
    await fs.writeFile(this.config.knownMarketplacesPath, JSON.stringify(marketplaces, null, 2), 'utf8')
  }

  /**
   * Reads installed_plugins.json, creating it if it doesn't exist
   * @returns {Promise<PluginsConfig>} Plugins configuration
   */
  async readInstalledPlugins() {
    await this.ensurePluginsDir()

    try {
      const content = await fs.readFile(this.config.installedPluginsPath, 'utf8')

      return JSON.parse(content)
    }
    catch (error) {
      if (error.code === 'ENOENT') {
        return {
          version : 1,
          plugins : {},
        }
      }
      throw error
    }
  }

  /**
   * Writes installed_plugins.json
   * @param {PluginsConfig} config - Plugins configuration
   * @returns {Promise<void>}
   */
  async writeInstalledPlugins(config) {
    await this.ensurePluginsDir()
    await fs.writeFile(this.config.installedPluginsPath, JSON.stringify(config, null, 2), 'utf8')
  }

  /**
   * Adds or updates a marketplace in known_marketplaces.json
   * @param {string} marketplaceName - Name/ID of the marketplace
   * @param {string} libraryPath - Absolute path to the library
   * @returns {Promise<void>}
   */
  async addOrUpdateMarketplace(marketplaceName, libraryPath) {
    const marketplaces = await this.readKnownMarketplaces()

    marketplaces[marketplaceName] = {
      source : {
        source : 'directory',
        path   : libraryPath,
      },
      installLocation : libraryPath,
      lastUpdated     : new Date().toISOString(),
    }

    await this.writeKnownMarketplaces(marketplaces)
  }

  /**
   * Installs a Claude Skill plugin
   * @param {string} libraryName - Library name
   * @param {string} integrationName - Integration name
   * @param {string} libraryPath - Absolute path to library root
   * @param {string} version - Library version
   * @returns {Promise<void>}
   */
  async installPlugin(libraryName, integrationName, libraryPath, version) {
    // Convert integration name to kebab-case for directory name
    const integrationDirName = this.toKebabCase(integrationName)

    // Create marketplace name from library name
    const marketplaceName = `${libraryName}-marketplace`

    // Add/update marketplace
    await this.addOrUpdateMarketplace(marketplaceName, libraryPath)

    // Get skill path
    const skillPath = path.join(libraryPath, 'ai-ready', 'integrations', integrationDirName, 'claude-skill')

    // Get git commit SHA
    const gitCommitSha = await getGitCommitSha(libraryPath)

    // Add plugin to installed_plugins.json
    const pluginsConfig = await this.readInstalledPlugins()
    const pluginKey = `${this.toKebabCase(integrationName)}@${marketplaceName}`

    pluginsConfig.plugins[pluginKey] = {
      version,
      installedAt : pluginsConfig.plugins[pluginKey]?.installedAt || new Date().toISOString(),
      lastUpdated : new Date().toISOString(),
      installPath : skillPath,
      gitCommitSha,
      isLocal     : true,
    }

    await this.writeInstalledPlugins(pluginsConfig)
  }

  /**
   * Removes a Claude Skill plugin
   * @param {string} libraryName - Library name
   * @param {string} integrationName - Integration name
   * @returns {Promise<void>}
   */
  async removePlugin(libraryName, integrationName) {
    const marketplaceName = `${libraryName}-marketplace`
    const pluginKey = `${this.toKebabCase(integrationName)}@${marketplaceName}`

    const pluginsConfig = await this.readInstalledPlugins()

    if (pluginKey in pluginsConfig.plugins) {
      delete pluginsConfig.plugins[pluginKey]
      await this.writeInstalledPlugins(pluginsConfig)
    }
  }

  /**
   * Checks if a Claude Skill plugin is installed
   * @param {string} libraryName - Library name
   * @param {string} integrationName - Integration name
   * @returns {Promise<boolean>} True if plugin is installed
   */
  async isPluginInstalled(libraryName, integrationName) {
    const marketplaceName = `${libraryName}-marketplace`
    const pluginKey = `${this.toKebabCase(integrationName)}@${marketplaceName}`

    const pluginsConfig = await this.readInstalledPlugins()

    return !!pluginsConfig.plugins[pluginKey]
  }
}

// Export singleton instance for convenience (uses default global config)
let defaultRegistry = null

/**
 * Gets the default plugin registry (singleton)
 * @returns {ClaudePluginRegistry} Default registry instance
 */
export function getDefaultRegistry() {
  if (!defaultRegistry) {
    defaultRegistry = new ClaudePluginRegistry()
  }

  return defaultRegistry
}

/**
 * Resets the default registry (useful for testing)
 */
export function resetDefaultRegistry() {
  defaultRegistry = null
}
