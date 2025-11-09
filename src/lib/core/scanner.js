import fs from 'fs/promises'
import path from 'path'
import { parseFrontmatter } from '../parsers/frontmatter.js'
import { INTEGRATION_TYPES } from './types.js'

/**
 * @import { Integration, IntegrationProvider } from './types.js'
 */

/**
 * Scans a list of paths for ai-ready libraries
 * @param {string[]} scanPaths - Paths to scan (e.g., ['node_modules'])
 * @param {string} [baseDir=process.cwd()] - Base directory for relative paths
 * @returns {Promise<IntegrationProvider[]>} Array of discovered providers
 */
export async function scanForProviders(scanPaths, baseDir = process.cwd()) {
  const scanPathPromises = scanPaths.map(async (scanPath) => {
    const fullScanPath = path.resolve(baseDir, scanPath)

    try {
      const entries = await fs.readdir(fullScanPath, { withFileTypes : true })

      const libraryPromises = entries.map(async (entry) => {
        if (!entry.isDirectory()) return null

        const libraryPath = path.join(fullScanPath, entry.name)
        const aiReadyPath = path.join(libraryPath, 'ai-ready', 'integrations')

        // Check if ai-ready/integrations exists
        try {
          const stat = await fs.stat(aiReadyPath)
          if (!stat.isDirectory()) return null
        }
        catch {
          return null // ai-ready directory doesn't exist
        }

        // This library has ai-ready integrations
        return scanLibrary(entry.name, libraryPath)
      })

      return Promise.all(libraryPromises)
    }
    catch (error) {
      // Scan path doesn't exist or can't be read
      if (error.code !== 'ENOENT') {
        throw error
      }

      return []
    }
  })

  const results = await Promise.all(scanPathPromises)
  const providers = results.flat().filter((provider) => !!provider)

  return providers
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

  const integrations = (await Promise.all(scans)).filter(
    (integration) => !!integration
  )

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
    summary,
    types,
    installedTypes : [], // Will be populated by registry reader
  }
}
