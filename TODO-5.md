# TODO-5: Refactor marketplace-validator.test.js (additional)

**File:** `tests/unit/lib/schemas/marketplace-validator.test.js`
**Priority:** Medium

## Overview

The "missing required fields" section was already refactored. Additional parameterization opportunities exist in the "invalid field values" section.

## Candidates

### 1. Invalid name format tests (lines 208-229)

**Current:** Uses a `for` loop over `invalidNames` array

**Proposed:** Convert to explicit `it.each` for better test output:
```javascript
it.each([
  { name : '-my-marketplace', reason : 'leading hyphen' },
  { name : '1marketplace', reason : 'starts with number' },
  { name : 'my marketplace', reason : 'contains space' },
  { name : 'marketplace@name', reason : 'special character' },
  { name : 'MyMarketplace', reason : 'uppercase letters' },
])('should reject invalid name "$name" ($reason)', ({ name }) => {
  const data = {
    name,
    owner   : { name : 'Test' },
    plugins : [{ name : 'plugin', source : './plugin' }],
  }

  const result = validateMarketplaceSchema(data)
  expect(result.valid).toBe(false)
  expect(getInvalidFields(result.errors)).toContain('name')
})
```

### 2. Wrong type rejection tests (lines 258-295)

**Current:** 4 separate tests for wrong types (empty name, wrong type for name/owner/plugins)

**Proposed:**
```javascript
it.each([
  {
    description : 'empty name',
    data        : {
      name    : '',
      owner   : { name : 'Test' },
      plugins : [{ name : 'plugin', source : './plugin' }],
    },
    invalidField : 'name',
  },
  {
    description : 'wrong type for name (number)',
    data        : {
      name    : 123,
      owner   : { name : 'Test' },
      plugins : [{ name : 'plugin', source : './plugin' }],
    },
    invalidField : 'name',
  },
  {
    description : 'wrong type for owner (string)',
    data        : {
      name    : 'my-marketplace',
      owner   : 'not-an-object',
      plugins : [{ name : 'plugin', source : './plugin' }],
    },
    invalidField : 'owner',
  },
  {
    description : 'wrong type for plugins (string)',
    data        : {
      name    : 'my-marketplace',
      owner   : { name : 'Test' },
      plugins : 'not-an-array',
    },
    invalidField : 'plugins',
  },
  {
    description : 'invalid plugin name format',
    data        : {
      name    : 'my-marketplace',
      owner   : { name : 'Test' },
      plugins : [{ name : '-invalid-name', source : './plugin' }],
    },
    invalidField : 'plugins.0.name',
  },
])('should reject $description', ({ data, invalidField }) => {
  const result = validateMarketplaceSchema(data)

  expect(result.valid).toBe(false)
  expect(getInvalidFields(result.errors)).toContain(invalidField)
})
```

## Benefits

- Converts implicit loop to explicit parameterized test with better output
- Consolidates 5-6 tests into 2 parameterized tests
- Each invalid case clearly documented with reason
