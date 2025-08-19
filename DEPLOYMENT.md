# 🚀 Hotdog Diaries - Vercel Deployment Guide

## Overview

This guide walks you through deploying Hotdog Diaries to Vercel with PostgreSQL database support.

## Prerequisites

- [Vercel account](https://vercel.com)
- [GitHub repository](https://github.com) with your code
- API keys for social media platforms (optional, but recommended)

## Step-by-Step Deployment

### 1. Prepare Your Repository

Ensure your code is pushed to a GitHub repository with all recent changes:

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### 2. Create Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"New Project"**
3. Import your GitHub repository
4. Configure the project:
   - **Framework**: Next.js
   - **Build Command**: `npm run build:prod`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### 3. Add PostgreSQL Storage

1. In your Vercel project dashboard, go to the **Storage** tab
2. Click **"Create Database"**
3. Select **"PostgreSQL"**
4. Choose your preferred region (recommend same as your project)
5. Create the database

This automatically provides these environment variables:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL` 
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`

### 4. Configure Environment Variables

Go to **Project Settings → Environment Variables** and add:

#### Required Variables

```bash
# JWT Authentication (Generate with: openssl rand -hex 32)
JWT_SECRET=your-64-character-jwt-secret-here
JWT_REFRESH_SECRET=your-64-character-refresh-secret-here

# Admin User
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourSecurePassword123!
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_FULL_NAME=Administrator

# Security
CORS_ORIGIN=https://your-app-name.vercel.app
CRON_SECRET=your-32-character-cron-secret

# Application
NEXT_PUBLIC_BASE_URL=https://your-app-name.vercel.app
```

#### Optional API Keys (for content scanning)

```bash
# Reddit
REDDIT_CLIENT_ID=your-reddit-client-id
REDDIT_CLIENT_SECRET=your-reddit-client-secret
REDDIT_USERNAME=your-reddit-bot-username
REDDIT_PASSWORD=your-reddit-bot-password

# YouTube
YOUTUBE_API_KEY=your-youtube-api-key

# Bluesky
BLUESKY_IDENTIFIER=your-bluesky-handle
BLUESKY_PASSWORD=your-bluesky-password

# Unsplash
UNSPLASH_ACCESS_KEY=your-unsplash-access-key

# Giphy
GIPHY_API_KEY=your-giphy-api-key
```

### 5. Deploy

1. Click **"Deploy"** in your Vercel dashboard
2. Wait for the build to complete (~2-3 minutes)
3. The database will be automatically set up during the build process

### 6. Verify Deployment

After deployment:

1. **Test the homepage**: Visit your Vercel app URL
2. **Check database**: Visit `/api/health` - should show database connected
3. **Test admin login**: Visit `/admin/login` and use your admin credentials
4. **Check content**: Visit `/api/content` - should return content data

## Database Management

### Automatic Setup

The database is automatically set up during deployment via the `postbuild` script:
- Runs migrations to create all tables
- Creates admin user with your configured credentials
- Seeds initial data if needed

### Manual Database Operations

If you need to manually manage the database:

```bash
# Check database status
npm run db:status

# Run specific migration
npm run db:migrate

# Set up Vercel Postgres (manual)
npm run db:setup-vercel
```

## Monitoring & Maintenance

### Environment Variables

- Update API keys in Vercel dashboard when they expire
- Rotate JWT secrets periodically for security

### Database

- Monitor database usage in Vercel dashboard
- PostgreSQL has automatic backups and scaling

### Content Pipeline

- Content scanning runs automatically via cron jobs (defined in `vercel.json`)
- Monitor API quotas for social media platforms
- Review and approve content in the admin dashboard

## Troubleshooting

### Common Issues

**Build fails with TypeScript errors:**
```bash
# Run locally first to fix issues
npm run type-check
npm run lint
npm run build
```

**Database connection errors:**
- Ensure PostgreSQL storage is properly connected in Vercel
- Check that all POSTGRES_* environment variables are automatically set
- Verify your app is in production mode (`NODE_ENV=production`)

**Admin login not working:**
- Check JWT_SECRET is set and at least 32 characters
- Verify admin credentials in environment variables
- Check `/api/health` for database connectivity

**Content not loading:**
- Verify API keys for social media platforms
- Check `/api/admin/platforms/status` for platform health
- Run manual scan via admin dashboard

### Logs

View deployment logs in Vercel:
1. Go to your project dashboard
2. Click on a deployment
3. View **"Function Logs"** tab for runtime logs
4. View **"Build Logs"** for deployment issues

## Performance Optimization

### Caching

The app includes:
- Static page generation where possible
- API response caching
- Image optimization via Next.js

### Database

- Connection pooling is automatic with Vercel Postgres
- Queries are optimized for performance
- Database indexes on frequently queried columns

### Monitoring

Add monitoring services by updating environment variables:
```bash
SENTRY_DSN=your-sentry-dsn
LOGFLARE_API_KEY=your-logflare-key
```

## Security Checklist

- ✅ JWT secrets are secure (64+ characters)
- ✅ Admin password is strong
- ✅ CORS origins are properly configured
- ✅ API keys are stored as environment variables (not in code)
- ✅ Database uses SSL in production
- ✅ Security headers are enabled via middleware

## Support

For deployment issues:
1. Check the [Vercel documentation](https://vercel.com/docs)
2. Review build and function logs
3. Test locally with `npm run build && npm run start`
4. Verify environment variables are correctly set

## Useful Commands

```bash
# Local development with production build
npm run build:prod && npm run start

# Generate secure secrets
openssl rand -hex 32

# Test API endpoints
curl https://your-app.vercel.app/api/health
curl https://your-app.vercel.app/api/content

# Check build output
npm run analyze
```

🎉 **Your Hotdog Diaries app should now be live on Vercel with PostgreSQL!**