/* eslint-disable no-console, no-process-exit */
import { scanDependencies } from '../scanner'
import { ClaudePluginConfig } from '../storage/claude-config'
import { getPluginStates, readSettings } from '../storage/claude-settings'
import { PLUGIN_STATUSES } from '../types'

/**
 * @import { PluginProvider } from '../types.js'
 */

/**
 * Plugins view command: Show plugin status for current project or all plugins
 * @param {object} options - Command options
 * @param {string} [options.path] - Project path (default: cwd)
 * @param {boolean} [options.all] - Show all plugins in settings
 * @param {ClaudePluginConfig} [options.config] - Config instance (for testing)
 * @returns {Promise<void>}
 */
export async function pluginsViewCommand(options = {}) {
  const baseDir = options.path || process.cwd()
  const config = options.config || ClaudePluginConfig.createDefault()

  try {
    if (options.all) {
      await viewAllPlugins(config.settingsPath)
    }
    else {
      await viewProjectPlugins(baseDir, config.settingsPath)
    }
  }
  catch (error) {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  }
}

/**
 * View plugins for specific project
 * @param {string} baseDir - Project directory
 * @param {string} settingsPath - Path to settings.json
 * @returns {Promise<void>}
 */
async function viewProjectPlugins(baseDir, settingsPath) {
  console.log(`\nDiscovered Claude Code Plugins in ${baseDir}\n`)

  // Scan dependencies
  const providers = await scanDependencies(baseDir)

  if (providers.length === 0) {
    console.log('No Claude Code plugins found in dependencies.\n')

    return
  }

  // Get settings and plugin states
  const settings = await readSettings(settingsPath)
  const states = getPluginStates(providers, settings)

  // Display plugins
  let enabledCount = 0
  let disabledCount = 0
  let notInstalledCount = 0

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i]
    const state = states[i]

    console.log(`Package: ${provider.packageName} (v${provider.version})`)
    console.log(`  Plugin: ${state.name}`)
    console.log(`  Status: ${formatStatus(state.status)}`)
    console.log(`  Description: ${state.description}`)
    console.log()

    if (state.status === PLUGIN_STATUSES.ENABLED) enabledCount++
    else if (state.status === PLUGIN_STATUSES.DISABLED) disabledCount++
    else notInstalledCount++
  }

  // Summary
  console.log(`Summary: ${enabledCount} enabled, ${disabledCount} disabled, ${notInstalledCount} available`)

  // Restart warning if there are new plugins
  if (notInstalledCount > 0) {
    console.log('\n⚠️  Run `air sync` to enable new plugins, then restart Claude Code\n')
  }
}

/**
 * View all plugins in settings (not just current project)
 * @param {string} settingsPath - Path to settings.json
 * @returns {Promise<void>}
 */
async function viewAllPlugins(settingsPath) {
  console.log('\nAll Claude Code Plugins\n')

  const settings = await readSettings(settingsPath)

  const allPlugins = new Set([...settings.plugins.enabled, ...settings.plugins.disabled])

  if (allPlugins.size === 0) {
    console.log('No plugins configured.\n')

    return
  }

  let enabledCount = 0
  let disabledCount = 0

  for (const pluginName of allPlugins) {
    const isEnabled = settings.plugins.enabled.includes(pluginName)
    const status = isEnabled ? PLUGIN_STATUSES.ENABLED : PLUGIN_STATUSES.DISABLED

    // Find source from marketplaces
    let source = '(not found)'
    for (const [, marketplace] of Object.entries(settings.plugins.marketplaces)) {
      if (marketplace.plugins[pluginName]) {
        source = marketplace.source.path

        break
      }
    }

    console.log(`Plugin: ${pluginName}`)
    console.log(`  Source: ${source}`)
    console.log(`  Status: ${formatStatus(status)}`)
    console.log()

    if (isEnabled) enabledCount++
    else disabledCount++
  }

  console.log(`Summary: ${enabledCount} enabled, ${disabledCount} disabled\n`)
}

/**
 * Format status with indicator
 * @param {string} status - Plugin status
 * @returns {string} Formatted status string
 */
function formatStatus(status) {
  switch (status) {
    case PLUGIN_STATUSES.ENABLED:
      return '✓ Enabled'
    case PLUGIN_STATUSES.DISABLED:
      return '⊗ Disabled (by user)'
    case PLUGIN_STATUSES.NOT_INSTALLED:
      return '• Not installed'
    default:
      return status
  }
}
