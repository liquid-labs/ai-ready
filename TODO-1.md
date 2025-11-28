# TODO-1: Refactor parse-library-integration.test.js

**File:** `tests/unit/lib/utils/parse-library-integration.test.js`
**Priority:** High

## Overview

All 14 tests in this file follow the identical pattern:
```javascript
const result = parseLibraryIntegration(input)
expect(result).toEqual({ libraryName: ..., integrationName: ... })
```

This entire file can be consolidated into 1-2 parameterized tests.

## Current Structure

- **Unscoped packages** (lines 4-27): 3 tests
- **Scoped packages** (lines 30-61): 4 tests
- **Edge cases** (lines 64-95): 4 tests
- **Real-world examples** (lines 98-122): 3 tests

## Proposed Changes

Consolidate all tests into a single `describe` block with one `it.each`:

```javascript
describe('parseLibraryIntegration', () => {
  it.each([
    // Unscoped packages
    {
      description     : 'library only',
      input           : 'my-package',
      expectedLibrary : 'my-package',
      expectedInteg   : null,
    },
    {
      description     : 'library and integration',
      input           : 'my-package/MyIntegration',
      expectedLibrary : 'my-package',
      expectedInteg   : 'MyIntegration',
    },
    {
      description     : 'package with hyphens',
      input           : 'my-long-package-name/TestIntegration',
      expectedLibrary : 'my-long-package-name',
      expectedInteg   : 'TestIntegration',
    },
    // Scoped packages
    {
      description     : 'scoped library only',
      input           : '@myorg/my-package',
      expectedLibrary : '@myorg/my-package',
      expectedInteg   : null,
    },
    {
      description     : 'scoped library and integration',
      input           : '@myorg/my-package/MyIntegration',
      expectedLibrary : '@myorg/my-package',
      expectedInteg   : 'MyIntegration',
    },
    // ... etc for all 14 test cases
  ])('should parse $description', ({ input, expectedLibrary, expectedInteg }) => {
    const result = parseLibraryIntegration(input)
    expect(result).toEqual({
      libraryName     : expectedLibrary,
      integrationName : expectedInteg,
    })
  })
})
```

## Benefits

- Reduces 14 individual test functions to 1 parameterized test
- Easier to add new test cases
- Clear tabular format shows all inputs and expected outputs
- Maintains descriptive test names in output
