import fs from 'fs/promises'
import path from 'path'
import simpleGit from 'simple-git'
import { find as findPlus } from 'find-plus'
import { parseFrontmatter } from './parsers/frontmatter'
import { INTEGRATION_TYPES, SOURCE_TYPE } from './types'
import { loadConfig } from './storage/config'
import { isRepoCloned, getRepoPath } from './storage/remote-repos'

/**
 * @import { Integration, IntegrationProvider, RemoteRepoProvider } from './types.js'
 */

/**
 * Scans both npm and remote sources for integrations
 * @param {object} options - Scan options
 * @param {string} [options.baseDir=process.cwd()] - Base directory for npm scan
 * @param {string} [options.source='all'] - Source type to scan ('npm', 'remote', or 'all')
 * @returns {Promise<{npmProviders: IntegrationProvider[], remoteProviders: RemoteRepoProvider[]}>} Scan results
 */
export async function scanAll(options = {}) {
  const { baseDir = process.cwd(), source = SOURCE_TYPE.ALL } = options

  const results = {
    npmProviders    : [],
    remoteProviders : [],
  }

  if (source === SOURCE_TYPE.ALL || source === SOURCE_TYPE.NPM) {
    results.npmProviders = await scanNpmProviders(baseDir)
  }

  if (source === SOURCE_TYPE.ALL || source === SOURCE_TYPE.REMOTE) {
    results.remoteProviders = await scanRemoteProviders()
  }

  return results
}

/**
 * Scans npm node_modules for integrations
 * @param {string} [baseDir=process.cwd()] - Base directory for scan
 * @returns {Promise<IntegrationProvider[]>} Array of npm providers
 */
export async function scanNpmProviders(baseDir = process.cwd()) {
  return await scanForProviders(['node_modules'], baseDir)
}

/**
 * Scans remote repositories for integrations
 * @returns {Promise<RemoteRepoProvider[]>} Array of remote providers
 */
export async function scanRemoteProviders() {
  const config = await loadConfig()
  const providers = []

  await Promise.all(
    config.repos.map(async (repo) => {
      // Skip if not cloned
      if (!(await isRepoCloned(repo))) {
        return
      }

      const repoPath = getRepoPath(repo.id)

      // Get current commit SHA
      let commitSHA = null
      try {
        const git = simpleGit(repoPath)
        const log = await git.log({ maxCount : 1 })
        commitSHA = log.latest?.hash || null
      }
      catch {
        // Git error - skip this repo
        return
      }

      // Scan for integrations
      const integrations = await scanRepoIntegrations(repoPath, repo)

      if (integrations.length > 0) {
        providers.push({
          repoId    : repo.id,
          repoUrl   : repo.url,
          repoName  : repo.name,
          commitSHA : commitSHA || '',
          scannedAt : new Date().toISOString(),
          integrations,
        })
      }
    })
  )

  return providers
}

/**
 * Scans a repository for integrations
 * @param {string} repoPath - Absolute path to repository
 * @param {object} repo - Repository metadata
 * @returns {Promise<Integration[]>} Array of integrations
 */
async function scanRepoIntegrations(repoPath, repo) {
  const integrationsPath = path.join(repoPath, 'ai-ready', 'integrations')

  try {
    await fs.access(integrationsPath)
  }
  catch {
    // No ai-ready/integrations directory
    return []
  }

  const integrations = await scanIntegrations(integrationsPath)

  // Add source metadata to each integration
  integrations.forEach((integration) => {
    integration.source = {
      type      : 'remote',
      repoId    : repo.id,
      repoName  : repo.name,
      repoUrl   : repo.url,
      commitSHA : repo.lastReviewedCommit || '',
      path      : repoPath,
    }
  })

  return integrations
}

/**
 * Scans a list of paths for ai-ready libraries
 * @param {string[]} scanPaths - Paths to scan (e.g., ['node_modules'])
 * @param {string} [baseDir=process.cwd()] - Base directory for relative paths
 * @returns {Promise<IntegrationProvider[]>} Array of discovered providers
 */
export async function scanForProviders(scanPaths, baseDir = process.cwd()) {
  // Scan all paths in parallel
  const scanResults = await Promise.all(
    scanPaths.map(async (scanPath) => {
      const fullScanPath = path.resolve(baseDir, scanPath)

      try {
        // Use find-plus to locate all 'ai-ready/integrations' directories
        const results = await findPlus({
          root         : fullScanPath,
          onlyDirs     : true,
          paths        : ['**/ai-ready/integrations'],
          excludePaths : ['**/node_modules/**'], // Avoid nested node_modules
          depth        : 4, // node_modules/[scope/]package/ai-ready/integrations
        })

        // Process each found integration directory
        // Note: find-plus returns an array of string paths, not objects
        const providers = await Promise.all(
          // the 'await' is on the 'Promise.all(...)' above
          // eslint-disable-next-line require-await
          results.map(async (integrationsPath) => {
            // Extract library path (parent of 'ai-ready/integrations')
            const libraryPath = path.dirname(path.dirname(integrationsPath))

            // Determine library name from path
            const relativePath = path.relative(fullScanPath, libraryPath)
            const libraryName = relativePath.replace(/\\/g, '/') // Normalize Windows paths

            return scanLibrary(libraryName, libraryPath)
          })
        )

        return providers.filter((provider) => !!provider)
      }
      catch (error) {
        // Scan path doesn't exist or can't be read
        if (error.code !== 'ENOENT' && !error.message?.includes('Did not find root directory')) {
          throw error
        }

        return []
      }
    })
  )

  // Flatten results from all scan paths
  return scanResults.flat()
}

/**
 * Scans a single library for integrations
 * @param {string} libraryName - Name of the library
 * @param {string} libraryPath - Absolute path to library
 * @returns {Promise<IntegrationProvider|null>} Provider object or null
 */
async function scanLibrary(libraryName, libraryPath) {
  // Read package.json for version
  const packageJsonPath = path.join(libraryPath, 'package.json')
  let version = 'unknown'

  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
    version = packageJson.version || 'unknown'
  }
  catch {
    // package.json doesn't exist or is invalid
  }

  // Scan integrations
  const integrationsPath = path.join(libraryPath, 'ai-ready', 'integrations')
  const integrations = await scanIntegrations(integrationsPath)

  if (integrations.length === 0) {
    return null
  }

  // Add npm source metadata to each integration
  integrations.forEach((integration) => {
    integration.source = {
      type           : 'npm',
      packageName    : libraryName,
      packageVersion : version,
      path           : libraryPath,
    }
  })

  return {
    libraryName,
    version,
    path : libraryPath,
    integrations,
  }
}

/**
 * Scans integrations directory
 * @param {string} integrationsPath - Path to ai-ready/integrations
 * @returns {Promise<Integration[]>} Array of integrations
 */
async function scanIntegrations(integrationsPath) {
  const scans = []
  try {
    const entries = await fs.readdir(integrationsPath, { withFileTypes : true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const integrationPath = path.join(integrationsPath, entry.name)
      scans.push(scanIntegration(entry.name, integrationPath))
    }
  }
  catch {
    // integrations directory doesn't exist or can't be read
  }

  const integrations = (await Promise.all(scans)).filter((integration) => !!integration)

  return integrations
}

/**
 * Scans a single integration directory
 * @param {string} integrationName - Name of the integration directory
 * @param {string} integrationPath - Path to integration directory
 * @returns {Promise<Integration|null>} Integration object or null
 */
async function scanIntegration(integrationName, integrationPath) {
  const types = []
  let name = integrationName
  let summary = ''

  // Check for generic integration (AI_INTEGRATION.md)
  const genericPath = path.join(integrationPath, 'AI_INTEGRATION.md')
  const genericMetadata = await parseFrontmatter(genericPath)

  if (genericMetadata) {
    types.push(INTEGRATION_TYPES.GENERIC)
    name = genericMetadata.name
    summary = genericMetadata.summary
  }

  // Check for Claude Skill (claude-skill/SKILL.md)
  const skillPath = path.join(integrationPath, 'claude-skill', 'SKILL.md')
  const skillMetadata = await parseFrontmatter(skillPath)

  if (skillMetadata) {
    types.push(INTEGRATION_TYPES.CLAUDE_SKILL)
    // Prefer skill metadata if generic wasn't found
    if (!name || name === integrationName) {
      name = skillMetadata.name
    }
    if (!summary) {
      summary = skillMetadata.summary
    }
  }

  // Must have at least one type
  if (types.length === 0) {
    return null
  }

  return {
    name,
    dirName        : integrationName, // Preserve actual directory name for path construction
    summary,
    types,
    installedTypes : [], // Will be populated by registry reader
  }
}
