/**
 * Shared test utilities for integration tests
 */
import { execFile } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Resolve project root (handles running from test-staging or project root)
 * @returns {string} Absolute path to project root
 */
export function getProjectRoot() {
  const cwd = process.cwd()
  // If running from test-staging, go up one level
  if (cwd.endsWith('test-staging')) {
    return path.resolve(cwd, '..')
  }

  return cwd
}

export const PROJECT_ROOT = getProjectRoot()

// Path to CLI
export const CLI_PATH = process.env.CLI_PATH || path.resolve(PROJECT_ROOT, 'dist/ai-ready-exec.js')
export const FIXTURE_PATH = process.env.FIXTURE_PATH || path.resolve(PROJECT_ROOT, 'tests/fixtures/test-air-package')

/**
 * Setup test project with test-air-package installed
 * @param {string} testDir - Test directory path
 * @param {object} [options] - Setup options
 * @param {string} [options.projectName='integration-test-project'] - Project name
 * @returns {Promise<void>}
 */
export async function setupTestProject(testDir, options = {}) {
  const projectName = options.projectName || 'integration-test-project'

  // Create package.json
  const packageJson = {
    name         : projectName,
    version      : '1.0.0',
    dependencies : {
      'test-air-package' : '1.0.0',
    },
  }
  await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2))

  // Create node_modules and copy fixture
  const nodeModulesDir = path.join(testDir, 'node_modules')
  await fs.mkdir(nodeModulesDir, { recursive : true })
  await copyDir(FIXTURE_PATH, path.join(nodeModulesDir, 'test-air-package'))

  // Create package-lock.json
  const packageLock = {
    name            : projectName,
    version         : '1.0.0',
    lockfileVersion : 3,
    requires        : true,
    packages        : {
      '' : {
        dependencies : {
          'test-air-package' : '1.0.0',
        },
      },
      'node_modules/test-air-package' : {
        version : '1.0.0',
      },
    },
  }
  await fs.writeFile(path.join(testDir, 'package-lock.json'), JSON.stringify(packageLock, null, 2))
}

/**
 * Recursively copy directory
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @returns {Promise<void>}
 */
export async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive : true })
  const entries = await fs.readdir(src, { withFileTypes : true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    }
    else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

/**
 * Run CLI command in test environment
 *
 * NOTE: This function explicitly passes process.env to child processes.
 * This is critical for integration tests that modify process.env.HOME
 * to isolate Claude plugin directories. Without explicit env passing,
 * child processes would inherit the original HOME value, not the modified one.
 * @param {string[]} args - CLI arguments
 * @param {string} cwd - Working directory
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export async function runCLI(args, cwd) {
  const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args], {
    cwd,
    env : process.env, // Explicitly pass environment variables including modified HOME
  })

  return { stdout, stderr }
}

/**
 * Read and parse JSON file, returns null if not found
 * @param {string} filePath - Path to JSON file
 * @returns {Promise<object|null>} Parsed JSON object or null if file doesn't exist
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
 * Read text file, returns null if not found
 * @param {string} filePath - Path to text file
 * @returns {Promise<string|null>} File contents or null if file doesn't exist
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
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
