# Implementation Plan: AI-Ready Architecture Update

This document provides detailed implementation steps for migrating ai-ready from the current multi-type integration system to the new focused Claude Code plugin auto-discovery system.

**Timeline**: 6 weeks
**Approach**: Iterative, phase-based implementation
**Estimated Effort**: ~40% reuse, ~30% refactor, ~30% new code

---

## Pre-Migration Checklist

- [ ] Create feature branch: `git checkout -b feature/plugin-auto-discovery`
- [ ] Review `design-overview.md` and `architecture-update.md`
- [ ] Back up current working implementation: `git tag pre-v2-migration`
- [ ] Set up test environment with Claude Code installed
- [ ] Create test npm packages for integration testing

---

## Phase 1: Foundation (Week 1-2)

**Goal**: Establish new data structures, update scanner, create marketplace parser

### 1.1 Update Type Definitions

**File**: `src/lib/types.js`

**Tasks**:

1. **Add new types** (keep old types temporarily for parallel testing):

```javascript
/**
 * @typedef {Object} PluginProvider
 * @property {string} packageName - npm package name
 * @property {string} version - Package version from package.json
 * @property {string} path - Absolute path to package directory
 * @property {PluginDeclaration} pluginDeclaration - Parsed marketplace.json
 */

/**
 * @typedef {Object} PluginDeclaration
 * @property {string} name - Plugin name
 * @property {string} version - Plugin version
 * @property {string} description - Plugin description
 * @property {string} skillPath - Relative path to skill directory
 */

/**
 * @typedef {Object} PluginState
 * @property {string} name - Plugin name
 * @property {'enabled'|'disabled'|'not-installed'} status - Current status
 * @property {string} source - Absolute path to plugin source
 * @property {string} version - Plugin version
 * @property {string} description - Plugin description
 */

/**
 * @typedef {Object} ClaudeSettings
 * @property {ClaudePluginSettings} plugins - Plugin configuration
 */

/**
 * @typedef {Object} ClaudePluginSettings
 * @property {string[]} enabled - List of enabled plugin names
 * @property {string[]} disabled - List of disabled plugin names
 * @property {Object.<string, MarketplaceEntry>} marketplaces - Marketplace entries
 */

/**
 * @typedef {Object} MarketplaceEntry
 * @property {MarketplaceSource} source - Marketplace source
 * @property {Object.<string, PluginMetadata>} plugins - Plugin metadata by name
 */

/**
 * @typedef {Object} MarketplaceSource
 * @property {'directory'} type - Source type
 * @property {string} path - Absolute path to source directory
 */

/**
 * @typedef {Object} PluginMetadata
 * @property {string} version - Plugin version
 * @property {string} skillPath - Relative path to skill directory
 */
```

2. **Add validation constants**:

```javascript
export const PLUGIN_STATUSES = {
  ENABLED: 'enabled',
  DISABLED: 'disabled',
  NOT_INSTALLED: 'not-installed'
}

export const MARKETPLACE_JSON_SCHEMA = {
  requiredFields: ['name', 'version', 'description', 'skillPath'],
  optionalFields: ['author', 'license', 'homepage']
}
```

**Test**:
```bash
cd test-staging && npx jest lib/types.test.js
```

### 1.2 Create Marketplace JSON Parser

**File**: `src/lib/parsers/marketplace-json.js`

**Implementation**:

```javascript
import { promises as fs } from 'fs'
import path from 'path'
import { MARKETPLACE_JSON_SCHEMA } from '../types.js'

/**
 * Parse and validate a marketplace.json file
 * @param {string} filePath - Absolute path to marketplace.json
 * @returns {Promise<Object|null>} Parsed declaration or null if invalid
 */
export async function parseMarketplaceJson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(content)

    if (validateMarketplaceJson(data)) {
      return data
    }

    console.warn(`Invalid marketplace.json at ${filePath}: missing required fields`)
    return null
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null // File doesn't exist
    }

    if (error instanceof SyntaxError) {
      console.warn(`Malformed JSON in ${filePath}: ${error.message}`)
      return null
    }

    throw error
  }
}

/**
 * Validate marketplace.json structure
 * @param {Object} data - Parsed JSON data
 * @returns {boolean} True if valid
 */
export function validateMarketplaceJson(data) {
  if (!data || typeof data !== 'object') {
    return false
  }

  // Check required fields
  for (const field of MARKETPLACE_JSON_SCHEMA.requiredFields) {
    if (!data[field] || typeof data[field] !== 'string') {
      return false
    }
  }

  // Validate skillPath doesn't escape package directory
  if (data.skillPath.includes('..') || path.isAbsolute(data.skillPath)) {
    console.warn('Invalid skillPath: must be relative and within package')
    return false
  }

  return true
}
```

**Test File**: `src/lib/parsers/marketplace-json.test.js`

```javascript
import { parseMarketplaceJson, validateMarketplaceJson } from './marketplace-json.js'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

describe('marketplace-json parser', () => {
  let tempDir

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('validateMarketplaceJson', () => {
    it('should accept valid declaration', () => {
      const valid = {
        name: 'my-plugin',
        version: '1.0.0',
        description: 'Test plugin',
        skillPath: '.claude-plugin/skill'
      }
      expect(validateMarketplaceJson(valid)).toBe(true)
    })

    it('should reject missing required fields', () => {
      const invalid = { name: 'my-plugin' }
      expect(validateMarketplaceJson(invalid)).toBe(false)
    })

    it('should reject path traversal in skillPath', () => {
      const invalid = {
        name: 'my-plugin',
        version: '1.0.0',
        description: 'Test',
        skillPath: '../../../etc/passwd'
      }
      expect(validateMarketplaceJson(invalid)).toBe(false)
    })
  })

  describe('parseMarketplaceJson', () => {
    it('should parse valid JSON file', async () => {
      const jsonPath = path.join(tempDir, 'marketplace.json')
      const data = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test',
        skillPath: '.claude-plugin/skill'
      }
      await fs.writeFile(jsonPath, JSON.stringify(data))

      const result = await parseMarketplaceJson(jsonPath)
      expect(result).toEqual(data)
    })

    it('should return null for malformed JSON', async () => {
      const jsonPath = path.join(tempDir, 'bad.json')
      await fs.writeFile(jsonPath, '{invalid json}')

      const result = await parseMarketplaceJson(jsonPath)
      expect(result).toBeNull()
    })

    it('should return null for missing file', async () => {
      const result = await parseMarketplaceJson('/nonexistent/marketplace.json')
      expect(result).toBeNull()
    })
  })
})
```

**Test**:
```bash
make build
cd test-staging && npx jest lib/parsers/marketplace-json.test.js
```

### 1.3 Refactor Scanner

**File**: `src/lib/scanner.js`

**Changes**:

1. **Update function signature**:

```javascript
// Change from:
export async function scanForProviders(scanPaths, baseDir = process.cwd())

// To:
export async function scanDependencies(baseDir = process.cwd())
```

2. **Update scanning logic**:

```javascript
import { promises as fs } from 'fs'
import path from 'path'
import { parseMarketplaceJson } from './parsers/marketplace-json.js'

/**
 * Scan direct dependencies for packages with .claude-plugin/marketplace.json
 * Only scans packages listed in dependencies and devDependencies in package.json
 * @param {string} baseDir - Project root directory
 * @returns {Promise<PluginProvider[]>} Discovered plugin providers
 */
export async function scanDependencies(baseDir = process.cwd()) {
  const nodeModulesPath = path.resolve(baseDir, 'node_modules')
  const packageJsonPath = path.resolve(baseDir, 'package.json')

  // Read package.json to get dependency list
  let packageJson
  try {
    const content = await fs.readFile(packageJsonPath, 'utf8')
    packageJson = JSON.parse(content)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [] // No package.json, no dependencies to scan
    }
    throw error // Malformed package.json should be reported
  }

  // Get list of direct dependencies
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }
  const dependencyNames = Object.keys(dependencies)

  if (dependencyNames.length === 0) {
    return [] // No dependencies
  }

  // Check if node_modules exists
  try {
    await fs.access(nodeModulesPath)
  } catch {
    return [] // No node_modules directory
  }

  // Scan only listed dependencies
  const packagePaths = dependencyNames.map(name =>
    path.join(nodeModulesPath, name)
  )

  // Scan packages in parallel
  const results = await Promise.all(
    packagePaths.map(pkg => scanPackage(pkg))
  )

  // Filter out null results (packages without plugins)
  return results.filter(provider => provider !== null)
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
  } catch (error) {
    console.warn(`Could not read package.json for ${packagePath}`)
  }

  return {
    packageName,
    version,
    path: packagePath,
    pluginDeclaration: declaration
  }
}
```

**Test File**: `src/lib/scanner.test.js` (update existing tests)

```javascript
import { scanDependencies } from './scanner.js'
import { createTestPackage } from './test-lib.js' // Will update this next
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

describe('scanner', () => {
  let tempDir

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should discover packages with .claude-plugin/marketplace.json', async () => {
    await createTestPackage(tempDir, 'test-lib', {
      name: 'test-plugin',
      version: '1.0.0',
      description: 'Test plugin',
      skillPath: '.claude-plugin/skill'
    })

    const providers = await scanDependencies(tempDir)

    expect(providers).toHaveLength(1)
    expect(providers[0].packageName).toBe('test-lib')
    expect(providers[0].pluginDeclaration.name).toBe('test-plugin')
  })

  it('should handle scoped packages', async () => {
    await createTestPackage(tempDir, '@myorg/test-lib', {
      name: 'scoped-plugin',
      version: '2.0.0',
      description: 'Scoped test',
      skillPath: '.claude-plugin/skill'
    })

    const providers = await scanDependencies(tempDir)

    expect(providers).toHaveLength(1)
    expect(providers[0].packageName).toBe('@myorg/test-lib')
  })

  it('should skip packages without marketplace.json', async () => {
    const nodeModules = path.join(tempDir, 'node_modules')
    await fs.mkdir(path.join(nodeModules, 'regular-package'), { recursive: true })
    await fs.writeFile(
      path.join(nodeModules, 'regular-package', 'package.json'),
      JSON.stringify({ name: 'regular-package', version: '1.0.0' })
    )

    const providers = await scanDependencies(tempDir)
    expect(providers).toHaveLength(0)
  })

  it('should return empty array if node_modules missing', async () => {
    const providers = await scanDependencies(tempDir)
    expect(providers).toEqual([])
  })
})
```

**Test**:
```bash
make build
cd test-staging && npx jest lib/scanner.test.js
```

### 1.4 Update Test Fixtures

**File**: `src/lib/test-lib.js`

**Add new helper function**:

```javascript
/**
 * Create a test package with .claude-plugin/marketplace.json
 * @param {string} baseDir - Base directory (should contain or will create node_modules)
 * @param {string} packageName - Package name (supports scoped: @org/pkg)
 * @param {Object} pluginDeclaration - marketplace.json content
 */
export async function createTestPackage(baseDir, packageName, pluginDeclaration) {
  const nodeModulesPath = path.join(baseDir, 'node_modules')
  const packagePath = path.join(nodeModulesPath, packageName)

  // Create package directory structure
  await fs.mkdir(packagePath, { recursive: true })

  // Write package.json
  const packageJson = {
    name: packageName,
    version: pluginDeclaration.version || '1.0.0',
    description: pluginDeclaration.description || 'Test package'
  }
  await fs.writeFile(
    path.join(packagePath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  )

  // Write .claude-plugin/marketplace.json
  const pluginDir = path.join(packagePath, '.claude-plugin')
  await fs.mkdir(pluginDir, { recursive: true })
  await fs.writeFile(
    path.join(pluginDir, 'marketplace.json'),
    JSON.stringify(pluginDeclaration, null, 2)
  )

  // Create skill directory with dummy SKILL.md
  const skillPath = path.join(packagePath, pluginDeclaration.skillPath || '.claude-plugin/skill')
  await fs.mkdir(skillPath, { recursive: true })
  await fs.writeFile(
    path.join(skillPath, 'SKILL.md'),
    `# ${pluginDeclaration.name}\n\n${pluginDeclaration.description}`
  )

  return packagePath
}
```

**Test**:
```bash
make build
cd test-staging && npx jest lib/test-lib.test.js
```

### 1.5 Update Cache Structure

**File**: `src/lib/storage/cache.js`

**Changes**:

1. **Update cache data structure**:

```javascript
/**
 * @typedef {Object} CacheData
 * @property {string} scannedAt - ISO timestamp
 * @property {number} packageJsonMTime - package.json mtime (ms)
 * @property {number} packageLockMTime - package-lock.json mtime (ms)
 * @property {PluginProvider[]} providers - Discovered plugin providers
 */

// Update cache file name (optional)
const CACHE_FILE_NAME = '.air-plugin-cache.json'
```

2. **Update validation logic** (remove remote provider checks):

```javascript
async function isValidCache(cacheData, baseDir) {
  if (!cacheData || !cacheData.scannedAt || !cacheData.providers) {
    return false
  }

  const packageJsonPath = path.join(baseDir, 'package.json')
  const packageLockPath = path.join(baseDir, 'package-lock.json')

  try {
    const [packageJsonStat, packageLockStat] = await Promise.all([
      fs.stat(packageJsonPath),
      fs.stat(packageLockPath).catch(() => null)
    ])

    // Check if package.json mtime changed
    if (packageJsonStat.mtimeMs !== cacheData.packageJsonMTime) {
      return false
    }

    // Check if package-lock.json mtime changed (if it exists)
    if (packageLockStat && packageLockStat.mtimeMs !== cacheData.packageLockMTime) {
      return false
    }

    return true
  } catch (error) {
    return false
  }
}
```

3. **Update cache writing**:

```javascript
async function writeCache(providers, baseDir) {
  const packageJsonPath = path.join(baseDir, 'package.json')
  const packageLockPath = path.join(baseDir, 'package-lock.json')

  const [packageJsonStat, packageLockStat] = await Promise.all([
    fs.stat(packageJsonPath),
    fs.stat(packageLockPath).catch(() => null)
  ])

  const cacheData = {
    scannedAt: new Date().toISOString(),
    packageJsonMTime: packageJsonStat.mtimeMs,
    packageLockMTime: packageLockStat?.mtimeMs || 0,
    providers
  }

  const cachePath = path.join(baseDir, CACHE_FILE_NAME)
  await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2))
}
```

**Test**:
```bash
make build
cd test-staging && npx jest lib/storage/cache.test.js
```

### 1.6 Phase 1 Verification

**Checklist**:
- [ ] All new types defined and documented
- [ ] Marketplace JSON parser implemented and tested
- [ ] Scanner refactored to find .claude-plugin/marketplace.json
- [ ] Test fixture helper updated (createTestPackage)
- [ ] Cache structure updated for new data format
- [ ] All tests passing: `make test`
- [ ] Lint passing: `make lint`
- [ ] Code committed: `git commit -m "Phase 1: Foundation - new types, scanner, parser"`

---

## Phase 2: Settings Manager (Week 2-3)

**Goal**: Implement Claude Code settings.json management with non-destructive merging

### 2.1 Update Claude Config

**File**: `src/lib/storage/claude-config.js`

**Add settings path**:

```javascript
export class ClaudePluginConfig {
  constructor(claudeDir) {
    this.claudeDir = claudeDir
    this.pluginsDir = path.join(claudeDir, 'plugins')
    this.installedPluginsPath = path.join(this.pluginsDir, 'installed_plugins.json')
    this.marketplacesPath = path.join(this.pluginsDir, 'known_marketplaces.json')

    // NEW: Add settings path
    this.settingsPath = path.join(claudeDir, 'settings.json')
  }

  // Keep existing factory methods...
}
```

**Test**: Update existing config tests to verify settings path

### 2.2 Create Settings Manager

**File**: `src/lib/storage/claude-settings.js`

**Implementation**:

```javascript
import { promises as fs } from 'fs'
import path from 'path'
import { PLUGIN_STATUSES } from '../types.js'

/** @import { PluginProvider, PluginState, ClaudeSettings } from '../types' */

/**
 * Read Claude Code settings.json
 * @param {string} settingsPath - Path to settings.json
 * @returns {Promise<ClaudeSettings>} Settings object
 */
export async function readSettings(settingsPath) {
  try {
    const content = await fs.readFile(settingsPath, 'utf8')
    const settings = JSON.parse(content)

    // Ensure plugins section exists with correct structure
    if (!settings.plugins) {
      settings.plugins = {
        enabled: [],
        disabled: [],
        marketplaces: {}
      }
    }

    settings.plugins.enabled = settings.plugins.enabled || []
    settings.plugins.disabled = settings.plugins.disabled || []
    settings.plugins.marketplaces = settings.plugins.marketplaces || {}

    return settings
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return default settings
      return {
        plugins: {
          enabled: [],
          disabled: [],
          marketplaces: {}
        }
      }
    }

    if (error instanceof SyntaxError) {
      console.warn(`Malformed settings.json, creating backup and using defaults`)
      await createBackup(settingsPath)
      return {
        plugins: {
          enabled: [],
          disabled: [],
          marketplaces: {}
        }
      }
    }

    throw error
  }
}

/**
 * Update settings with discovered providers (non-destructive merge)
 * @param {string} settingsPath - Path to settings.json
 * @param {PluginProvider[]} providers - Discovered providers
 * @returns {Promise<{added: string[], updated: string[]}>} Change summary
 */
export async function updateSettings(settingsPath, providers) {
  const settings = await readSettings(settingsPath)
  const changes = { added: [], updated: [] }

  for (const provider of providers) {
    const pluginName = provider.pluginDeclaration.name
    const marketplaceName = `${provider.packageName}-marketplace`

    // Skip if plugin is explicitly disabled
    if (settings.plugins.disabled.includes(pluginName)) {
      continue
    }

    // Check if plugin is already enabled
    const isEnabled = settings.plugins.enabled.includes(pluginName)

    if (!isEnabled) {
      // Add to enabled list
      settings.plugins.enabled.push(pluginName)
      changes.added.push(pluginName)
    } else {
      changes.updated.push(pluginName)
    }

    // Update marketplace entry (always update path/version)
    settings.plugins.marketplaces[marketplaceName] = {
      source: {
        type: 'directory',
        path: provider.path
      },
      plugins: {
        [pluginName]: {
          version: provider.pluginDeclaration.version,
          skillPath: provider.pluginDeclaration.skillPath
        }
      }
    }
  }

  // Only write if there were changes
  if (changes.added.length > 0 || changes.updated.length > 0) {
    await writeSettings(settingsPath, settings)
  }

  return changes
}

/**
 * Write settings to file with backup
 * @param {string} settingsPath - Path to settings.json
 * @param {ClaudeSettings} settings - Settings object
 */
async function writeSettings(settingsPath, settings) {
  // Create backup before writing
  await createBackup(settingsPath)

  // Ensure directory exists
  await fs.mkdir(path.dirname(settingsPath), { recursive: true })

  // Write settings
  await fs.writeFile(
    settingsPath,
    JSON.stringify(settings, null, 2),
    'utf8'
  )
}

/**
 * Create backup of settings file
 * @param {string} settingsPath - Path to settings.json
 */
async function createBackup(settingsPath) {
  try {
    await fs.access(settingsPath)

    // Rotate existing backups (.bak -> .bak.1, .bak.1 -> .bak.2, etc.)
    const maxBackups = 5
    for (let i = maxBackups - 1; i >= 0; i--) {
      const from = i === 0 ? `${settingsPath}.bak` : `${settingsPath}.bak.${i}`
      const to = `${settingsPath}.bak.${i + 1}`

      try {
        await fs.access(from)
        if (i === maxBackups - 1) {
          await fs.unlink(from) // Delete oldest backup
        } else {
          await fs.rename(from, to)
        }
      } catch {
        // Backup doesn't exist, skip
      }
    }

    // Create new backup
    await fs.copyFile(settingsPath, `${settingsPath}.bak`)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
}

/**
 * Get plugin state from settings
 * @param {string} pluginName - Plugin name
 * @param {ClaudeSettings} settings - Settings object
 * @returns {string} Status: 'enabled' | 'disabled' | 'not-installed'
 */
export function getPluginState(pluginName, settings) {
  if (settings.plugins.enabled.includes(pluginName)) {
    return PLUGIN_STATUSES.ENABLED
  }

  if (settings.plugins.disabled.includes(pluginName)) {
    return PLUGIN_STATUSES.DISABLED
  }

  return PLUGIN_STATUSES.NOT_INSTALLED
}

/**
 * Get states for all discovered providers
 * @param {PluginProvider[]} providers - Discovered providers
 * @param {ClaudeSettings} settings - Settings object
 * @returns {PluginState[]} Plugin states
 */
export function getPluginStates(providers, settings) {
  return providers.map(provider => ({
    name: provider.pluginDeclaration.name,
    status: getPluginState(provider.pluginDeclaration.name, settings),
    source: provider.path,
    version: provider.pluginDeclaration.version,
    description: provider.pluginDeclaration.description
  }))
}
```

### 2.3 Settings Manager Tests

**File**: `src/lib/storage/claude-settings.test.js`

```javascript
import {
  readSettings,
  updateSettings,
  getPluginState,
  getPluginStates
} from './claude-settings.js'
import { PLUGIN_STATUSES } from '../types.js'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

describe('claude-settings', () => {
  let tempDir
  let settingsPath

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-test-'))
    settingsPath = path.join(tempDir, 'settings.json')
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('readSettings', () => {
    it('should return default settings if file missing', async () => {
      const settings = await readSettings(settingsPath)

      expect(settings.plugins).toBeDefined()
      expect(settings.plugins.enabled).toEqual([])
      expect(settings.plugins.disabled).toEqual([])
      expect(settings.plugins.marketplaces).toEqual({})
    })

    it('should read existing settings', async () => {
      const existing = {
        plugins: {
          enabled: ['plugin-1'],
          disabled: ['plugin-2'],
          marketplaces: {}
        }
      }
      await fs.writeFile(settingsPath, JSON.stringify(existing))

      const settings = await readSettings(settingsPath)
      expect(settings.plugins.enabled).toEqual(['plugin-1'])
      expect(settings.plugins.disabled).toEqual(['plugin-2'])
    })

    it('should create backup for malformed JSON', async () => {
      await fs.writeFile(settingsPath, '{invalid json}')

      const settings = await readSettings(settingsPath)

      expect(settings.plugins.enabled).toEqual([])
      const backupExists = await fs.access(`${settingsPath}.bak`)
        .then(() => true)
        .catch(() => false)
      expect(backupExists).toBe(true)
    })
  })

  describe('updateSettings', () => {
    it('should add new plugin to enabled list', async () => {
      const providers = [{
        packageName: 'test-pkg',
        version: '1.0.0',
        path: '/path/to/pkg',
        pluginDeclaration: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test',
          skillPath: '.claude-plugin/skill'
        }
      }]

      const changes = await updateSettings(settingsPath, providers)

      expect(changes.added).toEqual(['test-plugin'])
      expect(changes.updated).toEqual([])

      const settings = await readSettings(settingsPath)
      expect(settings.plugins.enabled).toContain('test-plugin')
      expect(settings.plugins.marketplaces['test-pkg-marketplace']).toBeDefined()
    })

    it('should skip disabled plugins', async () => {
      await fs.writeFile(settingsPath, JSON.stringify({
        plugins: {
          enabled: [],
          disabled: ['test-plugin'],
          marketplaces: {}
        }
      }))

      const providers = [{
        packageName: 'test-pkg',
        version: '1.0.0',
        path: '/path/to/pkg',
        pluginDeclaration: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test',
          skillPath: '.claude-plugin/skill'
        }
      }]

      const changes = await updateSettings(settingsPath, providers)

      expect(changes.added).toEqual([])

      const settings = await readSettings(settingsPath)
      expect(settings.plugins.enabled).not.toContain('test-plugin')
      expect(settings.plugins.disabled).toContain('test-plugin')
    })

    it('should update marketplace for already enabled plugin', async () => {
      await fs.writeFile(settingsPath, JSON.stringify({
        plugins: {
          enabled: ['test-plugin'],
          disabled: [],
          marketplaces: {
            'test-pkg-marketplace': {
              source: { type: 'directory', path: '/old/path' },
              plugins: { 'test-plugin': { version: '0.9.0', skillPath: '.claude-plugin/skill' } }
            }
          }
        }
      }))

      const providers = [{
        packageName: 'test-pkg',
        version: '1.0.0',
        path: '/new/path',
        pluginDeclaration: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test',
          skillPath: '.claude-plugin/skill'
        }
      }]

      const changes = await updateSettings(settingsPath, providers)

      expect(changes.added).toEqual([])
      expect(changes.updated).toEqual(['test-plugin'])

      const settings = await readSettings(settingsPath)
      const marketplace = settings.plugins.marketplaces['test-pkg-marketplace']
      expect(marketplace.source.path).toBe('/new/path')
      expect(marketplace.plugins['test-plugin'].version).toBe('1.0.0')
    })

    it('should create backup before writing', async () => {
      await fs.writeFile(settingsPath, JSON.stringify({ plugins: { enabled: [], disabled: [], marketplaces: {} } }))

      const providers = [{
        packageName: 'test-pkg',
        version: '1.0.0',
        path: '/path',
        pluginDeclaration: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test',
          skillPath: '.claude-plugin/skill'
        }
      }]

      await updateSettings(settingsPath, providers)

      const backupExists = await fs.access(`${settingsPath}.bak`)
        .then(() => true)
        .catch(() => false)
      expect(backupExists).toBe(true)
    })
  })

  describe('getPluginState', () => {
    it('should return enabled for enabled plugin', () => {
      const settings = {
        plugins: {
          enabled: ['plugin-1'],
          disabled: [],
          marketplaces: {}
        }
      }

      expect(getPluginState('plugin-1', settings)).toBe(PLUGIN_STATUSES.ENABLED)
    })

    it('should return disabled for disabled plugin', () => {
      const settings = {
        plugins: {
          enabled: [],
          disabled: ['plugin-1'],
          marketplaces: {}
        }
      }

      expect(getPluginState('plugin-1', settings)).toBe(PLUGIN_STATUSES.DISABLED)
    })

    it('should return not-installed for unknown plugin', () => {
      const settings = {
        plugins: {
          enabled: [],
          disabled: [],
          marketplaces: {}
        }
      }

      expect(getPluginState('plugin-1', settings)).toBe(PLUGIN_STATUSES.NOT_INSTALLED)
    })
  })

  describe('getPluginStates', () => {
    it('should return states for all providers', () => {
      const providers = [
        {
          packageName: 'pkg-1',
          version: '1.0.0',
          path: '/path1',
          pluginDeclaration: { name: 'plugin-1', version: '1.0.0', description: 'Test 1', skillPath: '.claude-plugin/skill' }
        },
        {
          packageName: 'pkg-2',
          version: '2.0.0',
          path: '/path2',
          pluginDeclaration: { name: 'plugin-2', version: '2.0.0', description: 'Test 2', skillPath: '.claude-plugin/skill' }
        }
      ]

      const settings = {
        plugins: {
          enabled: ['plugin-1'],
          disabled: ['plugin-2'],
          marketplaces: {}
        }
      }

      const states = getPluginStates(providers, settings)

      expect(states).toHaveLength(2)
      expect(states[0].name).toBe('plugin-1')
      expect(states[0].status).toBe(PLUGIN_STATUSES.ENABLED)
      expect(states[1].name).toBe('plugin-2')
      expect(states[1].status).toBe(PLUGIN_STATUSES.DISABLED)
    })
  })
})
```

**Test**:
```bash
make build
cd test-staging && npx jest lib/storage/claude-settings.test.js
```

### 2.4 Phase 2 Verification

**Checklist**:
- [ ] Settings manager implemented with all functions
- [ ] Non-destructive merge logic working correctly
- [ ] Backup rotation implemented (max 5 backups)
- [ ] Plugin state tracking working
- [ ] All tests passing: `make test`
- [ ] Manual test with real settings.json file
- [ ] Code committed: `git commit -m "Phase 2: Settings manager with non-destructive merge"`

---

## Phase 3: View Command (Week 3-4)

**Goal**: Implement view command to show plugin status

### 3.1 Create View Command

**File**: `src/lib/commands/view.js`

```javascript
/* eslint-disable no-console, no-process-exit */

import { scanDependencies } from '../scanner.js'
import { loadProvidersWithCache } from '../storage/cache.js'
import { readSettings, getPluginStates } from '../storage/claude-settings.js'
import { ClaudePluginConfig } from '../storage/claude-config.js'
import { PLUGIN_STATUSES } from '../types.js'

/**
 * View command: Show plugin status for current project or all plugins
 * @param {Object} options - Command options
 * @param {string} options.path - Project path (default: cwd)
 * @param {boolean} options.all - Show all plugins in settings
 */
export async function viewCommand(options = {}) {
  const baseDir = options.path || process.cwd()
  const config = ClaudePluginConfig.createDefault()

  try {
    if (options.all) {
      await viewAllPlugins(config.settingsPath)
    } else {
      await viewProjectPlugins(baseDir, config.settingsPath)
    }
  } catch (error) {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  }
}

/**
 * View plugins for specific project
 */
async function viewProjectPlugins(baseDir, settingsPath) {
  console.log(`\nDiscovered Claude Code Plugins in ${baseDir}\n`)

  // Scan dependencies (with cache)
  const providers = await loadProvidersWithCache(
    () => scanDependencies(baseDir),
    baseDir
  )

  if (providers.length === 0) {
    console.log('No Claude Code plugins found in dependencies.\n')
    return
  }

  // Get settings and plugin states
  const settings = await readSettings(settingsPath)
  const states = getPluginStates(providers, settings)

  // Display plugins
  let enabledCount = 0
  let disabledCount = 0
  let notInstalledCount = 0

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i]
    const state = states[i]

    console.log(`Package: ${provider.packageName} (v${provider.version})`)
    console.log(`  Plugin: ${state.name}`)
    console.log(`  Status: ${formatStatus(state.status)}`)
    console.log(`  Description: ${state.description}`)
    console.log()

    if (state.status === PLUGIN_STATUSES.ENABLED) enabledCount++
    else if (state.status === PLUGIN_STATUSES.DISABLED) disabledCount++
    else notInstalledCount++
  }

  // Summary
  console.log(`Summary: ${enabledCount} enabled, ${disabledCount} disabled, ${notInstalledCount} available`)

  // Restart warning if there are new plugins
  if (notInstalledCount > 0) {
    console.log('\n⚠️  Run `air sync` to enable new plugins, then restart Claude Code\n')
  }
}

/**
 * View all plugins in settings (not just current project)
 */
async function viewAllPlugins(settingsPath) {
  console.log('\nAll Claude Code Plugins\n')

  const settings = await readSettings(settingsPath)

  const allPlugins = new Set([
    ...settings.plugins.enabled,
    ...settings.plugins.disabled
  ])

  if (allPlugins.size === 0) {
    console.log('No plugins configured.\n')
    return
  }

  let enabledCount = 0
  let disabledCount = 0

  for (const pluginName of allPlugins) {
    const isEnabled = settings.plugins.enabled.includes(pluginName)
    const status = isEnabled ? PLUGIN_STATUSES.ENABLED : PLUGIN_STATUSES.DISABLED

    // Find source from marketplaces
    let source = '(not found)'
    for (const [marketplaceName, marketplace] of Object.entries(settings.plugins.marketplaces)) {
      if (marketplace.plugins[pluginName]) {
        source = marketplace.source.path
        break
      }
    }

    console.log(`Plugin: ${pluginName}`)
    console.log(`  Source: ${source}`)
    console.log(`  Status: ${formatStatus(status)}`)
    console.log()

    if (isEnabled) enabledCount++
    else disabledCount++
  }

  console.log(`Summary: ${enabledCount} enabled, ${disabledCount} disabled\n`)
}

/**
 * Format status with indicator
 */
function formatStatus(status) {
  switch (status) {
    case PLUGIN_STATUSES.ENABLED:
      return '✓ Enabled'
    case PLUGIN_STATUSES.DISABLED:
      return '⊗ Disabled (by user)'
    case PLUGIN_STATUSES.NOT_INSTALLED:
      return '• Not installed'
    default:
      return status
  }
}
```

### 3.2 Wire View Command into CLI

**File**: `src/cli/air.mjs`

```javascript
import { Command } from 'commander'
import { viewCommand } from '../lib/commands/view.js'
// ... other imports

const program = new Command()

program
  .name('air')
  .description('AI-Ready: Auto-discover and manage Claude Code plugins')
  .version('2.0.0-alpha.1')

// View command
program
  .command('view')
  .description('Show plugin status for current project or all plugins')
  .argument('[path]', 'Project path (default: current directory)')
  .option('-a, --all', 'Show all plugins in Claude Code settings')
  .action(async (path, options) => {
    await viewCommand({ path, all: options.all })
  })

// ... other commands

program.parse()
```

### 3.3 View Command Tests

**File**: `src/lib/commands/view.test.js`

```javascript
import { viewCommand } from './view.js'
import { createTestPackage } from '../test-lib.js'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

describe('view command', () => {
  let tempDir
  let settingsPath

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-test-'))
    settingsPath = path.join(tempDir, '.claude', 'settings.json')
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should display plugins for project', async () => {
    await createTestPackage(tempDir, 'test-lib', {
      name: 'test-plugin',
      version: '1.0.0',
      description: 'Test plugin',
      skillPath: '.claude-plugin/skill'
    })

    // Capture console output
    const logs = []
    const originalLog = console.log
    console.log = (...args) => logs.push(args.join(' '))

    await viewCommand({ path: tempDir })

    console.log = originalLog

    const output = logs.join('\n')
    expect(output).toContain('test-plugin')
    expect(output).toContain('Not installed')
  })

  // Add more tests...
})
```

### 3.4 Phase 3 Verification

**Checklist**:
- [ ] View command implemented for project plugins
- [ ] View --all command implemented
- [ ] Output formatting looks good
- [ ] Tests passing
- [ ] Manual CLI test: `node dist/ai-ready-exec.js view`
- [ ] Code committed: `git commit -m "Phase 3: View command"`

---

## Phase 4: Sync Command (Week 4-5)

**Goal**: Implement automatic plugin discovery and enablement

### 4.1 Create Sync Command

**File**: `src/lib/commands/sync.js`

```javascript
/* eslint-disable no-console, no-process-exit */

import { scanDependencies } from '../scanner.js'
import { loadProvidersWithCache } from '../storage/cache.js'
import { readSettings, updateSettings } from '../storage/claude-settings.js'
import { ClaudePluginConfig } from '../storage/claude-config.js'

/**
 * Sync command: Discover and enable plugins from dependencies
 * @param {Object} options - Command options
 * @param {string} options.path - Project path (default: cwd)
 * @param {boolean} options.quiet - Suppress output (for hooks)
 * @param {boolean} options.noCache - Skip cache, force fresh scan
 */
export async function syncCommand(options = {}) {
  const baseDir = options.path || process.cwd()
  const config = ClaudePluginConfig.createDefault()
  const quiet = options.quiet || false

  try {
    if (!quiet) {
      console.log('Scanning dependencies for Claude Code plugins...')
    }

    // Scan dependencies (with cache unless --no-cache)
    const scanFn = () => scanDependencies(baseDir)
    const providers = options.noCache
      ? await scanFn()
      : await loadProvidersWithCache(scanFn, baseDir)

    if (!quiet) {
      console.log(`Found ${providers.length} plugin${providers.length === 1 ? '' : 's'}\n`)
    }

    if (providers.length === 0) {
      return
    }

    // Get current settings
    const settings = await readSettings(config.settingsPath)

    // Update settings
    const changes = await updateSettings(config.settingsPath, providers)

    // Report changes
    if (!quiet) {
      if (changes.added.length > 0) {
        console.log('New plugins discovered:')
        for (const pluginName of changes.added) {
          const provider = providers.find(p => p.pluginDeclaration.name === pluginName)
          console.log(`  • ${pluginName} (from ${provider.packageName} v${provider.version})`)
        }
        console.log()
      }

      if (changes.added.length > 0 || changes.updated.length > 0) {
        console.log(`Updated settings: ${config.settingsPath}`)
        console.log(`✓ ${changes.added.length} plugin${changes.added.length === 1 ? '' : 's'} added, ${changes.updated.length} updated\n`)

        if (changes.added.length > 0) {
          console.log('⚠️  Restart Claude Code to load new plugins\n')
        }
      } else {
        console.log('All plugins already enabled.\n')
      }
    }
  } catch (error) {
    if (!quiet) {
      console.error(`Error: ${error.message}`)
    }
    process.exit(1)
  }
}
```

### 4.2 Wire Sync Command into CLI

**File**: `src/cli/air.mjs`

```javascript
import { syncCommand } from '../lib/commands/sync.js'

// ... in program definition

program
  .command('sync')
  .description('Discover and enable plugins from dependencies')
  .argument('[path]', 'Project path (default: current directory)')
  .option('-q, --quiet', 'Suppress output (for hooks)')
  .option('--no-cache', 'Skip cache, force fresh scan')
  .action(async (path, options) => {
    await syncCommand({ path, quiet: options.quiet, noCache: !options.cache })
  })
```

### 4.3 Sync Command Tests

**File**: `src/lib/commands/sync.test.js`

```javascript
import { syncCommand } from './sync.js'
import { createTestPackage } from '../test-lib.js'
import { readSettings } from '../storage/claude-settings.js'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

describe('sync command', () => {
  let tempDir
  let settingsPath

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-test-'))
    settingsPath = path.join(tempDir, '.claude', 'settings.json')

    // Mock ClaudePluginConfig to use test directory
    // (Implementation depends on your config structure)
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should enable newly discovered plugins', async () => {
    await createTestPackage(tempDir, 'test-lib', {
      name: 'test-plugin',
      version: '1.0.0',
      description: 'Test',
      skillPath: '.claude-plugin/skill'
    })

    await syncCommand({ path: tempDir, quiet: true })

    const settings = await readSettings(settingsPath)
    expect(settings.plugins.enabled).toContain('test-plugin')
  })

  it('should respect disabled plugins', async () => {
    // Pre-populate settings with disabled plugin
    await fs.mkdir(path.dirname(settingsPath), { recursive: true })
    await fs.writeFile(settingsPath, JSON.stringify({
      plugins: {
        enabled: [],
        disabled: ['test-plugin'],
        marketplaces: {}
      }
    }))

    await createTestPackage(tempDir, 'test-lib', {
      name: 'test-plugin',
      version: '1.0.0',
      description: 'Test',
      skillPath: '.claude-plugin/skill'
    })

    await syncCommand({ path: tempDir, quiet: true })

    const settings = await readSettings(settingsPath)
    expect(settings.plugins.enabled).not.toContain('test-plugin')
    expect(settings.plugins.disabled).toContain('test-plugin')
  })

  // Add more tests...
})
```

### 4.4 Integration Tests

**File**: `src/lib/integration.test.js`

```javascript
import { scanDependencies } from './scanner.js'
import { syncCommand } from './commands/sync.js'
import { viewCommand } from './commands/view.js'
import { createTestPackage } from './test-lib.js'
import { readSettings } from './storage/claude-settings.js'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

describe('End-to-end workflow', () => {
  let tempDir

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should complete full workflow: scan → sync → view', async () => {
    // 1. Create test package
    await createTestPackage(tempDir, 'my-lib', {
      name: 'my-plugin',
      version: '1.0.0',
      description: 'Test plugin',
      skillPath: '.claude-plugin/skill'
    })

    // 2. Scan should discover plugin
    const providers = await scanDependencies(tempDir)
    expect(providers).toHaveLength(1)
    expect(providers[0].pluginDeclaration.name).toBe('my-plugin')

    // 3. Sync should enable plugin
    await syncCommand({ path: tempDir, quiet: true })

    const settingsPath = path.join(tempDir, '.claude', 'settings.json')
    const settings = await readSettings(settingsPath)
    expect(settings.plugins.enabled).toContain('my-plugin')

    // 4. View should show plugin as enabled
    // (Test output capture)
  })
})
```

### 4.5 Phase 4 Verification

**Checklist**:
- [ ] Sync command implemented
- [ ] --quiet flag works (for hooks)
- [ ] --no-cache flag works
- [ ] Changes reported correctly
- [ ] Tests passing (unit + integration)
- [ ] Manual test: Create test project, run sync, verify settings updated
- [ ] Code committed: `git commit -m "Phase 4: Sync command"`

---

## Phase 5: Cleanup (Week 5-6)

**Goal**: Remove old code, update documentation

### 5.1 Remove Old Commands

**Delete Files**:
- `src/lib/commands/install.js`
- `src/lib/commands/remove.js`
- `src/lib/commands/list.js`
- `src/lib/commands/verify.js`
- `src/lib/commands/sources.js`

**Delete Tests**:
- `test-staging/lib/commands/install.test.js`
- `test-staging/lib/commands/remove.test.js`
- `test-staging/lib/commands/list.test.js`
- `test-staging/lib/commands/verify.test.js`

**Update CLI** (`src/cli/air.mjs`):
- Remove command imports
- Remove command definitions
- Keep only `view` and `sync` commands

### 5.2 Remove Old Registry System

**Delete Files**:
- `src/lib/storage/registry.js`
- `src/lib/storage/claude-plugin-registry.js`

**Delete Tests**:
- `test-staging/lib/storage/registry.test.js`
- `test-staging/lib/storage/claude-plugin-registry.test.js`

### 5.3 Remove Remote Repo Support (for now)

**Delete Files**:
- `src/lib/storage/config.js` (remote repo config)
- `src/lib/storage/remote-repos.js`
- `src/lib/utils/git.js` (unless useful elsewhere)

**Delete Tests**:
- Related test files

### 5.4 Remove Old Parsers

**Delete Files**:
- `src/lib/parsers/frontmatter.js`

**Remove Dependencies**:
```bash
npm uninstall gray-matter
```

### 5.5 Clean Up Types

**File**: `src/lib/types.js`

**Remove**:
- `Integration` type
- `IntegrationProvider` type
- `RemoteRepoProvider` type
- `INTEGRATION_TYPES` constants

**Keep only new types** from Phase 1

### 5.6 Update Test Fixtures

**File**: `src/lib/test-lib.js`

**Remove**:
- `createTestLibrary()` function (old format)

**Keep**:
- `createTestPackage()` function (new format)

### 5.7 Update Documentation

**File**: `README.md`

Update to reflect new purpose and commands:

```markdown
# ai-ready

Enables npm dependencies to describe themselves to AI coding agents.

## Purpose

ai-ready automatically discovers and enables Claude Code plugins bundled within your npm dependencies. When you install a package that includes a Claude Code plugin, ai-ready detects it and configures Claude Code to load it—no manual setup required.

## Installation

```bash
npm install -g ai-ready
```

## Quick Start

1. Install a package with a Claude Code plugin
2. Run `air sync` in your project
3. Restart Claude Code
4. The plugin is now active!

## Commands

### `air view [path]`

Show plugins discovered in the current project (or specified path).

```bash
air view
air view /path/to/project
```

### `air view --all`

Show all plugins configured in Claude Code (not just current project).

```bash
air view --all
```

### `air sync [path]`

Discover and enable plugins from dependencies.

```bash
air sync
air sync --quiet  # For use in hooks
air sync --no-cache  # Force fresh scan
```

## Session Start Hook

For automatic plugin discovery, configure Claude Code to run `air sync` on session start:

1. Create hook script `$HOME/.claude/hooks/session-start.sh`:

```bash
#!/bin/bash
cd "$CLAUDE_PROJECT_DIR" || exit 0
air sync --quiet
```

2. Make it executable:

```bash
chmod +x $HOME/.claude/hooks/session-start.sh
```

3. Configure Claude Code (add to `$HOME/.claude/settings.json`):

```json
{
  "hooks": {
    "sessionStart": "$HOME/.claude/hooks/session-start.sh"
  }
}
```

## For Library Authors

To bundle a Claude Code plugin with your npm package:

1. Create `.claude-plugin/marketplace.json`:

```json
{
  "name": "my-library-helper",
  "version": "1.0.0",
  "description": "Helps developers use my-library APIs",
  "skillPath": ".claude-plugin/skill"
}
```

2. Add your plugin code to `.claude-plugin/skill/SKILL.md`

3. Publish your package

Users who install your package will automatically get your plugin enabled via `air sync`.

## How It Works

1. **Discovery**: Scans `node_modules/` for packages with `.claude-plugin/marketplace.json`
2. **Caching**: Caches results based on `package.json` and `package-lock.json` mtimes
3. **Settings Update**: Non-destructively updates `$HOME/.claude/settings.json`
4. **Respect User Choice**: Never re-enables plugins that users have explicitly disabled

## License

MIT
```

**File**: `CLAUDE.md`

Update to reflect new architecture (refer to architecture documents)

**File**: `CHANGELOG.md`

Add entry for v2.0.0:

```markdown
# Changelog

## [2.0.0-alpha.1] - 2025-XX-XX

### Breaking Changes

- **Complete architecture redesign**: Focus on automatic Claude Code plugin discovery
- **Removed commands**: `install`, `remove`, `list`, `verify`, `sources`
- **New commands**: `view`, `sync`
- **Changed plugin format**: Now uses `.claude-plugin/marketplace.json` instead of `ai-ready/integrations/`
- **Changed settings management**: Uses `$HOME/.claude/settings.json` instead of separate plugin registries

### Added

- Automatic plugin discovery from npm dependencies
- Non-destructive settings file merging
- Session start hook support
- `air view` command to show plugin status
- `air sync` command for automatic enablement
- Cache system based on package.json/package-lock.json mtimes

### Removed

- Multi-type integration system (generic vs. Claude Skill)
- Manual install/remove workflow
- Remote repository support (may return in future)
- Markdown table registry format

### Migration Guide

For library authors publishing AI-ready plugins:

1. Create `.claude-plugin/` directory in your package
2. Add `marketplace.json` with plugin metadata
3. Move plugin skill code to `.claude-plugin/skill/`
4. Remove old `ai-ready/integrations/` directory
5. Publish updated package

For users:

1. Run `air sync` in your projects
2. Restart Claude Code
3. Plugins from dependencies now auto-enabled

## [1.0.0-alpha.x] - Previous releases

...
```

### 5.8 Phase 5 Verification

**Checklist**:
- [ ] All old commands removed
- [ ] All old registry code removed
- [ ] Old parsers removed
- [ ] Unused dependencies removed
- [ ] Type definitions cleaned up
- [ ] README updated
- [ ] CLAUDE.md updated
- [ ] CHANGELOG updated
- [ ] All tests still passing
- [ ] Build successful
- [ ] Code committed: `git commit -m "Phase 5: Cleanup old code and update docs"`

---

## Phase 6: Hook Documentation and Polish (Week 6)

**Goal**: Complete documentation, testing, and polish

### 6.1 Create Hook Setup Guide

**File**: `docs/HOOK_SETUP.md`

```markdown
# Setting Up Session Start Hook

This guide explains how to configure Claude Code to automatically run `air sync` when you start a coding session.

## Overview

The session start hook runs `air sync` automatically when you open a project in Claude Code. This ensures that any new plugins from dependencies are discovered and enabled without manual intervention.

## Prerequisites

- ai-ready installed globally: `npm install -g ai-ready`
- Claude Code installed

## Setup Steps

### 1. Create Hook Script

Create the directory and hook script:

```bash
mkdir -p $HOME/.claude/hooks
cat > $HOME/.claude/hooks/session-start.sh << 'EOF'
#!/bin/bash

# Change to project directory
cd "$CLAUDE_PROJECT_DIR" || exit 0

# Run air sync quietly (suppress output for cleaner startup)
air sync --quiet

# Exit successfully
exit 0
EOF
```

### 2. Make Script Executable

```bash
chmod +x $HOME/.claude/hooks/session-start.sh
```

### 3. Configure Claude Code

Add hook configuration to `$HOME/.claude/settings.json`:

```json
{
  "hooks": {
    "sessionStart": "$HOME/.claude/hooks/session-start.sh"
  }
}
```

If `settings.json` doesn't exist, create it with the above content.

### 4. Test

1. Open a project in Claude Code
2. Check that hook ran: `cat /tmp/claude-hooks.log` (if logging enabled)
3. Verify plugins enabled: `air view`

## Troubleshooting

### Hook Not Running

- Check hook script permissions: `ls -l $HOME/.claude/hooks/session-start.sh`
- Ensure shebang is correct: `#!/bin/bash`
- Check Claude Code hook configuration in settings.json

### air Command Not Found

- Ensure ai-ready installed globally: `npm list -g ai-ready`
- Check PATH in hook environment: Add `export PATH="/usr/local/bin:$PATH"` to hook script

### Slow Startup

- Cache should make subsequent runs fast (<100ms)
- If slow, check cache file exists: `ls .air-plugin-cache.json`
- Force cache rebuild: `air sync --no-cache`

## Customization

### Enable Logging

Add logging to hook script:

```bash
#!/bin/bash

LOG_FILE="/tmp/air-sync.log"

echo "$(date): Starting air sync for $CLAUDE_PROJECT_DIR" >> "$LOG_FILE"

cd "$CLAUDE_PROJECT_DIR" || exit 0
air sync --quiet >> "$LOG_FILE" 2>&1

exit 0
```

### Conditional Execution

Only run for specific projects:

```bash
#!/bin/bash

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Only run if package.json exists (npm project)
if [ -f "package.json" ]; then
  air sync --quiet
fi

exit 0
```

## Disabling

To disable the hook:

1. Remove or comment out hook configuration in `$HOME/.claude/settings.json`
2. Or delete the hook script

You can still run `air sync` manually whenever needed.
```

### 6.2 Performance Testing

**File**: `src/lib/performance.test.js`

```javascript
import { scanDependencies } from './scanner.js'
import { loadProvidersWithCache } from './storage/cache.js'
import { updateSettings } from './storage/claude-settings.js'
import { createTestPackage } from './test-lib.js'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

describe('Performance tests', () => {
  let tempDir

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'air-perf-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('cache hit should complete in <100ms', async () => {
    // Create test packages
    for (let i = 0; i < 10; i++) {
      await createTestPackage(tempDir, `pkg-${i}`, {
        name: `plugin-${i}`,
        version: '1.0.0',
        description: `Plugin ${i}`,
        skillPath: '.claude-plugin/skill'
      })
    }

    // First scan (creates cache)
    const start1 = Date.now()
    await loadProvidersWithCache(() => scanDependencies(tempDir), tempDir)
    const duration1 = Date.now() - start1

    // Second scan (cache hit)
    const start2 = Date.now()
    await loadProvidersWithCache(() => scanDependencies(tempDir), tempDir)
    const duration2 = Date.now() - start2

    console.log(`First scan: ${duration1}ms, Cache hit: ${duration2}ms`)
    expect(duration2).toBeLessThan(100)
  })

  it('should handle 100 dependencies in <2s', async () => {
    // Create 100 packages (only 10 with plugins)
    const nodeModules = path.join(tempDir, 'node_modules')

    // 90 regular packages
    for (let i = 0; i < 90; i++) {
      const pkgPath = path.join(nodeModules, `regular-${i}`)
      await fs.mkdir(pkgPath, { recursive: true })
      await fs.writeFile(
        path.join(pkgPath, 'package.json'),
        JSON.stringify({ name: `regular-${i}`, version: '1.0.0' })
      )
    }

    // 10 packages with plugins
    for (let i = 0; i < 10; i++) {
      await createTestPackage(tempDir, `plugin-pkg-${i}`, {
        name: `plugin-${i}`,
        version: '1.0.0',
        description: `Plugin ${i}`,
        skillPath: '.claude-plugin/skill'
      })
    }

    const start = Date.now()
    const providers = await scanDependencies(tempDir)
    const duration = Date.now() - start

    console.log(`Scanned 100 packages in ${duration}ms`)
    expect(providers).toHaveLength(10)
    expect(duration).toBeLessThan(2000)
  })
})
```

### 6.3 Error Handling Tests

**File**: `src/lib/error-handling.test.js`

```javascript
// Test various error scenarios:
// - Corrupt cache file
// - Corrupt settings file
// - Malformed marketplace.json
// - Permission errors
// - Disk space errors
// - Conflicting plugin names
// etc.
```

### 6.4 Phase 6 Verification

**Checklist**:
- [ ] Hook setup guide written
- [ ] Performance tests added and passing
- [ ] Error handling tests comprehensive
- [ ] End-to-end manual testing complete
- [ ] Documentation reviewed and complete
- [ ] All tests passing
- [ ] Performance targets met (cache <100ms, scan <2s)
- [ ] Code committed: `git commit -m "Phase 6: Documentation and testing polish"`

---

## Post-Migration Tasks

### 1. Version Bump

Update version in `package.json`:

```json
{
  "version": "2.0.0-alpha.1"
}
```

### 2. Build and Test

```bash
make clean
make build
make test
make lint
```

### 3. Create Release

```bash
git tag v2.0.0-alpha.1
git push origin feature/plugin-auto-discovery
git push --tags
```

### 4. Create Pull Request

- Title: "v2.0.0: Complete architecture redesign for auto-discovery"
- Description: Link to design-overview.md and architecture-update.md
- Include migration guide for users and library authors
- Request review

### 5. Publish Alpha Release

```bash
npm publish --tag alpha
```

### 6. Announcement

- Update GitHub README
- Post announcement with migration guide
- Notify library authors who might be affected

---

## Success Metrics

After implementation, verify:

- [ ] Scanner discovers `.claude-plugin/marketplace.json` in dependencies
- [ ] Cache hit completes in <100ms
- [ ] Full scan of 100 deps completes in <2s
- [ ] Settings file updated without corruption
- [ ] Merge logic preserves existing settings
- [ ] Disabled plugins respected
- [ ] `air view` shows accurate status
- [ ] `air sync` enables new plugins
- [ ] Hook integration works
- [ ] Restart notification displayed when needed
- [ ] Test coverage >90% on core modules
- [ ] All edge cases handled gracefully
- [ ] Documentation complete and accurate

---

## Rollback Plan

If critical issues discovered:

1. Revert to tag: `git checkout pre-v2-migration`
2. Create hotfix branch: `git checkout -b hotfix/revert-v2`
3. Publish rollback: `npm publish --tag latest`
4. Communicate rollback to users
5. Analyze issues and plan fixes

---

## Timeline Summary

| Week | Phase | Deliverable |
|------|-------|-------------|
| 1-2 | Phase 1: Foundation | Scanner, parser, types updated |
| 2-3 | Phase 2: Settings Manager | Settings management complete |
| 3-4 | Phase 3: View Command | Status visibility working |
| 4-5 | Phase 4: Sync Command | Auto-enablement working |
| 5-6 | Phase 5: Cleanup | Old code removed, docs updated |
| 6 | Phase 6: Polish | Hook docs, performance, testing |

Total: **6 weeks** to production-ready v2.0.0-alpha.1

---

## Notes

- Commit frequently (end of each major task)
- Run tests before each commit
- Keep phases focused and deliverable
- Don't hesitate to adjust timeline if needed
- Document any deviations from plan
- Celebrate milestones! 🎉
