# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ai-ready** is a CLI tool that implements the AIR (AI Ready) protocol, enabling developers to discover and install AI integrations bundled within their npm packages. The tool scans `node_modules`, manages installation state, and provides commands to interact with integrations.

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
Scanner → Cache → Registry → Commands
```

1. **Scanner** (`src/lib/scanner.js`)
   - Discovers integrations in `node_modules/*/ai-ready/integrations/`
   - Parses frontmatter from `AI_INTEGRATION.md` (generic) and `claude-skill/SKILL.md` (skills)
   - Returns `IntegrationProvider[]` with available types

2. **Cache** (`src/lib/storage/cache.js`)
   - Stores scan results in `.aircache.json`
   - Validates cache against `package.json` and `package-lock.json` mtimes
   - Invalidates on dependency changes

3. **Registry** (`src/lib/storage/registry.js` + `src/lib/storage/claude-plugin-registry.js`)
   - Tracks installed integrations in two formats:
     - `$HOME/.claude/plugins/installed_plugins.json` - Claude Skills (via plugin system)
     - `AGENTS.md` (Markdown table) - Generic integrations
   - Overlays installation status onto provider data

4. **Commands** (`src/lib/commands/*.js`)
   - Orchestrate the flow: load → filter → display/modify

### Integration Type System

**Two Types, Independent Installation:**

- **Claude Skills** (`claudeSkill`)
  - File: `ai-ready/integrations/<Name>/claude-skill/SKILL.md`
  - Registry: `$HOME/.claude/plugins/installed_plugins.json` and `$HOME/.claude/plugins/known_marketplaces.json`
  - Installation: Registers skill in Claude's plugin system (marketplace + installed plugin entries)
  - **Important:** Users must restart Claude Code after installing/removing skills for changes to take effect
  - Flag: `--skill`

- **Generic Integrations** (`genericIntegration`)
  - File: `ai-ready/integrations/<Name>/AI_INTEGRATION.md`
  - Registry: `AGENTS.md` or `CLAUDE.md` (Markdown table)
  - Installation: Listed in markdown table (no separate tracking needed)
  - Flag: `--generic`

**Dual-Type Support:** An integration can provide both types by including both files. Users can install one or both types independently.

### Key Data Types

From `src/lib/types.js`:

```javascript
Integration {
  name: string              // Integration name
  summary: string           // One-line description
  types: string[]           // Available: ['genericIntegration', 'claudeSkill']
  installedTypes: string[]  // Dynamically computed by checking filesystem/markdown
}

IntegrationProvider {
  libraryName: string       // npm package name
  version: string           // From package.json
  path: string             // Absolute path
  integrations: Integration[]
}

CacheData {
  scannedAt: string           // ISO timestamp
  packageJsonMTime: number    // Unix mtime (ms)
  packageLockMTime: number
  providers: IntegrationProvider[]
}
```

### Module Organization

**Directory Structure:**
- `src/lib/` - Core modules (scanner, types, test helpers)
- `src/lib/commands/` - CLI command implementations
- `src/lib/storage/` - **Persistent state & file I/O operations** (cache, registry, config, repos)
- `src/lib/parsers/` - Data format parsing utilities
- `src/lib/utils/` - General utilities (git operations)

**Layered Dependencies:**
```
CLI (air.mjs)
  ↓
Commands (commands/*.js)
  ↓
Core (scanner.js, types.js) + Storage (storage/*.js)
  ↓
Parsers (parsers/*.js) + Utilities (utils/*.js)
```

**Key Principles:**
- **No circular dependencies**
- **Named exports only** (no default exports)
- **types.js is dependency-free** (pure data/constants)
- **Storage layer** - All file I/O operations consolidated in `src/lib/storage/`

## Testing Patterns

### Test Helper
Use `createTestLibrary()` from `src/lib/test-lib.js` to create fixture libraries:

```javascript
await createTestLibrary(tempDir, 'my-lib', [
  {
    dirName: 'TestIntegration',
    generic: { name: 'TestInt', summary: 'Description' },
    skill: { name: 'SkillInt', summary: 'Skill description' }
  }
])
```

### Parameterized Tests
Use `it.each()` for data-driven tests (see `registry.test.js` for examples):

```javascript
it.each([
  ['case 1', input1, expected1],
  ['case 2', input2, expected2],
])('should handle %s', async (desc, input, expected) => {
  // test implementation
})
```

## Code Conventions

### JSDoc Type System
- All modules use JSDoc (no TypeScript)
- Import types: `@import { Integration } from './types'`
- Inline types: `@param {string[]} scanPaths`
- Return types: `@returns {Promise<IntegrationProvider[]>}`

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
- Create backups before modifying registry files:
  ```javascript
  await createBackup(filePath)  // Creates .bak file
  // ... modify and write
  ```

## Important Implementation Details

### Scanner Name Resolution Priority
1. Generic metadata name (if `AI_INTEGRATION.md` exists)
2. Skill metadata name (if `claude-skill/SKILL.md` exists)
3. Directory name (fallback)

### Registry Behavior
- **Claude Skills:**
  - Installation:
    1. Creates/updates marketplace entry in `$HOME/.claude/plugins/known_marketplaces.json`
    2. Adds plugin entry to `$HOME/.claude/plugins/installed_plugins.json`
    3. Uses library name as marketplace name (e.g., `my-lib-marketplace`)
    4. Plugin key format: `<skill-name-kebab-case>@<marketplace-name>`
  - Removal: Removes plugin entry from `installed_plugins.json`
  - Detection: Checks for plugin entry in `installed_plugins.json`
  - **Note:** Claude Code must be restarted for skill changes to take effect
- **Generic Integrations:**
  - Installation: Writes to **first** file in `DEFAULT_CONFIG.registryFiles.generic` array
  - Removal: Removes entry from table
  - Detection: Parses markdown tables from all configured files
  - **Multiple generic files:** Reads from all, merges results

### Plugin Registry Architecture

**Key Classes:**

1. **`ClaudePluginConfig`** (`src/lib/storage/claude-config.js`)
   - Pure configuration class holding plugin directory paths
   - Factory methods: `createDefault()` for production, `createForTest(testDir)` for tests
   - Separates configuration from operations (SRP)

2. **`ClaudePluginRegistry`** (`src/lib/storage/claude-plugin-registry.js`)
   - Manages Claude Skills registration in the plugin system
   - Factory methods: `createDefault()` for production, `createForTest(testDir)` for tests
   - Operations: `installPlugin()`, `removePlugin()`, `isPluginInstalled()`

**Usage Patterns:**

```javascript
// Production: Use singleton via getDefaultRegistry()
import { getDefaultRegistry } from './storage/claude-plugin-registry'

const registry = getDefaultRegistry()
await registry.installPlugin('my-lib', 'MySkill', '/path/to/lib', '1.0.0')

// Testing: Use factory method with test directory
import { ClaudePluginRegistry } from './storage/claude-plugin-registry'

const testRegistry = ClaudePluginRegistry.createForTest(tempDir)
await testRegistry.installPlugin('test-lib', 'TestSkill', '/path', '1.0.0')

// Commands call registry directly (no wrapper functions)
const registry = getDefaultRegistry()
const providersWithStatus = await loadInstallationStatus(
  providers,
  claudeSkillsDir,
  genericFiles,
  process.cwd(),
  registry  // Pass registry instance directly
)
```

**Design Principles:**
- **Dependency Injection:** Registry instance passed explicitly to functions
- **Factory Pattern:** `createDefault()` and `createForTest()` for instance creation
- **Singleton Pattern:** `getDefaultRegistry()` for production convenience
- **Test Isolation:** Test instances use temporary directories, never touch global config
- **No Wrapper Functions:** Commands call registry methods directly

### Validation Layers
1. **Type validation** (`types.js`) - Structure checks
2. **Format validation** (`parsers/frontmatter.js`) - YAML/frontmatter parsing
3. **Business validation** (commands) - Existence, availability, installation status

### Cache Invalidation
Cache is invalidated when:
- `package.json` mtime changes
- `package-lock.json` mtime changes
- Cache file is missing or malformed

## Key Files Reference

### CLI Commands
- `src/cli/air.mjs` - Command routing (Commander.js)
- `src/lib/commands/list.js` - List integrations
- `src/lib/commands/view.js` - View integration details
- `src/lib/commands/install.js` - Install integrations
- `src/lib/commands/remove.js` - Remove integrations
- `src/lib/commands/verify.js` - Verify integration metadata

### Core Modules
- `src/lib/scanner.js` - Discovery logic
- `src/lib/types.js` - Type definitions and constants
- `src/lib/test-lib.js` - Test fixture helper

### Storage (Persistent State & File I/O)
- `src/lib/storage/cache.js` - Performance optimization cache
- `src/lib/storage/registry.js` - Installation state management
- `src/lib/storage/claude-plugin-registry.js` - Claude plugin system integration
- `src/lib/storage/claude-config.js` - Plugin configuration class
- `src/lib/storage/config.js` - Remote repository configuration storage
- `src/lib/storage/remote-repos.js` - Git repository management

### Utilities
- `src/lib/utils/git.js` - Git repository utilities

### Parsers
- `src/lib/parsers/frontmatter.js` - YAML frontmatter parser

## Related Documentation

- `docs/AIR_PROTOCOL_SPEC.md` - Protocol specification
- `docs/AIR_PROTOCOL_LIBRARY_AUTHOR_GUIDE.md` - Guide for package authors
- `README.md` - User-facing documentation
