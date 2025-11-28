import fs from 'fs/promises'
import path from 'path'

import { PLUGIN_STATUSES } from '../types'

/**
 * @import { MarketplaceProvider, PluginState, ClaudeSettings, PluginEntry } from '../types.js'
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
 * Check if settings file exists
 * @param {string} settingsPath - Path to settings.json
 * @returns {Promise<boolean>} True if file exists, false otherwise
 */
async function checkSettingsExists(settingsPath) {
  try {
    await fs.access(settingsPath)

    return true
  }
  catch {
    return false
  }
}

/**
 * Get the source string for a plugin entry
 * @param {PluginEntry} plugin - Plugin entry from marketplace
 * @returns {string} Source string representation
 */
function getPluginSourceString(plugin) {
  if (typeof plugin.source === 'string') {
    return plugin.source
  }

  // Object source - serialize it
  if (plugin.source.source === 'github') {
    return `github:${plugin.source.repo}${plugin.source.ref ? `#${plugin.source.ref}` : ''}`
  }

  if (plugin.source.source === 'url') {
    return plugin.source.url
  }

  return JSON.stringify(plugin.source)
}

/**
 * Build marketplace entry for Claude settings from provider
 * @param {MarketplaceProvider} provider - Marketplace provider
 * @returns {object} Marketplace entry for settings
 */
function buildMarketplaceEntry(provider) {
  const marketplace = provider.marketplaceDeclaration
  const plugins = {}

  for (const plugin of marketplace.plugins) {
    plugins[plugin.name] = {
      version : plugin.version || 'unknown',
      source  : getPluginSourceString(plugin),
    }
  }

  return {
    source : {
      type : 'directory',
      path : provider.path,
    },
    plugins,
  }
}

/**
 * Check if marketplace entry needs updating
 * @param {object} existingEntry - Current marketplace entry in settings
 * @param {object} newEntry - New marketplace entry
 * @returns {boolean} True if marketplace needs updating
 */
function shouldUpdateMarketplace(existingEntry, newEntry) {
  if (!existingEntry) {
    return true
  }

  if (existingEntry.source.path !== newEntry.source.path) {
    return true
  }

  // Check if plugins have changed
  const existingPlugins = Object.keys(existingEntry.plugins || {})
  const newPlugins = Object.keys(newEntry.plugins || {})

  if (existingPlugins.length !== newPlugins.length) {
    return true
  }

  for (const pluginName of newPlugins) {
    const existing = existingEntry.plugins[pluginName]
    const updated = newEntry.plugins[pluginName]

    if (!existing) {
      return true
    }

    if (existing.version !== updated.version || existing.source !== updated.source) {
      return true
    }
  }

  return false
}

/**
 * Update settings with discovered marketplace providers (non-destructive merge)
 * @param {string} settingsPath - Path to settings.json
 * @param {MarketplaceProvider[]} providers - Discovered marketplace providers
 * @returns {Promise<{added: string[], updated: string[]}>} Change summary
 */
export async function updateSettings(settingsPath, providers) {
  const settings = await readSettings(settingsPath)
  const changes = { added : [], updated : [] }
  const settingsFileExists = await checkSettingsExists(settingsPath)
  let marketplacesUpdated = false

  for (const provider of providers) {
    const marketplace = provider.marketplaceDeclaration
    const marketplaceName = marketplace.name

    const existingEntry = settings.plugins.marketplaces[marketplaceName]
    const newEntry = buildMarketplaceEntry(provider)

    if (shouldUpdateMarketplace(existingEntry, newEntry)) {
      settings.plugins.marketplaces[marketplaceName] = newEntry
      marketplacesUpdated = true
    }

    // Process each plugin in the marketplace
    for (const plugin of marketplace.plugins) {
      const pluginKey = `${plugin.name}@${marketplaceName}`

      if (settings.plugins.disabled.includes(pluginKey)) {
        continue
      }

      const isEnabled = settings.plugins.enabled.includes(pluginKey)
      if (!isEnabled) {
        settings.plugins.enabled.push(pluginKey)
        changes.added.push(plugin.name)
      }
      else {
        changes.updated.push(plugin.name)
      }
    }
  }

  if (changes.added.length > 0 || changes.updated.length > 0 || marketplacesUpdated || !settingsFileExists) {
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
 * @param {string} marketplaceName - Marketplace name
 * @param {ClaudeSettings} settings - Settings object
 * @returns {string} Status: 'enabled' | 'disabled' | 'not-installed'
 */
export function getPluginState(pluginName, marketplaceName, settings) {
  const pluginKey = `${pluginName}@${marketplaceName}`

  if (settings.plugins.enabled.includes(pluginKey)) {
    return PLUGIN_STATUSES.ENABLED
  }

  if (settings.plugins.disabled.includes(pluginKey)) {
    return PLUGIN_STATUSES.DISABLED
  }

  return PLUGIN_STATUSES.NOT_INSTALLED
}

/**
 * Get states for all plugins in discovered marketplaces
 * @param {MarketplaceProvider[]} providers - Discovered marketplace providers
 * @param {ClaudeSettings} settings - Settings object
 * @returns {PluginState[]} Plugin states
 */
export function getPluginStates(providers, settings) {
  const states = []

  for (const provider of providers) {
    const marketplace = provider.marketplaceDeclaration
    const marketplaceName = marketplace.name

    for (const plugin of marketplace.plugins) {
      states.push({
        name        : plugin.name,
        status      : getPluginState(plugin.name, marketplaceName, settings),
        source      : getPluginSourceString(plugin),
        version     : plugin.version || 'unknown',
        description : plugin.description || '',
        marketplace : marketplaceName,
      })
    }
  }

  return states
}
