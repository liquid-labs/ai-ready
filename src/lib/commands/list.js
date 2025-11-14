import { scanAll } from '../core/scanner.js'
import { loadProvidersWithCache } from '../storage/cache.js'
import { loadInstallationStatus } from '../storage/registry.js'
import { DEFAULT_CONFIG } from '../core/types.js'

/* eslint-disable no-console, no-process-exit */

/**
 * List command implementation
 * @param {object} options - Command options
 * @param {boolean} [options.installed] - Show only installed integrations
 * @param {boolean} [options.available] - Show only available integrations
 * @param {string} [options.library] - Filter by library name
 * @returns {Promise<void>}
 */
export async function cmdList(options) {
  try {
    // Load providers with caching
    const { npmProviders, remoteProviders } = await loadProvidersWithCache(DEFAULT_CONFIG.cacheFile, () => scanAll())

    // Combine all providers for display
    const allProviders = [...npmProviders, ...remoteProviders]

    // Load installation status
    const providersWithStatus = await loadInstallationStatus(
      allProviders,
      DEFAULT_CONFIG.registryFiles.claudeSkillsDir,
      DEFAULT_CONFIG.registryFiles.generic
    )

    // Filter providers
    let filtered = providersWithStatus

    if (options.library) {
      filtered = filtered.filter((p) => (p.libraryName || p.repoName) === options.library)
    }

    // Filter integrations
    const results = []
    for (const provider of filtered) {
      for (const integration of provider.integrations) {
        const isInstalled = integration.installedTypes.length > 0
        const isPartiallyInstalled =
          integration.installedTypes.length > 0 && integration.installedTypes.length < integration.types.length

        // Apply filters
        if (options.installed && !isInstalled) continue
        if (options.available && isInstalled && !isPartiallyInstalled) continue

        results.push({
          library        : provider.libraryName || provider.repoName,
          integration    : integration.name,
          types          : integration.types,
          installedTypes : integration.installedTypes,
          summary        : integration.summary,
        })
      }
    }

    // Display results
    if (results.length === 0) {
      console.log('No integrations found.')

      return
    }

    displayTable(results)
  }
  catch (error) {
    console.error('Error listing integrations:', error.message)
    process.exit(1)
  }
}

/**
 * Displays results in table format
 * @param {Array} results - Integration results
 */
function displayTable(results) {
  // Calculate column widths
  const widths = {
    library        : Math.max(7, ...results.map((r) => r.library.length)),
    integration    : Math.max(11, ...results.map((r) => r.integration.length)),
    types          : Math.max(5, ...results.map((r) => formatTypes(r.types).length)),
    installedTypes : Math.max(14, ...results.map((r) => formatTypes(r.installedTypes).length)),
    summary        : Math.max(7, ...results.map((r) => r.summary.length)),
  }

  // Header
  console.log(
    pad('Library', widths.library)
      + '  '
      + pad('Integration', widths.integration)
      + '  '
      + pad('Types', widths.types)
      + '  '
      + pad('InstalledTypes', widths.installedTypes)
      + '  '
      + 'Summary'
  )

  // Rows
  for (const result of results) {
    console.log(
      pad(result.library, widths.library)
        + '  '
        + pad(result.integration, widths.integration)
        + '  '
        + pad(formatTypes(result.types), widths.types)
        + '  '
        + pad(formatTypes(result.installedTypes), widths.installedTypes)
        + '  '
        + result.summary
    )
  }
}

/**
 * Pads a string to a specific width
 * @param {string} str - String to pad
 * @param {number} width - Target width
 * @returns {string} Padded string
 */
function pad(str, width) {
  return str.padEnd(width, ' ')
}

/**
 * Formats types array for display
 * @param {string[]} types - Array of type strings
 * @returns {string} Formatted types string
 */
function formatTypes(types) {
  if (types.length === 0) return '[]'

  return `[${types.join(',')}]`
}
