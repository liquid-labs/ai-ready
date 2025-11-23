import fs from 'fs/promises'
import path from 'path'

import { PLUGIN_STATUSES } from '../types'

/**
 * @import { PluginProvider, PluginState, ClaudeSettings } from '../types.js'
 */

/**
 * Read Claude Code settings.json
 * @param {string} settingsPath - Path to settings.json
 * @returns {Promise<ClaudeSettings>} Settings object
 */
export async function readSettings(settingsPath) {
  try {
    const content = await fs.readFile(settingsPath, 'utf8')
    const settings = JSON.parse(content)

    // Ensure plugins section exists with correct structure
    if (!settings.plugins) {
      settings.plugins = {
        enabled      : [],
        disabled     : [],
        marketplaces : {},
      }
    }

    settings.plugins.enabled = settings.plugins.enabled || []
    settings.plugins.disabled = settings.plugins.disabled || []
    settings.plugins.marketplaces = settings.plugins.marketplaces || {}

    return settings
  }
  catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return default settings
      return {
        plugins : {
          enabled      : [],
          disabled     : [],
          marketplaces : {},
        },
      }
    }

    if (error instanceof SyntaxError) {
      // eslint-disable-next-line no-console
      console.warn('Malformed settings.json, creating backup and using defaults')
      await createBackup(settingsPath)

      return {
        plugins : {
          enabled      : [],
          disabled     : [],
          marketplaces : {},
        },
      }
    }

    throw error
  }
}

/**
 * Update settings with discovered providers (non-destructive merge)
 * @param {string} settingsPath - Path to settings.json
 * @param {PluginProvider[]} providers - Discovered providers
 * @returns {Promise<{added: string[], updated: string[]}>} Change summary
 */
export async function updateSettings(settingsPath, providers) {
  const settings = await readSettings(settingsPath)
  const changes = { added : [], updated : [] }

  for (const provider of providers) {
    const pluginName = provider.pluginDeclaration.name
    const marketplaceName = `${provider.packageName}-marketplace`

    // Skip if plugin is explicitly disabled
    if (settings.plugins.disabled.includes(pluginName)) {
      continue
    }

    // Check if plugin is already enabled
    const isEnabled = settings.plugins.enabled.includes(pluginName)

    if (!isEnabled) {
      // Add to enabled list
      settings.plugins.enabled.push(pluginName)
      changes.added.push(pluginName)
    }
    else {
      changes.updated.push(pluginName)
    }

    // Update marketplace entry (always update path/version)
    settings.plugins.marketplaces[marketplaceName] = {
      source : {
        type : 'directory',
        path : provider.path,
      },
      plugins : {
        [pluginName] : {
          version   : provider.pluginDeclaration.version,
          skillPath : provider.pluginDeclaration.skillPath,
        },
      },
    }
  }

  // Only write if there were changes
  if (changes.added.length > 0 || changes.updated.length > 0) {
    await writeSettings(settingsPath, settings)
  }

  return changes
}

/**
 * Write settings to file with backup
 * @param {string} settingsPath - Path to settings.json
 * @param {ClaudeSettings} settings - Settings object
 * @returns {Promise<void>}
 */
async function writeSettings(settingsPath, settings) {
  // Create backup before writing
  await createBackup(settingsPath)

  // Ensure directory exists
  await fs.mkdir(path.dirname(settingsPath), { recursive : true })

  // Write settings
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8')
}

/**
 * Create backup of settings file
 * @param {string} settingsPath - Path to settings.json
 * @returns {Promise<void>}
 */
async function createBackup(settingsPath) {
  try {
    await fs.access(settingsPath)

    // Rotate existing backups (.bak -> .bak.1, .bak.1 -> .bak.2, etc.)
    const maxBackups = 5
    for (let i = maxBackups - 1; i >= 0; i--) {
      const from = i === 0 ? `${settingsPath}.bak` : `${settingsPath}.bak.${i}`
      const to = `${settingsPath}.bak.${i + 1}`

      try {
        // eslint-disable-next-line no-await-in-loop
        await fs.access(from)
        if (i === maxBackups - 1) {
          // eslint-disable-next-line no-await-in-loop
          await fs.unlink(from) // Delete oldest backup
        }
        else {
          // eslint-disable-next-line no-await-in-loop
          await fs.rename(from, to)
        }
      }
      catch {
        // Backup doesn't exist, skip
      }
    }

    // Create new backup
    await fs.copyFile(settingsPath, `${settingsPath}.bak`)
  }
  catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
}

/**
 * Get plugin state from settings
 * @param {string} pluginName - Plugin name
 * @param {ClaudeSettings} settings - Settings object
 * @returns {string} Status: 'enabled' | 'disabled' | 'not-installed'
 */
export function getPluginState(pluginName, settings) {
  if (settings.plugins.enabled.includes(pluginName)) {
    return PLUGIN_STATUSES.ENABLED
  }

  if (settings.plugins.disabled.includes(pluginName)) {
    return PLUGIN_STATUSES.DISABLED
  }

  return PLUGIN_STATUSES.NOT_INSTALLED
}

/**
 * Get states for all discovered providers
 * @param {PluginProvider[]} providers - Discovered providers
 * @param {ClaudeSettings} settings - Settings object
 * @returns {PluginState[]} Plugin states
 */
export function getPluginStates(providers, settings) {
  return providers.map((provider) => ({
    name        : provider.pluginDeclaration.name,
    status      : getPluginState(provider.pluginDeclaration.name, settings),
    source      : provider.path,
    version     : provider.pluginDeclaration.version,
    description : provider.pluginDeclaration.description,
  }))
}
