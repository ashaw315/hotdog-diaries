# Vercel Environment Variables - Required Setup

## Critical Issue: AUTH_TOKEN Missing in Production

The auto-post workflow is failing with **401 "Invalid cron authorization"** because the AUTH_TOKEN environment variable is not set in Vercel.

### Required Environment Variables

Go to: **Vercel Dashboard → hotdog-diaries project → Settings → Environment Variables**

Ensure these are set for **Production**:

#### 1. AUTH_TOKEN (CRITICAL - MISSING)
- **Name:** `AUTH_TOKEN`
- **Value:** Your secret authentication token
- **Environment:** Production (and Preview if testing)
- **Note:** This must match the `AUTH_TOKEN` secret in GitHub Actions

#### 2. Database Variables (Should already be set)
- `DATABASE_URL` - Supabase connection string
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for API access
- (OR `SUPABASE_SERVICE_ROLE_KEY_V2` if using newer key)

### How to Get the AUTH_TOKEN Value

The AUTH_TOKEN in GitHub secrets needs to be added to Vercel:

1. Go to: https://github.com/ashaw315/hotdog-diaries/settings/secrets/actions
2. Find the `AUTH_TOKEN` secret (you can't view it, only update it)
3. If you need to check the value:
   - You can generate a new one
   - OR use the same value you have in GitHub

### How to Set Environment Variable in Vercel

1. Go to: https://vercel.com/ashaw315s-projects/hotdog-diaries/settings/environment-variables
2. Click "Add New"
3. Fill in:
   - **Key:** `AUTH_TOKEN`
   - **Value:** (paste your token value)
   - **Environment:** Select "Production" (and "Preview" for testing)
4. Click "Save"
5. **Important:** Redeploy the application for changes to take effect
   - Go to Deployments tab
   - Click "..." on the latest deployment
   - Click "Redeploy"

### Alternative: Use CRON_SECRET

You can also set `CRON_SECRET` instead of (or in addition to) `AUTH_TOKEN`:

- **Name:** `CRON_SECRET`
- **Value:** A different secret token specifically for cron jobs
- **Environment:** Production

The API checks for `CRON_SECRET` first, then falls back to `AUTH_TOKEN`.

### How to Verify After Setup

1. Wait for deployment to complete
2. Check the workflow: https://github.com/ashaw315/hotdog-diaries/actions/workflows/auto-post-scheduled.yml
3. Manually trigger a run:
   - Click "Run workflow"
   - Select branch: main
   - Click "Run workflow"
4. Check the logs - should see success (200) instead of 401

### Monitoring Logs

After the fix, check Vercel logs:
1. Go to: https://vercel.com/ashaw315s-projects/hotdog-diaries/logs
2. Look for the `/api/cron/post-scheduled` endpoint calls
3. Should see:
   - ✅ "🤖 Cron job: Starting scheduled content posting..."
   - NOT: ❌ "Invalid cron authorization"

---

## Current Status

- ✅ GitHub Actions workflow created (auto-post-scheduled.yml)
- ✅ API endpoint updated to use correct database table
- ✅ Admin UI timezone bug fixed
- ❌ **Vercel AUTH_TOKEN environment variable NOT SET** ← **FIX THIS FIRST**

Once the AUTH_TOKEN is set in Vercel and the app is redeployed, the automated posting should work correctly on the hourly schedule (:05 of every hour).
