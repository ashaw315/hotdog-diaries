# JWT Token Generation for Production

This directory contains scripts to generate production-compatible JWT tokens for the Hotdog Diaries GitHub Actions workflows.

## Problem
The GitHub Actions workflows were failing because the `AUTH_TOKEN` secret was generated using the local development `JWT_SECRET`, which differs from the production `JWT_SECRET` used by the Vercel deployment.

## Solution

### 1. Get Production JWT_SECRET

Run the helper script to retrieve the production JWT_SECRET from Vercel:

```bash
./scripts/get-production-jwt-secret.sh
```

This will:
- Pull production environment variables from Vercel
- Extract the JWT_SECRET
- Optionally generate the token directly

### 2. Generate Production JWT Token

Once you have the production JWT_SECRET, generate a compatible token:

```bash
# Method 1: Using command line argument
npx tsx scripts/generate-production-jwt.ts "your-production-jwt-secret-here"

# Method 2: Using environment variable  
JWT_SECRET="your-production-jwt-secret-here" npx tsx scripts/generate-production-jwt.ts
```

### 3. Update GitHub Secret

Copy the generated token and update the GitHub repository secret:

```bash
# Using GitHub CLI
gh secret set AUTH_TOKEN --body="your-generated-token-here"

# Or via GitHub Web UI:
# Settings → Secrets and variables → Actions → AUTH_TOKEN
```

## Files

- `generate-production-jwt.ts` - Main token generation script
- `get-production-jwt-secret.sh` - Helper to retrieve production JWT_SECRET from Vercel
- `README-JWT.md` - This documentation

## Token Details

- **User**: admin (ID: 1)
- **Expiry**: 24 hours
- **Issuer**: hotdog-diaries  
- **Audience**: admin
- **Algorithm**: HS256

## Important Notes

⚠️ **The generated token expires in 24 hours!**

For production use, you may want to:
1. Extend the token expiry by modifying `ACCESS_TOKEN_EXPIRY` in `lib/services/auth.ts`
2. Set up a periodic token refresh workflow
3. Consider using longer-lived refresh tokens for automation

## Troubleshooting

### "JWT_SECRET not found"
Ensure the production environment variables are properly set in Vercel:
1. Go to https://vercel.com/dashboard
2. Select your project → Settings → Environment Variables
3. Verify JWT_SECRET exists in the Production environment

### "Project not linked"
Run `vercel link` to connect your local codebase to the Vercel project.

### "Token verification failed"
Make sure you're using the exact JWT_SECRET from the production environment, not from local development.