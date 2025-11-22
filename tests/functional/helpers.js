/**
 * Test helpers for functional/CLI-level testing
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
const CLI_PATH = path.resolve(PROJECT_ROOT, 'dist/ai-ready-exec.js')

/**
 * Path to the fixture test package
 */
const FIXTURE_PACKAGE_PATH = path.resolve(PROJECT_ROOT, 'tests/fixtures/test-air-package')

/**
 * Create package.json for test environment
 * @returns {object} Package.json content
 */
function createTestPackageJson() {
  return {
    name         : 'test-project',
    version      : '1.0.0',
    dependencies : {
      'test-air-package'         : '1.0.0',
      '@ai-ready/scoped-package' : '1.0.0',
    },
  }
}

/**
 * Create package-lock.json for test environment
 * @returns {object} Package-lock.json content
 */
function createTestPackageLockJson() {
  return {
    name            : 'test-project',
    version         : '1.0.0',
    lockfileVersion : 3,
    requires        : true,
    packages        : {
      '' : {
        name         : 'test-project',
        version      : '1.0.0',
        dependencies : {
          'test-air-package'         : '1.0.0',
          '@ai-ready/scoped-package' : '1.0.0',
        },
      },
      'node_modules/test-air-package' : {
        version  : '1.0.0',
        resolved : 'file:../tests/fixtures/test-air-package',
      },
      'node_modules/@ai-ready/scoped-package' : {
        version  : '1.0.0',
        resolved : 'file:../tests/fixtures/test-air-package',
      },
    },
  }
}

/**
 * Run the ai-ready CLI with given arguments
 * @param {string[]} args - Command arguments
 * @param {string} cwd - Working directory
 * @param {object} [options] - Additional options
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
    // execFile throws on non-zero exit codes
    // Return error details for test assertions
    return {
      stdout   : error.stdout || '',
      stderr   : error.stderr || '',
      exitCode : error.code || 1,
    }
  }
}

/**
 * Setup a test environment with temp directory and fixture package
 * @returns {Promise<{testDir: string, nodeModulesDir: string, cleanup: Function}>} Test environment configuration
 */
export async function setupTestEnv() {
  // Create temp directory
  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-ready-test-'))

  // Create node_modules directory
  const nodeModulesDir = path.join(testDir, 'node_modules')
  await fs.mkdir(nodeModulesDir)

  // Copy fixture package to node_modules/test-air-package
  await copyDir(FIXTURE_PACKAGE_PATH, path.join(nodeModulesDir, 'test-air-package'))

  // Create scoped package @ai-ready/scoped-package with same structure
  const scopedDir = path.join(nodeModulesDir, '@ai-ready')
  await fs.mkdir(scopedDir, { recursive : true })
  await copyDir(FIXTURE_PACKAGE_PATH, path.join(scopedDir, 'scoped-package'))

  // Update package.json for the scoped package
  const scopedPackageJsonPath = path.join(scopedDir, 'scoped-package', 'package.json')
  const scopedPkgJson = JSON.parse(await fs.readFile(scopedPackageJsonPath, 'utf8'))
  scopedPkgJson.name = '@ai-ready/scoped-package'
  await fs.writeFile(scopedPackageJsonPath, JSON.stringify(scopedPkgJson, null, 2))

  // Create package.json and package-lock.json in test directory
  await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify(createTestPackageJson(), null, 2))
  await fs.writeFile(path.join(testDir, 'package-lock.json'), JSON.stringify(createTestPackageLockJson(), null, 2))

  // Cleanup function
  const cleanup = async () => {
    try {
      await fs.rm(testDir, { recursive : true, force : true })
    }
    catch {
      // Silently ignore cleanup errors
    }
  }

  return { testDir, nodeModulesDir, cleanup }
}

/**
 * Recursively copy directory
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 */
async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive : true })
  const entries = await fs.readdir(src, { withFileTypes : true })

  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath)
      }
      else {
        await fs.copyFile(srcPath, destPath)
      }
    })
  )
}

/**
 * Read a JSON file
 * @param {string} filePath - Path to JSON file
 * @returns {Promise<object | null>} Parsed JSON object or null if file not found
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
 * Read a text file
 * @param {string} filePath - Path to file
 * @returns {Promise<string|null>} File contents or null if file not found
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
 * @param {string} filePath - Path to file
 * @returns {Promise<boolean>} True if file exists, false otherwise
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
 * Parse markdown table to extract integration entries
 * @param {string} content - Markdown content
 * @returns {Array<{name: string, library: string, summary: string}>} Array of parsed integration entries
 */
export function parseMarkdownTable(content) {
  const entries = []
  const lines = content.split('\n')
  let inTable = false

  for (const line of lines) {
    // Table can start with either "| Name |" or "| Library |" (actual format uses "Library | Integration | Summary | Installed")
    if (line.startsWith('| Name |') || line.startsWith('| Library')) {
      inTable = true
      continue
    }
    if (line.startsWith('|---')) {
      continue
    }
    if (inTable && line.startsWith('|')) {
      const cells = line
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean)
      if (cells.length >= 4) {
        // Actual format: Library | Integration | Summary | Installed
        entries.push({
          library : cells[0],
          name    : cells[1], // Integration column becomes 'name'
          summary : cells[2],
        })
      }
    }
    if (inTable && !line.startsWith('|')) {
      inTable = false
    }
  }

  return entries
}

/**
 * Create a mock Claude plugin directory structure for testing
 * @param {string} baseDir - Base directory for plugin files
 * @returns {Promise<{pluginsDir: string, installedPluginsPath: string, marketplacesPath: string}>} Plugin directory paths
 */
export async function setupClaudePluginDir(baseDir) {
  const pluginsDir = path.join(baseDir, '.claude', 'plugins')
  await fs.mkdir(pluginsDir, { recursive : true })

  const installedPluginsPath = path.join(pluginsDir, 'installed_plugins.json')
  const marketplacesPath = path.join(pluginsDir, 'known_marketplaces.json')

  // Initialize empty plugin files with correct structure
  await fs.writeFile(installedPluginsPath, JSON.stringify({ version : 1, plugins : {} }, null, 2))
  await fs.writeFile(marketplacesPath, JSON.stringify({}, null, 2))

  return { pluginsDir, installedPluginsPath, marketplacesPath }
}
