# Hotdog Diaries Deployment Guide

## Table of Contents
- [Authentication & Token Management](#authentication--token-management)
- [Environment Setup](#environment-setup)
- [Deployment Process](#deployment-process)
- [Monitoring & Troubleshooting](#monitoring--troubleshooting)

## Authentication & Token Management

### Overview
Hotdog Diaries uses a robust token rotation system to ensure GitHub Actions never fail due to expired authentication tokens. The system supports two authentication methods:

1. **Service Account Tokens** (Recommended for CI/CD)
   - Long-lived tokens (30 days)
   - Automatically refreshed before expiry
   - Ideal for GitHub Actions

2. **Refresh Tokens** (For user sessions)
   - Short-lived access tokens (24 hours)
   - Refresh tokens valid for 7 days
   - Automatic rotation on each refresh

### Initial Setup

#### 1. Generate Service Account Token

First, generate a service account token for GitHub Actions:

```bash
# Generate service account and token
npm run generate:service-token
```

This will output:
- `SERVICE_ACCOUNT_SECRET`: A secret key for generating new tokens
- `AUTH_TOKEN`: A backup token (optional)

#### 2. Configure GitHub Secrets

Add the following secrets to your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add/Update these secrets:
   - `SITE_URL`: Your production URL (e.g., `https://hotdog-diaries.vercel.app`)
   - `SERVICE_ACCOUNT_SECRET`: The secret from step 1
   - `AUTH_TOKEN`: Backup token (optional but recommended)
   - `JWT_SECRET`: Your JWT signing secret

#### 3. Configure Vercel Environment Variables

Set the same secrets in Vercel:

```bash
# Using Vercel CLI
vercel env add SERVICE_ACCOUNT_SECRET production
vercel env add JWT_SECRET production
```

### Token Refresh Workflow

#### Automatic Refresh in GitHub Actions

All GitHub Actions workflows now automatically refresh tokens before execution:

```yaml
jobs:
  refresh-token:
    uses: ./.github/workflows/token-refresh.yml
    secrets:
      SITE_URL: ${{ secrets.SITE_URL }}
      SERVICE_ACCOUNT_SECRET: ${{ secrets.SERVICE_ACCOUNT_SECRET }}
      AUTH_TOKEN: ${{ secrets.AUTH_TOKEN }}

  main-job:
    needs: refresh-token
    runs-on: ubuntu-latest
    steps:
      - name: Use Fresh Token
        env:
          AUTH_TOKEN: ${{ needs.refresh-token.outputs.auth_token }}
        run: |
          # Your API calls here with fresh token
```

#### Manual Token Refresh

If you need to manually refresh a token:

```bash
# Using service account
curl -X POST https://your-site.com/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"serviceAccount": "YOUR_SERVICE_ACCOUNT_SECRET"}'

# Using refresh token
curl -X POST https://your-site.com/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "YOUR_REFRESH_TOKEN"}'
```

### Token Rotation Strategy

The system implements a multi-layer fallback strategy:

1. **Primary**: Use service account secret to generate fresh token
2. **Secondary**: Use refresh token to get new access token
3. **Fallback**: Use existing AUTH_TOKEN if still valid
4. **Error**: Fail with clear instructions for manual intervention

### Security Best Practices

1. **Never commit tokens** to your repository
2. **Rotate service account secret** quarterly
3. **Monitor token usage** via system logs
4. **Use environment-specific tokens** (dev/staging/prod)
5. **Enable audit logging** for token generation

## Environment Setup

### Development Environment

```bash
# Copy environment template
cp .env.example .env.local

# Configure required variables
SERVICE_ACCOUNT_SECRET=<generated-secret>
JWT_SECRET=<your-jwt-secret>
DATABASE_URL_SQLITE=./hotdog_diaries_dev.db

# Initialize database
npm run db:init

# Create admin user
npm run admin:create

# Generate service token
npm run generate:service-token
```

### Production Environment

#### Vercel Deployment

1. **Connect GitHub Repository**
   ```bash
   vercel link
   ```

2. **Set Environment Variables**
   ```bash
   # Database (Supabase)
   vercel env add DATABASE_URL production
   
   # Authentication
   vercel env add JWT_SECRET production
   vercel env add SERVICE_ACCOUNT_SECRET production
   
   # API Keys
   vercel env add REDDIT_CLIENT_ID production
   vercel env add YOUTUBE_API_KEY production
   # ... other API keys
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

#### Manual Deployment

```bash
# Build for production
npm run build:prod

# Start production server
npm start
```

## Deployment Process

### Pre-Deployment Checklist

- [ ] All tests passing (`npm test`)
- [ ] E2E tests passing (`npm run test:e2e`)
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Service account token generated
- [ ] GitHub secrets updated

### Deployment Steps

1. **Merge to main branch**
   - GitHub Actions will run CI tests
   - Automatic deployment to Vercel (if configured)

2. **Verify Deployment**
   ```bash
   # Check health endpoint
   curl https://your-site.com/api/health
   
   # Verify token refresh
   curl -X GET https://your-site.com/api/auth/refresh
   
   # Test authentication
   curl -H "Authorization: Bearer $TOKEN" \
     https://your-site.com/api/admin/queue/status
   ```

3. **Monitor Initial Operations**
   - Check GitHub Actions runs
   - Monitor system logs
   - Verify content posting

### Rollback Process

If issues arise:

1. **Revert in Vercel**
   ```bash
   vercel rollback
   ```

2. **Revert in Git**
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Regenerate Tokens** (if auth issues)
   ```bash
   npm run generate:service-token
   # Update GitHub secrets
   ```

## Monitoring & Troubleshooting

### Common Issues

#### Token Expiration in GitHub Actions

**Symptoms**: Actions fail with 401 Unauthorized

**Solution**:
1. Check SERVICE_ACCOUNT_SECRET is set correctly
2. Regenerate service token if needed
3. Verify token refresh workflow is included

```bash
# Debug token refresh
./scripts/refresh-token.sh
```

#### Database Connection Issues

**Symptoms**: 500 errors, "Database unavailable"

**Solution**:
1. Check DATABASE_URL in production
2. Verify Supabase connection
3. Check connection pool settings

#### Content Not Posting

**Symptoms**: Scheduled posts not appearing

**Solution**:
1. Check GitHub Actions logs
2. Verify approved content exists
3. Check posting API endpoint
4. Review system logs in database

### Monitoring Commands

```bash
# Check system health
curl https://your-site.com/api/health

# View queue status
curl -H "Authorization: Bearer $TOKEN" \
  https://your-site.com/api/admin/queue/status

# Check recent posts
curl -H "Authorization: Bearer $TOKEN" \
  https://your-site.com/api/admin/content?limit=10

# View system logs
curl -H "Authorization: Bearer $TOKEN" \
  https://your-site.com/api/admin/logs?level=error
```

### Log Analysis

System logs are stored in the `system_logs` table:

```sql
-- View recent errors
SELECT * FROM system_logs 
WHERE log_level = 'error' 
ORDER BY created_at DESC 
LIMIT 20;

-- Check token refresh attempts
SELECT * FROM system_logs 
WHERE component = 'auth-refresh' 
ORDER BY created_at DESC;

-- Monitor API failures
SELECT * FROM system_logs 
WHERE message LIKE '%API%failed%' 
ORDER BY created_at DESC;
```

### Performance Monitoring

Key metrics to track:

1. **Token Refresh Success Rate**
   - Target: >99%
   - Alert threshold: <95%

2. **API Response Times**
   - Target: <500ms p50
   - Alert threshold: >2000ms p95

3. **Content Posting Success**
   - Target: 100% (6 posts/day)
   - Alert threshold: <5 posts/day

4. **GitHub Actions Success Rate**
   - Target: >95%
   - Alert threshold: <90%

## Support & Resources

- **Documentation**: `/docs`
- **GitHub Issues**: Report bugs and feature requests
- **System Logs**: Check `system_logs` table for debugging
- **Health Check**: `/api/health` endpoint

### Emergency Contacts

For critical production issues:

1. Check system status
2. Review recent deployments
3. Check GitHub Actions logs
4. Review system logs
5. Rollback if necessary

Remember: The token rotation system ensures continuous operation. If tokens expire, the system will automatically attempt to refresh them before failing.