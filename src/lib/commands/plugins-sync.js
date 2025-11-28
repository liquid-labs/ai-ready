/* eslint-disable no-console, no-process-exit */
import { scanDependencies } from '../scanner'
import { ClaudePluginConfig } from '../storage/claude-config'
import { updateSettings } from '../storage/claude-settings'

/**
 * @import { MarketplaceProvider } from '../types.js'
 */

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

    // Scan dependencies
    const providers = await scanDependencies(baseDir)

    // Count total plugins across all marketplaces
    const totalPlugins = providers.reduce((sum, p) => sum + p.marketplaceDeclaration.plugins.length, 0)

    if (!quiet) {
      console.log(
        `Found ${providers.length} marketplace${providers.length === 1 ? '' : 's'} with ${totalPlugins} plugin${totalPlugins === 1 ? '' : 's'}\n`
      )
    }

    // Update settings (non-destructive merge)
    // Even if no providers, we create/ensure settings file exists
    const changes = await updateSettings(config.settingsPath, providers)

    if (providers.length === 0) {
      return
    }

    // Report changes
    if (!quiet) {
      if (changes.added.length > 0) {
        console.log('New plugins discovered:')
        for (const pluginName of changes.added) {
          // Find the provider and plugin
          for (const provider of providers) {
            const plugin = provider.marketplaceDeclaration.plugins.find((p) => p.name === pluginName)
            if (plugin) {
              console.log(
                `  • ${pluginName} (from ${provider.marketplaceDeclaration.name} in ${provider.packageName} v${provider.version})`
              )

              break
            }
          }
        }
        console.log()
      }

      if (changes.added.length > 0 || changes.updated.length > 0) {
        console.log(`Updated settings: ${config.settingsPath}`)
        console.log(
          `✓ ${changes.added.length} plugin${changes.added.length === 1 ? '' : 's'} added, ${changes.updated.length} updated\n`
        )

        if (changes.added.length > 0) {
          console.log('  Restart Claude Code to load new plugins\n')
        }
      }
      else {
        console.log('All plugins already enabled.\n')
      }
    }
  }
  catch (error) {
    if (!quiet) {
      console.error(`Error: ${error.message}`)
    }
    process.exit(1)
  }
}
