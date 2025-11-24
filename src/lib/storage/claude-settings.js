import fs from 'fs/promises'
import path from 'path'

import { PLUGIN_STATUSES } from '../types'

/**
 * @import { PluginProvider, PluginState, ClaudeSettings } from '../types.js'
 */

/**
 * Convert package name to marketplace name
 * Handles scoped packages: @scope/package -> scope-package-marketplace
 * @param {string} packageName - npm package name
 * @returns {string} Marketplace name
 */
function packageNameToMarketplaceName(packageName) {
  // Remove @ prefix, replace / with -, and convert to lowercase
  const normalized = packageName.replace(/^@/, '').replace(/\//g, '-').toLowerCase()

  return `${normalized}-marketplace`
}

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
 * Build marketplace entry for provider
 * @param {PluginProvider} provider - Plugin provider
 * @returns {object} Marketplace entry
 */
function buildMarketplaceEntry(provider) {
  return {
    source : {
      type : 'directory',
      path : provider.path,
    },
    plugins : {
      [provider.pluginDeclaration.name] : {
        version   : provider.pluginDeclaration.version,
        skillPath : provider.pluginDeclaration.skillPath,
      },
    },
  }
}

/**
 * Check if marketplace entry needs updating
 * @param {object} existingMarketplace - Current marketplace entry
 * @param {object} newMarketplace - New marketplace entry
 * @param {string} pluginName - Plugin name
 * @returns {boolean} True if marketplace needs updating
 */
function shouldUpdateMarketplace(existingMarketplace, newMarketplace, pluginName) {
  return (
    !existingMarketplace
    || existingMarketplace.source.path !== newMarketplace.source.path
    || existingMarketplace.plugins[pluginName]?.version !== newMarketplace.plugins[pluginName].version
    || existingMarketplace.plugins[pluginName]?.skillPath !== newMarketplace.plugins[pluginName].skillPath
  )
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
  const settingsFileExists = await checkSettingsExists(settingsPath)
  let marketplacesUpdated = false

  for (const provider of providers) {
    const pluginName = provider.pluginDeclaration.name
    const marketplaceName = packageNameToMarketplaceName(provider.packageName)
    const pluginKey = `${pluginName}@${marketplaceName}`

    const existingMarketplace = settings.plugins.marketplaces[marketplaceName]
    const newMarketplace = buildMarketplaceEntry(provider)

    if (shouldUpdateMarketplace(existingMarketplace, newMarketplace, pluginName)) {
      settings.plugins.marketplaces[marketplaceName] = newMarketplace
      marketplacesUpdated = true
    }

    if (settings.plugins.disabled.includes(pluginKey)) {
      continue
    }

    const isEnabled = settings.plugins.enabled.includes(pluginKey)
    if (!isEnabled) {
      settings.plugins.enabled.push(pluginKey)
      changes.added.push(pluginName)
    }
    else {
      changes.updated.push(pluginName)
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
 * @param {string} packageName - Package name (for constructing plugin key)
 * @param {ClaudeSettings} settings - Settings object
 * @returns {string} Status: 'enabled' | 'disabled' | 'not-installed'
 */
export function getPluginState(pluginName, packageName, settings) {
  const marketplaceName = packageNameToMarketplaceName(packageName)
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
 * Get states for all discovered providers
 * @param {PluginProvider[]} providers - Discovered providers
 * @param {ClaudeSettings} settings - Settings object
 * @returns {PluginState[]} Plugin states
 */
export function getPluginStates(providers, settings) {
  return providers.map((provider) => ({
    name        : provider.pluginDeclaration.name,
    status      : getPluginState(provider.pluginDeclaration.name, provider.packageName, settings),
    source      : provider.path,
    version     : provider.pluginDeclaration.version,
    description : provider.pluginDeclaration.description,
  }))
}
