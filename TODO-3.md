# TODO-3: Refactor marketplace-json.test.js

**File:** `tests/unit/lib/parsers/marketplace-json.test.js`
**Priority:** High

## Overview

Two groups of tests follow repetitive patterns that can be parameterized.

## Candidates

### 1. `validateMarketplaceJson` rejection tests (lines 53-121)

**Current:** 9 separate tests checking invalid inputs return `valid: false`

**Proposed:**
```javascript
describe('invalid inputs', () => {
  it.each([
    {
      description : 'missing required fields',
      data        : { name : 'my-marketplace' },
    },
    {
      description : 'missing name',
      data        : { owner : { name : 'Test' }, plugins : [] },
    },
    {
      description : 'empty name',
      data        : { name : '', owner : { name : 'Test' }, plugins : [] },
    },
    {
      description : 'missing owner',
      data        : { name : 'my-marketplace', plugins : [] },
    },
    {
      description : 'missing plugins',
      data        : { name : 'my-marketplace', owner : { name : 'Test' } },
    },
    {
      description : 'plugin without name',
      data        : { name : 'my-marketplace', owner : { name : 'Test' }, plugins : [{ source : './plugin' }] },
    },
    {
      description : 'plugin without source',
      data        : { name : 'my-marketplace', owner : { name : 'Test' }, plugins : [{ name : 'my-plugin' }] },
    },
  ])('should reject $description', ({ data }) => {
    expect(validateMarketplaceJson(data).valid).toBe(false)
  })

  it.each([
    { description : 'null', data : null },
    { description : 'undefined', data : undefined },
    { description : 'string', data : 'string' },
    { description : 'number', data : 123 },
    { description : 'array', data : [] },
  ])('should reject $description', ({ data }) => {
    expect(validateMarketplaceJson(data).valid).toBe(false)
  })
})
```

### 2. `parseMarketplaceJson` null return tests (lines 165-204)

**Current:** 5 tests that write files and check for null return

**Proposed:**
```javascript
it.each([
  {
    description : 'malformed JSON',
    filename    : 'bad.json',
    content     : '{invalid json}',
  },
  {
    description : 'invalid data (missing fields)',
    filename    : 'invalid.json',
    content     : JSON.stringify({ name : 'test-marketplace' }),
  },
  {
    description : 'empty file',
    filename    : 'empty.json',
    content     : '',
  },
  {
    description : 'whitespace only',
    filename    : 'whitespace.json',
    content     : '   \n  \t  ',
  },
])('should return null for $description', async ({ filename, content }) => {
  const jsonPath = path.join(tempDir, filename)
  await fs.writeFile(jsonPath, content)

  const result = await parseMarketplaceJson(jsonPath)
  expect(result).toBeNull()
})

it('should return null for missing file', async () => {
  const result = await parseMarketplaceJson('/nonexistent/marketplace.json')
  expect(result).toBeNull()
})
```

## Benefits

- Reduces 14 tests to 3-4 parameterized tests
- Clear separation of validation logic vs file parsing
- Easier to see all invalid input cases at a glance
