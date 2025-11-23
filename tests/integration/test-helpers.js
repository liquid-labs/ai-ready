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
export const CLI_PATH = process.env.CLI_PATH || path.resolve(PROJECT_ROOT, 'dist/ai-ready-exec.js')

/**
 * Run CLI command
 * NOTE: Explicitly passes process.env to child processes for integration tests
 * that modify process.env.HOME to isolate Claude plugin directories.
 * @param {string[]} args - Command arguments
 * @param {string} cwd - Working directory
 * @param {object} [options] - Additional options
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
export async function runCLI(args, cwd, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args], {
      cwd,
      env : { ...process.env, ...options.env },
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
async function createTestPackage(baseDir, packageName, pluginDeclaration) {
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
