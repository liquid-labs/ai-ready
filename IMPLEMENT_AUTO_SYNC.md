# Implementation Plan: Auto-sync Plugin Architecture

## Overview

This document outlines the implementation plan for transforming ai-ready into a self-hosted Claude Code plugin that provides automatic plugin discovery via session-start hooks, along with restructuring commands into namespaces and adding JSON output support.

## Goals

1. **Command Restructuring**: Move commands to logical namespaces (`plugins`, `hooks`)
2. **JSON Output Support**: Add `--json` flag following CLI industry standards
3. **Self-Hosted Plugin**: Make ai-ready itself a Claude Code plugin
4. **Auto-sync Hook**: Automatically run `air sync` on Claude Code session start

## Design Decisions

### 1. Command Namespace Structure

**Breaking Changes**:
- ❌ Remove `air view` (no longer works)
- ✅ Add `air plugins view` (new canonical command)
- ✅ Add `air plugins sync` (new canonical command)
- ✅ Keep `air sync` as shortcut alias (backward compatibility)

**Rationale**:
- Groups plugin-related operations under `plugins` namespace
- Reserves `hooks` namespace for hook management
- Maintains consistency if adding future namespaces (e.g., `air config`)

### 2. Plural vs Singular Namespaces

**Decision**: Use plural (`hooks`, `plugins`)

**Rationale**:
- Aligns with RESTful and database naming conventions
- Implies managing collections of resources
- More natural for list-style commands (`air hooks list`, `air plugins view`)
- User preference and organizational consistency

### 3. JSON Output Format

**Pattern**: JSON as source of truth, human-readable text derived from it

**Industry precedent**: GitHub CLI, kubectl, Docker, npm, Terraform all use `--json` flag

**Approach**:
```javascript
// 1. Build JSON structure (source of truth)
const result = {
  command: 'sync',
  changes: { added: [...], updated: [...], skipped: [...] },
  status: 'success'
}

// 2. Output JSON if --json flag
if (options.json) {
  console.log(JSON.stringify(result, null, 2))
  return
}

// 3. Derive human-readable from JSON
const text = result.changes.added.length === 0
  ? 'No changes made'
  : `Installed ${result.changes.added.length} plugin${result.changes.added.length === 1 ? '' : 's'}:\n- ${result.changes.added.map(p => p.name).join('\n- ')}`
console.log(text)
```

### 4. Plugin Directory Structure

**Decision**: Nest AI-related components under `ai-ready/` directory

**Structure**:
```
ai-ready/                    # npm package root
├── .claude-plugin/
│   └── plugin.json         # Plugin metadata (at root per Claude Code standard)
├── ai-ready/               # Nested namespace for AI components
│   ├── hooks/
│   │   └── hooks.json      # SessionStart hook definition
│   └── scripts/
│       └── session-start.sh # Hook implementation (bash)
└── src/                    # CLI tool source code
```

**Rationale**:
- Reduces root-level clutter (2 dirs instead of 3)
- Organizes AI-related components together
- Scales well for projects with multiple AI components (skills, commands, agents)
- `.claude-plugin/` stays at root (Claude Code convention)

### 5. Hook Implementation Language

**Decision**: Use bash script (`.sh`) instead of Node.js (`.cjs`)

**Rationale**:
- Simple task: just call `air sync --quiet`
- No need for npm dependencies
- Faster execution (no Node.js startup overhead)
- Standard shell scripting is sufficient

## Implementation Phases

### Phase 1: Command Restructuring (Breaking Changes)

**Tasks**:
1. Create new command namespace structure in `src/cli/air.mjs`:
   ```javascript
   // New structure
   program
     .command('plugins')
     .description('Manage Claude Code plugins')

   program
     .command('plugins view [path]')
     .description('Show plugins discovered in project')
     .option('--all', 'Show all plugins configured in Claude Code')
     .option('--json', 'Output JSON format')
     .action(async (path, options) => {
       await pluginsViewCommand(path, options)
     })

   program
     .command('plugins sync [path]')
     .description('Discover and enable plugins from dependencies')
     .option('--quiet', 'Suppress output (for hooks)')
     .option('--json', 'Output JSON format')
     .action(async (path, options) => {
       await pluginsSyncCommand(path, options)
     })

   // Shortcut alias (backward compatibility)
   program
     .command('sync [path]')
     .description('Alias for "plugins sync"')
     .option('--quiet', 'Suppress output (for hooks)')
     .option('--json', 'Output JSON format')
     .action(async (path, options) => {
       await pluginsSyncCommand(path, options)
     })
   ```

2. Move command implementations:
   - Rename `src/lib/commands/view.js` → `src/lib/commands/plugins-view.js`
   - Rename `src/lib/commands/sync.js` → `src/lib/commands/plugins-sync.js`
   - Update imports in CLI router

3. Update command exports:
   ```javascript
   // src/lib/commands/plugins-view.js
   export async function pluginsViewCommand(path, options) { /* ... */ }

   // src/lib/commands/plugins-sync.js
   export async function pluginsSyncCommand(path, options) { /* ... */ }
   ```

**Breaking Changes**:
- `air view` no longer works (removed)
- Users must use `air plugins view`
- Requires major version bump (1.x.x → 2.0.0)

**Migration Guide for Users**:
```bash
# Old command (no longer works)
air view
air view --all

# New commands
air plugins view
air plugins view --all

# Sync command (both work)
air sync              # Still works (shortcut)
air plugins sync      # Canonical form
```

### Phase 2: Add --json Flag Support

**JSON Output Schemas**:

**For `air plugins sync --json`**:
```typescript
{
  command: 'sync',
  timestamp: string,              // ISO 8601 format
  scannedPath: string,            // Absolute path to project
  discovered: Array<{
    pluginName: string,
    packageName: string,
    version: string,
    description: string,
    source: string                // Absolute path to package
  }>,
  changes: {
    added: string[],              // Plugin keys added
    updated: string[],            // Plugin keys updated
    skipped: string[]             // Plugin keys skipped (disabled)
  },
  status: 'success' | 'partial' | 'error',
  errors?: Array<{
    pluginName?: string,
    packageName?: string,
    error: string,
    code?: string
  }>,
  restartRequired: boolean
}
```

**For `air plugins view --json`**:
```typescript
{
  command: 'view',
  timestamp: string,
  scannedPath?: string,           // Only present if not --all
  all: boolean,                   // True if --all flag used
  plugins: Array<{
    name: string,                 // Plugin name
    packageName: string,          // Package name
    version: string,
    description: string,
    status: 'enabled' | 'disabled' | 'not-installed',
    source: string,               // Absolute path or 'not-installed'
    marketplace?: string          // Marketplace name
  }>,
  summary: {
    enabled: number,
    disabled: number,
    notInstalled: number,
    total: number
  }
}
```

**Implementation Steps**:

1. **Update `src/lib/commands/plugins-sync.js`**:
   ```javascript
   export async function pluginsSyncCommand(path, options = {}) {
     const baseDir = path ? resolvePath(path) : process.cwd()

     // 1. Build JSON result structure (source of truth)
     const result = {
       command: 'sync',
       timestamp: new Date().toISOString(),
       scannedPath: baseDir,
       discovered: [],
       changes: { added: [], updated: [], skipped: [] },
       status: 'success',
       errors: [],
       restartRequired: false
     }

     try {
       // Existing logic, but populate result object
       const providers = await scanForPlugins(baseDir)
       result.discovered = providers.map(p => ({
         pluginName: p.pluginDeclaration.name,
         packageName: p.packageName,
         version: p.version,
         description: p.pluginDeclaration.description,
         source: p.path
       }))

       // Update settings and track changes
       const changesSummary = await updateSettings(providers)
       result.changes = changesSummary
       result.restartRequired = result.changes.added.length > 0

     } catch (error) {
       result.status = 'error'
       result.errors.push({
         error: error.message,
         code: error.code
       })
     }

     // 2. Output JSON if --json flag
     if (options.json) {
       console.log(JSON.stringify(result, null, 2))
       return
     }

     // 3. Output quiet mode (for hooks)
     if (options.quiet) {
       if (result.status === 'error') {
         process.exit(1)
       }
       return
     }

     // 4. Derive human-readable output from JSON
     outputHumanReadable(result)
   }

   function outputHumanReadable(result) {
     if (result.status === 'error') {
       console.error('Error:', result.errors[0].error)
       process.exit(1)
     }

     if (result.changes.added.length === 0) {
       console.log('No changes made')
       return
     }

     const count = result.changes.added.length
     console.log(`Installed ${count} plugin${count === 1 ? '' : 's'}:`)
     result.discovered
       .filter(p => result.changes.added.includes(`${p.pluginName}@${p.packageName}-marketplace`))
       .forEach(p => console.log(`- ${p.packageName}/${p.pluginName}`))

     if (result.restartRequired) {
       console.log('\n⚠️  Restart Claude Code to activate plugins')
     }
   }
   ```

2. **Update `src/lib/commands/plugins-view.js`**:
   ```javascript
   export async function pluginsViewCommand(path, options = {}) {
     // 1. Build JSON result
     const result = {
       command: 'view',
       timestamp: new Date().toISOString(),
       all: options.all || false,
       plugins: [],
       summary: { enabled: 0, disabled: 0, notInstalled: 0, total: 0 }
     }

     if (!options.all) {
       result.scannedPath = path ? resolvePath(path) : process.cwd()
     }

     // Populate result.plugins and result.summary
     // ... existing logic ...

     // 2. Output JSON if --json flag
     if (options.json) {
       console.log(JSON.stringify(result, null, 2))
       return
     }

     // 3. Derive human-readable output
     outputHumanReadable(result)
   }
   ```

3. **Add tests for JSON output**:
   ```javascript
   // tests/unit/lib/commands/plugins-sync.test.js
   describe('pluginsSyncCommand with --json', () => {
     it('should output valid JSON structure', async () => {
       const output = await captureOutput(() =>
         pluginsSyncCommand(testDir, { json: true })
       )
       const result = JSON.parse(output)
       expect(result).toHaveProperty('command', 'sync')
       expect(result).toHaveProperty('timestamp')
       expect(result).toHaveProperty('changes')
       expect(result.changes).toHaveProperty('added')
     })
   })
   ```

### Phase 3: Self-Hosted Plugin Structure

**Directory Creation**:

1. Create nested directory structure:
   ```bash
   mkdir -p ai-ready/hooks
   mkdir -p ai-ready/scripts
   ```

2. **Create `.claude-plugin/plugin.json`**:
   ```json
   {
     "name": "ai-ready-sync",
     "version": "1.0.0",
     "description": "Automatic Claude Code plugin discovery on session start",
     "author": {
       "name": "Zane Rockenbaugh",
       "email": "zane@liquid-labs.com"
     },
     "keywords": ["ai-ready", "plugin-discovery", "session-start", "hooks"],
     "license": "Apache-2.0"
   }
   ```

3. **Create `ai-ready/hooks/hooks.json`**:
   ```json
   {
     "SessionStart": [
       {
         "hooks": [
           {
             "type": "command",
             "command": "${CLAUDE_PLUGIN_ROOT}/ai-ready/scripts/session-start.sh"
           }
         ]
       }
     ]
   }
   ```

4. **Create `ai-ready/scripts/session-start.sh`**:
   ```bash
   #!/bin/bash
   # ai-ready session-start hook
   # Automatically discovers and enables Claude Code plugins from project dependencies

   # Don't fail the session if sync fails
   set +e

   # Only run if we're in a project with package.json
   if [ ! -f "${CLAUDE_PROJECT_DIR}/package.json" ]; then
     exit 0
   fi

   # Change to project directory
   cd "${CLAUDE_PROJECT_DIR}" || exit 0

   # Run air sync in quiet mode
   # This will discover and enable plugins from dependencies
   air sync --quiet

   # Always exit successfully to avoid blocking session start
   exit 0
   ```

5. **Make script executable**:
   ```bash
   chmod +x ai-ready/scripts/session-start.sh
   ```

6. **Update `package.json` files array** (to include plugin files in npm package):
   ```json
   {
     "files": [
       "dist/",
       ".claude-plugin/",
       "ai-ready/",
       "README.md",
       "LICENSE"
     ]
   }
   ```

7. **Update `.gitignore`** (ensure plugin files are tracked):
   ```
   # Don't ignore plugin files
   !.claude-plugin/
   !ai-ready/
   ```

**Testing the Plugin Structure**:

```bash
# After building, test the plugin manually
npm run build

# Create a test settings.json entry
cat << 'EOF' > /tmp/test-ai-ready-plugin.json
{
  "plugins": {
    "enabled": ["ai-ready-sync@ai-ready-test"],
    "disabled": [],
    "marketplaces": {
      "ai-ready-test": {
        "source": {
          "type": "directory",
          "path": "/path/to/ai-ready"
        },
        "plugins": {
          "ai-ready-sync": {
            "version": "1.0.0"
          }
        }
      }
    }
  }
}
EOF

# Verify hooks.json is valid JSON
cat ai-ready/hooks/hooks.json | jq .

# Verify script is executable
test -x ai-ready/scripts/session-start.sh && echo "Script is executable" || echo "Script NOT executable"
```

### Phase 4: Implement `air hooks install` Command

**Purpose**: Install ai-ready's session-start hook plugin into Claude Code settings

**Command Signature**:
```bash
air hooks install    # Install the hook
air hooks remove     # Remove the hook (future)
air hooks status     # Show hook status (future)
```

**Implementation**:

1. **Create `src/lib/commands/hooks-install.js`**:

```javascript
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import { readSettings, writeSettings } from '../storage/settings-manager.js'

/**
 * Install ai-ready's session-start hook plugin
 *
 * @param {object} options - Command options
 * @param {boolean} [options.json] - Output JSON format
 * @returns {Promise<void>}
 */
export async function hooksInstallCommand(options = {}) {
  /* eslint-disable no-console, no-process-exit */

  const result = {
    command: 'hooks install',
    timestamp: new Date().toISOString(),
    status: 'success',
    hook: 'session-start',
    plugin: 'ai-ready-sync',
    installed: false,
    alreadyInstalled: false,
    disabled: false
  }

  try {
    // 1. Locate ai-ready installation directory
    const __filename = fileURLToPath(import.meta.url)
    const aiReadyRoot = path.resolve(__filename, '../../../../')  // Up to package root

    // Verify plugin structure exists
    const pluginJsonPath = path.join(aiReadyRoot, '.claude-plugin', 'plugin.json')
    const hooksJsonPath = path.join(aiReadyRoot, 'ai-ready', 'hooks', 'hooks.json')

    try {
      await fs.access(pluginJsonPath)
      await fs.access(hooksJsonPath)
    } catch (error) {
      throw new Error('ai-ready plugin structure not found. This may be an installation issue.')
    }

    // 2. Read ai-ready version from package.json
    const packageJsonPath = path.join(aiReadyRoot, 'package.json')
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
    const version = packageJson.version

    result.version = version
    result.aiReadyPath = aiReadyRoot

    // 3. Read Claude Code settings
    const settingsPath = path.join(process.env.HOME, '.claude', 'settings.json')
    const settings = await readSettings(settingsPath)

    // 4. Create marketplace entry for ai-ready
    const marketplaceName = 'ai-ready-global-marketplace'
    const pluginName = 'ai-ready-sync'
    const pluginKey = `${pluginName}@${marketplaceName}`

    result.marketplace = marketplaceName
    result.pluginKey = pluginKey

    // 5. Check if plugin is already installed
    if (settings.plugins.enabled.includes(pluginKey)) {
      result.alreadyInstalled = true
      result.status = 'success'

      if (options.json) {
        console.log(JSON.stringify(result, null, 2))
        return
      }

      console.log('✓ ai-ready session-start hook is already installed')
      return
    }

    // 6. Check if plugin was explicitly disabled
    if (settings.plugins.disabled.includes(pluginKey)) {
      result.disabled = true
      result.status = 'warning'

      if (options.json) {
        console.log(JSON.stringify(result, null, 2))
        return
      }

      console.log('⚠️  ai-ready session-start hook was previously disabled')
      console.log('To re-enable, remove it from the disabled list in ~/.claude/settings.json')
      return
    }

    // 7. Add/update marketplace entry
    if (!settings.plugins.marketplaces) {
      settings.plugins.marketplaces = {}
    }

    settings.plugins.marketplaces[marketplaceName] = {
      source: {
        type: 'directory',
        path: aiReadyRoot
      },
      plugins: {
        [pluginName]: {
          version: version
        }
      }
    }

    // 8. Enable plugin
    if (!settings.plugins.enabled) {
      settings.plugins.enabled = []
    }

    settings.plugins.enabled.push(pluginKey)
    result.installed = true

    // 9. Write settings
    await writeSettings(settingsPath, settings)

    // 10. Output result
    if (options.json) {
      console.log(JSON.stringify(result, null, 2))
      return
    }

    console.log('✓ ai-ready session-start hook installed successfully')
    console.log('')
    console.log('The hook will automatically run "air sync" when you start a Claude Code session.')
    console.log('')
    console.log('⚠️  Restart Claude Code to activate the hook')

  } catch (error) {
    result.status = 'error'
    result.error = {
      message: error.message,
      code: error.code
    }

    if (options.json) {
      console.log(JSON.stringify(result, null, 2))
      process.exit(1)
    }

    console.error('Error installing hook:', error.message)
    process.exit(1)
  }
}
```

2. **Create `src/lib/commands/hooks-remove.js`** (future):

```javascript
export async function hooksRemoveCommand(options = {}) {
  // Remove ai-ready-sync from enabled list
  // Optionally add to disabled list
  // Implementation similar to install but in reverse
}
```

3. **Update `src/cli/air.mjs`** to add hooks commands:

```javascript
import { hooksInstallCommand } from '../lib/commands/hooks-install.js'

// Add hooks namespace
program
  .command('hooks')
  .description('Manage ai-ready hooks')

program
  .command('hooks install')
  .description('Install session-start hook for automatic plugin sync')
  .option('--json', 'Output JSON format')
  .action(async (options) => {
    await hooksInstallCommand(options)
  })
```

4. **Add tests**:

```javascript
// tests/unit/lib/commands/hooks-install.test.js
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { hooksInstallCommand } from '../../../../src/lib/commands/hooks-install.js'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

describe('hooksInstallCommand', () => {
  let tempClaudeDir
  let originalHome

  beforeEach(async () => {
    // Create temp .claude directory
    tempClaudeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-test-'))
    originalHome = process.env.HOME
    process.env.HOME = tempClaudeDir

    // Create initial settings.json
    await fs.mkdir(path.join(tempClaudeDir, '.claude'), { recursive: true })
    await fs.writeFile(
      path.join(tempClaudeDir, '.claude', 'settings.json'),
      JSON.stringify({ plugins: { enabled: [], disabled: [], marketplaces: {} } })
    )
  })

  afterEach(async () => {
    process.env.HOME = originalHome
    await fs.rm(tempClaudeDir, { recursive: true, force: true })
  })

  it('should install ai-ready hook successfully', async () => {
    await hooksInstallCommand()

    const settingsPath = path.join(tempClaudeDir, '.claude', 'settings.json')
    const settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'))

    expect(settings.plugins.enabled).toContain('ai-ready-sync@ai-ready-global-marketplace')
    expect(settings.plugins.marketplaces).toHaveProperty('ai-ready-global-marketplace')
  })

  it('should output JSON when --json flag is used', async () => {
    const output = await captureOutput(() => hooksInstallCommand({ json: true }))
    const result = JSON.parse(output)

    expect(result).toHaveProperty('command', 'hooks install')
    expect(result).toHaveProperty('status', 'success')
    expect(result).toHaveProperty('installed', true)
  })

  it('should detect already installed hook', async () => {
    // Install twice
    await hooksInstallCommand()
    await hooksInstallCommand()

    // Second install should detect existing installation
    // (test output or JSON result)
  })
})
```

### Phase 5: Documentation Updates

**Files to Update**:

1. **README.md**:
   - Update Quick Start section with new commands
   - Update Commands section with namespace structure
   - Add `air hooks install` documentation
   - Remove manual hook setup instructions (or mark as "Manual Setup (Alternative)")
   - Update examples

2. **CLAUDE.md**:
   - Update command reference with new structure
   - Document plugin architecture
   - Update testing commands

3. **CHANGELOG.md**:
   - Document breaking changes (2.0.0)
   - List new features
   - Add migration guide

**Example README.md Updates**:

```markdown
## Quick Start

1. Install ai-ready globally:
   ```bash
   npm install -g ai-ready
   ```

2. Install the auto-sync hook:
   ```bash
   air hooks install
   ```

3. Restart Claude Code

4. The hook will now automatically discover and enable plugins whenever you start a Claude Code session!

## Commands

### Plugin Management

#### `air plugins view [path]`

Show plugins discovered in the current project (or specified path).

```bash
air plugins view
air plugins view /path/to/project
air plugins view --json          # JSON output
```

#### `air plugins view --all`

Show all plugins configured in Claude Code (not just current project).

```bash
air plugins view --all
air plugins view --all --json
```

#### `air plugins sync [path]`

Discover and enable plugins from dependencies.

```bash
air plugins sync
air plugins sync --quiet         # For use in hooks
air plugins sync --json          # JSON output
```

#### `air sync` (shortcut)

Alias for `air plugins sync`.

```bash
air sync                         # Same as 'air plugins sync'
```

### Hook Management

#### `air hooks install`

Install ai-ready's session-start hook for automatic plugin discovery.

```bash
air hooks install
air hooks install --json
```

After installation, the hook automatically runs `air sync` when you start a Claude Code session.

## Migration from 1.x

**Breaking Changes in 2.0.0**:

- `air view` has been removed
- Use `air plugins view` instead
- `air sync` still works (shortcut for `air plugins sync`)

**Migration**:

```bash
# Old (1.x)
air view              → air plugins view
air view --all        → air plugins view --all
air sync              → air sync (still works) or air plugins sync

# New features (2.x)
air hooks install     → Install auto-sync hook
air plugins sync --json   → JSON output
```
```

4. **Create Migration Guide** (`docs/MIGRATION-2.0.md`):

```markdown
# Migration Guide: v1.x to v2.0

## Breaking Changes

### Command Restructuring

The `air view` command has been removed. Use `air plugins view` instead.

| v1.x | v2.0 |
|------|------|
| `air view` | `air plugins view` |
| `air view --all` | `air plugins view --all` |
| `air sync` | `air sync` (still works) or `air plugins sync` |

### Why the Change?

Commands are now organized into logical namespaces:
- `air plugins` - Plugin management
- `air hooks` - Hook management

This provides better organization and room for future expansion.

## New Features

### Automatic Plugin Discovery

Instead of manually configuring hooks, you can now install ai-ready's built-in hook:

```bash
air hooks install
```

This automatically runs `air sync` whenever you start a Claude Code session.

### JSON Output

Both view and sync commands now support `--json` output for automation:

```bash
air plugins view --json
air plugins sync --json
```

## Step-by-Step Migration

1. **Update global installation**:
   ```bash
   npm install -g ai-ready@2
   ```

2. **Update scripts and documentation**:
   - Replace `air view` with `air plugins view`
   - `air sync` continues to work unchanged

3. **Install auto-sync hook** (recommended):
   ```bash
   air hooks install
   ```

4. **Remove manual hook** (if you set one up):
   - Delete `~/.claude/hooks/session-start.sh` (if you created it manually)
   - Remove hook configuration from `~/.claude/settings.json` (if added manually)

5. **Restart Claude Code**

## Rollback

If you need to rollback to v1.x:

```bash
npm install -g ai-ready@1
```
```

## Testing Strategy

### Unit Tests

1. **Command tests**:
   - Test `plugins-sync.js` with `--json` flag
   - Test `plugins-view.js` with `--json` flag
   - Test `hooks-install.js` for various scenarios
   - Test JSON schema validation

2. **Integration tests**:
   - Test full command flow with temp directories
   - Test settings.json updates
   - Test plugin discovery and hook installation together

3. **Test coverage targets**:
   - Maintain >80% coverage
   - 100% coverage for critical paths (settings updates)

### Manual Testing Checklist

Before release:

- [ ] `air plugins view` shows plugins correctly
- [ ] `air plugins view --all` shows all Claude plugins
- [ ] `air plugins view --json` outputs valid JSON
- [ ] `air plugins sync` discovers and enables plugins
- [ ] `air plugins sync --json` outputs valid JSON
- [ ] `air sync` works as shortcut
- [ ] `air hooks install` successfully installs hook
- [ ] `air hooks install --json` outputs valid JSON
- [ ] Session-start hook runs automatically after install
- [ ] Session-start hook doesn't break Claude Code on errors
- [ ] Hook respects disabled plugins
- [ ] `air view` shows deprecation message or error
- [ ] All tests pass: `make test`
- [ ] Linting passes: `make lint`

### Test Projects

Create test scenarios:

1. **Empty project**: No dependencies
2. **Project with ai-ready plugins**: Verify discovery
3. **Project with mixed dependencies**: Some with plugins, some without
4. **Global installation**: Verify `air hooks install` works from global install
5. **Error scenarios**: Missing package.json, corrupted settings.json, permission errors

## Rollout Plan

### Version Numbering

- **v2.0.0**: Major version bump (breaking changes)

### Release Steps

1. **Pre-release testing** (v2.0.0-beta.1):
   - Internal testing
   - Beta release to npm
   - Community feedback

2. **Release candidate** (v2.0.0-rc.1):
   - Address beta feedback
   - Final testing
   - Documentation review

3. **Official release** (v2.0.0):
   - Publish to npm
   - Update GitHub releases
   - Announcement and migration guide

4. **Support**:
   - v1.x in maintenance mode (critical bugs only)
   - v2.x active development

## Success Metrics

- [ ] Zero critical bugs in first week
- [ ] >90% of users successfully migrate within one month
- [ ] No GitHub issues related to confusion about command structure
- [ ] Positive feedback on auto-sync feature

## Open Questions / Decisions Needed

1. **Deprecation timeline for v1.x**:
   - Option A: Immediate (v2.0.0 removes v1.x support)
   - Option B: 6-month support window
   - **Recommendation**: Option B (6-month maintenance window)

2. **Error handling in session-start hook**:
   - Current: Always exit 0 (never block session)
   - Alternative: Exit non-zero on critical errors?
   - **Recommendation**: Keep current approach (never block session)

3. **JSON schema validation**:
   - Should we provide a JSON schema file for --json output?
   - Useful for tools integrating with ai-ready
   - **Recommendation**: Yes, add in Phase 2 or 3

4. **Backward compatibility for `air view`**:
   - Option A: Hard error with migration instructions
   - Option B: Deprecation warning, still works but shows message
   - Option C: Silent redirect to `air plugins view`
   - **Recommendation**: Option A (clean break for v2.0)

## Timeline Estimate

- **Phase 1** (Command Restructuring): 4-6 hours
- **Phase 2** (JSON Support): 6-8 hours
- **Phase 3** (Plugin Structure): 2-3 hours
- **Phase 4** (Hooks Install): 4-6 hours
- **Phase 5** (Documentation): 3-4 hours
- **Testing & QA**: 4-6 hours

**Total**: ~23-33 hours (~3-4 days of development)

## References

- [Claude Code Plugin Documentation](https://code.claude.com/docs/en/plugins)
- [Claude Code Hooks Documentation](https://code.claude.com/docs/en/hooks)
- [GitHub CLI JSON Output](https://cli.github.com/manual/gh_help_formatting)
- [Semantic Versioning](https://semver.org/)
