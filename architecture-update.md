# Architecture Update: Current to New Design

## Executive Summary

The current ai-ready implementation can be **iteratively updated** to the new architecture rather than requiring a complete rewrite. Approximately 40% of the current code can be reused with modifications, 30% requires significant refactoring, and 30% is new functionality.

**Recommendation**: Iterative update approach, implementing changes in phases to maintain a working system throughout the transition.

## What Can Be Reused

### 1. Scanner Core (`src/lib/scanner.js`)

**Reusable Elements** (60%):
- File system scanning logic using `find-plus`
- Package enumeration in `node_modules/`
- Scoped package handling (`@org/package` structure)
- Path resolution and normalization
- Parallel async operations with `Promise.all()`

**Modifications Needed**:
- Change search target from `ai-ready/integrations/` to `.claude-plugin/marketplace.json`
- Simplify data structure (no longer need `Integration[]` per provider)
- Remove frontmatter parsing logic
- Remove generic vs. Claude Skill type differentiation
- Keep `scanForProviders()` pattern but adjust to look for marketplace.json

**Updated Function Signature**:
```javascript
// OLD
async function scanForProviders(scanPaths, baseDir)
  → Returns: IntegrationProvider[]

// NEW
async function scanDependencies(baseDir)
  → Returns: PluginProvider[]
```

### 2. Cache System (`src/lib/storage/cache.js`)

**Reusable Elements** (80%):
- Cache file read/write operations
- mtime-based invalidation for package.json and package-lock.json
- `isValidCache()` validation logic
- `loadProvidersWithCache()` pattern
- Cache data structure (with minor modifications)

**Modifications Needed**:
- Update cache data structure to store `PluginProvider[]` instead of `IntegrationProvider[]`
- Remove remote provider caching (not in new design initially)
- Simplify cache validation (no remote repo commit SHA checks)
- Keep same file name or rename to `.air-plugin-cache.json`

**Updated Cache Structure**:
```javascript
// OLD
{
  scannedAt: string,
  packageJsonMTime: number,
  packageLockMTime: number,
  npmProviders: IntegrationProvider[],
  remoteProviders: RemoteRepoProvider[]
}

// NEW
{
  scannedAt: string,
  packageJsonMTime: number,
  packageLockMTime: number,
  providers: PluginProvider[]
}
```

### 3. Configuration System (`src/lib/storage/claude-config.js`)

**Reusable Elements** (100%):
- `ClaudePluginConfig` class structure
- Factory methods (`createDefault()`, `createForTest()`)
- Path management for Claude directories
- Test isolation pattern

**Modifications Needed**:
- Add properties for `settingsPath` (`$HOME/.claude/settings.json`)
- Keep existing paths for future compatibility
- No breaking changes, purely additive

### 4. Type System (`src/lib/types.js`)

**Reusable Elements** (40%):
- Validation function patterns
- Constants structure
- JSDoc type annotation approach
- Dependency-free module pattern

**Modifications Needed**:
- Define new types: `PluginProvider`, `PluginState`, `ClaudeSettings`
- Remove old types: `Integration`, `IntegrationProvider`, `RemoteRepoProvider`
- Remove integration type constants (`INTEGRATION_TYPES`)
- Keep validation function pattern but for new types

### 5. Test Infrastructure (`src/lib/test-lib.js`)

**Reusable Elements** (50%):
- Test fixture creation pattern
- Temporary directory management
- File structure creation utilities

**Modifications Needed**:
- Replace `createTestLibrary()` with `createTestPackage()`
- New fixture creates `.claude-plugin/marketplace.json` instead of `ai-ready/integrations/`
- Simplify (no longer need generic vs. skill type handling)

### 6. CLI Framework (`src/cli/air.mjs`)

**Reusable Elements** (70%):
- Commander.js setup
- Command routing structure
- Version handling
- Error handling patterns

**Modifications Needed**:
- Remove commands: `install`, `remove`, `list`, `verify`, `sources`
- Add commands: `view`, `sync`
- Simplify option parsing (no more `--skill`/`--generic` flags)
- Keep modular command structure

## What Needs Major Refactoring

### 1. Registry System → Settings Manager

**Current**: `src/lib/storage/registry.js` and `src/lib/storage/claude-plugin-registry.js`

**Changes**:
- **Old Purpose**: Manage two separate registries (markdown table + plugin JSON files)
- **New Purpose**: Manage single Claude Code settings.json file
- **Reusable**: Backup creation pattern, JSON file I/O
- **New**: Non-destructive merge logic, enabled/disabled tracking, settings validation

**Migration Strategy**:
1. Create new `src/lib/storage/claude-settings.js`
2. Implement `readSettings()`, `updateSettings()`, `getPluginState()`
3. Borrow backup logic from current registry
4. Add merge algorithm (preserve existing, add new, respect disabled)
5. Deprecate old registry modules

**Complexity**: Medium - New logic but similar file operations

### 2. Frontmatter Parser → Marketplace JSON Parser

**Current**: `src/lib/parsers/frontmatter.js` (gray-matter for YAML)

**Changes**:
- **Old**: Parse YAML frontmatter from Markdown files
- **New**: Parse and validate `.claude-plugin/marketplace.json` files
- **Reusable**: Validation pattern, error handling
- **New**: JSON schema validation, simpler format

**Migration Strategy**:
1. Create new `src/lib/parsers/marketplace-json.js`
2. Implement JSON parsing with validation
3. Define marketplace.json schema
4. Remove gray-matter dependency
5. Remove frontmatter parser

**Complexity**: Low - Simpler format than YAML frontmatter

### 3. Installation Status Tracking

**Current**: `loadInstallationStatus()` overlays `installedTypes[]` onto integrations

**Changes**:
- **Old**: Check multiple sources (markdown table + plugin registry JSON)
- **New**: Read from single settings.json file, determine enabled/disabled/not-installed state
- **Reusable**: Multi-source querying pattern
- **New**: Simpler state model (3 states instead of type arrays)

**Migration Strategy**:
1. Implement `getPluginStates(providers, settings)` in settings manager
2. Returns `PluginState[]` with status for each discovered plugin
3. Used by `view` command to display status
4. Much simpler than current implementation

**Complexity**: Low - Simplification from current

## What Needs to Be Removed

### 1. Multi-Type Integration System

**Remove**:
- `INTEGRATION_TYPES.GENERIC` and `INTEGRATION_TYPES.CLAUDE_SKILL` constants
- Type filtering logic (`--skill`, `--generic` flags)
- Dual registry system (markdown + JSON)
- `installedTypes[]` array on integrations
- Generic integration markdown table parsing/writing

**Rationale**: New design focuses exclusively on Claude Code plugins, one type only

### 2. Install/Remove Commands

**Remove**:
- `src/lib/commands/install.js`
- `src/lib/commands/remove.js`
- Installation workflow (user-initiated)
- Removal workflow (user-initiated)
- Backup/restore for markdown files

**Rationale**: New design is automatic (sync command replaces manual install/remove)

### 3. Remote Repository Management

**Remove**:
- `src/lib/storage/config.js` (remote repo config - old format)
- `src/lib/storage/remote-repos.js` (Git operations - old implementation)
- `src/lib/commands/sources.js` (sources subcommands)
- Remote provider scanning logic
- Commit SHA tracking in cache

**Keep**:
- `src/lib/utils/git.js` - **Repurpose for marketplace detection** (detecting GitHub repo from package.json, .git config)

**Rationale**: New design uses local settings with `extraKnownMarketplaces` instead of direct remote scanning. Git utilities needed for auto-detection but not for cloning/scanning.

### 4. Verify Command

**Remove**:
- `src/lib/commands/verify.js`
- Frontmatter validation logic
- Integration structure validation

**Rationale**: Not needed in new design; marketplace.json validation happens during scan

### 5. List Command

**Remove**:
- `src/lib/commands/list.js`
- Table formatting for integrations
- Filter flags (`--installed`, `--available`, `--library`)

**Rationale**: Replaced by `view` command with different output format

### 6. View Command (Current Version)

**Remove**:
- `src/lib/commands/view.js` (current implementation)

**Rationale**: Completely different output format and logic in new design

## What Needs to Be Added

### 1. Global Settings Manager (`src/lib/storage/claude-settings.js`)

**New Module**: Complete implementation required

**Functions**:
```javascript
async readGlobalSettings()
async updateGlobalSettings(providers)
getPluginState(pluginName, settings)
enablePlugin(pluginName, provider, settings)
disablePlugin(pluginName, settings)
mergePlugins(existing, discovered)
validateSettings(settings)
createBackup(settingsPath)
```

**Complexity**: Medium - Core new functionality

### 1a. Local Settings Manager (`src/lib/storage/local-settings.js`)

**New Module**: Manages project-local `.claude/settings.json` with `extraKnownMarketplaces`

**Functions**:
```javascript
async readLocalSettings(baseDir)
async updateLocalSettings(baseDir, marketplaces)
async detectTeamMarketplaces(baseDir)
parseMarketplacesConfig(baseDir)  // Read .air-marketplaces.json
extractMarketplacesFromPackageJson(packageJson)
mergeMarketplaces(existing, detected)
validateMarketplaceReference(marketplace)
getProjectPluginState(pluginKey, localSettings)  // Read project-specific override
setProjectPluginState(pluginKey, enabled, localSettings)  // Set project-specific state (for future CLI)
```

**Important Behavior**:
- `updateLocalSettings()` updates `extraKnownMarketplaces` only
- **Never** modifies `enabledPlugins` automatically
- `enabledPlugins` only changed via manual edits or future CLI commands
- Preserves existing `enabledPlugins` entries during marketplace updates

**Complexity**: Medium - New functionality with auto-detection logic

### 2. Marketplace JSON Parser (`src/lib/parsers/marketplace-json.js`)

**New Module**: Required for parsing `.claude-plugin/marketplace.json`

**Functions**:
```javascript
parseMarketplaceJson(filePath)
validateMarketplaceJson(data)
```

**Complexity**: Low - Simple JSON parsing with validation

### 3. View Command (`src/lib/commands/view.js`)

**New Module**: Complete rewrite with new output format

**Features**:
- Show plugins for current project
- Display status (enabled/disabled/not-installed)
- `--all` flag to show all plugins in settings
- Table/tree output format

**Complexity**: Medium - New UI logic

### 4. Sync Command (`src/lib/commands/sync.js`)

**New Module**: Core automatic workflow

**Features**:
- Scan dependencies
- Load settings
- Merge discovered with existing
- Update settings file
- Report changes
- Detect if restart needed

**Complexity**: Medium - Orchestrates scanner and settings manager

### 5. Hook Integration Documentation

**New Documentation**: Setup instructions for session-start hook

**Contents**:
- How to create hook script
- Claude Code hook configuration
- Troubleshooting

**Complexity**: Low - Documentation only, no code

### 6. Plugin State Tracking

**New Logic**: Determine state (enabled/disabled/not-installed) per plugin

**Implementation**: Part of global settings manager

**Complexity**: Low - Simple state determination logic

### 7. Marketplace Auto-Detection

**New Logic**: Detect team/organization plugin repositories from project configuration

**Implementation**: Part of local settings manager

**Files to Check**:
- `.air-marketplaces.json` (explicit configuration)
- `package.json` (field: `claudePluginMarketplaces`)
- `.git/config` (organization defaults from remote URL)

**Complexity**: Low-Medium - File parsing and pattern matching

## Migration Strategy

### Phase 1: Foundation (Week 1-2)

**Goal**: Establish new data structures and scanner

**Tasks**:
1. Update `types.js` with new type definitions
2. Refactor scanner to find `.claude-plugin/marketplace.json`
3. Create `marketplace-json.js` parser
4. Update cache structure and validation
5. Update test fixtures (`createTestPackage`)

**Deliverable**: Scanner can discover plugins and cache results

**Risk**: Low - Isolated changes, existing code still works

### Phase 2: Settings Managers (Week 2-3)

**Goal**: Implement Claude Code settings management (both global and local)

**Tasks**:
1. Create `claude-settings.js` module (global)
2. Implement read/write operations for global settings
3. Implement merge logic for plugins
4. Add plugin state tracking
5. Create `local-settings.js` module (project-local)
6. Implement marketplace auto-detection logic
7. Implement extraKnownMarketplaces update (preserving enabledPlugins)
8. Implement project-level plugin state read functions
9. Repurpose `utils/git.js` for marketplace detection
10. Write unit tests for both settings modules (including enabledPlugins preservation)

**Deliverable**: Both settings managers can read, update, and merge configurations

**Risk**: Medium - New core functionality, needs thorough testing

### Phase 3: View Command (Week 3-4)

**Goal**: Provide visibility into plugin status

**Tasks**:
1. Create new `view.js` command
2. Implement project plugin display
3. Implement `--all` flag for global view
4. Add status indicators and formatting
5. Wire into CLI

**Deliverable**: `air view` shows plugin status

**Risk**: Low - UI only, no destructive operations

### Phase 4: Sync Command (Week 4-5)

**Goal**: Automatic plugin discovery and enablement + local marketplace configuration

**Tasks**:
1. Create `sync.js` command
2. Implement discovery + global settings update workflow
3. Implement marketplace detection + local settings update workflow
4. Add change reporting (plugins + marketplaces)
5. Add `--quiet` flag for hooks
6. Wire into CLI
7. Integration testing (both global and local settings)

**Deliverable**: `air sync` automatically enables plugins and configures team marketplaces

**Risk**: Medium - Core workflow with two settings files, needs extensive testing

### Phase 5: Cleanup (Week 5-6)

**Goal**: Remove old functionality and polish

**Tasks**:
1. Remove old commands (install, remove, list, verify, sources)
2. Remove old registry modules
3. Remove old remote repo modules (config.js, remote-repos.js)
4. Keep and update git utilities for marketplace detection
5. Remove frontmatter parser
6. Update README and documentation (include .air-marketplaces.json examples)
7. Remove unused dependencies (gray-matter)
8. Update tests to cover new workflows (including local settings)

**Deliverable**: Clean codebase with only new architecture

**Risk**: Low - Removal of unused code

### Phase 6: Hook Documentation and Testing (Week 6)

**Goal**: Complete session-start hook integration

**Tasks**:
1. Write hook setup documentation
2. Create example hook scripts
3. Test end-to-end workflow with Claude Code
4. Performance testing (ensure <100ms cache hit)
5. Error handling and edge case testing

**Deliverable**: Complete, documented, tested system

**Risk**: Low - Documentation and polish

## Testing Strategy During Migration

### Unit Test Migration

**Phase 1-2**: Update existing tests as modules change
- Update scanner tests for new discovery logic
- Update cache tests for new data structure
- Add settings manager tests (new)

**Phase 3-4**: Add new command tests
- Test view command output formatting
- Test sync command workflow
- Mock file system and settings

**Phase 5-6**: Remove obsolete tests
- Delete install/remove command tests
- Delete verify command tests
- Delete remote repo tests

### Integration Test Strategy

**Parallel Testing**: Run old and new systems side-by-side during phases 1-4
- Old tests continue to pass (regression prevention)
- New tests added for new functionality
- Overlap period ensures no functionality loss

**Cut-Over**: Phase 5 removes old tests
- Ensure new integration tests cover all workflows
- End-to-end test: npm install → air sync → verify settings

### Test Coverage Goals

- Scanner: 90%+ (critical path)
- Settings Manager: 95%+ (data integrity critical)
- Cache: 85%+
- Commands: 80%+ (UI/formatting less critical)

## Risk Assessment

### High Risk Areas

**1. Settings File Corruption**
- **Risk**: Merging logic bug corrupts Claude Code settings
- **Mitigation**: Extensive backup system, validation before write, comprehensive tests
- **Contingency**: Backup rotation allows recovery

**2. Performance Regression**
- **Risk**: Sync command too slow, delays session start
- **Mitigation**: Cache system, performance benchmarks, profiling
- **Contingency**: Add `--skip-sync` flag if needed

**3. Plugin Conflicts**
- **Risk**: Multiple packages declare same plugin name
- **Mitigation**: Conflict detection and reporting, precedence rules
- **Contingency**: Manual conflict resolution via `air view --all`

### Medium Risk Areas

**1. Settings Format Changes**
- **Risk**: Claude Code changes settings.json format
- **Mitigation**: Version detection, graceful fallback, minimal assumptions about format
- **Contingency**: Quick patch release if Claude updates format

**2. Cache Invalidation**
- **Risk**: False cache hits or misses
- **Mitigation**: Conservative invalidation (mtime checks), manual cache clear option
- **Contingency**: `--no-cache` flag for troubleshooting

### Low Risk Areas

**1. Marketplace JSON Parsing**
- **Risk**: Invalid marketplace.json crashes scanner
- **Mitigation**: Try-catch around parsing, skip invalid plugins
- **Contingency**: Validation mode to test marketplace.json

**2. UI Output Formatting**
- **Risk**: Output looks bad or is unclear
- **Mitigation**: User testing, examples in docs
- **Contingency**: Iterate on formatting based on feedback

## Breaking Changes for Users

### Command Changes

**Removed Commands**:
- `air install <library/integration>` → Use `air sync` (automatic)
- `air remove <library/integration>` → Use Claude Code settings (manual disable)
- `air list` → Use `air view`
- `air verify` → No replacement (not needed)
- `air sources` → Removed (no remote repos initially)

**New Commands**:
- `air view [path]` → View plugin status
- `air view --all` → View all plugins
- `air sync` → Auto-enable discovered plugins

### Workflow Changes

**Old Workflow**:
1. Run `air list` to see integrations
2. Run `air install library/integration` to install
3. Restart Claude Code if skill

**New Workflow**:
1. Install npm package with plugin
2. Open project in Claude Code
3. Hook runs `air sync` automatically
4. Restart if prompted

### File Changes

**Removed Files**:
- `AGENTS.md` / `CLAUDE.md` (generic integration registry) - No longer used
- `$HOME/.claude/plugins/installed_plugins.json` - Replaced by settings.json
- `$HOME/.claude/plugins/known_marketplaces.json` - Replaced by settings.json

**New/Modified Files**:
- `$HOME/.claude/settings.json` - Global configuration (created/updated by air sync)
- `.claude/settings.json` - Project-local configuration with extraKnownMarketplaces
- `.air-marketplaces.json` - Optional explicit marketplace configuration (see below)
- `.air-plugin-cache.json` - Renamed from `.aircache.json` (optional rename)

**New Configuration File: `.air-marketplaces.json`**

Projects can optionally include this file to declare team/organization plugin repositories:

```json
{
  "marketplaces": [
    {
      "name": "team-tools",
      "source": "github",
      "repo": "your-org/claude-plugins"
    },
    {
      "name": "project-specific",
      "source": "git",
      "url": "https://git.company.com/project-plugins.git"
    },
    {
      "name": "shared-internal",
      "source": "directory",
      "path": "/shared/claude-plugins"
    }
  ]
}
```

When `air sync` detects this file, it updates `.claude/settings.json` with the corresponding `extraKnownMarketplaces` entries.

**Local Settings File: `.claude/settings.json`** (in project root)

After `air sync`, the project-local settings file contains:

```json
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
    }
  },
  "enabledPlugins": {
    "feature-dev@claude-code-plugins": true,
    "superpowers@superpowers-marketplace": false
  }
}
```

**Note**: `enabledPlugins` is **never auto-populated** by `air sync`. It must be manually edited or set via future CLI commands. This provides project-specific control over which plugins are active, overriding global settings.

**Alternative: `package.json` field**

Can also specify in `package.json`:

```json
{
  "name": "my-project",
  "claudePluginMarketplaces": [
    "your-org/claude-plugins",
    "https://git.company.com/plugins.git"
  ]
}
```

System auto-detects source type based on format (org/repo vs URL).

### Package Structure Changes

**Old Structure** (for library authors):
```
my-package/
└── ai-ready/
    └── integrations/
        └── MyIntegration/
            ├── AI_INTEGRATION.md
            └── claude-skill/
                └── SKILL.md
```

**New Structure**:
```
my-package/
└── .claude-plugin/
    ├── marketplace.json
    └── skill/
        └── SKILL.md
```

**Migration Guide for Library Authors**:
1. Create `.claude-plugin/` directory
2. Create `marketplace.json` with plugin metadata
3. Move skill files to `.claude-plugin/skill/`
4. Remove old `ai-ready/` directory
5. Update package version
6. Publish

## Deprecation Strategy

### Alpha Release (v1.0.0-alpha.x → v2.0.0-alpha.1)

**Communication**:
- CHANGELOG: List all breaking changes
- README: Add "Migration Guide" section
- Package description: Update to reflect new purpose

**Support**:
- No backward compatibility (alpha software)
- Clean break to new architecture
- Provide migration examples

**Timeline**:
- Announce breaking change 2 weeks before release
- Publish migration guide with announcement
- Release v2.0.0-alpha.1 with new architecture

### Post-Migration Support

**Old Format Detection**:
- Add warning if `air sync` detects old `ai-ready/integrations/` structure
- Message: "Found old AIR protocol structure. Please update to .claude-plugin/ format. See: [migration guide URL]"

**No Automatic Migration**:
- Too risky to auto-migrate packages
- Library authors must update their packages
- Users can continue using old packages (won't be discovered)

## Success Criteria

### Functional Requirements

- [ ] Scanner discovers `.claude-plugin/marketplace.json` in dependencies
- [ ] Cache invalidates on package.json/package-lock.json changes
- [ ] Global settings manager reads and writes settings.json without corruption
- [ ] Local settings manager updates extraKnownMarketplaces correctly
- [ ] Local settings manager preserves enabledPlugins during updates
- [ ] Merge logic preserves existing settings and respects disabled plugins
- [ ] Marketplace auto-detection works from .air-marketplaces.json and package.json
- [ ] Project-level plugin overrides (enabledPlugins) work correctly
- [ ] `air view` displays accurate plugin status
- [ ] `air sync` enables new plugins automatically
- [ ] `air sync` configures team marketplaces in local settings
- [ ] Hook integration works with Claude Code session start
- [ ] Restart notification appears when plugins added

### Performance Requirements

- [ ] Cache hit completes in <100ms
- [ ] Cache miss (full scan) completes in <2s for typical project (100 deps)
- [ ] Settings update completes in <50ms
- [ ] `air view` displays in <200ms

### Quality Requirements

- [ ] 90%+ test coverage on core modules (scanner, settings managers, cache)
- [ ] All edge cases handled (corrupt files, missing dirs, etc.)
- [ ] Clear error messages for common problems
- [ ] Documentation complete and accurate (including .air-marketplaces.json examples)
- [ ] No data loss (backups working correctly for both global and local settings)

### User Experience Requirements

- [ ] Zero-configuration workflow for consumers
- [ ] Single command (`air sync`) handles everything
- [ ] Clear status indicators in `air view`
- [ ] Helpful error messages with recovery suggestions
- [ ] Restart notification is actionable

## Conclusion

The migration from current to new architecture is **feasible and low-risk** when approached iteratively. The phased strategy allows maintaining a working system throughout the transition while progressively building toward the new design.

**Key Advantages of Iterative Approach**:
1. Existing code provides patterns and utilities (cache, file I/O, testing)
2. No "big bang" rewrite risk
3. Each phase delivers working functionality
4. Can pause/adjust based on learnings
5. Tests catch regressions

**Estimated Timeline**: 6 weeks for complete migration

**Estimated Effort**:
- Reusable code: 40% (minor mods)
- Refactored code: 30% (significant changes)
- New code: 30% (fresh implementation)

**Recommendation**: Proceed with iterative migration starting with Phase 1 (Foundation). The simpler new design and existing infrastructure make this a manageable project with high likelihood of success.
