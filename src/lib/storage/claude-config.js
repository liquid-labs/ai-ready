import os from 'os'
import path from 'path'

/**
 * Configuration for Claude plugin system
 */
export class ClaudePluginConfig {
  /**
   * Creates a new ClaudePluginConfig
   * @param {object} [options] - Configuration options
   * @param {string} [options.claudeDir] - Override the Claude directory (defaults to $HOME/.claude)
   */
  constructor(options = {}) {
    this.claudeDir = options.claudeDir || path.join(os.homedir(), '.claude')
    this.pluginsDir = path.join(this.claudeDir, 'plugins')
  }

  /**
   * Gets the path to known_marketplaces.json
   * @returns {string} Absolute path to known_marketplaces.json
   */
  get knownMarketplacesPath() {
    return path.join(this.pluginsDir, 'known_marketplaces.json')
  }

  /**
   * Gets the path to installed_plugins.json
   * @returns {string} Absolute path to installed_plugins.json
   */
  get installedPluginsPath() {
    return path.join(this.pluginsDir, 'installed_plugins.json')
  }

  /**
   * Gets the path to settings.json
   * @returns {string} Absolute path to settings.json
   */
  get settingsPath() {
    return path.join(this.claudeDir, 'settings.json')
  }

  /**
   * Creates a default configuration (uses global ~/.claude/plugins)
   * @returns {ClaudePluginConfig} Default configuration
   */
  static createDefault() {
    return new ClaudePluginConfig()
  }

  /**
   * Creates a test configuration (uses a custom directory)
   * @param {string} testDir - Test directory path
   * @returns {ClaudePluginConfig} Test configuration
   */
  static createForTest(testDir) {
    return new ClaudePluginConfig({
      claudeDir : path.join(testDir, '.claude'),
    })
  }
}
