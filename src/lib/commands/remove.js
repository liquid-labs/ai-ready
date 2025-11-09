import { logErrAndExit } from './log-lib.js'
import { findProviderAndIntegration } from './data-lib.js'
import { scanAll } from '../core/scanner.js'
import { loadProvidersWithCache } from '../core/cache.js'
import {
  loadInstallationStatus,
  createBackup,
  removeClaudeSkillSymlink,
  readGenericRegistry,
  writeGenericRegistry
} from '../core/registry.js'
import { DEFAULT_CONFIG, INTEGRATION_TYPES } from '../core/types.js'

/* eslint-disable no-console, no-process-exit */

/**
 * Remove command implementation
 * @param {string} libraryIntegration - Library/integration to remove
 * @param {object} options - Command options
 * @param {boolean} [options.skill] - Remove only Claude Skill type
 * @param {boolean} [options.generic] - Remove only generic integration type
 * @returns {Promise<void>}
 */
export async function cmdRemove(libraryIntegration, options) {
  if (!libraryIntegration || !libraryIntegration.includes('/')) {
    console.error(
      'Error: Please specify library/integration format (e.g., my-lib/MyIntegration)'
    )
    process.exit(1)
  }

  try {
    // Parse input
    const [libraryName, integrationName] = libraryIntegration.split('/')

    // Load providers
    const { npmProviders, remoteProviders } = await loadProvidersWithCache(
      DEFAULT_CONFIG.cacheFile,
      () => scanAll()
    )

    const providers = [...npmProviders, ...remoteProviders]

    const providersWithStatus = await loadInstallationStatus(
      providers,
      DEFAULT_CONFIG.registryFiles.claudeSkillsDir,
      DEFAULT_CONFIG.registryFiles.generic
    )

    // Find integration
    const { integration } = findProviderAndIntegration(
      providersWithStatus,
      libraryName,
      integrationName
    )

    // Determine types to remove
    const typesToRemove = determineTypesToRemove(integration, options)
    if (typesToRemove.length === 0) {
      console.log('No installed types to remove.')

      return
    }

    console.log(`Removing ${libraryName}/${integrationName} ...`)

    // Remove each type
    await Promise.all(
      typesToRemove.map((type) =>
        removeType(libraryName, integrationName, type))
    )

    console.log('✔ Removal complete')
  }
  catch (error) {
    logErrAndExit(`Error removing integration: ${error.message}`)
  }
}

/**
 * Determines which types to remove based on options
 * @param {import('../core/types.js').Integration} integration - Integration to remove
 * @param {object} options - Command options
 * @returns {string[]} Array of types to remove
 */
function determineTypesToRemove(integration, options) {
  // If both flags or neither flag, remove all installed types
  if (
    (!options.skill && !options.generic)
    || (options.skill && options.generic)
  ) {
    return [...integration.installedTypes]
  }

  const typesToRemove = []
  if (
    options.skill
    && integration.installedTypes.includes(INTEGRATION_TYPES.CLAUDE_SKILL)
  ) {
    typesToRemove.push(INTEGRATION_TYPES.CLAUDE_SKILL)
  }
  if (
    options.generic
    && integration.installedTypes.includes(INTEGRATION_TYPES.GENERIC)
  ) {
    typesToRemove.push(INTEGRATION_TYPES.GENERIC)
  }

  return typesToRemove
}

/**
 * Removes a specific type of integration
 * @param {string} libraryName - Library name
 * @param {string} integrationName - Integration name
 * @param {string} type - Type to remove
 * @returns {Promise<void>}
 */
async function removeType(libraryName, integrationName, type) {
  if (type === INTEGRATION_TYPES.CLAUDE_SKILL) {
    await removeClaudeSkill(libraryName, integrationName)
    console.log('✔ Claude Skill removed')
  }
  else if (type === INTEGRATION_TYPES.GENERIC) {
    await removeGenericIntegration(libraryName, integrationName)
    console.log('✔ Generic integration removed')
  }
}

/**
 * Removes a Claude Skill by deleting its symlink
 * @param {string} libraryName - Library name (unused, kept for signature compatibility)
 * @param {string} integrationName - Integration name
 * @returns {Promise<void>}
 */
async function removeClaudeSkill(libraryName, integrationName) {
  const claudeSkillsDir = DEFAULT_CONFIG.registryFiles.claudeSkillsDir

  // Remove symlink
  await removeClaudeSkillSymlink(claudeSkillsDir, integrationName)
}

/**
 * Removes a generic integration
 * @param {string} libraryName - Library name
 * @param {string} integrationName - Integration name
 * @returns {Promise<void>}
 */
async function removeGenericIntegration(libraryName, integrationName) {
  // Use first generic file path (AGENTS.md or CLAUDE.md)
  const genericFile = DEFAULT_CONFIG.registryFiles.generic[0]

  // Create backup
  await createBackup(genericFile)

  // Read existing entries from all generic files
  const allEntries = await readGenericRegistry(
    DEFAULT_CONFIG.registryFiles.generic
  )

  // Filter out the entry
  const filtered = allEntries.filter(
    (e) => !(e.library === libraryName && e.integration === integrationName)
  )

  await writeGenericRegistry(genericFile, filtered)
}
