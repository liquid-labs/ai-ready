/**
 * Test helpers for integration tests (v2.0.0)
 * @module tests/integration/test-helpers
 */
const { execFile } = require('child_process')
const fs = require('fs/promises')
const path = require('path')
const { promisify } = require('util')

const { verifySettingsStructure } = require('./verify-helpers')

const execFileAsync = promisify(execFile)

/**
 * Resolve project root
 * @returns {string} Project root path
 */
function getProjectRoot() {
  const cwd = process.cwd()
  if (cwd.endsWith('test-staging')) {
    return path.resolve(cwd, '..')
  }

  return cwd
}

const PROJECT_ROOT = getProjectRoot()
const CLI_PATH = process.env.CLI_PATH || path.resolve(PROJECT_ROOT, 'dist/ai-ready-exec')

/**
 * Run CLI command
 * NOTE: Explicitly passes process.env to child processes for integration tests
 * that modify process.env.HOME to isolate Claude plugin directories.
 * @param {string[]} args - Command arguments
 * @param {string} cwd - Working directory
 * @param {object} [options] - Additional options
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>} CLI execution results
 */
async function runCLI(args, cwd, options = {}) {
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
async function setupTestProject(testDir, options = {}) {
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

  // Create test plugins (names must be kebab-case per schema)
  await createTestPackage(testDir, 'test-plugin', {
    name        : 'test-plugin',
    version     : '1.0.0',
    description : 'Test plugin for integration testing',
    source      : './',
  })

  await createTestPackage(testDir, '@scoped/plugin', {
    name        : 'scoped-plugin',
    version     : '2.0.0',
    description : 'Scoped test plugin',
    source      : './',
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
 * Create a package.json file with specified dependencies
 * @param {string} baseDir - Base directory
 * @param {string[]} dependencies - List of dependency package names
 * @returns {Promise<void>}
 */
async function createPackageJson(baseDir, dependencies = []) {
  const deps = {}
  for (const dep of dependencies) {
    deps[dep] = '1.0.0'
  }

  const packageJson = {
    name         : 'test-project',
    version      : '1.0.0',
    dependencies : deps,
  }

  await fs.writeFile(path.join(baseDir, 'package.json'), JSON.stringify(packageJson, null, 2))
}

/**
 * Create a test package with .claude-plugin/marketplace.json
 * @param {string} baseDir - Base directory
 * @param {string} packageName - Package name
 * @param {object} pluginConfig - Plugin configuration
 * @param {string} pluginConfig.name - Plugin name (kebab-case)
 * @param {string} [pluginConfig.version] - Plugin version
 * @param {string} [pluginConfig.description] - Plugin description
 * @param {string} [pluginConfig.source] - Plugin source path
 * @param {object[]} [pluginConfig.plugins] - Array of plugin entries (for multi-plugin packages)
 * @returns {Promise<string>} Package path
 */
async function createTestPackage(baseDir, packageName, pluginConfig) {
  const nodeModulesPath = path.join(baseDir, 'node_modules')
  const packagePath = path.join(nodeModulesPath, packageName)

  // Create package directory
  await fs.mkdir(packagePath, { recursive : true })

  // Build plugins array - support both single plugin and multi-plugin configs
  const plugins = pluginConfig.plugins || [
    {
      name        : pluginConfig.name,
      source      : pluginConfig.source || './',
      version     : pluginConfig.version || '1.0.0',
      description : pluginConfig.description || 'Test plugin',
    },
  ]

  // Derive marketplace name from package name (kebab-case, all lowercase)
  // For scoped packages (@scope/name), create: scope-name-marketplace
  // For non-scoped packages (name), create: name-marketplace
  // Replace dots, underscores, and slashes with hyphens, convert to lowercase
  const marketplaceName = packageName.replace(/^@/, '').replace(/[/._]/g, '-').toLowerCase() + '-marketplace'

  // Write package.json
  const packageJson = {
    name        : packageName,
    version     : pluginConfig.version || '1.0.0',
    description : pluginConfig.description || 'Test package',
  }
  await fs.writeFile(path.join(packagePath, 'package.json'), JSON.stringify(packageJson, null, 2))

  // Create valid marketplace.json structure
  const marketplaceDeclaration = {
    name  : marketplaceName,
    owner : { name : 'Test Owner' },
    plugins,
  }

  // Write .claude-plugin/marketplace.json
  const pluginDir = path.join(packagePath, '.claude-plugin')
  await fs.mkdir(pluginDir, { recursive : true })
  await fs.writeFile(path.join(pluginDir, 'marketplace.json'), JSON.stringify(marketplaceDeclaration, null, 2))

  // Create plugin directories with plugin.json for each plugin
  for (const plugin of plugins) {
    const pluginSourcePath = path.join(packagePath, plugin.source || './')
    await fs.mkdir(pluginSourcePath, { recursive : true })
    const pluginManifest = {
      name        : plugin.name,
      version     : plugin.version || '1.0.0',
      description : plugin.description || 'Test plugin',
    }
    await fs.writeFile(path.join(pluginSourcePath, 'plugin.json'), JSON.stringify(pluginManifest, null, 2))

    // Create SKILL.md for skill-type plugins
    const skillMdContent = `# ${plugin.name}\n\n${plugin.description || 'Test plugin'}\n`
    await fs.writeFile(path.join(pluginSourcePath, 'SKILL.md'), skillMdContent)
  }

  return packagePath
}

/**
 * Read JSON file
 * @param {string} filePath - File path
 * @returns {Promise<object>} Parsed JSON
 */
async function readJsonFile(filePath) {
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
async function readFile(filePath) {
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
async function fileExists(filePath) {
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
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Alias for createTestPackage (for clarity in test code)
 * @param {string} baseDir - Base directory
 * @param {string} packageName - Package name
 * @param {object} pluginDeclaration - Plugin declaration
 * @returns {Promise<string>} Package path
 */
const createPluginPackage = createTestPackage

/**
 * Build package.json dependencies object from plugins
 * @param {object[]} plugins - Plugin declarations
 * @returns {object} Dependencies object
 */
function buildDependencies(plugins) {
  return plugins.reduce((acc, plugin) => {
    acc[plugin.packageName] = '1.0.0'

    return acc
  }, {})
}

/**
 * Create initial settings structure
 * @returns {object} Initial settings object
 */
function createInitialSettings() {
  return {
    plugins : {
      enabled      : [],
      disabled     : [],
      marketplaces : {},
    },
  }
}

/**
 * Setup single test project environment
 * @param {object} project - Project configuration
 * @returns {Promise<{name: string, dir: string, settingsPath: string}>} Project info
 */
async function setupSingleProject(project) {
  const { name, dir, plugins = [] } = project
  const dependencies = buildDependencies(plugins)

  const claudeDir = path.join(dir, '.claude')
  const settingsPath = path.join(claudeDir, 'settings.json')

  await Promise.all([
    fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ name, version : '1.0.0', dependencies }, null, 2)),
    fs.writeFile(
      path.join(dir, 'package-lock.json'),
      JSON.stringify(
        {
          name,
          version         : '1.0.0',
          lockfileVersion : 3,
          requires        : true,
          packages        : { '' : { name, version : '1.0.0', dependencies } },
        },
        null,
        2
      )
    ),
    fs
      .mkdir(claudeDir, { recursive : true })
      .then(() => fs.writeFile(settingsPath, JSON.stringify(createInitialSettings(), null, 2))),
    ...plugins.map((plugin) => createTestPackage(dir, plugin.packageName, plugin.declaration)),
  ])

  return { name, dir, settingsPath }
}

/**
 * Setup multiple test projects with independent environments
 * @param {object[]} projects - Array of project configurations
 * @param {string} projects[].name - Project name
 * @param {string} projects[].dir - Project directory path
 * @param {object[]} projects[].plugins - Plugin declarations array
 * @returns {Promise<{projects: Array<{name: string, dir: string, settingsPath: string}>}>} Project environments
 */
async function setupMultiProjectEnv(projects) {
  const results = await Promise.all(projects.map(setupSingleProject))

  return { projects : results }
}

/**
 * Corrupt a settings file with invalid JSON
 * @param {string} settingsPath - Path to settings.json file
 * @param {string} [corruptionType='invalid-json'] - Type of corruption
 * @returns {Promise<void>}
 */
async function corruptSettingsFile(settingsPath, corruptionType = 'invalid-json') {
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

module.exports = {
  getProjectRoot,
  PROJECT_ROOT,
  CLI_PATH,
  runCLI,
  setupTestProject,
  createPackageJson,
  createTestPackage,
  readJsonFile,
  readFile,
  fileExists,
  sleep,
  createPluginPackage,
  setupMultiProjectEnv,
  corruptSettingsFile,
  verifySettingsStructure,
}
