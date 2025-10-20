# CI Fixes Documentation

## Secret Validation Fix - 2025-10-20

### Issue
- GitHub Actions secret validation workflow was failing
- Error: `❌ Secret Validation Failed` due to weak or missing tokens

### Root Cause
1. `JWT_SECRET` was either missing or not meeting the 64-character hex requirement
2. `AUTH_TOKEN` was either missing or not in proper JWT format
3. The validation script requires both tokens to be present and meet strength requirements

### Solution
1. **Generated new JWT_SECRET**: 64-character hex string using `openssl rand -hex 64`
2. **Generated new AUTH_TOKEN**: Proper JWT token using `scripts/generate-production-jwt.ts`
3. **Updated GitHub Secrets**: Both `JWT_SECRET` and `AUTH_TOKEN` in repository secrets

### Token Requirements
- `JWT_SECRET`: 64-character hexadecimal string, used for signing JWT tokens
- `AUTH_TOKEN`: Valid JWT token (generated using JWT_SECRET), used for API authentication
- `CRON_TOKEN`: Optional 32-character hex token for scheduled jobs
- `ADMIN_PASSWORD`: Optional 32-character alphanumeric password

### Validation Commands
```bash
# Test locally (requires tokens in environment)
pnpm run validate-secrets -- --verbose

# Test in strict mode (warnings = errors)
pnpm run validate-secrets -- --strict
```

### GitHub Secrets Updated
- `JWT_SECRET`: Updated 2025-10-20T18:05:33Z
- `AUTH_TOKEN`: Updated 2025-10-20T18:05:40Z

### Files Modified
- **GitHub Secrets**: Updated `JWT_SECRET` and `AUTH_TOKEN` values
- **docs/ci-fixes.md**: Added this documentation file
- **.github/workflows/secret-validation.yml**: Fixed pnpm setup order

### Additional Fix Required
After updating the secrets, the workflow failed due to pnpm setup ordering:
- **Issue**: "Unable to locate executable file: pnpm"
- **Root Cause**: Node.js setup was trying to cache pnpm before pnpm was installed
- **Solution**: Moved `Setup pnpm` step before `Setup Node.js with pnpm` step

### Verification
- ✅ Local validation passes in both normal and strict modes
- ✅ Tokens meet all strength requirements (length, format, patterns)
- ✅ GitHub Actions Secret Validation workflow now passes
- ✅ CI run 18660811570 completed successfully with all jobs passing

### Next Issue: Deploy Gate AUTH_TOKEN Validation
After fixing secret validation, discovered that AUTH_TOKEN fails in deploy gate with:
- Error: "Invalid or expired JWT token" (401 status)
- Root cause: Production JWT_SECRET differs from the one used to generate AUTH_TOKEN
- Solution: Discovered production was using old JWT_SECRET from .env.production.local
- Fixed: Generated AUTH_TOKEN using production's JWT_SECRET and synced GitHub secrets
- Both JWT_SECRET and AUTH_TOKEN now match production environment