import fs from 'fs/promises'
import path from 'path'

/**
 * Helper to create or update root package.json with dependencies
 * @param {string} baseDir - Base directory
 * @param {string[]} dependencies - Package names to add as dependencies
 * @returns {Promise<void>}
 */
export async function createPackageJson(baseDir, dependencies) {
  const packageJsonPath = path.join(baseDir, 'package.json')

  // Check if package.json already exists
  let packageJson = { name : 'test-project', version : '1.0.0' }
  try {
    const existing = await fs.readFile(packageJsonPath, 'utf8')
    packageJson = JSON.parse(existing)
  }
  catch {
    // File doesn't exist or is invalid, use defaults
  }

  // Add/update dependencies
  packageJson.dependencies = packageJson.dependencies || {}
  for (const dep of dependencies) {
    packageJson.dependencies[dep] = '1.0.0'
  }

  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8')
}

/**
 * Helper to create a test package with .claude-plugin/marketplace.json
 * @param {string} baseDir - Base directory (should contain or will create node_modules)
 * @param {string} packageName - Package name (supports scoped: @org/pkg)
 * @param {object} marketplaceDeclaration - marketplace.json content (can be full marketplace or legacy plugin format)
 * @returns {Promise<string>} Absolute path to created package
 */
export async function createTestPackage(baseDir, packageName, marketplaceDeclaration) {
  const nodeModulesPath = path.join(baseDir, 'node_modules')
  const packagePath = path.join(nodeModulesPath, packageName)

  // Create package directory structure
  await fs.mkdir(packagePath, { recursive : true })

  // Normalize marketplace name from package name
  const normalizedName = packageName.replace(/^@/, '').replace(/\//g, '-').toLowerCase()
  const marketplaceName = `${normalizedName}-marketplace`

  // Convert legacy format to new marketplace format if needed
  let marketplace
  if (marketplaceDeclaration.plugins && Array.isArray(marketplaceDeclaration.plugins)) {
    // Already in new format
    marketplace = marketplaceDeclaration
  }
  else {
    // Legacy format - convert to new format
    marketplace = {
      name    : marketplaceName,
      owner   : { name : 'Test Owner' },
      plugins : [
        {
          name        : marketplaceDeclaration.name,
          source      : './plugin',
          version     : marketplaceDeclaration.version || '1.0.0',
          description : marketplaceDeclaration.description,
        },
      ],
    }
  }

  // Write package.json
  const firstPlugin = marketplace.plugins[0]
  const packageJson = {
    name        : packageName,
    version     : firstPlugin?.version || '1.0.0',
    description : firstPlugin?.description || 'Test package',
  }
  await fs.writeFile(path.join(packagePath, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf8')

  // Write .claude-plugin/marketplace.json
  const pluginDir = path.join(packagePath, '.claude-plugin')
  await fs.mkdir(pluginDir, { recursive : true })
  await fs.writeFile(path.join(pluginDir, 'marketplace.json'), JSON.stringify(marketplace, null, 2), 'utf8')

  // Create plugin directories for each plugin in the marketplace
  for (const plugin of marketplace.plugins) {
    const pluginSourcePath = typeof plugin.source === 'string' ? plugin.source : './plugin'
    const pluginPath = path.join(packagePath, pluginSourcePath)
    await fs.mkdir(pluginPath, { recursive : true })
    await fs.writeFile(
      path.join(pluginPath, 'SKILL.md'),
      `# ${plugin.name}\n\n${plugin.description || 'Test plugin'}`,
      'utf8'
    )
  }

  return packagePath
}
