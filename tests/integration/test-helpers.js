/**
 * Test helpers for integration tests (v2.0.0)
 * @module tests/integration/test-helpers
 */
import { execFile } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Resolve project root
 * @returns {string} Project root path
 */
export function getProjectRoot() {
  const cwd = process.cwd()
  if (cwd.endsWith('test-staging')) {
    return path.resolve(cwd, '..')
  }

  return cwd
}

export const PROJECT_ROOT = getProjectRoot()
export const CLI_PATH = process.env.CLI_PATH || path.resolve(PROJECT_ROOT, 'dist/ai-ready-exec')

/**
 * Run CLI command
 * NOTE: Explicitly passes process.env to child processes for integration tests
 * that modify process.env.HOME to isolate Claude plugin directories.
 * @param {string[]} args - Command arguments
 * @param {string} cwd - Working directory
 * @param {object} [options] - Additional options
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>} CLI execution results
 */
export async function runCLI(args, cwd, options = {}) {
  try {
    // Use process.execPath to get full path to node executable
    // This avoids ENOENT errors when PATH might not be properly set
    const { stdout, stderr } = await execFileAsync(process.execPath, [CLI_PATH, ...args], {
      cwd,
      env : { ...process.env, ...options.env },
      ...options,
    })

    return { stdout, stderr, exitCode : 0 }
  }
  catch (error) {
    // For exec errors, exitCode is numeric, but error.code might be string like "ENOENT"
    // Use exitCode if available, otherwise default to 1
    const exitCode = typeof error.exitCode === 'number' ? error.exitCode : 1

    return {
      stdout : error.stdout || '',
      stderr : error.stderr || '',
      exitCode,
    }
  }
}

/**
 * Setup a test project with package.json and test plugins
 * @param {string} testDir - Test directory path
 * @param {object} [options] - Setup options
 * @param {string} [options.projectName='test-project'] - Project name
 * @returns {Promise<void>}
 */
export async function setupTestProject(testDir, options = {}) {
  const projectName = options.projectName || 'test-project'

  // Create package.json
  const packageJson = {
    name         : projectName,
    version      : '1.0.0',
    dependencies : {
      'test-plugin'    : '1.0.0',
      '@scoped/plugin' : '1.0.0',
    },
  }
  await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2))

  // Create package-lock.json
  const packageLock = {
    name            : projectName,
    version         : '1.0.0',
    lockfileVersion : 3,
    requires        : true,
    packages        : {
      '' : {
        name         : projectName,
        version      : '1.0.0',
        dependencies : packageJson.dependencies,
      },
    },
  }
  await fs.writeFile(path.join(testDir, 'package-lock.json'), JSON.stringify(packageLock, null, 2))

  // Create test plugins
  await createTestPackage(testDir, 'test-plugin', {
    name        : 'TestPlugin',
    version     : '1.0.0',
    description : 'Test plugin for integration testing',
    skillPath   : '.claude-plugin/skill',
  })

  await createTestPackage(testDir, '@scoped/plugin', {
    name        : 'ScopedPlugin',
    version     : '2.0.0',
    description : 'Scoped test plugin',
    skillPath   : '.claude-plugin/skill',
  })

  // Setup Claude settings directory
  const claudeDir = path.join(testDir, '.claude')
  await fs.mkdir(claudeDir, { recursive : true })

  const settingsPath = path.join(claudeDir, 'settings.json')
  const initialSettings = {
    plugins : {
      enabled      : [],
      disabled     : [],
      marketplaces : {},
    },
  }
  await fs.writeFile(settingsPath, JSON.stringify(initialSettings, null, 2))
}

/**
 * Create a test package with .claude-plugin/marketplace.json
 * @param {string} baseDir - Base directory
 * @param {string} packageName - Package name
 * @param {object} pluginDeclaration - Plugin declaration
 * @returns {Promise<string>} Package path
 */
export async function createTestPackage(baseDir, packageName, pluginDeclaration) {
  const nodeModulesPath = path.join(baseDir, 'node_modules')
  const packagePath = path.join(nodeModulesPath, packageName)

  // Create package directory
  await fs.mkdir(packagePath, { recursive : true })

  // Write package.json
  const packageJson = {
    name        : packageName,
    version     : pluginDeclaration.version || '1.0.0',
    description : pluginDeclaration.description || 'Test package',
  }
  await fs.writeFile(path.join(packagePath, 'package.json'), JSON.stringify(packageJson, null, 2))

  // Write .claude-plugin/marketplace.json
  const pluginDir = path.join(packagePath, '.claude-plugin')
  await fs.mkdir(pluginDir, { recursive : true })
  await fs.writeFile(path.join(pluginDir, 'marketplace.json'), JSON.stringify(pluginDeclaration, null, 2))

  // Create skill directory with SKILL.md
  const skillPath = path.join(packagePath, pluginDeclaration.skillPath || '.claude-plugin/skill')
  await fs.mkdir(skillPath, { recursive : true })
  await fs.writeFile(
    path.join(skillPath, 'SKILL.md'),
    `# ${pluginDeclaration.name}\n\n${pluginDeclaration.description}`
  )

  return packagePath
}

/**
 * Read JSON file
 * @param {string} filePath - File path
 * @returns {Promise<object>} Parsed JSON
 */
export async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8')

    return JSON.parse(content)
  }
  catch (error) {
    if (error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

/**
 * Read text file
 * @param {string} filePath - File path
 * @returns {Promise<string>} File content
 */
export async function readFile(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8')
  }
  catch (error) {
    if (error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

/**
 * Check if file exists
 * @param {string} filePath - File path
 * @returns {Promise<boolean>} True if exists
 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath)

    return true
  }
  catch {
    return false
  }
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Alias for createTestPackage (for clarity in test code)
 * @param {string} baseDir - Base directory
 * @param {string} packageName - Package name
 * @param {object} pluginDeclaration - Plugin declaration
 * @returns {Promise<string>} Package path
 */
export const createPluginPackage = createTestPackage

/**
 * Setup multiple test projects with independent environments
 * @param {object[]} projects - Array of project configurations
 * @param {string} projects[].name - Project name
 * @param {string} projects[].dir - Project directory path
 * @param {object[]} projects[].plugins - Plugin declarations array
 * @returns {Promise<{projects: Array<{name: string, dir: string, settingsPath: string}>}>} Project environments
 */
export async function setupMultiProjectEnv(projects) {
  const results = []

  for (const project of projects) {
    const { name, dir, plugins = [] } = project

    // Create package.json with dependencies
    const dependencies = plugins.reduce((acc, plugin) => {
      acc[plugin.packageName] = '1.0.0'

      return acc
    }, {})

    const packageJson = {
      name,
      version : '1.0.0',
      dependencies,
    }
    await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify(packageJson, null, 2))

    // Create package-lock.json
    const packageLock = {
      name,
      version         : '1.0.0',
      lockfileVersion : 3,
      requires        : true,
      packages        : {
        '' : {
          name,
          version : '1.0.0',
          dependencies,
        },
      },
    }
    await fs.writeFile(path.join(dir, 'package-lock.json'), JSON.stringify(packageLock, null, 2))

    // Create test packages
    for (const plugin of plugins) {
      await createTestPackage(dir, plugin.packageName, plugin.declaration)
    }

    // Setup Claude settings
    const claudeDir = path.join(dir, '.claude')
    await fs.mkdir(claudeDir, { recursive : true })
    const settingsPath = path.join(claudeDir, 'settings.json')
    const initialSettings = {
      plugins : {
        enabled      : [],
        disabled     : [],
        marketplaces : {},
      },
    }
    await fs.writeFile(settingsPath, JSON.stringify(initialSettings, null, 2))

    results.push({
      name,
      dir,
      settingsPath,
    })
  }

  return { projects : results }
}

/**
 * Corrupt a settings file with invalid JSON
 * @param {string} settingsPath - Path to settings.json file
 * @param {string} [corruptionType='invalid-json'] - Type of corruption
 * @returns {Promise<void>}
 */
export async function corruptSettingsFile(settingsPath, corruptionType = 'invalid-json') {
  switch (corruptionType) {
    case 'invalid-json':
      await fs.writeFile(settingsPath, '{ "plugins": { "enabled": [') // Missing closing brackets
      break

    case 'missing-plugins-section':
      await fs.writeFile(settingsPath, JSON.stringify({ someOtherKey : 'value' }, null, 2))
      break

    case 'empty-file':
      await fs.writeFile(settingsPath, '')
      break

    case 'malformed-structure':
      await fs.writeFile(settingsPath, JSON.stringify({ plugins : 'not-an-object' }, null, 2))
      break

    default:
      throw new Error(`Unknown corruption type: ${corruptionType}`)
  }
}

/**
 * Verify settings structure matches expected format
 * @param {object} settings - Settings object to verify
 * @param {object} expected - Expected structure (partial match)
 * @returns {object} Verification result with detailed errors
 */
export function verifySettingsStructure(settings, expected) {
  const errors = []

  // Check plugins section exists
  if (!settings.plugins) {
    errors.push('Missing plugins section')

    return { valid : false, errors }
  }

  // Check enabled array
  if (expected.enabled !== undefined) {
    if (!Array.isArray(settings.plugins.enabled)) {
      errors.push('plugins.enabled is not an array')
    }
    else if (expected.enabled.length !== undefined && settings.plugins.enabled.length !== expected.enabled.length) {
      errors.push(`Expected ${expected.enabled.length} enabled plugins, got ${settings.plugins.enabled.length}`)
    }
    // Check specific plugins if provided
    if (Array.isArray(expected.enabled)) {
      for (const expectedPlugin of expected.enabled) {
        if (!settings.plugins.enabled.includes(expectedPlugin)) {
          errors.push(`Expected plugin "${expectedPlugin}" not found in enabled array`)
        }
      }
    }
  }

  // Check disabled array
  if (expected.disabled !== undefined) {
    if (!Array.isArray(settings.plugins.disabled)) {
      errors.push('plugins.disabled is not an array')
    }
    else if (Array.isArray(expected.disabled)) {
      for (const expectedPlugin of expected.disabled) {
        if (!settings.plugins.disabled.includes(expectedPlugin)) {
          errors.push(`Expected plugin "${expectedPlugin}" not found in disabled array`)
        }
      }
    }
  }

  // Check marketplaces
  if (expected.marketplaces !== undefined) {
    if (typeof settings.plugins.marketplaces !== 'object') {
      errors.push('plugins.marketplaces is not an object')
    }
    else {
      for (const [marketplaceName, marketplaceConfig] of Object.entries(expected.marketplaces)) {
        if (!settings.plugins.marketplaces[marketplaceName]) {
          errors.push(`Expected marketplace "${marketplaceName}" not found`)
        }
        else {
          const actualMarketplace = settings.plugins.marketplaces[marketplaceName]

          // Verify source path if provided
          if (marketplaceConfig.sourcePath && actualMarketplace.source?.path !== marketplaceConfig.sourcePath) {
            errors.push(
              `Marketplace "${marketplaceName}" has wrong source path: `
                + `expected "${marketplaceConfig.sourcePath}", got "${actualMarketplace.source?.path}"`
            )
          }

          // Verify plugins in marketplace
          if (marketplaceConfig.plugins) {
            for (const pluginName of Object.keys(marketplaceConfig.plugins)) {
              if (!actualMarketplace.plugins?.[pluginName]) {
                errors.push(`Plugin "${pluginName}" not found in marketplace "${marketplaceName}"`)
              }
            }
          }
        }
      }
    }
  }

  return {
    valid : errors.length === 0,
    errors,
  }
}
