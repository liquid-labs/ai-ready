# AI-Ready Testing Infrastructure (v2.0.0)

This directory contains comprehensive tests for the `ai-ready` CLI tool, organized into three test levels:

## Test Levels

### 1. Unit Tests (`tests/unit/lib/**/*.test.js`)
- **Location**: `tests/unit/lib/` (mirroring src structure)
- **Purpose**: Test individual modules and functions in isolation
- **Run with**: `make test`
- **Coverage**: Core modules (scanner, storage, parsers, commands, types)
- **Speed**: Fast (<2 seconds)
- **Count**: ~120 tests across 7 test files

### 2. Functional Tests (`tests/functional/`)
- **Location**: `tests/functional/`
- **Purpose**: Test the bundled CLI (`dist/ai-ready-exec.js`) via `child_process.execFile()`
- **Run with**: `make functional-test`
- **Build process**: Transpiled via Babel (`tests/functional/` → `test-staging/tests/functional/`)
- **What's tested**:
  - CLI command parsing and execution (`air sync`, `air view`)
  - Plugin discovery and enablement workflows
  - Settings file updates
  - Error handling (missing files, invalid JSON, etc.)
  - UX output (messages, warnings, table formatting)
- **Speed**: Medium (~10-30 seconds)
- **Isolation**: Uses temp directories and isolated `$HOME/.claude/` directories
- **Count**: ~41 tests across 2 test files

### 3. Integration Tests (`tests/integration/`)
- **Location**: `tests/integration/`
- **Purpose**: Test end-to-end workflows in production-like environments
- **Run with**:
  - `make integration-test` - Run Jest tests locally (fast feedback)
  - `make integration-test-docker` - Run in Docker container (full isolation)
- **Build process**: Transpiled via Babel (`tests/integration/` → `test-staging/tests/integration/`)
- **What's tested**:
  - Complete sync workflows with settings verification
  - Cross-command state persistence
  - Multi-project scenarios
  - Settings file recovery from corruption
  - Scoped package (@scope/package) handling
  - Plugin version updates
  - Filesystem edge cases (spaces, symlinks, etc.)
  - Concurrent sync operations
  - Package add/remove simulation
- **Speed**: Slow (~30-90 seconds for Jest, ~2-5 minutes for Docker)
- **Isolation**: Full environment isolation with mocked `$HOME`
- **Count**: ~100+ tests across 10 test files

## Directory Structure

```
tests/
├── README.md                                # This file
├── fixtures/                                # Test data and fixtures
│   └── test-air-package/                   # Sample package with plugins
├── unit/lib/                                # Unit tests
│   ├── commands/
│   │   ├── sync.test.js                    # Sync command tests
│   │   └── view.test.js                    # View command tests
│   ├── parsers/
│   │   └── marketplace-json.test.js        # Plugin declaration parser
│   ├── storage/
│   │   └── claude-settings.test.js         # Settings manager (464 lines)
│   ├── utils/
│   │   └── parse-library-integration.test.js
│   ├── scanner.test.js                     # Dependency scanner
│   ├── types.test.js                       # Type validation
│   └── test-lib.js                         # Unit test helpers
├── functional/                              # CLI-level tests
│   ├── helpers.js                           # CLI execution utilities
│   ├── sync.test.js                         # CLI sync command (21 tests)
│   └── view.test.js                         # CLI view command (20 tests)
└── integration/                             # End-to-end integration tests
    ├── test-helpers.js                      # Integration test utilities
    ├── Dockerfile                           # Docker test environment
    ├── integration-test.sh                  # Host-side Docker runner
    ├── run-integration-tests.sh             # Container-side bash scenarios
    ├── sync-workflow.test.js                # Basic sync workflows
    ├── settings-persistence.test.js         # Cross-command state
    ├── multi-project.test.js                # Multiple project scenarios
    ├── settings-recovery.test.js            # Corruption & recovery
    ├── scoped-packages.test.js              # @scope/package support
    ├── plugin-updates.test.js               # Version updates
    ├── multiple-plugins.test.js             # Multiple plugins per package
    ├── filesystem-paths.test.js             # Path edge cases
    ├── concurrent-sync.test.js              # Race condition tests
    └── npm-workflow.test.js                 # Package add/remove simulation
```

## Test Build Process

All tests follow the same Babel transpilation workflow as the main source:

1. **Source files** (`tests/functional/*.js`, `tests/integration/*.js`)
2. **Transpiled via Babel** → `test-staging/tests/{functional,integration}/`
3. **Executed by Jest** from `test-staging/` directory

This ensures tests use the same CommonJS build process as the production code.

## Running Tests

### Quick Development Workflow
```bash
make test              # Unit tests only (fastest)
make functional-test   # CLI-level tests (transpiles + runs)
make test-all          # Unit + functional + integration (comprehensive)
```

### Docker-Based Testing
```bash
make integration-test-docker   # Full Docker isolation (slowest, most realistic)
```

### Individual Test Files
```bash
# Run specific functional test
npx jest tests/functional/cli-install.test.js

# Run specific integration test
npx jest tests/integration/integration-cache.test.js --testTimeout=30000
```

## Integration Test Scenarios Covered

### 1. Sync Workflow (`sync-workflow.test.js`)
- ✓ Discover and enable plugins from dependencies
- ✓ Create settings file if missing
- ✓ Handle projects with no plugins
- ✓ Idempotent behavior (no duplicates on repeated sync)
- ✓ Update marketplace entries when plugin content changes
- ✓ Valid settings structure creation
- ✓ Quiet mode output suppression
- ✓ Error handling (missing package.json, missing node_modules)

### 2. Settings Persistence (`settings-persistence.test.js`)
- ✓ State persists between sync and view commands
- ✓ Settings maintained across multiple sync invocations
- ✓ Never re-enable plugins that user has disabled
- ✓ Respect disabled plugins across multiple sync runs
- ✓ Allow re-enabling previously disabled plugins
- ✓ Preserve manually added settings sections
- ✓ Preserve manually added marketplaces
- ✓ Update project marketplaces without affecting others
- ✓ Display correct status after manual disable (view command)

### 3. Multi-Project (`multi-project.test.js`)
- ✓ Enable plugins from multiple projects in shared settings
- ✓ Handle overlapping plugin names from different projects
- ✓ Maintain separate settings when using different HOME directories
- ✓ Show only project plugins with default view command
- ✓ Handle projects with both unique and shared dependencies
- ✓ Update shared plugin when syncing from different projects

### 4. Settings Recovery (`settings-recovery.test.js`)
- ✓ Handle invalid JSON and create backup
- ✓ Create fresh settings when file is empty
- ✓ Create settings.json if file does not exist
- ✓ Create .claude directory if it does not exist
- ✓ Handle settings without plugins section
- ✓ Handle settings with malformed plugins structure
- ✓ Handle read-only settings file gracefully
- ✓ Handle read-only .claude directory gracefully
- ✓ Preserve valid sections when recovering from corruption

### 5. Scoped Packages (`scoped-packages.test.js`)
- ✓ Discover and enable plugin from scoped package
- ✓ Handle multiple scoped packages from different orgs
- ✓ Handle scoped and non-scoped packages together
- ✓ Use correct marketplace name format for scoped packages
- ✓ Handle complex scoped package names with hyphens
- ✓ Resolve correct file paths for scoped packages
- ✓ Verify skill directory exists in scoped package
- ✓ Display scoped packages correctly in view output
- ✓ Handle missing scoped package gracefully
- ✓ Handle scoped package without plugin declaration

### 6. Plugin Updates (`plugin-updates.test.js`)
- ✓ Update marketplace when plugin version changes
- ✓ Handle major version upgrades
- ✓ Handle downgrades (version rollback)
- ✓ Update skillPath when plugin structure changes
- ✓ Update description when changed
- ✓ Handle plugin name change within same package
- ✓ Keep plugin enabled through version updates
- ✓ Keep plugin disabled through version updates

### 7. Multiple Plugins (`multiple-plugins.test.js`)
- ✓ Handle marketplace.json with multiple plugin entries
- ✓ Handle package with plugins in different directories
- ✓ Handle different packages with same plugin name
- ✓ Handle multiple packages from same organization
- ✓ Handle projects with varied plugin counts per package
- ✓ Handle empty plugin name gracefully

### 8. Filesystem Paths (`filesystem-paths.test.js`)
- ✓ Handle project directory with spaces
- ✓ Handle HOME directory with spaces
- ✓ Handle skill path with spaces
- ✓ Handle paths with hyphens and underscores
- ✓ Handle paths with dots
- ✓ Handle symlinked node_modules directory
- ✓ Handle symlinked package directory
- ✓ Store absolute paths in settings
- ✓ Handle deeply nested project paths
- ✓ Handle deeply nested skill paths
- ✓ Handle package names with mixed case

### 9. Concurrent Sync (`concurrent-sync.test.js`)
- ✓ Handle two concurrent sync operations without corruption
- ✓ Handle multiple concurrent syncs from different projects
- ✓ Handle rapid successive syncs
- ✓ Not corrupt settings during concurrent writes
- ✓ Handle concurrent view operations during sync
- ✓ Handle backup file creation during concurrent syncs
- ✓ Handle many concurrent syncs without resource exhaustion
- ✓ Handle interleaved sync and view operations
- ✓ Maintain data consistency across concurrent operations

### 10. npm Workflow (`npm-workflow.test.js`)
- ✓ Discover new plugin after adding to dependencies
- ✓ Handle adding multiple plugins at once
- ✓ Handle adding scoped plugin
- ✓ Handle plugin removal gracefully
- ✓ Handle removing all plugins
- ✓ Handle partial removal (some plugins remain)
- ✓ Update plugin when version changes in package.json
- ✓ Handle updating multiple plugins simultaneously
- ✓ Handle add, update, and remove in sequence
- ✓ Handle switching between different plugin sets

### Docker Scenarios (`run-integration-tests.sh`)
- ✓ Basic sync workflow in isolated container
- ✓ View command functionality
- ✓ Settings persistence (user choices respected)
- ✓ Scoped package support
- ✓ Idempotent behavior (no duplicates)
- ✓ Plugin version updates
- ✓ Empty project handling

## Writing New Tests

### Functional Test Pattern
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { setupTestEnv, setupClaudePluginDir, runCLI } from './helpers'

describe('My feature', () => {
  let testDir, cleanup

  beforeEach(async () => {
    const env = await setupTestEnv()
    testDir = env.testDir
    cleanup = env.cleanup
    await setupClaudePluginDir(testDir)
  })

  afterEach(async () => {
    await cleanup()
  })

  it('should do something', async () => {
    const { stdout, exitCode } = await runCLI(
      ['command', 'args'],
      testDir,
      { env: { ...process.env, HOME: testDir } }
    )
    expect(exitCode).toBe(0)
    expect(stdout).toContain('expected output')
  })
})
```

### Integration Test Pattern
```javascript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
// Similar to functional tests but with longer timeouts and $HOME isolation

describe('Integration: My feature', () => {
  let testDir, originalHome

  beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'))
    originalHome = process.env.HOME
    process.env.HOME = testDir
    await setupTestProject(testDir)
  })

  afterAll(async () => {
    process.env.HOME = originalHome
    await fs.rm(testDir, { recursive: true, force: true })
  })

  // Tests...
})
```

## Test Helpers

### Integration Test Helpers (`tests/integration/test-helpers.js`)

The integration test helpers provide utilities for setting up complex test scenarios:

- `runCLI(args, cwd, options)` - Execute bundled CLI with environment isolation
- `setupTestProject(testDir, options)` - Create test project with plugins
- `createTestPackage(baseDir, packageName, pluginDeclaration)` - Create individual plugin package
- `setupMultiProjectEnv(projects[])` - Create multiple test projects
- `corruptSettingsFile(path, corruptionType)` - Generate invalid JSON for recovery tests
- `verifySettingsStructure(settings, expected)` - Deep assertion helper for settings validation
- `readJsonFile(filePath)` - Safe JSON file reading
- `fileExists(filePath)` - Check file existence
- `sleep(ms)` - Timing control for async tests

## CI/CD Integration

### GitHub Actions Workflow (`.github/workflows/test.yml`)

The project includes a comprehensive CI/CD workflow with matrix testing across Node versions:

**Jobs:**
1. **Lint and Build** - Code quality and build verification
2. **Unit Tests** - Matrix across Node 18.x, 20.x, 22.x on Ubuntu and macOS
3. **Functional Tests** - CLI-level tests across all Node versions and OSes
4. **Integration Tests** - End-to-end Jest tests across all environments
5. **Docker Integration Tests** - Full isolation tests in Ubuntu container
6. **Test Summary** - Aggregate results and reporting
7. **All Tests Passed Gate** - Final verification step

**Running in CI:**
```yaml
- name: Run all tests
  run: make test-all

- name: Run Docker integration tests
  run: make integration-test-docker
```

### Test Reports
All test runs generate reports in `qa/`:
- `qa/unit-test.txt` - Unit test results + coverage
- `qa/functional-test.txt` - Functional test results
- `qa/integration-test.txt` - Integration test results
- `qa/integration-test-docker.txt` - Docker test output
- `qa/coverage/` - Code coverage HTML reports

## Debugging Tests

### Verbose Output
```bash
# Functional tests with verbose Jest output
npx jest tests/functional/ --verbose

# Integration tests with longer timeout
npx jest tests/integration/ --testTimeout=60000 --verbose
```

### Inspect Test Artifacts
Tests create temporary directories that are cleaned up automatically. To inspect artifacts:

1. Comment out `cleanup()` in test teardown
2. Run test
3. Check `/tmp/ai-ready-test-*` directories
4. Remember to re-enable cleanup!

## Common Issues

### Test Timeouts
Integration tests may timeout on slower systems. Increase timeout:
```javascript
jest.setTimeout(60000) // 60 seconds
```

### Docker Permission Issues
If Docker tests fail with permission errors:
```bash
# Ensure Docker daemon is running
docker ps

# Rebuild image
docker build -t ai-ready-integration-test:latest -f tests/integration/Dockerfile .
```

### Cache Test Failures
Cache invalidation tests rely on mtime changes. Ensure:
- Tests include `sleep(1100)` between modifications (mtime has 1-second resolution)
- File system supports mtime tracking

## Test Coverage Summary

### Current Coverage (v2.0.0)
- **Unit Tests**: ~120 tests covering scanner, settings manager, commands, parsers, types
- **Functional Tests**: ~41 tests covering CLI commands and user workflows
- **Integration Tests**: ~100+ tests covering 10 comprehensive scenarios
- **Docker Tests**: 7 bash scenarios for full environment validation
- **Total**: ~260+ tests across all levels

### Quality Gates
- All tests must pass before merge
- Linting must pass (ESLint via `make lint`)
- Build must succeed (`make build`)
- Coverage reports generated for unit tests
- Matrix testing across Node 18.x, 20.x, 22.x
- Cross-platform testing (Ubuntu, macOS)

## Future Enhancements

Potential additions to the test suite:
- Performance benchmarks for large projects (1000+ dependencies)
- Windows compatibility testing (currently Ubuntu/macOS only)
- Real npm registry testing (tarball installs, actual npm publish flow)
- Load testing for concurrent operations
- Fuzzing for marketplace.json parser
- Visual regression testing for CLI output formatting
- Integration with real Claude Code installation
