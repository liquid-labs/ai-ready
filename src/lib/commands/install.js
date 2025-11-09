import { logErrAndExit } from './log-lib.js'
import { findProviderAndIntegration } from './data-lib.js'
import { scanAll } from '../core/scanner.js'
import { loadProvidersWithCache } from '../core/cache.js'
import {
  loadInstallationStatus,
  createBackup,
  installClaudeSkillSymlink,
  readGenericRegistry,
  writeGenericRegistry
} from '../core/registry.js'
import { DEFAULT_CONFIG, INTEGRATION_TYPES } from '../core/types.js'

/**
 * @import { Integration } from './types.js'
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
  if (!libraryIntegration || !libraryIntegration.includes('/')) {
    logErrAndExit(
      'Error: Please specify library/integration format (e.g., my-lib/MyIntegration)'
    )
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
    const { provider, integration } = findProviderAndIntegration(
      providersWithStatus,
      libraryName,
      integrationName
    )

    // Determine types to install
    const typesToInstall = determineTypesToInstall(integration, options)

    if (typesToInstall.length === 0) {
      console.log('No types available to install.')

      return
    }

    console.log(`Installing ${libraryName}/${integrationName} ...`)

    // Install each type
    const installations = typesToInstall.map((type) =>
      installType(
        libraryName,
        integrationName,
        integration,
        type,
        provider.path
      ))

    await Promise.all(installations)
    console.log('✔ Installation complete')
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
  if (
    (!options.skill && !options.generic)
    || (options.skill && options.generic)
  ) {
    requestedTypes.push(...integration.types)
  }
  else {
    if (
      options.skill
      && integration.types.includes(INTEGRATION_TYPES.CLAUDE_SKILL)
    ) {
      requestedTypes.push(INTEGRATION_TYPES.CLAUDE_SKILL)
    }
    if (
      options.generic
      && integration.types.includes(INTEGRATION_TYPES.GENERIC)
    ) {
      requestedTypes.push(INTEGRATION_TYPES.GENERIC)
    }
  }

  // Filter out already installed types
  return requestedTypes.filter(
    (type) => !integration.installedTypes.includes(type)
  )
}

/**
 * Installs a specific type of integration
 * @param {string} libraryName - Library name
 * @param {string} integrationName - Integration name
 * @param {Integration} integration - Integration object
 * @param {string} type - Type to install
 * @param {string} libraryPath - Path to library root
 * @returns {Promise<void>}
 */
async function installType(
  libraryName,
  integrationName,
  integration,
  type,
  libraryPath
) {
  if (type === INTEGRATION_TYPES.CLAUDE_SKILL) {
    await installClaudeSkill(integrationName, libraryPath)
    console.log('✔ Claude Skill installed')
  }
  else if (type === INTEGRATION_TYPES.GENERIC) {
    await installGenericIntegration(
      libraryName,
      integrationName,
      integration.summary
    )
    console.log('✔ Generic integration installed')
  }
}

/**
 * Installs a Claude Skill by creating a symlink
 * @param {string} integrationName - Integration name
 * @param {string} libraryPath - Path to library root
 * @returns {Promise<void>}
 */
async function installClaudeSkill(integrationName, libraryPath) {
  const claudeSkillsDir = DEFAULT_CONFIG.registryFiles.claudeSkillsDir

  // Determine integration directory name (convert PascalCase to kebab-case)
  const integrationDirName = integrationName
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()

  // Source path is the claude-skill directory in the library
  const sourcePath = `${libraryPath}/ai-ready/integrations/${integrationDirName}/claude-skill`

  // Create symlink
  await installClaudeSkillSymlink(claudeSkillsDir, integrationName, sourcePath)
}

/**
 * Installs a generic integration
 * @param {string} libraryName - Library name
 * @param {string} integrationName - Integration name
 * @param {string} summary - Integration summary
 * @returns {Promise<void>}
 */
async function installGenericIntegration(
  libraryName,
  integrationName,
  summary
) {
  // Use first generic file path (AGENTS.md or CLAUDE.md)
  const genericFile = DEFAULT_CONFIG.registryFiles.generic[0]

  // Create backup
  await createBackup(genericFile)

  // Read existing entries
  const entries = await readGenericRegistry(
    DEFAULT_CONFIG.registryFiles.generic
  )

  // Check if already exists
  const exists = entries.some(
    (e) => e.library === libraryName && e.integration === integrationName
  )

  if (!exists) {
    entries.push({
      library     : libraryName,
      integration : integrationName,
      summary,
    })

    await writeGenericRegistry(genericFile, entries)
  }
}
