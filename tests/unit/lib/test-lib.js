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
 * @param {object} pluginDeclaration - marketplace.json content
 * @returns {Promise<string>} Absolute path to created package
 */
export async function createTestPackage(baseDir, packageName, pluginDeclaration) {
  const nodeModulesPath = path.join(baseDir, 'node_modules')
  const packagePath = path.join(nodeModulesPath, packageName)

  // Create package directory structure
  await fs.mkdir(packagePath, { recursive : true })

  // Write package.json
  const packageJson = {
    name        : packageName,
    version     : pluginDeclaration.version || '1.0.0',
    description : pluginDeclaration.description || 'Test package',
  }
  await fs.writeFile(path.join(packagePath, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf8')

  // Write .claude-plugin/marketplace.json
  const pluginDir = path.join(packagePath, '.claude-plugin')
  await fs.mkdir(pluginDir, { recursive : true })
  await fs.writeFile(path.join(pluginDir, 'marketplace.json'), JSON.stringify(pluginDeclaration, null, 2), 'utf8')

  // Create skill directory with dummy SKILL.md
  const skillPath = path.join(packagePath, pluginDeclaration.skillPath || '.claude-plugin/skill')
  await fs.mkdir(skillPath, { recursive : true })
  await fs.writeFile(
    path.join(skillPath, 'SKILL.md'),
    `# ${pluginDeclaration.name}\n\n${pluginDeclaration.description}`,
    'utf8'
  )

  return packagePath
}
