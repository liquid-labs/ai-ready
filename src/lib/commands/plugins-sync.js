/* eslint-disable no-console, no-process-exit */
import { scanDependencies } from '../scanner'
import { ClaudePluginConfig } from '../storage/claude-config'
import { updateSettings } from '../storage/claude-settings'

/**
 * @import { MarketplaceProvider } from '../types.js'
 */

/**
 * Find the provider that contains a plugin by name
 * @param {MarketplaceProvider[]} providers - List of providers
 * @param {string} pluginName - Name of the plugin to find
 * @returns {MarketplaceProvider|undefined} The provider containing the plugin
 */
const findProviderForPlugin = (providers, pluginName) =>
  providers.find((p) => p.marketplaceDeclaration.plugins.some((plugin) => plugin.name === pluginName))

/**
 * Log information about newly added plugins
 * @param {string[]} addedPlugins - Names of added plugins
 * @param {MarketplaceProvider[]} providers - List of providers
 */
const logAddedPlugins = (addedPlugins, providers) => {
  console.log('New plugins discovered:')
  for (const pluginName of addedPlugins) {
    const provider = findProviderForPlugin(providers, pluginName)
    if (provider) {
      console.log(`  • ${pluginName} (from ${provider.marketplaceDeclaration.name} in ${provider.packageName} v${provider.version})`)
    }
  }
  console.log()
}

/**
 * Log sync results summary
 * @param {object} changes - Changes object from updateSettings
 * @param {string} settingsPath - Path to settings file
 */
const logSyncResults = (changes, settingsPath) => {
  if (changes.added.length > 0 || changes.updated.length > 0) {
    console.log(`Updated settings: ${settingsPath}`)
    console.log(`✓ ${changes.added.length} plugin${changes.added.length === 1 ? '' : 's'} added, ${changes.updated.length} updated\n`)
    if (changes.added.length > 0) {
      console.log('  Restart Claude Code to load new plugins\n')
    }
  }
  else {
    console.log('All plugins already enabled.\n')
  }
}

/**
 * Plugins sync command: Discover and enable plugins from dependencies
 * @param {object} options - Command options
 * @param {string} [options.path] - Project path (default: cwd)
 * @param {boolean} [options.quiet] - Suppress output (for hooks)
 * @param {ClaudePluginConfig} [options.config] - Config instance (for testing)
 * @returns {Promise<void>}
 */
export async function pluginsSyncCommand(options = {}) {
  const baseDir = options.path || process.cwd()
  const config = options.config || ClaudePluginConfig.createDefault()
  const quiet = options.quiet || false

  try {
    if (!quiet) {
      console.log('Scanning dependencies for Claude Code plugin marketplaces...')
    }

    const providers = await scanDependencies(baseDir)
    const totalPlugins = providers.reduce((sum, p) => sum + p.marketplaceDeclaration.plugins.length, 0)

    if (!quiet) {
      console.log(`Found ${providers.length} marketplace${providers.length === 1 ? '' : 's'} with ${totalPlugins} plugin${totalPlugins === 1 ? '' : 's'}\n`)
    }

    const changes = await updateSettings(config.settingsPath, providers)

    if (providers.length === 0) {
      return
    }

    if (!quiet) {
      if (changes.added.length > 0) {
        logAddedPlugins(changes.added, providers)
      }
      logSyncResults(changes, config.settingsPath)
    }
  }
  catch (error) {
    if (!quiet) {
      console.error(`Error: ${error.message}`)
    }
    process.exit(1)
  }
}
