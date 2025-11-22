# AI-Ready Architecture Design

## System Purpose

**ai-ready** enables npm dependencies to describe themselves to AI coding agents through automatic plugin discovery and installation. The system focuses initially on Claude Code, with an architecture that supports other AI coding agents in the future.

The primary workflow is automatic: when a developer runs `air` (typically via a session-start hook), the tool scans their project's dependencies, discovers Claude Code plugins declared by those packages, and non-destructively updates Claude Code's settings to enable them. This allows library authors to bundle AI integrations that "just work" when their package is installed.

## Core Concepts

### Plugin Declaration

npm packages declare Claude Code plugins by including a `.claude-plugin/marketplace.json` file in their package root. This JSON file follows Claude Code's marketplace format and describes the plugin's metadata, capabilities, and location.

**Example `.claude-plugin/marketplace.json`:**
```json
{
  "name": "my-library-plugin",
  "version": "1.0.0",
  "description": "Helps developers work with my-library APIs",
  "skillPath": ".claude-plugin/skill"
}
```

### Discovery Process

The system scans `node_modules/` for packages containing `.claude-plugin/marketplace.json` declarations. For each discovered plugin:

1. Read and validate the marketplace declaration
2. Extract plugin metadata (name, version, description)
3. Determine the absolute path to the plugin content
4. Check current installation and enabled state in Claude Code settings

### Settings Management

Claude Code uses two levels of configuration:

1. **Global Settings** (`$HOME/.claude/settings.json`) - User-wide plugin configuration
2. **Local Settings** (`.claude/settings.json` in project root) - Project-specific marketplace configuration

The system performs non-destructive updates on both:

- **Merge Strategy**: Preserve existing settings, only add/update plugin entries
- **Respect Explicit Disables**: If a user has explicitly disabled a plugin, don't re-enable it
- **Track State**: Distinguish between "never installed," "installed but disabled," and "installed and enabled"
- **Team Repositories**: Configure remote Git repositories containing team/organization plugins

### Session Integration

The primary workflow runs automatically at session start (via hook or script):

1. Scan dependencies for plugin declarations
2. Compare discovered plugins with current settings
3. Update global settings if new plugins are found
4. Update local settings with team/organization marketplace references
5. Report status to user
6. Notify if Claude Code restart is needed

## Architecture Layers

### Layer 1: Discovery (Scanner)

**Responsibility**: Find `.claude-plugin/marketplace.json` files in dependencies

**Module**: `src/lib/scanner.js`

**Operations**:
- `scanDependencies(baseDir)` - Scan node_modules for plugin declarations
- Returns array of `PluginProvider` objects with metadata

**Data Structure**:
```javascript
PluginProvider {
  packageName: string         // npm package name
  version: string            // From package.json
  path: string              // Absolute path to package
  pluginDeclaration: {      // Parsed marketplace.json
    name: string
    version: string
    description: string
    skillPath: string
  }
}
```

**Discovery Algorithm**:
1. Enumerate top-level directories in `node_modules/` (including scoped packages)
2. For each package, check for `.claude-plugin/marketplace.json`
3. If found, read and parse the JSON
4. Read `package.json` for version information
5. Construct `PluginProvider` object with absolute paths

### Layer 2: Cache

**Responsibility**: Optimize performance by caching scan results

**Module**: `src/lib/storage/cache.js`

**Cache File**: `.air-plugin-cache.json` (project root)

**Cache Structure**:
```javascript
{
  scannedAt: string              // ISO timestamp
  packageJsonMTime: number       // Unix mtime (ms)
  packageLockMTime: number       // Unix mtime (ms)
  providers: PluginProvider[]    // Cached scan results
}
```

**Invalidation Triggers**:
- `package.json` modified (mtime changed)
- `package-lock.json` modified (mtime changed)
- Cache file missing or malformed

**Operations**:
- `loadProvidersWithCache(scanFn, baseDir)` - Load from cache or scan
- `invalidateCache(baseDir)` - Force cache refresh

### Layer 3: Settings Manager

**Responsibility**: Read and update Claude Code settings non-destructively

**Modules**:
- `src/lib/storage/claude-settings.js` (global settings)
- `src/lib/storage/local-settings.js` (project-local settings)

#### Global Settings (`$HOME/.claude/settings.json`)

**Settings Structure**:
```javascript
{
  // ... existing Claude Code settings ...
  "plugins": {
    "enabled": [
      "plugin-name-1",
      "plugin-name-2"
    ],
    "disabled": [
      "explicitly-disabled-plugin"
    ],
    "marketplaces": {
      "package-name-marketplace": {
        "source": {
          "type": "directory",
          "path": "/absolute/path/to/package"
        },
        "plugins": {
          "plugin-name": {
            "version": "1.0.0",
            "skillPath": ".claude-plugin/skill"
          }
        }
      }
    }
  }
}
```

**Operations**:
- `readGlobalSettings()` - Read global settings (create if missing)
- `updateGlobalSettings(providers)` - Merge new plugin providers
- `getPluginState(pluginName)` - Returns: 'enabled' | 'disabled' | 'not-installed'
- `enablePlugin(pluginName, provider)` - Add to enabled list and marketplace
- `disablePlugin(pluginName)` - Move to disabled list (preserve marketplace)

**Merge Strategy**:
1. Load existing settings JSON
2. Create `plugins` section if missing
3. For each discovered plugin:
   - Check if in `disabled` list → skip (respect user choice)
   - Check if already in `enabled` list → update marketplace metadata only
   - Otherwise → add to `enabled` list and create marketplace entry
4. Write updated settings with backup

**Backup Strategy**:
- Create `$HOME/.claude/settings.json.bak` before any write
- Preserve previous backup by rotating to `.bak.1`, `.bak.2`, etc.

#### Local Settings (`.claude/settings.json` in project root)

**Purpose**: Configure team/organization plugin repositories and project-specific plugin enable/disable overrides

**Settings Structure**:
```javascript
{
  "extraKnownMarketplaces": {
    "team-tools": {
      "source": {
        "source": "github",
        "repo": "your-org/claude-plugins"
      }
    },
    "project-specific": {
      "source": {
        "source": "git",
        "url": "https://git.company.com/project-plugins.git"
      }
    },
    "internal-tools": {
      "source": {
        "source": "directory",
        "path": "/shared/claude-plugins"
      }
    }
  },
  "enabledPlugins": {
    "feature-dev@claude-code-plugins": true,
    "superpowers-developing-for-claude-code@superpowers-marketplace": true,
    "superpowers@superpowers-marketplace": false,
    "example-skills@anthropic-agent-skills": false
  }
}
```

**Plugin Key Format**: `<plugin-name>@<marketplace-name>`

**enabledPlugins Behavior**:
- `true`: Enable this plugin for this project (overrides global if disabled)
- `false`: Disable this plugin for this project (overrides global if enabled)
- Omitted: Use global setting (from `$HOME/.claude/settings.json`)

**Marketplace Source Types**:
- `github`: GitHub repository (uses `repo` field: "org/repo")
- `git`: Generic Git repository (uses `url` field)
- `directory`: Local file system path (uses `path` field)

**Operations**:
- `readLocalSettings(baseDir)` - Read project-local settings
- `updateLocalSettings(baseDir, marketplaces)` - Update extraKnownMarketplaces
- `detectTeamMarketplaces(baseDir)` - Auto-detect team repos from project configuration
- `getProjectPluginState(pluginKey, localSettings)` - Get project-specific override
- `setProjectPluginState(pluginKey, enabled, localSettings)` - Set project-specific enable/disable

**Auto-Detection Strategy**:
The system can auto-populate `extraKnownMarketplaces` based on:
1. `.air-marketplaces.json` file in project root (if exists)
2. `package.json` field: `"claudePluginMarketplaces": ["org/repo", "https://..."]`
3. Organization defaults from `.github/` repository structure

**Merge Strategy**:
1. Load existing local settings (or create minimal structure)
2. Preserve any manually-configured marketplaces
3. Add auto-detected marketplaces (don't override existing)
4. Preserve all `enabledPlugins` entries (never auto-modify)
5. Write updated local settings

**Important**: The `enabledPlugins` map is **never automatically modified** by `air sync`. It is only updated when:
- User manually edits `.claude/settings.json`
- Future CLI command for project-level plugin management (e.g., `air disable <plugin> --project`)

This prevents `air sync` from overriding deliberate project-specific plugin choices.

**File Location**: `.claude/settings.json` (in project root, alongside `.claude/hooks/` if used)

### Layer 4: CLI Commands

**Responsibility**: User interface and workflow orchestration

**Module**: `src/cli/air.mjs` and `src/lib/commands/`

**Commands**:

#### `air view [path]` (default: cwd)
**Purpose**: Show plugin status for current project or specified path

**Output**:
```
Discovered Claude Code Plugins in /Users/dev/my-project

Package: express-api-helpers (v2.1.0)
  Plugin: express-helper
  Status: ✓ Enabled
  Description: Helps generate Express.js API code

Package: jest-test-gen (v1.0.0)
  Plugin: jest-generator
  Status: ⊗ Disabled (by user)
  Description: Auto-generates Jest tests

Package: new-package (v0.5.0)
  Plugin: new-helper
  Status: • Not installed
  Description: Helper for new-package

Summary: 2 enabled, 1 disabled, 1 available
⚠️  Restart Claude Code to load new plugins
```

**Algorithm**:
1. Scan dependencies (with cache)
2. For each plugin, query settings for state
3. Display table with status indicators
4. Report if restart needed

#### `air view --all`
**Purpose**: Show all Claude Code plugins (not just project dependencies)

**Output**:
```
All Claude Code Plugins

Plugin: express-helper
  Source: /Users/dev/my-project/node_modules/express-api-helpers
  Status: ✓ Enabled

Plugin: global-plugin
  Source: ~/.claude/plugins/marketplace-x
  Status: ✓ Enabled

Plugin: old-plugin
  Source: (not found)
  Status: ⊗ Disabled

Summary: 2 enabled, 1 disabled, 0 available
```

**Algorithm**:
1. Read settings file
2. For each plugin in settings:
   - Determine source path
   - Check if source exists
   - Display with status
3. Include plugins not from project dependencies

#### `air sync`
**Purpose**: Synchronize project plugins with Claude Code settings (primary workflow)

**Output**:
```
Scanning dependencies for Claude Code plugins...
Found 3 plugins

New plugins discovered:
  • new-helper (from new-package v0.5.0)

Team marketplaces configured:
  • team-tools (github:your-org/claude-plugins)

Updated settings:
  Global: $HOME/.claude/settings.json
  Local: .claude/settings.json
✓ 1 plugin added, 0 updated, 1 marketplace configured

⚠️  Restart Claude Code to load new plugins
```

**Algorithm**:
1. Scan dependencies (with cache)
2. Load global settings
3. For each discovered plugin:
   - If disabled → skip
   - If enabled → update marketplace metadata (path, version)
   - If not installed → add to enabled list and marketplace
4. Update global settings file
5. Detect team/organization marketplaces
6. Load local settings
7. Update local settings with extraKnownMarketplaces
8. Report changes

**Auto-run**: This command is designed to run via session-start hook

### Layer 5: Hook Integration

**Responsibility**: Automatic execution at Claude Code session start

**Implementation**: User configures Claude Code to run script at session start

**Hook Script** (`$HOME/.claude/hooks/session-start.sh`):
```bash
#!/bin/bash
cd "$CLAUDE_PROJECT_DIR" || exit 0
air sync --quiet
```

**Claude Code Configuration**:
```json
{
  "hooks": {
    "sessionStart": "$HOME/.claude/hooks/session-start.sh"
  }
}
```

**Workflow**:
1. User opens project in Claude Code
2. Claude Code executes session-start hook
3. Hook runs `air sync` in project directory
4. `air sync` discovers and installs plugins
5. User sees notification if restart needed

## Module Organization

### Directory Structure

```
src/
├── cli/
│   └── air.mjs                      # CLI entry point, command routing
├── lib/
│   ├── scanner.js                   # Plugin discovery in dependencies
│   ├── types.js                     # Type definitions and constants
│   ├── commands/
│   │   ├── view.js                  # View command implementation
│   │   └── sync.js                  # Sync command implementation
│   ├── storage/
│   │   ├── cache.js                 # Cache read/write operations
│   │   ├── claude-settings.js       # Global settings file management
│   │   ├── local-settings.js        # Project-local settings management
│   │   └── claude-config.js         # Configuration paths
│   ├── parsers/
│   │   └── marketplace-json.js      # marketplace.json parser
│   └── utils/
│       └── git.js                   # Git repository detection utilities
```

### Dependency Graph

```
CLI (air.mjs)
  ↓
Commands (commands/*.js)
  ↓
Scanner (scanner.js) + Settings Managers (storage/claude-settings.js, storage/local-settings.js)
  ↓
Cache (storage/cache.js) + Parsers (parsers/marketplace-json.js) + Git Utils (utils/git.js)
  ↓
Types (types.js) + Config (storage/claude-config.js)
```

### Key Principles

- **No circular dependencies**: Strict layered architecture
- **Named exports only**: No default exports
- **Types are dependency-free**: Pure data definitions
- **Storage layer isolation**: All file I/O in `storage/` modules
- **Parser separation**: Format parsing in dedicated `parsers/` modules

## Data Structures

### PluginProvider
```javascript
{
  packageName: 'express-api-helpers',
  version: '2.1.0',
  path: '/Users/dev/project/node_modules/express-api-helpers',
  pluginDeclaration: {
    name: 'express-helper',
    version: '2.1.0',
    description: 'Helps generate Express.js API code',
    skillPath: '.claude-plugin/skill'
  }
}
```

### ClaudeSettings (fragment)
```javascript
{
  plugins: {
    enabled: ['express-helper', 'jest-generator'],
    disabled: ['old-plugin'],
    marketplaces: {
      'express-api-helpers-marketplace': {
        source: {
          type: 'directory',
          path: '/Users/dev/project/node_modules/express-api-helpers'
        },
        plugins: {
          'express-helper': {
            version: '2.1.0',
            skillPath: '.claude-plugin/skill'
          }
        }
      }
    }
  }
}
```

### PluginState
```javascript
{
  name: 'express-helper',
  status: 'enabled' | 'disabled' | 'not-installed',
  source: '/Users/dev/project/node_modules/express-api-helpers',
  version: '2.1.0',
  description: 'Helps generate Express.js API code'
}
```

### LocalSettings
```javascript
{
  extraKnownMarketplaces: {
    'team-tools': {
      source: {
        source: 'github',
        repo: 'your-org/claude-plugins'
      }
    },
    'project-plugins': {
      source: {
        source: 'git',
        url: 'https://git.company.com/plugins.git'
      }
    }
  },
  enabledPlugins: {
    'feature-dev@claude-code-plugins': true,
    'superpowers@superpowers-marketplace': false,
    'example-skills@anthropic-agent-skills': false
  }
}
```

### MarketplaceReference
```javascript
{
  name: 'team-tools',
  sourceType: 'github' | 'git' | 'directory',
  repo?: 'org/repo',          // For github type
  url?: 'https://...',        // For git type
  path?: '/absolute/path'     // For directory type
}
```

## Use Cases

### For Consumers (Developers Using AI-Ready Libraries)

#### Use Case 1: Automatic Plugin Discovery
**Actor**: Developer starting new project with dependencies

**Flow**:
1. Developer runs `npm install` to install packages
2. Claude Code session starts
3. Hook runs `air sync`
4. System discovers plugins in dependencies
5. Settings updated automatically
6. Developer sees notification: "1 new plugin available. Restart to load."

**Benefit**: Zero-configuration plugin enablement

#### Use Case 2: Viewing Plugin Status
**Actor**: Developer wanting to see which plugins are active

**Flow**:
1. Developer runs `air view`
2. System shows table of all plugins in current project
3. Developer sees which are enabled, disabled, or newly available
4. Developer can identify which packages provide AI assistance

**Benefit**: Transparency and control

#### Use Case 3: Reviewing All Plugins
**Actor**: Developer troubleshooting plugin issues

**Flow**:
1. Developer runs `air view --all`
2. System shows all plugins in Claude Code settings
3. Includes plugins from other projects and global sources
4. Shows orphaned plugins (source no longer exists)

**Benefit**: Complete visibility into Claude Code configuration

### For Publishers (Library Authors)

#### Use Case 1: Bundling a Plugin with npm Package
**Actor**: Library author adding AI integration

**Flow**:
1. Author creates `.claude-plugin/` directory in package
2. Author writes `marketplace.json` with plugin metadata
3. Author adds plugin skill code to `.claude-plugin/skill/`
4. Author publishes package to npm
5. Consumers install package
6. Plugin auto-discovered and enabled via `air sync`

**Benefit**: Plugin distribution via npm, zero friction for users

#### Use Case 2: Testing Plugin Locally
**Actor**: Library author developing plugin

**Flow**:
1. Author creates test project
2. Author runs `npm link` to link local package
3. Author runs `air view` to verify plugin discovered
4. Author runs `air sync` to install plugin
5. Author restarts Claude Code to test plugin

**Benefit**: Local development and testing workflow

#### Use Case 3: Versioning and Updates
**Actor**: Library author releasing plugin update

**Flow**:
1. Author updates plugin code and `marketplace.json` version
2. Author publishes new package version to npm
3. Consumer runs `npm update`
4. Next Claude Code session, hook runs `air sync`
5. System updates marketplace entry with new version/path
6. Consumer gets updated plugin automatically

**Benefit**: Automatic plugin updates with package updates

#### Use Case 4: Team/Organization Plugin Repositories
**Actor**: Developer working in organization with shared plugins

**Flow**:
1. Organization maintains Git repository with Claude Code plugins
2. Project includes `.air-marketplaces.json` referencing org repo
3. Developer runs `air sync` (or hook runs automatically)
4. System detects org marketplace from project config
5. Local `.claude/settings.json` updated with `extraKnownMarketplaces`
6. Claude Code discovers plugins from org repository
7. Plugins available to all team members automatically

**Benefit**: Centralized team tooling, consistent development experience

#### Use Case 5: Project-Specific Plugin Configuration
**Actor**: Developer working on project requiring specific plugin setup

**Flow**:
1. Project has certain plugins that should be disabled (e.g., conflicting linters)
2. Developer or team lead edits `.claude/settings.json`
3. Sets `enabledPlugins` entries to override global settings
4. Entry format: `"plugin-name@marketplace-name": false`
5. All team members get same plugin configuration for this project
6. Global settings remain unchanged for other projects

**Benefit**: Project-specific tool configuration, avoid plugin conflicts

**Example Scenario**:
- Global settings enable `general-linter@tools-marketplace`
- This project uses `specialized-linter@project-tools` instead
- `.claude/settings.json` sets:
  ```json
  {
    "enabledPlugins": {
      "general-linter@tools-marketplace": false,
      "specialized-linter@project-tools": true
    }
  }
  ```

**Example `.air-marketplaces.json`**:
```json
{
  "marketplaces": [
    {
      "name": "acme-dev-tools",
      "source": "github",
      "repo": "acme-corp/claude-dev-plugins"
    },
    {
      "name": "project-alpha-plugins",
      "source": "git",
      "url": "https://git.acme.com/alpha/plugins.git"
    }
  ]
}
```

## Error Handling

### File System Errors

**Scenario**: Cache file corrupt, settings file unreadable

**Strategy**:
- Cache errors → Ignore cache, perform fresh scan
- Settings errors → Create default settings file
- Permission errors → Report to user with clear message

### Malformed JSON

**Scenario**: Invalid `marketplace.json` or `settings.json`

**Strategy**:
- `marketplace.json` invalid → Skip plugin, log warning
- `settings.json` invalid → Backup and create fresh file
- Validation errors → Report which file/field is problematic

### Plugin Conflicts

**Scenario**: Two packages declare same plugin name

**Strategy**:
- Detect duplicate plugin names during scan
- Report conflict to user with package names
- Apply precedence rule (first in scan order wins)
- Warn in output: "Conflict: 'helper' claimed by pkg-a and pkg-b. Using pkg-a."

### Settings Update Failures

**Scenario**: Cannot write to `settings.json`

**Strategy**:
- Check disk space before write
- Verify write permissions
- If write fails, preserve backup
- Report to user: "Cannot update settings: [reason]"
- Exit with error code

## Testing Strategy

### Unit Tests

**Scanner Tests** (`src/lib/scanner.test.js`):
- Discover plugins in flat node_modules structure
- Discover plugins in scoped packages (@org/package)
- Skip packages without `.claude-plugin/marketplace.json`
- Parse marketplace.json correctly
- Handle malformed JSON gracefully

**Cache Tests** (`src/lib/storage/cache.test.js`):
- Write and read cache correctly
- Invalidate on package.json mtime change
- Invalidate on package-lock.json mtime change
- Return null for missing/corrupt cache
- Use cached data when valid

**Global Settings Manager Tests** (`src/lib/storage/claude-settings.test.js`):
- Read existing settings correctly
- Create settings file if missing
- Merge plugins without overwriting existing
- Respect disabled plugins list
- Create backups before write
- Handle corrupt settings gracefully

**Local Settings Manager Tests** (`src/lib/storage/local-settings.test.js`):
- Read local settings correctly
- Create local settings file if missing
- Update extraKnownMarketplaces without overwriting enabledPlugins
- Auto-detect marketplaces from .air-marketplaces.json
- Auto-detect marketplaces from package.json
- Parse marketplace source types correctly (github, git, directory)
- Never auto-modify enabledPlugins map
- Handle missing or corrupt local settings

**Command Tests** (`src/lib/commands/*.test.js`):
- View command displays correct status
- Sync command updates settings correctly
- Sync command skips disabled plugins
- Sync command reports new plugins

### Integration Tests

**End-to-End Workflow**:
1. Create test project with package.json
2. Create mock dependency with `.claude-plugin/marketplace.json`
3. Run `air view` → verify plugin shown as "not installed"
4. Run `air sync` → verify settings updated
5. Run `air view` → verify plugin shown as "enabled"
6. Modify dependency version
7. Run `air sync` → verify marketplace updated with new version

**Hook Simulation**:
1. Create test project
2. Add dependency with plugin
3. Simulate session-start hook execution
4. Verify settings updated
5. Verify notification displayed

### Test Fixtures

**createTestPackage(tempDir, packageName, pluginDeclaration)**:
```javascript
await createTestPackage(tempDir, 'my-lib', {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'Test plugin',
  skillPath: '.claude-plugin/skill'
})
```

Creates:
- `node_modules/my-lib/package.json`
- `node_modules/my-lib/.claude-plugin/marketplace.json`
- `node_modules/my-lib/.claude-plugin/skill/SKILL.md`

## Security Considerations

### Plugin Trust Model

**Threat**: Malicious plugins in dependencies

**Mitigation**:
- Plugins run with same permissions as npm dependencies (already trusted)
- System only discovers and enables, doesn't execute during sync
- Claude Code controls plugin execution environment

### Settings File Integrity

**Threat**: Corrupted settings file breaks Claude Code

**Mitigation**:
- Always create backup before write
- Validate settings structure before write
- If write fails, preserve original file

### Path Injection

**Threat**: Malicious `marketplace.json` with path traversal

**Mitigation**:
- Resolve all paths to absolute
- Validate paths stay within package directory
- Reject paths with `..` or absolute paths in `skillPath`

### Disk Space Exhaustion

**Threat**: Repeated syncs fill disk with backups

**Mitigation**:
- Limit backup rotation (keep max 5 backups)
- Clean old backups automatically
- Check disk space before write

## Performance Considerations

### Scan Optimization

**Challenge**: Scanning large node_modules is slow

**Optimizations**:
- Cache results based on package-lock.json mtime
- Only scan top-level packages (no nested node_modules)
- Parallel file reads for marketplace.json
- Early exit if package.json indicates no plugin

### Startup Time

**Challenge**: Hook delays session start

**Optimizations**:
- Cache hit should complete in <100ms
- Report "using cache" for transparency
- Run sync in background if possible
- Provide `--quiet` flag to suppress output

### Memory Usage

**Challenge**: Large projects with many dependencies

**Optimizations**:
- Stream-based scanning (don't load all in memory)
- Limit marketplace.json file size (reject >1MB files)
- Clean cache periodically (remove old entries)

## Future Extensibility

### Support for Other AI Agents

**Current**: Claude Code-specific settings format

**Future**: Abstract settings manager interface

**Architecture Changes**:
- Introduce `SettingsAdapter` interface
- Implement `ClaudeSettingsAdapter` (current)
- Add `CursorSettingsAdapter`, `CopilotSettingsAdapter`, etc.
- Command line flag: `air sync --agent=cursor`

### Remote Plugin Repositories

**Current**: Local settings configure `extraKnownMarketplaces` for team repos

**Future**: Direct scanning and caching of remote repository contents

**Architecture Changes**:
- Add remote source cloning and scanning
- Cache remote repo commit SHAs
- Auto-update remote plugins when commits change
- Support monorepo structures with multiple plugins per repo

### Plugin Marketplace

**Current**: Plugins declared individually per package

**Future**: Central marketplace registry

**Architecture Changes**:
- Add marketplace API client
- Fetch plugin metadata from registry
- Compare local with marketplace versions
- Suggest updates
