import { scanForProviders } from '../core/scanner.js'
import { loadProvidersWithCache } from '../core/cache.js'
import { loadInstallationStatus } from '../core/registry.js'
import { DEFAULT_CONFIG } from '../core/types.js'

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
    const providers = await loadProvidersWithCache(
      DEFAULT_CONFIG.cacheFile,
      () => scanForProviders(DEFAULT_CONFIG.scanPaths)
    )

    // Load installation status
    const providersWithStatus = await loadInstallationStatus(
      providers,
      DEFAULT_CONFIG.registryFiles.claude,
      DEFAULT_CONFIG.registryFiles.generic
    )

    // Parse input
    const parts = libraryIntegration.split('/')
    const libraryName = parts[0]
    const integrationName = parts[1] || null

    // Find library
    const provider = providersWithStatus.find(
      (p) => p.libraryName === libraryName
    )

    if (!provider) {
      console.error(`Error: Library '${libraryName}' not found`)
      process.exit(1)
    }

    // Display library or integration
    if (integrationName) {
      displayIntegration(provider, integrationName)
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
    const installed =
      integration.installedTypes.length > 0 ? ' [installed]' : ''
    console.log(`  - ${integration.name}${installed}`)
    console.log(`    ${integration.summary}`)
  }
}

/**
 * Displays integration details
 * @param {IntegrationProvider} provider - Provider containing the integration
 * @param {string} integrationName - Name of integration to display
 */
function displayIntegration(provider, integrationName) {
  const integration = provider.integrations.find(
    (i) => i.name === integrationName
  )

  if (!integration) {
    console.error(
      `Error: Integration '${integrationName}' not found in library '${provider.libraryName}'`
    )
    process.exit(1)
  }

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
 * @returns {string}
 */
function formatTypes(types) {
  if (types.length === 0) return '(none)'

  return `[${types.join(', ')}]`
}
