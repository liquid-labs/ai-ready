import fs from 'fs/promises'
import path from 'path'

import { parseMarketplaceJson } from './parsers/marketplace-json'

/**
 * @import { PluginProvider } from './types.js'
 */

// ===========================================================================
// TEMPORARY: Old exports kept for backward compatibility during migration
// These will be removed in Phase 5
// ===========================================================================

/**
 * Temporary stub for backward compatibility
 * @deprecated Use scanDependencies() instead
 * @returns {Promise<object>} Empty scan results
 */
// eslint-disable-next-line require-await
export async function scanAll() {
  return {
    npmProviders    : [],
    remoteProviders : [],
  }
}

/**
 * Temporary stub for backward compatibility
 * @deprecated Use scanDependencies() instead
 * @returns {Promise<Array>} Empty array
 */
// eslint-disable-next-line require-await
export async function scanNpmProviders() {
  return []
}

/**
 * Temporary stub for backward compatibility
 * @deprecated Use scanDependencies() instead
 * @returns {Promise<Array>} Empty array
 */
// eslint-disable-next-line require-await
export async function scanRemoteProviders() {
  return []
}

/**
 * Temporary stub for backward compatibility
 * @deprecated Use scanDependencies() instead
 * @returns {Promise<Array>} Empty array
 */
// eslint-disable-next-line require-await
export async function scanForProviders() {
  return []
}

// ===========================================================================
// New scanner implementation (v2.0.0)
// ===========================================================================

/**
 * Scan direct dependencies for packages with .claude-plugin/marketplace.json
 * Only scans packages listed in dependencies and devDependencies in package.json
 * @param {string} baseDir - Project root directory
 * @returns {Promise<PluginProvider[]>} Discovered plugin providers
 */
export async function scanDependencies(baseDir = process.cwd()) {
  const nodeModulesPath = path.resolve(baseDir, 'node_modules')
  const packageJsonPath = path.resolve(baseDir, 'package.json')

  // Read package.json to get dependency list
  let packageJson
  try {
    const content = await fs.readFile(packageJsonPath, 'utf8')
    packageJson = JSON.parse(content)
  }
  catch (error) {
    if (error.code === 'ENOENT') {
      return [] // No package.json, no dependencies to scan
    }
    throw error // Malformed package.json should be reported
  }

  // Get list of direct dependencies
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }
  const dependencyNames = Object.keys(dependencies)

  if (dependencyNames.length === 0) {
    return [] // No dependencies
  }

  // Check if node_modules exists
  try {
    await fs.access(nodeModulesPath)
  }
  catch {
    return [] // No node_modules directory
  }

  // Scan only listed dependencies
  const packagePaths = dependencyNames.map((name) => path.join(nodeModulesPath, name))

  // Scan packages in parallel
  const results = await Promise.all(packagePaths.map((pkg) => scanPackage(pkg)))

  // Filter out null results (packages without plugins)
  return results.filter((provider) => provider !== null)
}

/**
 * Scan a single package for plugin declaration
 * @param {string} packagePath - Absolute path to package
 * @returns {Promise<PluginProvider|null>} Provider or null if no plugin
 */
async function scanPackage(packagePath) {
  const marketplacePath = path.join(packagePath, '.claude-plugin', 'marketplace.json')

  // Try to parse marketplace.json
  const declaration = await parseMarketplaceJson(marketplacePath)
  if (!declaration) {
    return null
  }

  // Read package.json for version
  const packageJsonPath = path.join(packagePath, 'package.json')
  let packageName = path.basename(packagePath)
  let version = 'unknown'

  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
    packageName = packageJson.name || packageName
    version = packageJson.version || version
  }
  catch {
    // eslint-disable-next-line no-console
    console.warn(`Could not read package.json for ${packagePath}`)
  }

  // Resolve symlinks to get canonical path
  const canonicalPath = await fs.realpath(packagePath)

  return {
    packageName,
    version,
    path              : canonicalPath,
    pluginDeclaration : declaration,
  }
}
