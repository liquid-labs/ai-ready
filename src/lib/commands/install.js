import { scanAll } from '../scanner'
import { loadProvidersWithCache } from '../storage/cache'
import { getDefaultRegistry } from '../storage/claude-plugin-registry'
import { createBackup, loadInstallationStatus, readGenericRegistry, writeGenericRegistry } from '../storage/registry'
import { DEFAULT_CONFIG, INTEGRATION_TYPES } from '../types'
import { parseLibraryIntegration } from '../utils/parse-library-integration'
import { findProviderAndIntegration } from './data-lib'
import { logErrAndExit } from './ui-lib'

/**
 * @import { Integration, IntegrationProvider } from '../types.js'
 */
/* eslint-disable no-console */

/**
 * Install command implementation
 * @param {string} libraryIntegration - Library/integration to install
 * @param {object} options - Command options
 * @param {boolean} [options.skill] - Install only Claude Skill type
 * @param {boolean} [options.generic] - Install only generic integration type
 * @returns {Promise<void>}
 */
export async function cmdInstall(libraryIntegration, options) {
  if (!libraryIntegration) {
    logErrAndExit('Error: Please specify library/integration format (e.g., my-lib/MyIntegration)')
  }

  try {
    // Parse input
    const { libraryName, integrationName } = parseLibraryIntegration(libraryIntegration)

    if (!integrationName) {
      logErrAndExit('Error: Please specify library/integration format (e.g., my-lib/MyIntegration)')
    }

    // Load providers
    const { npmProviders, remoteProviders } = await loadProvidersWithCache(DEFAULT_CONFIG.cacheFile, () => scanAll())

    const providers = [...npmProviders, ...remoteProviders]

    const pluginRegistry = getDefaultRegistry()
    const providersWithStatus = await loadInstallationStatus(
      providers,
      DEFAULT_CONFIG.registryFiles.claudeSkillsDir,
      DEFAULT_CONFIG.registryFiles.generic,
      process.cwd(),
      pluginRegistry
    )

    // Find integration
    const { provider, integration } = findProviderAndIntegration(providersWithStatus, libraryName, integrationName)

    // Determine types to install
    const typesToInstall = determineTypesToInstall(integration, options)

    if (typesToInstall.length === 0) {
      console.log('No types available to install.')

      return
    }

    console.log(`Installing ${libraryName}/${integrationName} ...`)

    // Install each type
    const installations = typesToInstall.map((type) =>
      installType(libraryName, integrationName, integration, type, provider.path, provider))

    await Promise.all(installations)
    console.log('✔ Installation complete')

    // Check if any Claude Skills were installed
    if (typesToInstall.includes(INTEGRATION_TYPES.CLAUDE_SKILL)) {
      console.log('\n⚠️  Please restart Claude Code for the skill changes to take effect.')
    }
  }
  catch (error) {
    logErrAndExit(`Error installing integration: ${error.message}`)
  }
}

/**
 * Determines which types to install based on options
 * @param {Integration} integration - Integration to install
 * @param {object} options - Command options
 * @returns {string[]} Array of types to install
 */
function determineTypesToInstall(integration, options) {
  const requestedTypes = []

  // If both flags or neither flag, install all available types
  if ((!options.skill && !options.generic) || (options.skill && options.generic)) {
    requestedTypes.push(...integration.types)
  }
  else {
    if (options.skill && integration.types.includes(INTEGRATION_TYPES.CLAUDE_SKILL)) {
      requestedTypes.push(INTEGRATION_TYPES.CLAUDE_SKILL)
    }
    if (options.generic && integration.types.includes(INTEGRATION_TYPES.GENERIC)) {
      requestedTypes.push(INTEGRATION_TYPES.GENERIC)
    }
  }

  // Filter out already installed types
  return requestedTypes.filter((type) => !integration.installedTypes.includes(type))
}

/**
 * Installs a specific type of integration
 * @param {string} libraryName - Library name
 * @param {string} integrationName - Integration name
 * @param {Integration} integration - Integration object
 * @param {string} type - Type to install
 * @param {string} libraryPath - Path to library root
 * @param {IntegrationProvider} provider - Provider object
 * @returns {Promise<void>}
 */
async function installType(libraryName, integrationName, integration, type, libraryPath, provider) {
  if (type === INTEGRATION_TYPES.CLAUDE_SKILL) {
    await installClaudeSkillIntegration(
      libraryName,
      integrationName,
      integration.dirName,
      libraryPath,
      provider.version
    )
    console.log('✔ Claude Skill installed')
  }
  else if (type === INTEGRATION_TYPES.GENERIC) {
    await installGenericIntegration(libraryName, integrationName, integration.summary)
    console.log('✔ Generic integration installed')
  }
}

/**
 * Installs a Claude Skill via plugin registry
 * @param {string} libraryName - Library name
 * @param {string} integrationName - Integration name (display name)
 * @param {string} integrationDirName - Integration directory name (actual filesystem name)
 * @param {string} libraryPath - Path to library root
 * @param {string} version - Library version
 * @returns {Promise<void>}
 */
async function installClaudeSkillIntegration(libraryName, integrationName, integrationDirName, libraryPath, version) {
  const registry = getDefaultRegistry()
  await registry.installPlugin(libraryName, integrationName, integrationDirName, libraryPath, version)
}

/**
 * Installs a generic integration
 * @param {string} libraryName - Library name
 * @param {string} integrationName - Integration name
 * @param {string} summary - Integration summary
 * @returns {Promise<void>}
 */
async function installGenericIntegration(libraryName, integrationName, summary) {
  // Use first generic file path (AGENTS.md or CLAUDE.md)
  const genericFile = DEFAULT_CONFIG.registryFiles.generic[0]

  // Create backup
  await createBackup(genericFile)

  // Read existing entries
  const entries = await readGenericRegistry(DEFAULT_CONFIG.registryFiles.generic)

  // Check if already exists
  const exists = entries.some((e) => e.library === libraryName && e.integration === integrationName)

  if (!exists) {
    entries.push({
      library     : libraryName,
      integration : integrationName,
      summary,
    })

    await writeGenericRegistry(genericFile, entries)
  }
}
