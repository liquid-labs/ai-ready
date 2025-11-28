# TODO-6: Refactor claude-settings.test.js

**File:** `tests/unit/lib/storage/claude-settings.test.js`
**Priority:** Low

## Overview

The `getPluginState` tests follow a simple pattern that could be parameterized.

## Candidates

### `getPluginState` tests (lines 462-497)

**Current:** 3 separate tests checking return values for different plugin states

**Proposed:**
```javascript
describe('getPluginState', () => {
  it.each([
    {
      description    : 'enabled plugin',
      enabled        : ['test-plugin@test-marketplace'],
      disabled       : [],
      expectedStatus : PLUGIN_STATUSES.ENABLED,
    },
    {
      description    : 'disabled plugin',
      enabled        : [],
      disabled       : ['test-plugin@test-marketplace'],
      expectedStatus : PLUGIN_STATUSES.DISABLED,
    },
    {
      description    : 'unknown plugin',
      enabled        : [],
      disabled       : [],
      pluginName     : 'unknown-plugin',
      marketplace    : 'unknown-marketplace',
      expectedStatus : PLUGIN_STATUSES.NOT_INSTALLED,
    },
  ])('should return $expectedStatus for $description', ({
    enabled,
    disabled,
    pluginName = 'test-plugin',
    marketplace = 'test-marketplace',
    expectedStatus,
  }) => {
    const settings = {
      plugins : {
        enabled,
        disabled,
        marketplaces : {},
      },
    }

    expect(getPluginState(pluginName, marketplace, settings)).toBe(expectedStatus)
  })
})
```

## Notes

This is a lower priority refactoring because:
- Only 3 tests are affected
- The current tests are already fairly concise
- The parameterized version doesn't dramatically reduce code

However, it does provide:
- Consistent style with other refactored tests
- Easier addition of new status cases if needed
- Clear tabular view of all test scenarios
