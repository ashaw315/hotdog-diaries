# JWT Authentication Guide for Hotdog Diaries

This guide documents the JWT authentication system for the Hotdog Diaries application and provides the correct process for generating production-compatible tokens.

## Overview

The Hotdog Diaries application uses JWT (JSON Web Tokens) for API authentication. The system has two main components:

1. **JWT_SECRET**: Used for generating and verifying JWT tokens
2. **AUTH_TOKEN**: The actual JWT token used by GitHub Actions and API endpoints

## Environment Configuration

### Local Development (.env.local)
```bash
JWT_SECRET=0d600b3805c95568d0a36950a7f3486f6e29fd43a6e95d6bc7ac3a282aa264947199ca5562b156dbae4bf56911467750eb813b2a4fdf5fb68e173b1e3014486a
AUTH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Production (Vercel)
```bash
JWT_SECRET=0d600b3805c95568d0a36950a7f3486f6e29fd43a6e95d6bc7ac3a282aa264947199ca5562b156dbae4bf56911467750eb813b2a4fdf5fb68e173b1e3014486a
AUTH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### GitHub Actions
```bash
AUTH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## JWT Token Structure

The JWT tokens use the following configuration:

- **Algorithm**: HS256 (HMAC with SHA-256)
- **Expiry**: 24 hours
- **Issuer**: "hotdog-diaries"
- **Audience**: "admin"

### Token Payload
```json
{
  "userId": 1,
  "username": "admin",
  "iat": 1756260651,
  "exp": 1756347051,
  "aud": "admin",
  "iss": "hotdog-diaries"
}
```

## API Authentication Method

**IMPORTANT**: The API endpoints use **simple string comparison**, not JWT verification:

```typescript
const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
```

This means:
- The `AUTH_TOKEN` environment variable must contain the exact JWT token string
- The Bearer token in the Authorization header must match exactly
- No JWT verification is performed by the API endpoints

## Correct Process for Generating Production-Compatible Tokens

### Method 1: Using the Generate Script (Recommended)

1. **Generate the token with production JWT_SECRET**:
   ```bash
   JWT_SECRET=<production-jwt-secret> npx tsx scripts/generate-production-jwt.ts
   ```

2. **Copy the generated token** from the output

3. **Update GitHub Actions secret**:
   ```bash
   gh secret set AUTH_TOKEN --body="<paste-token-here>"
   ```

4. **Update Vercel environment**:
   ```bash
   vercel env add AUTH_TOKEN
   # Paste the same token when prompted
   ```

### Method 2: Manual Generation

1. **Connect to development database**:
   ```bash
   JWT_SECRET=<production-jwt-secret> DATABASE_USER=<user> DATABASE_PASSWORD=<pass> NODE_ENV=development npx tsx -e "
   import { AuthService } from './lib/services/auth';
   import { AdminService } from './lib/services/admin';
   import { db } from './lib/db';
   
   async function generateToken() {
     try {
       const user = await AdminService.getAdminByUsername('admin');
       if (!user) {
         console.log('No admin user found');
         return;
       }
       
       const token = AuthService.generateJWT({ id: user.id, username: user.username });
       console.log(token);
     } catch (error) {
       console.error('Error:', error.message);
     } finally {
       await db.disconnect();
     }
   }
   
   generateToken();
   "
   ```

## Debugging Authentication Issues

### Use the Debug Script

The application includes a comprehensive debug script:

```bash
# Test local configuration
JWT_SECRET=<local-secret> DATABASE_USER=<user> DATABASE_PASSWORD=<pass> NODE_ENV=development npx tsx scripts/debug-jwt-authentication.ts

# Test production configuration
JWT_SECRET=<prod-secret> SITE_URL=https://hotdog-diaries.vercel.app npx tsx scripts/debug-jwt-authentication.ts

# Test specific token
TEST_TOKEN=<token> npx tsx scripts/debug-jwt-authentication.ts
```

### Common Issues and Solutions

#### Issue 1: "Unauthorized" (401) responses
**Cause**: AUTH_TOKEN environment variable doesn't match the Bearer token being sent

**Solution**:
1. Generate a fresh JWT token with the correct JWT_SECRET
2. Update AUTH_TOKEN in all environments (local, Vercel, GitHub Actions)
3. Restart services to load new environment variables

#### Issue 2: Production AUTH_TOKEN is not a valid JWT
**Cause**: AUTH_TOKEN contains base64-encoded JSON instead of a proper JWT

**Solution**:
1. Generate a proper JWT token using AuthService.generateJWT()
2. Update Vercel environment variable
3. Verify the token has the correct format (3 parts separated by dots)

#### Issue 3: JWT_SECRET mismatch between environments
**Cause**: Different JWT_SECRET values in local vs production

**Solution**:
1. Use the same JWT_SECRET across all environments
2. Regenerate AUTH_TOKEN with the correct JWT_SECRET
3. Update all environment configurations

## Token Lifecycle Management

### Token Expiry
- Tokens expire after **24 hours**
- Expired tokens will cause 401 Unauthorized responses
- Regenerate tokens before expiry or when authentication fails

### Rotation Process
1. Generate new token with current JWT_SECRET
2. Update GitHub Actions secret first (to prevent CI failures)
3. Update Vercel environment variables
4. Update local .env files
5. Test authentication with the new token

### Security Best Practices
1. **Never commit tokens** to version control
2. **Use environment variables** for all token storage
3. **Rotate tokens regularly** (at least monthly)
4. **Monitor for authentication failures** in logs
5. **Use the same JWT_SECRET** across all environments

## Verification Commands

### Test Token Validity
```bash
# Verify token structure and expiry
JWT_SECRET=<secret> npx tsx -e "
import { AuthService } from './lib/services/auth';
const token = '<your-token>';
try {
  const decoded = AuthService.verifyJWT(token);
  console.log('✅ Token valid:', decoded);
  console.log('Expires:', new Date(decoded.exp * 1000));
} catch (error) {
  console.error('❌ Token invalid:', error.message);
}
"
```

### Test API Authentication
```bash
# Test against local API
curl -H "Authorization: Bearer <token>" http://localhost:3003/api/admin/system-verification

# Test against production API
curl -H "Authorization: Bearer <token>" https://hotdog-diaries.vercel.app/api/admin/system-verification
```

## Architecture Notes

### Why String Comparison Instead of JWT Verification?

The current implementation uses string comparison (`authHeader === \`Bearer ${process.env.AUTH_TOKEN}\``) instead of JWT verification for simplicity and consistency across GitHub Actions workflows. This approach:

- **Pros**: Simple, predictable, works with environment variables
- **Cons**: Requires exact token management, no automatic expiry handling

### Potential Improvements

For enhanced security, consider updating API endpoints to use proper JWT verification:

```typescript
// Instead of string comparison:
const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`

// Use JWT verification:
const token = AuthService.extractTokenFromHeader(authHeader);
const decoded = AuthService.verifyJWT(token);
const isAuthenticated = decoded.userId === expectedUserId;
```

## Troubleshooting Checklist

When authentication fails, check:

- [ ] JWT_SECRET is identical in all environments
- [ ] AUTH_TOKEN is a valid JWT (3 parts separated by dots)
- [ ] Token is not expired (check `exp` claim)
- [ ] Token was generated with the correct JWT_SECRET
- [ ] Bearer header format is correct: `Authorization: Bearer <token>`
- [ ] Environment variables are loaded (restart services after changes)
- [ ] GitHub Actions secrets are updated
- [ ] Vercel environment variables are updated

## Support Scripts

The following scripts are available for JWT management:

- `scripts/generate-production-jwt.ts` - Generate production tokens
- `scripts/debug-jwt-authentication.ts` - Comprehensive authentication debugging
- `scripts/monitor-system-health.ts` - System health monitoring with auth tests

## Last Updated

This guide was last updated on August 27, 2025, following the resolution of JWT authentication mismatches between local development and production environments.