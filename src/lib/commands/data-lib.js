import { logErrAndExit } from './ui-lib'

/**
 * @import { IntegrationProvider, Integration } from '../core/types.js'
 */

/**
 * Finds a provider and optionally an integration by name
 * @param {IntegrationProvider[]} providersWithStatus - Array of providers with installation status
 * @param {string} libraryName - Library name to find
 * @param {string} [integrationName] - Optional integration name to find
 * @returns {{ provider: IntegrationProvider, integration: Integration | null }} - Found provider and integration (if requested)
 */
export function findProviderAndIntegration(providersWithStatus, libraryName, integrationName) {
  // Find provider
  const provider = providersWithStatus.find((p) => p.libraryName === libraryName)
  if (!provider) {
    logErrAndExit(`Error: Library '${libraryName}' not found`)
  }

  // Find integration if name provided
  let integration = null
  if (integrationName) {
    integration = provider.integrations.find((i) => i.name === integrationName)
    if (!integration) {
      logErrAndExit(`Error: Integration '${integrationName}' not found in library '${libraryName}'`)
    }
  }

  return { provider, integration }
}
