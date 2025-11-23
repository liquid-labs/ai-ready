/* eslint-disable no-console, no-process-exit */
import { scanDependencies } from '../scanner'
import { ClaudePluginConfig } from '../storage/claude-config'
import { updateSettings } from '../storage/claude-settings'

/**
 * @import { PluginProvider } from '../types.js'
 */

/**
 * Sync command: Discover and enable plugins from dependencies
 * @param {object} options - Command options
 * @param {string} [options.path] - Project path (default: cwd)
 * @param {boolean} [options.quiet] - Suppress output (for hooks)
 * @param {ClaudePluginConfig} [options.config] - Config instance (for testing)
 * @returns {Promise<void>}
 */
export async function syncCommand(options = {}) {
  const baseDir = options.path || process.cwd()
  const config = options.config || ClaudePluginConfig.createDefault()
  const quiet = options.quiet || false

  try {
    if (!quiet) {
      console.log('Scanning dependencies for Claude Code plugins...')
    }

    // Scan dependencies
    const providers = await scanDependencies(baseDir)

    if (!quiet) {
      console.log(`Found ${providers.length} plugin${providers.length === 1 ? '' : 's'}\n`)
    }

    if (providers.length === 0) {
      return
    }

    // Update settings (non-destructive merge)
    const changes = await updateSettings(config.settingsPath, providers)

    // Report changes
    if (!quiet) {
      if (changes.added.length > 0) {
        console.log('New plugins discovered:')
        for (const pluginName of changes.added) {
          const provider = providers.find((p) => p.pluginDeclaration.name === pluginName)
          console.log(`  • ${pluginName} (from ${provider.packageName} v${provider.version})`)
        }
        console.log()
      }

      if (changes.added.length > 0 || changes.updated.length > 0) {
        console.log(`Updated settings: ${config.settingsPath}`)
        console.log(
          `✓ ${changes.added.length} plugin${changes.added.length === 1 ? '' : 's'} added, ${changes.updated.length} updated\n`
        )

        if (changes.added.length > 0) {
          console.log('⚠️  Restart Claude Code to load new plugins\n')
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
