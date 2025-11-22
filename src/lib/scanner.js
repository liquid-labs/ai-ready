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
 * Scan node_modules for packages with .claude-plugin/marketplace.json
 * @param {string} baseDir - Project root directory
 * @returns {Promise<PluginProvider[]>} Discovered plugin providers
 */
export async function scanDependencies(baseDir = process.cwd()) {
  const nodeModulesPath = path.resolve(baseDir, 'node_modules')

  try {
    await fs.access(nodeModulesPath)
  }
  catch {
    return [] // No node_modules directory
  }

  const packages = await enumeratePackages(nodeModulesPath)

  // Scan packages in parallel
  const results = await Promise.all(
    packages.map((pkg) => scanPackage(pkg))
  )

  // Filter out null results (packages without plugins)
  return results.filter((provider) => provider !== null)
}

/**
 * Enumerate all packages in node_modules (including scoped)
 * @param {string} nodeModulesPath - Path to node_modules
 * @returns {Promise<string[]>} Array of absolute package paths
 */
async function enumeratePackages(nodeModulesPath) {
  const packages = []
  const entries = await fs.readdir(nodeModulesPath, { withFileTypes : true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const entryPath = path.join(nodeModulesPath, entry.name)

    // Handle scoped packages (@org/package)
    if (entry.name.startsWith('@')) {
      // eslint-disable-next-line no-await-in-loop
      const scopedEntries = await fs.readdir(entryPath, { withFileTypes : true })
      for (const scopedEntry of scopedEntries) {
        if (scopedEntry.isDirectory()) {
          packages.push(path.join(entryPath, scopedEntry.name))
        }
      }
    }
    else {
      packages.push(entryPath)
    }
  }

  return packages
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

  return {
    packageName,
    version,
    path              : packagePath,
    pluginDeclaration : declaration,
  }
}
