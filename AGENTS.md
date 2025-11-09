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
cd test-staging && npx jest lib/core/scanner.test.js
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

1. **Scanner** (`src/lib/core/scanner.js`)
   - Discovers integrations in `node_modules/*/ai-ready/integrations/`
   - Parses frontmatter from `AI_INTEGRATION.md` (generic) and `claude-skill/SKILL.md` (skills)
   - Returns `IntegrationProvider[]` with available types

2. **Cache** (`src/lib/core/cache.js`)
   - Stores scan results in `.aircache.json`
   - Validates cache against `package.json` and `package-lock.json` mtimes
   - Invalidates on dependency changes

3. **Registry** (`src/lib/core/registry.js`)
   - Tracks installed integrations in two formats:
     - `.claude/skills/` (symlinks) - Claude Skills
     - `AGENTS.md` (Markdown table) - Generic integrations
   - Overlays installation status onto provider data

4. **Commands** (`src/lib/commands/*.js`)
   - Orchestrate the flow: load → filter → display/modify

### Integration Type System

**Two Types, Independent Installation:**

- **Claude Skills** (`claudeSkill`)
  - File: `ai-ready/integrations/<Name>/claude-skill/SKILL.md`
  - Registry: `.claude/skills/` (directory of symlinks)
  - Installation: Symlink `.claude/skills/<skill-name> → <library-path>/ai-ready/integrations/<Name>/claude-skill`
  - Flag: `--skill`

- **Generic Integrations** (`genericIntegration`)
  - File: `ai-ready/integrations/<Name>/AI_INTEGRATION.md`
  - Registry: `AGENTS.md` or `CLAUDE.md` (Markdown table)
  - Installation: Listed in markdown table (no separate tracking needed)
  - Flag: `--generic`

**Dual-Type Support:** An integration can provide both types by including both files. Users can install one or both types independently.

### Key Data Types

From `src/lib/core/types.js`:

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

**Layered Dependencies:**
```
CLI (air.mjs)
  ↓
Commands (commands/*.js)
  ↓
Core (core/*.js)
  ↓
Parsers (parsers/*.js)
```

- **No circular dependencies**
- **Named exports only** (no default exports)
- **types.js is dependency-free** (pure data/constants)

## Testing Patterns

### Test Helper
Use `createTestLibrary()` from `src/lib/core/test-lib.js` to create fixture libraries:

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
- Import types: `@import { Integration } from './types.js'`
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
  - Installation: Creates symlink in `.claude/skills/<skill-name>`
  - Removal: Deletes symlink
  - Detection: Checks for symlink existence
- **Generic Integrations:**
  - Installation: Writes to **first** file in `DEFAULT_CONFIG.registryFiles.generic` array
  - Removal: Removes entry from table
  - Detection: Parses markdown tables from all configured files
  - **Multiple generic files:** Reads from all, merges results

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

- `src/cli/air.mjs` - Command routing (Commander.js)
- `src/lib/core/scanner.js` - Discovery logic
- `src/lib/core/cache.js` - Performance optimization
- `src/lib/core/registry.js` - Installation state management
- `src/lib/core/types.js` - Type definitions and constants
- `src/lib/core/test-lib.js` - Test fixture helper
- `src/lib/parsers/frontmatter.js` - YAML frontmatter parser

## Related Documentation

- `docs/AIR_PROTOCOL_SPEC.md` - Protocol specification
- `docs/AIR_PROTOCOL_LIBRARY_AUTHOR_GUIDE.md` - Guide for package authors
- `README.md` - User-facing documentation
