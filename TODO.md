# TODO

This document tracks technical debt and improvement opportunities.

## High Priority

_No high priority items at this time._

---

## Medium Priority

_No medium priority items at this time._

---

## Low Priority

_No low priority items at this time._

---

## Future Enhancements

### 1. Add Performance Benchmarking Over Time

**Issue**: Performance tests exist but don't track metrics over time to detect regressions.

**Location**: `tests/integration/performance.test.js`

**Current Implementation**: Tests verify operations complete within time limits but don't store historical data.

**Recommended Enhancement**:
1. Store benchmark results in `qa/performance/`
2. Compare against baseline to detect regressions
3. Generate performance reports in CI

**Benefits**:
- Detect performance regressions automatically
- Track performance trends over releases
- Identify optimization opportunities

---

## Notes

- High priority items should be addressed before next major release
- Medium priority items can be tackled incrementally
- Low priority and future enhancements are nice-to-have improvements
