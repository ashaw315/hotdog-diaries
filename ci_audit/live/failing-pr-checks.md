# CI Audit: Failing PR Checks Forensics

**Date**: 2025-10-21
**PR**: #7 (auth-hardening-ci-gates)  
**SHA**: 84a30d8ffcb83e8cb53f27b8e1f26c006bd64397

## Summary of Failing Checks

1. **Deployment Gate / 🔐 Security & Health Gate** - `failure` (deployment_status)
2. **Deploy Gate / Deployment Gate Result** - `failure` (deployment_status)  
3. **Deploy Gate / Validate Runtime JWT Deploy Gate** - Not triggered (skipped due to context)
4. **GitGuardian Security Checks** - `failure` (2 secrets detected)
5. **OpenAPI Spec Drift Detection / Validate OpenAPI Specification** - `failure` (pull_request)

## Root Cause Analysis

### 1. Deployment Status Gates (3 failures)

**Issue**: The deployment_status event workflows are failing because they lack proper neutralization logic when deployments aren't successful.

**Current behavior**:
- The `context` job exists but doesn't properly handle deployment_status events
- Missing `if` conditions on validation jobs to skip when `proceed != 'true'`
- The neutralize job exists but isn't properly connected to the workflow flow

**Fix needed**:
- Add proper `if` conditions to validation jobs
- Ensure pnpm is set up before running TypeScript scripts
- Fix the deploy-context.ts invocation to handle `--from-event` flag

### 2. GitGuardian Security Checks (2 detections)

**Detected secrets in**: `scripts/ci/lib/jwt.ts`
- **Line 226**: Example JWT token in usage documentation
- **Line 227**: Example JWT token in usage documentation

**Analysis**: These are example JWT tokens shown in CLI usage help text, not actual secrets. They appear to be dummy values used for documentation.

**Fix needed**:
- Add `.gitguardian.yml` with precise exclusions for documented test fixtures
- Mark these as dummy values with comments

### 3. OpenAPI Spec Drift Detection

**Issue**: The workflow is checking for API route drift but failing on PR.

**Current problems**:
- Missing pnpm setup in the workflow (using npm commands)
- The workflow doesn't auto-regenerate the spec when drift is detected
- It only fails the PR without offering remediation

**Fix needed**:
- Add pnpm setup to the workflow
- Implement auto-regeneration logic for the OpenAPI spec
- Allow the workflow to update the PR with regenerated specs

## Files Requiring Changes

1. `.github/workflows/deploy-gate.yml` - Add proper conditional logic
2. `scripts/ci/lib/jwt.ts` - Mark dummy tokens as test fixtures
3. `.gitguardian.yml` - Create with precise exclusions
4. `.github/workflows/spec-drift.yml` - Add pnpm support and auto-regen
5. `scripts/openapi/diff.mjs` - Create diff/update script