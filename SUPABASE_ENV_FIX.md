# Supabase Environment Variables Fix

## Quick Manual Fix Commands

Run these commands in order to extend your Supabase environment variables to all environments:

### 1. Check current status
```bash
vercel env ls production | grep SUPABASE
vercel env ls preview | grep SUPABASE  
vercel env ls development | grep SUPABASE
```

### 2. Add NEXT_PUBLIC_SUPABASE_URL to all environments
```bash
# For Preview (will prompt for value)
vercel env add NEXT_PUBLIC_SUPABASE_URL preview

# For Development (will prompt for value)  
vercel env add NEXT_PUBLIC_SUPABASE_URL development
```

### 3. Add SUPABASE_SERVICE_ROLE_KEY to all environments
```bash
# For Preview (will prompt for value)
vercel env add SUPABASE_SERVICE_ROLE_KEY preview

# For Development (will prompt for value)
vercel env add SUPABASE_SERVICE_ROLE_KEY development
```

### 4. Verify all environments have the variables
```bash
vercel env ls production | grep SUPABASE
vercel env ls preview | grep SUPABASE
vercel env ls development | grep SUPABASE
```

### 5. Redeploy
```bash
vercel --prod --yes
```

### 6. Test the fix
```bash
# Wait 2-3 minutes for deployment, then test:
curl https://hotdog-diaries.vercel.app/api/test-db
curl https://hotdog-diaries.vercel.app/api/full-diagnostic
```

## Your Supabase Values

Get these from: https://supabase.com/dashboard/project/supabase-blue-queen/settings/api

- **NEXT_PUBLIC_SUPABASE_URL**: `https://supabase-blue-queen.supabase.co`
- **SUPABASE_SERVICE_ROLE_KEY**: The "service_role" secret key (long JWT token)

## Alternative: Use the script
```bash
./scripts/fix-env-simple.sh
```

## Expected Result

Once complete, your database connection will work and content scanning will find posts!