# Performance Benchmark Report

Generated: 2026-07-08 18:44:20

## Test Environment

- Database: pgsql
- Records: 100,000
- Fields: 50
- Iterations: 100

## Results

### list

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Mean | 3.73 ms | - | - |
| Min | 2.78 ms | - | - |
| Max | 7.23 ms | - | - |
| P95 | 5.44 ms | 200 ms | ✓ PASS |
| P99 | 7.23 ms | - | - |

### search

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Mean | 3.78 ms | - | - |
| Min | 2.82 ms | - | - |
| Max | 7.61 ms | - | - |
| P95 | 4.87 ms | 200 ms | ✓ PASS |
| P99 | 7.61 ms | - | - |

### read

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Mean | 1.33 ms | - | - |
| Min | 1.05 ms | - | - |
| Max | 2.01 ms | - | - |
| P95 | 1.86 ms | 50 ms | ✓ PASS |
| P99 | 2.01 ms | - | - |

### reverse_lookup

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Mean | 1.2 ms | - | - |
| Min | 0.87 ms | - | - |
| Max | 3.77 ms | - | - |
| P95 | 1.46 ms | 100 ms | ✓ PASS |
| P99 | 3.77 ms | - | - |

## Recommendations

All performance targets met. No immediate tuning required.
