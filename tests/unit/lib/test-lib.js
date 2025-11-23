import fs from 'fs/promises'
import path from 'path'

/**
 * Helper to create a test library structure for testing
 * @param {string} tempDir - Temporary directory base path
 * @param {string} libraryName - Name of the library to create
 * @param {Array<{dirName: string, generic?: {name: string, summary: string}, skill?: {name: string, summary: string}}>} integrations - Integration definitions
 * @returns {Promise<void>}
 */
export async function createTestLibrary(tempDir, libraryName, integrations) {
  const libraryPath = path.join(tempDir, 'node_modules', libraryName)
  await fs.mkdir(libraryPath, { recursive : true })

  // Create package.json
  await fs.writeFile(
    path.join(libraryPath, 'package.json'),
    JSON.stringify({ name : libraryName, version : '1.0.0' }, null, 2),
    'utf8'
  )

  // Create integrations
  for (const integration of integrations) {
    const integrationPath = path.join(libraryPath, 'ai-ready', 'integrations', integration.dirName)
    // eslint-disable-next-line no-await-in-loop
    await fs.mkdir(integrationPath, { recursive : true })

    if (integration.generic) {
      // eslint-disable-next-line no-await-in-loop
      await fs.writeFile(
        path.join(integrationPath, 'AI_INTEGRATION.md'),
        `---
name: ${integration.generic.name}
summary: ${integration.generic.summary}
---

# Generic Integration
`,
        'utf8'
      )
    }

    if (integration.skill) {
      const skillPath = path.join(integrationPath, 'claude-skill')
      // eslint-disable-next-line no-await-in-loop
      await fs.mkdir(skillPath, { recursive : true })
      // eslint-disable-next-line no-await-in-loop
      await fs.writeFile(
        path.join(skillPath, 'SKILL.md'),
        `---
name: ${integration.skill.name}
summary: ${integration.skill.summary}
---

# Claude Skill
`,
        'utf8'
      )
    }
  }
}

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

/**
 * Helper to create a test table for testing
 * @param {string} rows - Rows of the table
 * @returns {string} Test table
 * @private
 */
export const mkTable = (rows) =>
  `| Library | Integration | Summary | Installed |\n|---------|-------------|---------|-----------|${rows}`

/**
 * Helper to create a test provider for testing
 * @param {Array<{name: string, summary: string, types: string[]}>} integrations - Integration definitions
 * @returns {object} Test provider
 * @private
 */
export const makeProvider = (integrations) => ({
  libraryName  : 'test-lib',
  version      : '1.0.0',
  path         : '/path',
  integrations : integrations.map((int) => ({
    name    : int.name,
    summary : int.summary || 'Test',
    types   : int.types,
  })),
})
