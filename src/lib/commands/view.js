import { findProviderAndIntegration } from './data-lib'
import { scanAll } from '../scanner'
import { loadProvidersWithCache } from '../storage/cache'
import { loadInstallationStatus } from '../storage/registry'
import { getDefaultRegistry } from '../storage/claude-plugin-registry'
import { DEFAULT_CONFIG } from '../types'

/**
 * @import { Integration, IntegrationProvider } from '../types.js'
 */
/* eslint-disable no-console, no-process-exit */

/**
 * View command implementation
 * @param {string} libraryIntegration - Library name or library/integration
 * @returns {Promise<void>}
 */
export async function cmdView(libraryIntegration) {
  if (!libraryIntegration) {
    console.error('Error: Please specify a library or library/integration')
    process.exit(1)
  }

  try {
    // Load providers with caching
    const { npmProviders, remoteProviders } = await loadProvidersWithCache(DEFAULT_CONFIG.cacheFile, () => scanAll())

    const providers = [...npmProviders, ...remoteProviders]

    // Load installation status
    const pluginRegistry = getDefaultRegistry()
    const providersWithStatus = await loadInstallationStatus(
      providers,
      DEFAULT_CONFIG.registryFiles.claudeSkillsDir,
      DEFAULT_CONFIG.registryFiles.generic,
      process.cwd(),
      pluginRegistry
    )

    // Parse input
    const parts = libraryIntegration.split('/')
    const libraryName = parts[0]
    const integrationName = parts[1] || null

    // Find library and optionally integration
    const { provider, integration } = findProviderAndIntegration(providersWithStatus, libraryName, integrationName)

    // Display library or integration
    if (integration) {
      displayIntegration(provider, integration)
    }
    else {
      displayLibrary(provider)
    }
  }
  catch (error) {
    console.error('Error viewing details:', error.message)
    process.exit(1)
  }
}

/**
 * Displays library details
 * @param {IntegrationProvider} provider - Provider to display
 */
function displayLibrary(provider) {
  console.log(`Library : ${provider.libraryName} (v${provider.version})`)
  console.log(`Path    : ${provider.path}`)
  console.log(`\nIntegrations:`)

  if (provider.integrations.length === 0) {
    console.log('  (none)')

    return
  }

  for (const integration of provider.integrations) {
    const installed = integration.installedTypes.length > 0 ? ' [installed]' : ''
    console.log(`  - ${integration.name}${installed}`)
    console.log(`    ${integration.summary}`)
  }
}

/**
 * Displays integration details
 * @param {IntegrationProvider} provider - Provider containing the integration
 * @param {Integration} integration - Integration to display
 */
function displayIntegration(provider, integration) {
  console.log(`Library      : ${provider.libraryName} (v${provider.version})`)
  console.log(`Integration  : ${integration.name}`)
  console.log(`Summary      : ${integration.summary}`)
  console.log(`Types        : ${formatTypes(integration.types)}`)
  console.log(`Installed    : ${formatTypes(integration.installedTypes)}`)

  // Show usage snippet if available
  // For now, we'll skip this as the spec mentions it's optional
}

/**
 * Formats types array for display
 * @param {string[]} types - Array of type strings
 * @returns {string} - Formatted types string
 */
function formatTypes(types) {
  if (types.length === 0) return '(none)'

  return `[${types.join(', ')}]`
}
