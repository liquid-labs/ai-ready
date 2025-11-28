# TODO-2: Refactor types.test.js

**File:** `tests/unit/lib/types.test.js`
**Priority:** High

## Overview

Three validation functions have multiple rejection tests that follow identical patterns.

## Candidates

### 1. `isValidMarketplaceProvider` rejection tests (lines 33-98)

**Current:** 5 separate tests checking various invalid providers return `false`

**Proposed:**
```javascript
it.each([
  {
    description : 'missing packageName',
    provider    : {
      version                : '1.0.0',
      path                   : '/path',
      marketplaceDeclaration : { name : 'test', owner : {}, plugins : [] },
    },
  },
  {
    description : 'empty packageName',
    provider    : {
      packageName            : '',
      version                : '1.0.0',
      path                   : '/path',
      marketplaceDeclaration : { name : 'test', owner : {}, plugins : [] },
    },
  },
  {
    description : 'missing marketplaceDeclaration',
    provider    : {
      packageName : 'test-lib',
      version     : '1.0.0',
      path        : '/path',
    },
  },
  {
    description : 'incomplete marketplaceDeclaration',
    provider    : {
      packageName            : 'test-lib',
      version                : '1.0.0',
      path                   : '/path',
      marketplaceDeclaration : { name : 'test' },
    },
  },
  {
    description : 'non-array plugins',
    provider    : {
      packageName            : 'test-lib',
      version                : '1.0.0',
      path                   : '/path',
      marketplaceDeclaration : { name : 'test', owner : {}, plugins : 'not-an-array' },
    },
  },
])('should reject provider with $description', ({ provider }) => {
  expect(isValidMarketplaceProvider(provider)).toBe(false)
})
```

### 2. `isValidPluginEntry` rejection tests (lines 120-143)

**Current:** 3 separate tests

**Proposed:**
```javascript
it.each([
  {
    description : 'missing name',
    plugin      : { source : './plugins/test' },
  },
  {
    description : 'empty name',
    plugin      : { name : '', source : './plugins/test' },
  },
  {
    description : 'missing source',
    plugin      : { name : 'test-plugin' },
  },
])('should reject plugin with $description', ({ plugin }) => {
  expect(isValidPluginEntry(plugin)).toBe(false)
})
```

### 3. `isValidPluginState` rejection tests (lines 172-205)

**Current:** 3 separate tests

**Proposed:**
```javascript
const baseState = {
  name        : 'test',
  source      : '/path',
  version     : '1.0.0',
  description : 'Test',
}

it.each([
  {
    description : 'invalid status',
    state       : { ...baseState, status : 'invalid-status' },
  },
  {
    description : 'missing name',
    state       : { status : 'enabled', source : '/path', version : '1.0.0', description : 'Test' },
  },
  {
    description : 'empty name',
    state       : { ...baseState, name : '', status : 'enabled' },
  },
])('should reject state with $description', ({ state }) => {
  expect(isValidPluginState(state)).toBe(false)
})
```

## Benefits

- Reduces 11 tests to 3 parameterized tests
- Consistent pattern across all validation functions
- Easy to add new rejection cases
