# TODO

This document tracks technical debt and improvement opportunities identified during code review of the integration test implementation.

## High Priority

_No high priority items at this time._

---

## Medium Priority

### 1. Add Debug Logging to Scanner

**Issue**: Scanner silently swallows git-related errors, making troubleshooting difficult.

**Location**: `src/lib/scanner.js`
- Line 73 (remote repo scanning)
- Line 166 (general error handling)

**Current Implementation**:
```javascript
catch (error) {
  // If repo doesn't exist or can't be scanned, skip it
  return
}
```

**Recommended Solution**:

1. Add debug logging utility:
```javascript
// At top of file
const DEBUG = process.env.DEBUG === 'true' || process.env.DEBUG === 'air:*' || process.env.DEBUG === 'air:scanner'

function debug(...args) {
  if (DEBUG) {
    console.error('[air:scanner]', ...args)
  }
}
```

2. Update error handling:
```javascript
catch (error) {
  debug(`Failed to scan remote repo ${repo.id}:`, error.message)
  return
}

// And at line 166:
catch (error) {
  debug(`Failed to scan library at ${integrationsPath}:`, error.message)
  continue
}
```

**Benefits**:
- Easier troubleshooting in CI/CD environments
- No performance impact when debug is disabled
- Follows standard debug pattern (similar to npm's `debug` package)

**Usage**:
```bash
DEBUG=true air list
DEBUG=air:* air list
```

**Estimated Effort**: 1 hour

---

## Low Priority

### 1. Replace Magic Numbers with Named Constants

**Issue**: Scanner uses hardcoded numeric values without explanation.

**Location**: `src/lib/scanner.js`
- Line 150: `depth: 4`

**Current Implementation**:
```javascript
const results = await findPlus({
  root         : fullScanPath,
  onlyDirs     : true,
  paths        : ['**/ai-ready/integrations'],
  excludePaths : ['**/node_modules/**'],
  depth        : 4, // node_modules/[scope/]package/ai-ready/integrations
})
```

**Recommended Solution**:
```javascript
// At top of file, after imports
/**
 * Maximum depth for scanning node_modules:
 * - Unscoped: node_modules/package/ai-ready/integrations (depth 4)
 * - Scoped: node_modules/@scope/package/ai-ready/integrations (depth 5)
 * We use 4 as the base depth and find-plus handles the extra level for scoped packages
 */
const MAX_NODE_MODULES_SCAN_DEPTH = 4

// In scanForProviders:
const results = await findPlus({
  root         : fullScanPath,
  onlyDirs     : true,
  paths        : ['**/ai-ready/integrations'],
  excludePaths : ['**/node_modules/**'],
  depth        : MAX_NODE_MODULES_SCAN_DEPTH,
})
```

**Other Candidates**:
- `tests/integration/integration-cache.test.js` line 125: `sleep(1100)` → `MTIME_DIFF_MS = 1100`
- Various test files: timeouts and delays

**Benefits**:
- Self-documenting code
- Easier to adjust if needed
- Clear intent for future maintainers

**Estimated Effort**: 1 hour

---

## Future Enhancements

### 1. Add Performance Benchmarking

**Issue**: Performance test exists but doesn't track actual metrics over time.

**Location**: `tests/integration/integration-cache.test.js` (lines 303-318)

**Current Implementation**:
```javascript
it('should be faster on cache hit vs cache miss', async () => {
  const start1 = Date.now()
  await runCLI(['list'], testDir)
  const duration1 = Date.now() - start1

  const start2 = Date.now()
  await runCLI(['list'], testDir)
  const duration2 = Date.now() - start2

  expect(duration2).toBeLessThanOrEqual(duration1 * 2)
})
```

**Recommended Enhancement**:

1. Create performance tracking utilities
2. Store benchmark results in `qa/performance/`
3. Compare against baseline to detect regressions
4. Generate performance reports

**Benefits**:
- Detect performance regressions in CI
- Track cache effectiveness over time
- Identify optimization opportunities

**Estimated Effort**: 4 hours

---

### 2. Implement Test Data Builders

**Issue**: Complex test setups are repeated across test files.

**Location**: All test files that call `createTestLibrary()` or `setupTestProject()`

**Recommended Enhancement**:

Create fluent test data builders:
```javascript
const testLib = new TestLibraryBuilder()
  .withName('my-test-lib')
  .withIntegration(builder => builder
    .withName('TestIntegration')
    .withGeneric()
    .withSkill()
  )
  .build()

const testProject = new TestProjectBuilder()
  .inDirectory(testDir)
  .withDependency('test-air-package', '1.0.0')
  .withDependency('@ai-ready/scoped-package', '1.0.0')
  .build()
```

**Benefits**:
- More readable test setup
- Easier to create variations
- Self-documenting test data

**Estimated Effort**: 6 hours

---

## Completed Items

### ✅ 1. Improve Cache Test Reliability (HIGH PRIORITY)

**Completed**: 2025-11-17

**Changes Made**:
- Replaced all 6 instances of `sleep(1100)` with explicit `fs.utimes()` calls
- Updated tests in `tests/integration/integration-cache.test.js` at lines:
  - 124-131 (package.json invalidation test)
  - 152-159 (package.json mtime update test)
  - 181-188 (package-lock.json invalidation test)
  - 208-215 (package-lock.json mtime update test)
  - 236-243 (dependency addition test)
  - 261-268 (dependency removal test)

**Results**:
- All 23 integration tests still passing ✅
- Test execution time reduced from ~9-10s to ~3s (66% faster)
- More reliable across different file systems
- Eliminated timing-based race conditions

**Pattern Used**:
```javascript
// Modify file
await fs.writeFile(filePath, content)

// Explicitly set mtime to ensure it differs from cached value
const newTime = new Date(Date.now() + 2000)
await fs.utimes(filePath, newTime, newTime)
```

---

### ✅ 2. Extract Common Test Utilities (MEDIUM PRIORITY)

**Completed**: 2025-11-19

**Changes Made**:
- Created `tests/integration/test-helpers.js` with shared utilities
- Extracted duplicate functions from both integration test files:
  - `setupTestProject()`, `copyDir()`, `runCLI()`
  - `readJsonFile()`, `readFile()`, `fileExists()`, `sleep()`
- Added comprehensive JSDoc documentation to all exported functions
- Updated both test files to import from shared module

**Results**:
- Eliminated ~150 lines of duplicated code
- Single source of truth for test utilities
- Better IDE autocomplete with JSDoc type hints
- Consistent behavior across all integration tests

---

### ✅ 3. Improve Test Environment Isolation Documentation (MEDIUM PRIORITY)

**Completed**: 2025-11-19

**Changes Made**:
- Added inline comments to integration test files explaining `process.env.HOME` modification
- Documented the requirement for `--runInBand` to prevent parallel test conflicts
- Added explanation in `runCLI()` helper about explicit environment variable passing

**Results**:
- Makes isolation strategy explicit in code
- Prevents future parallelization attempts without proper consideration
- Documents why sequential execution is required

---

### ✅ 4. Standardize Code Documentation Style (LOW PRIORITY)

**Completed**: 2025-11-19

**Changes Made**:
- Added comprehensive JSDoc to `tests/integration/test-helpers.js`
- All exported functions now have `@param`, `@returns`, and description tags
- Consistent documentation style across test utilities

**Results**:
- Better IDE autocomplete and type hints for test utilities
- Consistent documentation experience across test code
- Easier onboarding for contributors

---

## Notes

- All estimates are for a developer familiar with the codebase
- High priority items should be addressed before next major release
- Medium priority items can be tackled incrementally
- Low priority and future enhancements are nice-to-have improvements
