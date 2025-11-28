# TODO-4: Refactor error-handling.test.js

**File:** `tests/unit/lib/error-handling.test.js`
**Priority:** Medium

## Overview

Several test groups follow repetitive patterns testing error scenarios.

## Candidates

### 1. "Invalid marketplace.json schemas" (lines 89-153)

**Current:** 5 tests that write invalid JSON and check `parseMarketplaceJson` returns null

**Proposed:**
```javascript
describe('Invalid marketplace.json schemas', () => {
  it.each([
    {
      description : 'missing required fields',
      data        : { name : 'test-marketplace' },
    },
    {
      description : 'missing owner',
      data        : { name : 'test-marketplace', plugins : [] },
    },
    {
      description : 'missing plugins',
      data        : { name : 'test-marketplace', owner : { name : 'Test' } },
    },
    {
      description : 'non-object (string)',
      data        : 'not an object',
    },
    {
      description : 'non-string name',
      data        : { name : 123, owner : { name : 'Test' }, plugins : [] },
    },
  ])('should reject marketplace.json with $description', async ({ data }) => {
    const marketplacePath = path.join(tempDir, 'marketplace.json')
    await fs.writeFile(marketplacePath, JSON.stringify(data))

    const result = await parseMarketplaceJson(marketplacePath)
    expect(result).toBeNull()
  })
})
```

### 2. "Missing file handling" (lines 63-86)

**Current:** 4 tests checking various functions handle missing files

**Proposed:**
```javascript
describe('Missing file handling', () => {
  it.each([
    {
      description : 'missing package.json returns empty providers',
      fn          : async () => scanDependencies(tempDir),
      expected    : [],
    },
    {
      description : 'missing marketplace.json returns null',
      fn          : async () => parseMarketplaceJson('/nonexistent/marketplace.json'),
      expected    : null,
    },
    {
      description : 'missing node_modules returns empty providers',
      fn          : async () => {
        await createPackageJson(tempDir, ['some-package'])
        return scanDependencies(tempDir)
      },
      expected    : [],
    },
  ])('should handle $description', async ({ fn, expected }) => {
    const result = await fn()
    expect(result).toEqual(expected)
  })

  it('should handle missing settings.json with defaults', async () => {
    const settings = await readSettings(settingsPath)
    expect(settings.plugins.enabled).toEqual([])
    expect(settings.plugins.disabled).toEqual([])
  })
})
```

### 3. "Empty or minimal inputs" (lines 281-304)

**Current:** 3 tests checking empty input handling

**Proposed:**
```javascript
describe('Empty or minimal inputs', () => {
  it.each([
    {
      description : 'empty dependencies array',
      setup       : async () => createPackageJson(tempDir, []),
      fn          : async () => scanDependencies(tempDir),
      expected    : [],
    },
    {
      description : 'package.json with no dependencies field',
      setup       : async () => fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name : 'test', version : '1.0.0' })
      ),
      fn          : async () => scanDependencies(tempDir),
      expected    : [],
    },
  ])('should handle $description', async ({ setup, fn, expected }) => {
    await setup()
    const result = await fn()
    expect(result).toEqual(expected)
  })

  it('should handle empty settings update', async () => {
    const changes = await updateSettings(settingsPath, [])
    expect(changes.added).toEqual([])
    expect(changes.updated).toEqual([])

    const settings = await readSettings(settingsPath)
    expect(settings.plugins).toBeDefined()
  })
})
```

## Benefits

- Reduces 12 tests to ~5 parameterized tests
- Groups related error scenarios together
- Clearer documentation of error handling behavior
