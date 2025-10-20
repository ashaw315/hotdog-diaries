# Auth Token Rotation & Deprecation Guide

## Overview

This guide covers the authentication token rotation and deprecation process for the Hotdog Diaries CI/CD system. We are migrating from static `AUTH_TOKEN` secrets to runtime-minted JWT tokens using `JWT_SECRET`.

## Authentication Architecture

### Current (Preferred) Method: JWT Runtime Minting

- **Secret**: `JWT_SECRET` (64+ hex characters)
- **Algorithm**: HMAC-SHA256 (HS256)
- **Format**: Standard JWT with base64url encoding
- **Lifetime**: Short-lived (5-30 minutes)
- **CLI Tool**: `scripts/ci/lib/jwt.ts`

### Legacy Method: Static Tokens

- **Secret**: `AUTH_TOKEN` (being phased out)
- **Format**: Static JWT or API key
- **Lifetime**: Long-lived (manual rotation)
- **Status**: Deprecated, maintained for backward compatibility

## JWT Secret Management

### JWT_SECRET Requirements

- **Length**: Minimum 64 hex characters (256 bits)
- **Format**: Hexadecimal string (0-9, a-f)
- **Entropy**: Cryptographically secure random
- **Storage**: GitHub Secrets, Vercel Environment Variables

### Generating JWT_SECRET

```bash
# Generate a new 256-bit (64 hex char) secret
openssl rand -hex 32

# Or use Node.js crypto
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Rotation Procedures

### 1. JWT_SECRET Rotation (Recommended)

**Frequency**: Every 90 days or on security incident

**Steps**:

1. **Generate new secret**:
   ```bash
   NEW_SECRET=$(openssl rand -hex 32)
   echo "New JWT_SECRET: $NEW_SECRET"
   ```

2. **Test locally**:
   ```bash
   export JWT_SECRET="$NEW_SECRET"
   pnpm tsx scripts/ci/lib/jwt.ts mint --ttl 5m
   ```

3. **Update GitHub Secrets**:
   ```bash
   gh secret set JWT_SECRET --body "$NEW_SECRET"
   ```

4. **Update Vercel Environment**:
   ```bash
   vercel env add JWT_SECRET production
   # Enter the new secret when prompted
   ```

5. **Test CI workflows**:
   ```bash
   # Trigger a test workflow to verify JWT minting works
   gh workflow run secret-validation.yml
   ```

6. **Update rotation log** in `docs/secrets.md`

7. **Optional**: Set JWT_KEY_VERSION for tracking:
   ```bash
   gh secret set JWT_KEY_VERSION --body "v2-$(date +%Y%m%d)"
   ```

### 2. AUTH_TOKEN Rotation (Legacy)

**Status**: Only for environments that haven't migrated to JWT_SECRET

**Steps**:

1. **Generate token using admin system**:
   ```bash
   pnpm tsx scripts/ci/lib/jwt.ts mint --ttl 8760h --sub ci-legacy
   ```

2. **Update GitHub Secrets**:
   ```bash
   gh secret set AUTH_TOKEN --body "$NEW_TOKEN"
   ```

3. **Test endpoints**:
   ```bash
   curl -H "Authorization: Bearer $NEW_TOKEN" \
        "https://hotdog-diaries.vercel.app/api/admin/health/deep"
   ```

## Migration Path: AUTH_TOKEN → JWT_SECRET

### Phase 1: Parallel Operation (Current)

- JWT_SECRET configured and operational
- AUTH_TOKEN maintained as fallback
- CI workflows try JWT first, fall back to AUTH_TOKEN

### Phase 2: JWT-Only Operation (Target)

- Remove AUTH_TOKEN from GitHub Secrets
- Update all workflows to rely solely on JWT_SECRET
- Remove fallback logic from workflows

### Migration Checklist

- [ ] JWT_SECRET configured in GitHub Secrets
- [ ] JWT_SECRET configured in Vercel Environment
- [ ] JWT minting tested in CI workflows
- [ ] Auth self-test endpoint validates JWT tokens
- [ ] All CI workflows updated with runtime minting
- [ ] Secret validation workflow prioritizes JWT_SECRET
- [ ] Documentation updated
- [ ] Team trained on JWT CLI tools

## CLI Tools

### JWT Utility Commands

```bash
# Mint a new token
pnpm tsx scripts/ci/lib/jwt.ts mint --ttl 15m --sub ci-test --aud ci

# Decode token (without verification)
pnpm tsx scripts/ci/lib/jwt.ts decode "eyJhbGc..."

# Verify token signature
pnpm tsx scripts/ci/lib/jwt.ts verify "eyJhbGc..."

# Get help
pnpm tsx scripts/ci/lib/jwt.ts --help
```

### Environment Variables

```bash
# Required for JWT operations
JWT_SECRET=<64-hex-chars>

# Optional for token versioning
JWT_KEY_VERSION=v2-20251020

# Legacy fallback (being deprecated)
AUTH_TOKEN=<static-jwt-token>
```

## Workflow Integration

### Runtime Token Minting Pattern

```yaml
- name: Mint runtime JWT token
  run: |
    echo "🔐 Minting runtime JWT token..."
    
    if TOKEN=$(pnpm -s tsx scripts/ci/lib/jwt.ts mint --ttl 15m --sub ci-gate --aud ci --iss hotdog-diaries 2>/dev/null); then
      echo "✅ Successfully minted runtime JWT token"
      echo "TOKEN=$TOKEN" >> $GITHUB_ENV
      echo "TOKEN_TYPE=runtime" >> $GITHUB_ENV
    elif [ -n "${{ secrets.AUTH_TOKEN }}" ]; then
      echo "⚠️ Runtime token minting failed, falling back to legacy AUTH_TOKEN"
      echo "TOKEN=${{ secrets.AUTH_TOKEN }}" >> $GITHUB_ENV
      echo "TOKEN_TYPE=legacy" >> $GITHUB_ENV
    else
      echo "❌ No token available"
      exit 1
    fi
  env:
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

### Auth Self-Test Validation

```yaml
- name: Test auth self-test endpoint
  run: |
    echo "🔍 Testing auth self-test endpoint..."
    
    RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
      -H "Authorization: Bearer $TOKEN" \
      "https://hotdog-diaries.vercel.app/api/health/auth-selftest")
    
    HTTP_STATUS=$(echo $RESPONSE | sed -e 's/.*HTTPSTATUS://')
    
    if [ "$HTTP_STATUS" -eq 200 ]; then
      echo "✅ Auth self-test passed"
    else
      echo "❌ Auth self-test failed with status $HTTP_STATUS"
      exit 1
    fi
```

## Security Considerations

### JWT_SECRET Security

- **Entropy**: Must be cryptographically random
- **Storage**: Stored in secure secret management systems only
- **Access**: Limited to CI/CD systems and production infrastructure
- **Rotation**: Regular rotation (90 days recommended)
- **Logging**: Never log the actual secret value

### Token Security

- **Lifetime**: Keep JWT tokens short-lived (5-30 minutes)
- **Scope**: Use specific audience (`aud`) and subject (`sub`) claims
- **Transport**: Always use HTTPS for token transmission
- **Storage**: Tokens stored in memory only, never persisted

### Incident Response

If JWT_SECRET is compromised:

1. **Immediate**: Generate new JWT_SECRET and rotate
2. **Invalidate**: All existing tokens become invalid automatically
3. **Monitor**: Check logs for unauthorized token usage
4. **Audit**: Review access patterns and update security measures

## Monitoring & Alerts

### Health Checks

- Auth self-test endpoint: `/api/health/auth-selftest`
- Secret validation workflow runs weekly
- CI workflows test JWT minting on every run

### Key Metrics

- JWT minting success rate
- Token verification failures
- Fallback to legacy AUTH_TOKEN usage
- Auth self-test response times

### Alerts

- JWT_SECRET missing or invalid format
- High rate of token verification failures
- Consistent fallback to legacy authentication
- Auth self-test endpoint unavailable

## Troubleshooting

### Common Issues

**JWT minting fails**:
- Check JWT_SECRET is exactly 64 hex characters
- Verify secret is accessible in CI environment
- Test locally with same secret

**Token verification fails**:
- Confirm JWT_SECRET matches between CI and production
- Check token hasn't expired
- Verify HMAC-SHA256 signature algorithm

**Fallback to AUTH_TOKEN**:
- JWT_SECRET not configured or invalid
- JWT utility script not available
- Network/dependency issues during minting

### Diagnostic Commands

```bash
# Test JWT_SECRET format
echo $JWT_SECRET | wc -c  # Should be 65 (64 chars + newline)

# Test minting locally
JWT_SECRET="your-secret" pnpm tsx scripts/ci/lib/jwt.ts mint --ttl 1m

# Test verification
TOKEN="..." JWT_SECRET="your-secret" pnpm tsx scripts/ci/lib/jwt.ts verify "$TOKEN"

# Check auth endpoint
curl -H "Authorization: Bearer $TOKEN" \
     "https://hotdog-diaries.vercel.app/api/health/auth-selftest"
```

## Related Documentation

- [Secrets Management](../secrets.md) - General secret management practices
- [Production Watchdog](../runbooks/prod-watchdog.md) - Production monitoring procedures
- [CI/CD Architecture](../ci.md) - Overall CI/CD system documentation

## Change Log

- **2025-10-20**: Initial auth rotation guide created
- **2025-10-20**: JWT runtime minting system implemented
- **2025-10-20**: Auth self-test endpoint deployed