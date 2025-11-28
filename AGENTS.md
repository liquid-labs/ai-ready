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
Scanner → Settings Manager → Commands
```

1. **Scanner** (`src/lib/scanner.js`)
   - Scans direct dependencies from `package.json` (dependencies + devDependencies)
   - Discovers packages with `.claude-plugin/marketplace.json`
   - Parses marketplace declarations with plugin arrays
   - Returns `MarketplaceProvider[]`

2. **Settings Manager** (`src/lib/storage/claude-settings.js`)
   - Non-destructively updates `$HOME/.claude/settings.json`
   - Manages `plugins.enabled`, `plugins.disabled`, `plugins.marketplaces`
   - Respects user choices (never re-enables disabled plugins)
   - Creates marketplace entries for each marketplace provider

3. **Commands** (`src/lib/commands/*.js`)
   - **plugins-view**: Display plugin status (project or all)
   - **plugins-sync**: Discover and enable plugins automatically

### Marketplace Provider System

**Marketplace-Based Discovery:**

- **Marketplace Format:**
  - Declaration: `.claude-plugin/marketplace.json` in package root
  - Contains: `name`, `owner`, and `plugins` array
  - Each plugin has `name`, `source`, and optional metadata
  - Package distributed via npm (part of `dependencies` or `devDependencies`)

- **Discovery Process:**
  1. Read `package.json` dependencies/devDependencies
  2. Check each package for `.claude-plugin/marketplace.json`
  3. Parse marketplace declaration
  4. Extract plugin entries from the `plugins` array

- **Settings Integration:**
  - Marketplace name: from `marketplace.json` `name` field
  - Plugin key: `{pluginName}@{marketplaceName}`
  - Settings structure: `plugins.marketplaces[marketplaceName]`
  - Enabled plugins: `plugins.enabled[]`
  - Disabled plugins: `plugins.disabled[]`

### Key Data Types

From `src/lib/types.js`:

```javascript
MarketplaceProvider {
  packageName: string           // npm package name
  version: string               // Package version from package.json
  path: string                  // Absolute path to package directory
  marketplaceDeclaration: MarketplaceDeclaration
}

MarketplaceDeclaration {
  name: string                  // Marketplace identifier (kebab-case)
  owner: {                      // Marketplace maintainer info
    name?: string
    email?: string
    url?: string
  }
  plugins: PluginEntry[]        // Array of plugin entries
  metadata?: {                  // Optional metadata
    description?: string
    version?: string
    pluginRoot?: string
  }
}

PluginEntry {
  name: string                  // Plugin identifier (kebab-case)
  source: string | object       // Relative path or source object
  version?: string              // Plugin version
  description?: string          // Brief description
  author?: string | object      // Author info
  commands?: string | string[]  // Custom command paths
  agents?: string | string[]    // Agent definition paths
  hooks?: string | object       // Hook configuration
  mcpServers?: string | object  // MCP server configuration
}

PluginState {
  name: string                  // Plugin name
  status: 'enabled'|'disabled'|'not-installed'
  source: string                // Plugin source location
  version: string               // Plugin version
  description: string           // Plugin description
  marketplace: string           // Marketplace name
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
            source: string      // Plugin source location
          }
        }
      }
    }
  }
}
```

### Module Organization

**Directory Structure:**
- `src/lib/` - Core modules (scanner, types)
- `src/lib/commands/` - CLI command implementations
- `src/lib/parsers/` - JSON parsing and validation
- `src/lib/schemas/` - JSON Schema definitions and validators
- `src/lib/storage/` - **Persistent state & file I/O** (claude-settings)

**Layered Dependencies:**
```
CLI (air.mjs)
  ↓
Commands (commands/*.js)
  ↓
Core (scanner.js, types.js) + Storage (storage/*.js)
  ↓
Parsers (parsers/*.js) + Schemas (schemas/*.js)
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

// Create test package with marketplace (legacy format auto-converted)
await createTestPackage(tempDir, 'my-lib', {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'Test plugin'
})

// Or provide full marketplace format
await createTestPackage(tempDir, 'my-lib', {
  name: 'my-marketplace',
  owner: { name: 'Test' },
  plugins: [
    { name: 'plugin-a', source: './plugins/a' },
    { name: 'plugin-b', source: './plugins/b' }
  ]
})
```

### Parameterized Tests
Use `it.each()` for data-driven tests:

```javascript
it.each([
  ['valid provider', validProvider, true],
  ['missing name', invalidProvider, false],
])('should validate %s', (desc, input, expected) => {
  expect(isValidMarketplaceProvider(input)).toBe(expected)
})
```

## Code Conventions

### JSDoc Type System
- All modules use JSDoc (no TypeScript)
- Import types: `@import { MarketplaceProvider } from './types'`
- Inline types: `@param {string[]} dependencies`
- Return types: `@returns {Promise<MarketplaceProvider[]>}`

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
- **Marketplace detection**: Checks for `.claude-plugin/marketplace.json`
- **Schema validation**: Validates marketplace.json against official Claude Code schema

### Settings Manager Behavior
- **Non-destructive merging**: Preserves existing settings, only adds/updates plugins
- **User choice respect**: Never re-enables plugins in `disabled` array
- **Marketplace creation**: Creates marketplace entry for each marketplace provider
- **Plugin key format**: `{pluginName}@{marketplaceName}` (kebab-case)
- **Settings location**: `$HOME/.claude/settings.json`

### Command Behavior
- **`air plugins view`** (or `air plugins view [path]`):
  - Without `--all`: Shows plugins from current project's dependencies
  - With `--all`: Shows all plugins in Claude Code settings
  - Output: Table with status (enabled/disabled/not-installed)
- **`air plugins sync`** (or `air sync` shortcut):
  - Scans dependencies → Updates settings → Enables new plugins
  - Respects disabled plugins (won't re-enable)
  - `--quiet` flag: Suppresses output (for hooks)

### Validation Layers
1. **Type validation** (`types.js`) - Structure checks via `isValidMarketplaceProvider()`, `isValidPluginEntry()`, `isValidPluginState()`
2. **Schema validation** (`schemas/marketplace-validator.js`) - marketplace.json and plugin.json against JSON Schema using ajv
3. **Business validation** (commands) - Dependency presence, file existence

## Key Files Reference

### CLI
- `src/cli/air.mjs` - Command routing (Commander.js)

### Commands
- `src/lib/commands/plugins-view.js` - Display plugin status
- `src/lib/commands/plugins-sync.js` - Discover and enable plugins

### Core Modules
- `src/lib/scanner.js` - Marketplace discovery logic
- `src/lib/types.js` - Type definitions and constants
- `tests/unit/lib/test-lib.js` - Test fixture helpers

### Parsers & Schemas
- `src/lib/parsers/marketplace-json.js` - Parse and validate marketplace.json
- `src/lib/schemas/marketplace-validator.js` - JSON Schema validation
- `src/lib/schemas/claude-marketplace-schema.json` - Marketplace JSON Schema
- `src/lib/schemas/plugin-manifest-schema.json` - Plugin manifest JSON Schema

### Storage
- `src/lib/storage/claude-settings.js` - Claude Code settings integration
- `src/lib/storage/claude-config.js` - Configuration paths

## Related Documentation

- `CHANGELOG.md` - Version history and migration guides
- `README.md` - User-facing documentation
