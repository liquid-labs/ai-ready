/**
 * Test helpers for functional/CLI-level testing (v2.0.0)
 * @module tests/functional/helpers
 */
import { execFile } from 'child_process'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Resolve project root (handles running from test-staging or project root)
 * @returns {string} The project root directory path
 */
function getProjectRoot() {
  const cwd = process.cwd()
  // If running from test-staging, go up one level
  if (cwd.endsWith('test-staging')) {
    return path.resolve(cwd, '..')
  }

  return cwd
}

const PROJECT_ROOT = getProjectRoot()

/**
 * Path to the bundled CLI executable
 */
const CLI_PATH = path.resolve(PROJECT_ROOT, 'dist/ai-ready-exec')

/**
 * Run the ai-ready CLI with given arguments
 * @param {string[]} args - Command arguments
 * @param {string} cwd - Working directory
 * @param {object} [options] - Additional options (env, etc.)
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>} CLI execution result
 */
export async function runCLI(args, cwd, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args], {
      cwd,
      ...options,
    })

    return { stdout, stderr, exitCode : 0 }
  }
  catch (error) {
    return {
      stdout   : error.stdout || '',
      stderr   : error.stderr || '',
      exitCode : error.code || 1,
    }
  }
}

/**
 * Create a test environment with package.json and test packages
 * @param {object} [options] - Configuration options
 * @param {string[]} [options.dependencies] - Package names to include as dependencies
 * @returns {Promise<{testDir: string, cleanup: Function}>} Test environment
 */
export async function setupTestEnv(options = {}) {
  const { dependencies = ['test-plugin'] } = options

  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-func-test-'))

  // Create package.json
  const packageJson = {
    name         : 'test-project',
    version      : '1.0.0',
    dependencies : dependencies.reduce((acc, dep) => {
      acc[dep] = '1.0.0'

      return acc
    }, {}),
  }
  await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2))

  // Create package-lock.json
  const packageLock = {
    name            : 'test-project',
    version         : '1.0.0',
    lockfileVersion : 3,
    requires        : true,
    packages        : {
      '' : {
        name         : 'test-project',
        version      : '1.0.0',
        dependencies : packageJson.dependencies,
      },
    },
  }
  await fs.writeFile(path.join(testDir, 'package-lock.json'), JSON.stringify(packageLock, null, 2))

  // Cleanup function
  const cleanup = async () => {
    try {
      await fs.rm(testDir, { recursive : true, force : true })
    }
    catch {
      // Ignore cleanup errors
    }
  }

  return { testDir, cleanup }
}

/**
 * Create a test package with .claude-plugin/marketplace.json
 * @param {string} baseDir - Base test directory
 * @param {string} packageName - Package name (supports scoped: @org/pkg)
 * @param {object} pluginConfig - Plugin configuration
 * @param {string} pluginConfig.name - Plugin name (kebab-case)
 * @param {string} [pluginConfig.version] - Plugin version
 * @param {string} [pluginConfig.description] - Plugin description
 * @param {string} [pluginConfig.source] - Plugin source path
 * @returns {Promise<string>} Path to created package
 */
export async function createTestPackage(baseDir, packageName, pluginConfig) {
  const nodeModulesPath = path.join(baseDir, 'node_modules')
  const packagePath = path.join(nodeModulesPath, packageName)

  // Create package directory
  await fs.mkdir(packagePath, { recursive : true })

  // Derive marketplace name from package name (strip scope, add -marketplace)
  const basePackageName = packageName.replace(/^@[^/]+\//, '')
  const marketplaceName = `${basePackageName}-marketplace`

  // Write package.json
  const packageJson = {
    name        : packageName,
    version     : pluginConfig.version || '1.0.0',
    description : pluginConfig.description || 'Test package',
  }
  await fs.writeFile(path.join(packagePath, 'package.json'), JSON.stringify(packageJson, null, 2))

  // Create valid marketplace.json structure
  const marketplaceDeclaration = {
    name    : marketplaceName,
    owner   : { name : 'Test Owner' },
    plugins : [
      {
        name        : pluginConfig.name,
        source      : pluginConfig.source || './',
        version     : pluginConfig.version || '1.0.0',
        description : pluginConfig.description || 'Test plugin',
      },
    ],
  }

  // Write .claude-plugin/marketplace.json
  const pluginDir = path.join(packagePath, '.claude-plugin')
  await fs.mkdir(pluginDir, { recursive : true })
  await fs.writeFile(path.join(pluginDir, 'marketplace.json'), JSON.stringify(marketplaceDeclaration, null, 2))

  // Create plugin directory with plugin.json
  const pluginSourcePath = path.join(packagePath, pluginConfig.source || './')
  await fs.mkdir(pluginSourcePath, { recursive : true })
  const pluginManifest = {
    name        : pluginConfig.name,
    version     : pluginConfig.version || '1.0.0',
    description : pluginConfig.description || 'Test plugin',
  }
  await fs.writeFile(path.join(pluginSourcePath, 'plugin.json'), JSON.stringify(pluginManifest, null, 2))

  return packagePath
}

/**
 * Read JSON file
 * @param {string} filePath - Path to JSON file
 * @returns {Promise<object>} Parsed JSON
 */
export async function readJsonFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8')

  return JSON.parse(content)
}

/**
 * Check if file exists
 * @param {string} filePath - Path to file
 * @returns {Promise<boolean>} True if file exists
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
 * Setup Claude settings directory for testing
 * @param {string} homeDir - HOME directory path
 * @returns {Promise<string>} Path to settings file
 */
export async function setupClaudeSettings(homeDir) {
  const claudeDir = path.join(homeDir, '.claude')
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

  return settingsPath
}
