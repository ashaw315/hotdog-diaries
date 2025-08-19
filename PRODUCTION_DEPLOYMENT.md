# 🚀 Production Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Setup
```bash
# 1. Create production environment file
cp .env.production.example .env.production

# 2. Fill in all production values in .env.production
# - Generate new JWT_SECRET (64 characters)
# - Set strong ADMIN_PASSWORD
# - Configure production database URL
# - Add all API keys with production quotas
```

### 2. Code Cleanup & Build
```bash
# 1. Clean up development files
npm run cleanup

# 2. Check for TypeScript errors
npm run type-check

# 3. Run linter
npm run lint

# 4. Test production build
npm run build:prod

# 5. Test locally
npm run start
```

### 3. Database Setup
```bash
# For PostgreSQL production database
npm run db:migrate

# Create admin user
npm run admin:create
```

## Vercel Deployment

### 1. Install Vercel CLI
```bash
npm install -g vercel
vercel login
```

### 2. Initial Deployment
```bash
# Deploy to preview first
vercel

# The deployment will prompt you to:
# - Link to existing project or create new
# - Set framework preset (Next.js - detected automatically)
# - Set build command (npm run build:prod)
# - Set output directory (.next)
```

### 3. Environment Variables
Set all production environment variables in Vercel dashboard or via CLI:

```bash
# Required variables
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
vercel env add ADMIN_USERNAME production
vercel env add ADMIN_PASSWORD production

# API Keys
vercel env add YOUTUBE_API_KEY production
vercel env add REDDIT_CLIENT_ID production
vercel env add REDDIT_CLIENT_SECRET production
vercel env add REDDIT_USERNAME production
vercel env add REDDIT_PASSWORD production
vercel env add GIPHY_API_KEY production
vercel env add PIXABAY_API_KEY production

# Optional
vercel env add UNSPLASH_ACCESS_KEY production
vercel env add BLUESKY_HANDLE production
vercel env add BLUESKY_PASSWORD production
```

### 4. Deploy to Production
```bash
# Deploy to production domain
vercel --prod
```

### 5. Set Up Custom Domain (Optional)
```bash
vercel domains add hotdogdiaries.com
# Follow DNS configuration instructions
```

## Post-Deployment Verification

### 1. Health Checks
```bash
# Basic health check
curl https://your-app.vercel.app/api/health

# Admin system
curl -X POST https://your-app.vercel.app/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

### 2. Cron Jobs Verification
Cron jobs are automatically configured via `vercel.json`:
- Content scanning: Every 4 hours (0 */4 * * *)
- Content posting: 6 times daily (0 7,10,13,16,19,22 * * *)

Verify they're working:
```bash
# Check cron job logs in Vercel dashboard
# Or manually trigger:
curl https://your-app.vercel.app/api/cron/scan-content
curl https://your-app.vercel.app/api/cron/post-content
```

### 3. Database Migration
```bash
# If using PostgreSQL, ensure migrations ran
# Check via admin panel or API:
curl https://your-app.vercel.app/api/admin/diagnostics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Performance Monitoring

### 1. Vercel Analytics (Recommended)
Add to `app/layout.tsx`:
```typescript
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### 2. Bundle Analysis
```bash
# Analyze bundle size
npm run analyze

# Check for largest chunks and optimize accordingly
```

## Security Configuration

Production deployment includes:
- ✅ Security headers via middleware.ts
- ✅ Content Security Policy
- ✅ HTTPS enforcement
- ✅ Test route redirects
- ✅ Environment variable protection

## Maintenance & Updates

### 1. Regular Updates
```bash
# Pull latest changes
git pull origin main

# Test locally
npm run build:prod

# Deploy
vercel --prod
```

### 2. Database Backups
Set up regular backups of your PostgreSQL database through your provider.

### 3. Monitoring
- Monitor Vercel function logs
- Check error rates in Vercel dashboard
- Monitor API quota usage for external services

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check TypeScript errors: `npm run type-check`
   - Check ESLint errors: `npm run lint`
   - Review build logs in Vercel dashboard

2. **Database Connection Issues**
   - Verify `DATABASE_URL` is set correctly
   - Check PostgreSQL connection limits
   - Ensure migrations have run

3. **API Rate Limits**
   - Monitor API usage in respective platforms
   - Check error logs for quota exceeded messages
   - Implement backoff strategies if needed

4. **Cron Jobs Not Running**
   - Check Vercel cron logs
   - Verify `vercel.json` configuration
   - Ensure functions don't timeout (max 60s)

### Emergency Procedures

1. **Rollback Deployment**
   ```bash
   # Revert to previous deployment
   vercel rollback
   ```

2. **Disable Problematic Platform**
   - Use admin panel to disable scanning
   - Or set environment variable to disable

3. **Database Issues**
   - Have rollback migration ready
   - Keep recent backup available

## Success Metrics

After successful deployment, you should see:
- ✅ Homepage loads in <3 seconds
- ✅ Admin login works
- ✅ Content feed displays properly
- ✅ Automated posting works (6 times daily)
- ✅ Platform scanning works (every 4 hours)
- ✅ Mobile responsiveness works
- ✅ All security headers present

## Contact & Support

For deployment issues:
1. Check Vercel deployment logs
2. Review error tracking (if configured)
3. Check database logs
4. Verify environment variables

Production deployment should provide a fast, secure, and scalable hotdog content aggregation platform!