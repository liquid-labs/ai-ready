# AI-Ready Testing Infrastructure

This directory contains comprehensive tests for the `ai-ready` CLI tool, organized into three test levels:

## Test Levels

### 1. Unit Tests (`src/**/*.test.js`)
- **Location**: Co-located with source files in `src/`
- **Purpose**: Test individual modules and functions in isolation
- **Run with**: `make test`
- **Coverage**: Core modules (scanner, storage, parsers, commands)
- **Speed**: Fast (<2 seconds)

### 2. Functional Tests (`tests/functional/`)
- **Location**: `tests/functional/`
- **Purpose**: Test the bundled CLI (`dist/ai-ready-exec.js`) via `child_process.execFile()`
- **Run with**: `make functional-test`
- **Build process**: Transpiled via Babel (`tests/functional/` → `test-staging/tests/functional/`)
- **What's tested**:
  - CLI command parsing and execution
  - Install/remove workflows
  - List and view commands
  - Error handling
  - UX output (messages, warnings, table formatting)
- **Speed**: Medium (~10-30 seconds)
- **Isolation**: Uses temp directories and mock Claude plugin directories

### 3. Integration Tests (`tests/integration/`)
- **Location**: `tests/integration/`
- **Purpose**: Test in production-like environments with real file system operations
- **Run with**:
  - `make integration-test` - Run Jest tests locally
  - `make integration-test-docker` - Run in Docker container
- **Build process**: Transpiled via Babel (`tests/integration/` → `test-staging/tests/integration/`)
- **What's tested**:
  - Real npm install → air install workflows
  - Global `$HOME/.claude/plugins/` interaction
  - Cache invalidation on package.json/package-lock.json changes
  - State persistence across CLI invocations
- **Speed**: Slow (~30-60 seconds for Jest, ~2-5 minutes for Docker)
- **Isolation**: Full environment isolation in Docker

## Directory Structure

```
tests/
├── README.md                           # This file
├── fixtures/                           # Test data
│   └── test-air-package/              # Fixture npm package with AIR integrations
│       ├── package.json
│       └── ai-ready/integrations/
│           ├── DualTypeIntegration/   # Both skill + generic
│           ├── SkillOnly/             # Claude Skill only
│           └── GenericOnly/           # Generic integration only
├── functional/                        # CLI-level tests (fast)
│   ├── helpers.js                     # Test utilities
│   ├── cli-install.test.js
│   ├── cli-remove.test.js
│   ├── cli-list.test.js
│   ├── cli-view.test.js
│   └── cli-output.test.js            # UX verification (separate file)
└── integration/                       # Docker-based tests (slow)
    ├── Dockerfile
    ├── integration-test.sh            # Host script: build + run Docker
    ├── run-integration-tests.sh       # Container script: run scenarios
    ├── integration-install-remove.test.js
    └── integration-cache.test.js
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

## Test Fixture Package

The fixture package (`tests/fixtures/test-air-package/`) provides three integrations:

1. **DualTypeIntegration** - Both Claude Skill and generic integration
   - Skill: `DualTypeSkill`
   - Generic: `DualTypeGeneric`
   - Tests: Dual-type workflows, selective installation with `--skill`/`--generic` flags

2. **SkillOnly** - Claude Skill without generic component
   - Skill: `SkillOnlyIntegration`
   - Tests: Skill-only installation, plugin registry behavior

3. **GenericOnly** - Generic integration without skill component
   - Generic: `GenericOnlyIntegration`
   - Tests: Generic-only installation, markdown table updates

## Test Scenarios Covered

### Basic Install/Remove
- ✓ Install Claude Skill → verify plugin registry
- ✓ Install generic integration → verify markdown table
- ✓ Remove skill → verify plugin removed
- ✓ Remove generic → verify table updated

### Dual-Type Integrations
- ✓ Install both types simultaneously
- ✓ Install skill only with `--skill` flag
- ✓ Install generic only with `--generic` flag
- ✓ Remove one type, keep other

### Cache Invalidation
- ✓ Create cache on first scan
- ✓ Use cache on subsequent scans
- ✓ Invalidate when `package.json` changes
- ✓ Invalidate when `package-lock.json` changes
- ✓ Rebuild if cache deleted or corrupted

### Error Handling
- ✓ Install non-existent integration
- ✓ Install already-installed integration
- ✓ Remove non-installed integration
- ✓ Invalid integration name format
- ✓ Type mismatch (--skill on generic-only, etc.)

### UX Verification (cli-output.test.js)
- ✓ Success messages
- ✓ Restart warnings for Claude Skills
- ✓ Error messages and formatting
- ✓ Table output formatting
- ✓ Progress indicators
- ✓ Help and version output

## Writing New Tests

### Functional Test Pattern
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { setupTestEnv, setupClaudePluginDir, runCLI } from './helpers.js'

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

## CI/CD Integration

### GitHub Actions (Recommended)
```yaml
- name: Run all tests
  run: make test-all

- name: Run Docker integration tests
  run: make integration-test-docker
```

### Test Reports
All test runs generate reports in `qa/`:
- `qa/unit-test.txt` - Unit test results
- `qa/functional-test.txt` - Functional test results
- `qa/integration-test.txt` - Integration test results
- `qa/coverage/` - Code coverage reports

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

## Future Enhancements

Potential additions to the test suite:
- Remote repository integration tests (`air sources` commands)
- Performance benchmarks
- Cross-platform tests (macOS, Linux, Windows)
- Multiple Node.js version testing
- Real npm package testing (once published)
