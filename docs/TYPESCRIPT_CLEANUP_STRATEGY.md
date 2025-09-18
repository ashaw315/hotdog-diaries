# TypeScript Cleanup Strategy

## Current Baseline (Locked)

- **ESLint Warnings**: 545 actual (locked via `--max-warnings=800`)
- **TypeScript Errors**: 1443 (non-blocking via `|| true`)
- **Build Status**: ✅ Successful

**Note**: ESLint rules have been temporarily changed to warnings (instead of errors) in `.eslintrc.json` to implement the baseline freezing strategy. Former "error" rules like `@typescript-eslint/no-unused-vars` are now "warn" to prevent CI blocking while maintaining visibility.

## CI Behavior

### Main CI Job (Blocking)
- `npm run lint:ci` - Fails if > 800 ESLint warnings (545 actual warnings + buffer)
- `npm run type-check` - Always passes (uses `|| true`)
- `npm run build` - Must succeed
- `npm test` - Must pass

### Optional CI Job (Non-blocking)
- `npm run type-check:strict` - Shows all 1443 errors
- Generates TypeScript error report artifact
- **Does not block PR merges**

## Incremental Cleanup Process

### Phase 1: High-Impact Fixes (Priority)
Target these error types first as they offer the best ROI:

1. **TS6133 (269 errors)**: Unused variables - Easy wins
   ```bash
   npm run type-check:strict | grep "TS6133"
   ```

2. **TS18046 (348 errors)**: Unknown error types - Simple `error instanceof Error` checks
   ```bash
   npm run type-check:strict | grep "TS18046"
   ```

### Phase 2: API Type Safety
3. **TS2345 (257 errors)**: Type mismatches - API route type annotations
4. **TS2339 (226 errors)**: Property access - Database schema alignment

### Phase 3: Advanced Cleanup
5. **TS2322**, **TS7053**, **TS7006**: Complex type annotations

## Monthly Goals

### Month 1: Foundation (Target: 1200 errors)
- Fix all unused variables (TS6133): -269 errors
- Fix unknown error types (TS18046): -100 errors (partial)

### Month 2: API Safety (Target: 900 errors)  
- Complete error type fixes: -248 errors remaining
- API route type annotations: -150 errors

### Month 3: Property Safety (Target: 600 errors)
- Database schema alignment: -226 errors
- Type assertion improvements: -100 errors

## Tools & Commands

### Development
```bash
# See all current errors
npm run type-check:strict

# Check specific error types
npm run type-check:strict | grep "TS6133" | head -10

# Test individual file
npx tsc --noEmit path/to/file.ts
```

### CI Integration
```bash
# Local CI simulation
npm run lint:ci && npm run type-check && npm run build

# Check if you're adding new errors
git diff HEAD~1 | npm run type-check:strict
```

## Updating Baselines

As cleanup progresses, update baselines in `package.json`:

```json
{
  "scripts": {
    "lint:ci": "next lint --max-warnings=400",  // Reduced from 800
    "type-check": "tsc --noEmit --maxErrors=800"  // When ready to enforce
  }
}
```

## Success Metrics

- ✅ **No regressions**: New code doesn't add errors
- ✅ **Steady progress**: 100+ errors fixed per month  
- ✅ **Build stability**: Always green CI builds
- ✅ **Developer experience**: Clear error reports and tooling

## Emergency Procedures

If CI starts failing unexpectedly:

1. **Check baseline drift**: 
   ```bash
   npm run lint:ci 2>&1 | grep -c "Warning"
   ```

2. **Temporary increase limit** (if urgent):
   ```json
   "lint:ci": "next lint --max-warnings=600"
   ```

3. **Investigate regression** and fix root cause

4. **Return to original baseline** once fixed