# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ai-ready** is a CLI tool that automatically discovers and enables Claude Code plugins bundled within npm dependencies. The tool scans direct dependencies (from `package.json`), detects packages with `.claude-plugin/marketplace.json`, and non-destructively updates Claude Code's settings to enable discovered plugins.

## Development Commands

### Testing & Quality
```bash
make test          # Run all Jest tests with coverage
make lint          # Run ESLint via fandl wrapper
make lint-fix      # Auto-fix linting issues
make qa            # Run both test and lint
```

### Build
```bash
make build         # Transpile source with Babel and bundle CLI with Rollup
make all           # Build + generate documentation
```

### Running Single Tests
```bash
# Tests run against transpiled code in test-staging/
cd test-staging && npx jest lib/scanner.test.js
```

### Important Build Details
- Source: `src/` (CommonJS with `.mjs` for CLI)
- Test staging: `test-staging/` (Babel-transpiled for Jest)
- Build output: `dist/ai-ready-exec.js` (bundled executable)
- QA reports: `qa/` (coverage, lint results)
- Build configs come from `@liquid-labs/sdlc-*` packages

## Architecture

### Core Data Flow

```
Scanner → Cache → Settings Manager → Commands
```

1. **Scanner** (`src/lib/scanner.js`)
   - Scans direct dependencies from `package.json` (dependencies + devDependencies)
   - Discovers packages with `.claude-plugin/marketplace.json`
   - Resolves plugin source paths (skillPath)
   - Returns `PluginProvider[]`

2. **Cache** (`src/lib/storage/cache.js`)
   - Stores scan results in `.aircache.json`
   - Validates cache against `package.json` and `package-lock.json` mtimes
   - Invalidates on dependency changes
   - Speeds up repeated scans

3. **Settings Manager** (`src/lib/storage/settings-manager.js`)
   - Non-destructively updates `$HOME/.claude/settings.json`
   - Manages `plugins.enabled`, `plugins.disabled`, `plugins.marketplaces`
   - Respects user choices (never re-enables disabled plugins)
   - Creates marketplace entries for each plugin provider

4. **Commands** (`src/lib/commands/*.js`)
   - **view**: Display plugin status (project or all)
   - **sync**: Discover and enable plugins automatically

### Plugin Provider System

**Single Type, Automatic Discovery:**

- **Plugin Format:**
  - Declaration: `.claude-plugin/marketplace.json` in package root
  - Skill code: Specified by `skillPath` field (typically `.claude-plugin/skill/`)
  - Package distributed via npm (part of `dependencies` or `devDependencies`)

- **Discovery Process:**
  1. Read `package.json` dependencies/devDependencies
  2. Check each package for `.claude-plugin/marketplace.json`
  3. Parse plugin declaration
  4. Resolve absolute paths to skill directories

- **Settings Integration:**
  - Marketplace name: `{packageName}-marketplace`
  - Plugin key: `{pluginName}@{marketplaceName}`
  - Settings structure: `plugins.marketplaces[marketplaceName]`
  - Enabled plugins: `plugins.enabled[]`
  - Disabled plugins: `plugins.disabled[]`

### Key Data Types

From `src/lib/types.js`:

```javascript
PluginProvider {
  packageName: string           // npm package name
  version: string               // Package version from package.json
  path: string                  // Absolute path to package directory
  pluginDeclaration: PluginDeclaration
}

PluginDeclaration {
  name: string                  // Plugin name
  version: string               // Plugin version
  description: string           // Plugin description
  skillPath: string             // Relative path to skill directory
}

PluginState {
  name: string                  // Plugin name
  status: 'enabled'|'disabled'|'not-installed'
  source: string                // Absolute path to plugin source
  version: string               // Plugin version
  description: string           // Plugin description
}

CacheData {
  scannedAt: string             // ISO timestamp
  packageJsonMTime: number      // Unix mtime (ms)
  packageLockMTime: number
  providers: PluginProvider[]
}

ClaudeSettings {
  plugins: {
    enabled: string[]           // Plugin keys
    disabled: string[]          // Plugin keys
    marketplaces: {
      [name]: {
        source: { type: 'directory', path: string }
        plugins: {
          [pluginName]: {
            version: string
            skillPath: string   // Relative path within source
          }
        }
      }
    }
  }
}
```

### Module Organization

**Directory Structure:**
- `src/lib/` - Core modules (scanner, types, test helpers)
- `src/lib/commands/` - CLI command implementations
- `src/lib/storage/` - **Persistent state & file I/O** (cache, settings-manager)

**Layered Dependencies:**
```
CLI (air.mjs)
  ↓
Commands (commands/*.js)
  ↓
Core (scanner.js, types.js) + Storage (storage/*.js)
```

**Key Principles:**
- **No circular dependencies**
- **Named exports only** (no default exports)
- **types.js is dependency-free** (pure data/constants)
- **Storage layer** - All file I/O operations consolidated in `src/lib/storage/`

## Testing Patterns

### Test Helpers
Use helpers from `tests/unit/lib/test-lib.js`:

```javascript
import { createPackageJson, createTestPackage } from './test-lib'

// Create root package.json with dependencies
await createPackageJson(tempDir, ['my-lib', '@scope/other-lib'])

// Create test package with plugin
await createTestPackage(tempDir, 'my-lib', {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'Test plugin',
  skillPath: '.claude-plugin/skill'
})
```

### Parameterized Tests
Use `it.each()` for data-driven tests:

```javascript
it.each([
  ['valid provider', validProvider, true],
  ['missing name', invalidProvider, false],
])('should validate %s', (desc, input, expected) => {
  expect(isValidPluginProvider(input)).toBe(expected)
})
```

## Code Conventions

### JSDoc Type System
- All modules use JSDoc (no TypeScript)
- Import types: `@import { PluginProvider } from './types'`
- Inline types: `@param {string[]} dependencies`
- Return types: `@returns {Promise<PluginProvider[]>}`

### Error Handling

**CLI Commands:**
```javascript
/* eslint-disable no-console, no-process-exit */

try {
  // logic
} catch (error) {
  console.error('Error:', error.message)
  process.exit(1)
}
```

**Core Modules:**
```javascript
try {
  const content = await fs.readFile(path, 'utf8')
} catch (error) {
  if (error.code === 'ENOENT') {
    return null  // Expected - file not found
  }
  throw error  // Unexpected - propagate
}
```

### Async Patterns
- Use `async/await` throughout (no callbacks, no `.then()`)
- Use `Promise.all()` for parallel operations:
  ```javascript
  const results = await Promise.all(
    items.map(async (item) => processItem(item))
  )
  ```

### File I/O
- Always use `path.resolve(baseDir, relativePath)` for consistency
- Default `baseDir` is `process.cwd()`
- Non-destructive updates: read → merge → write

## Important Implementation Details

### Scanner Behavior
- **Dependency-only scanning**: Only scans packages listed in `package.json` dependencies/devDependencies
- **Package resolution**: Uses `path.join(baseDir, 'node_modules', packageName)`
- **Scoped packages**: Handles `@scope/package` names correctly
- **Plugin detection**: Checks for `.claude-plugin/marketplace.json`
- **Path resolution**: Converts relative `skillPath` to absolute paths

### Settings Manager Behavior
- **Non-destructive merging**: Preserves existing settings, only adds/updates plugins
- **User choice respect**: Never re-enables plugins in `disabled` array
- **Marketplace creation**: Creates marketplace entry for each plugin provider
- **Plugin key format**: `{pluginName}@{marketplaceName}` (kebab-case)
- **Settings location**: `$HOME/.claude/settings.json`

### Cache Behavior
- **Cache location**: `.aircache.json` in project directory
- **Cache validation**: Compares mtimes of `package.json` and `package-lock.json`
- **Invalidation triggers**:
  - Cache file missing or malformed
  - `package.json` mtime changed
  - `package-lock.json` mtime changed
  - User passes `--no-cache` flag

### Command Behavior
- **view**:
  - Without `--all`: Shows plugins from current project's dependencies
  - With `--all`: Shows all plugins in Claude Code settings
  - Output: Table with status (enabled/disabled/not-installed)
- **sync**:
  - Scans dependencies → Updates settings → Enables new plugins
  - Respects disabled plugins (won't re-enable)
  - `--quiet` flag: Suppresses output (for hooks)
  - `--no-cache` flag: Forces fresh scan

### Validation Layers
1. **Type validation** (`types.js`) - Structure checks via `isValidPluginProvider()`, `isValidPluginState()`
2. **Schema validation** - marketplace.json against `MARKETPLACE_JSON_SCHEMA`
3. **Business validation** (commands) - Dependency presence, file existence

## Key Files Reference

### CLI
- `src/cli/air.mjs` - Command routing (Commander.js)

### Commands
- `src/lib/commands/view.js` - Display plugin status
- `src/lib/commands/sync.js` - Discover and enable plugins

### Core Modules
- `src/lib/scanner.js` - Plugin discovery logic
- `src/lib/types.js` - Type definitions and constants
- `tests/unit/lib/test-lib.js` - Test fixture helpers

### Storage
- `src/lib/storage/cache.js` - Scan result caching
- `src/lib/storage/settings-manager.js` - Claude Code settings integration

## Related Documentation

- `CHANGELOG.md` - Version history and migration guides
- `README.md` - User-facing documentation
