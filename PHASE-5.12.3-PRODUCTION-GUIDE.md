# Phase 5.12.3: Unblock Prod Forecast Now - Implementation Guide

## 🚀 Quick Start (Production Steps)

Follow these steps **IN ORDER** to unblock the production forecast immediately:

## Step 1: Create Table in Supabase Production

1. Open Supabase Studio for your **production** project
2. Navigate to **SQL Editor**
3. Copy and run the **ENTIRE** SQL from: `supabase/migrations/20251009_create_scheduled_posts_prod.sql`
4. Verify table creation by running:
   ```sql
   select table_name
   from information_schema.tables
   where table_schema='public' and table_name='scheduled_posts';
   ```
   - Expected result: One row with `scheduled_posts`

## Step 2: Configure Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Ensure these are set for **Production**:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key (NOT the anon key!)
3. **Important**: Trigger a production redeploy to pick up the environment variables

## Step 3: Backfill Today's Schedule (Optional but Recommended)

### Option A: Run Locally with Production Credentials
```bash
# Set your production Supabase credentials
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Generate schedule for today
npm run schedule:day 2025-10-09
```

### Option B: Let the API Auto-Generate
The forecast API will automatically call `generateDailySchedule()` if the table is empty, but running it manually ensures immediate availability.

## Step 4: Validate Production Endpoint

### Test Forecast API:
```bash
curl -s "https://hotdog-diaries.vercel.app/api/admin/schedule/forecast?date=2025-10-09" | jq '.date,.slots|length,.summary'
```

**Expected Output:**
- HTTP 200 status
- Date: "2025-10-09"
- Slots: 6
- Summary with posted/upcoming/missed counts

### Test Health Check:
```bash
curl -s "https://hotdog-diaries.vercel.app/api/admin/schedule/forecast/health" | jq '.'
```

**Expected Output:**
```json
{
  "ok": true,
  "missing": [],
  "table_ok": true
}
```

## Step 5: Verify in Admin UI

1. Navigate to: https://hotdog-diaries.vercel.app/admin/schedule
2. Look for the **"🔮 Forecast - What Will Post"** section
3. Should display 6 slots with:
   - Time slots: 08:00, 12:00, 15:00, 18:00, 21:00, 23:30 ET
   - Status indicators: ✅ Posted, 🕒 Upcoming, or ⏳ Missed
   - Platform diversity metrics
   - Content details and reasoning

## 📋 Troubleshooting

### Issue: "scheduled_posts table missing in Supabase"
**Solution:** Run the SQL migration in Step 1

### Issue: Health check shows `table_ok: false`
**Solution:** 
1. Verify table exists with the SELECT query
2. If table exists, run: `select pg_notify('pgrst', 'reload schema');`
3. Wait 1 minute for PostgREST cache to refresh

### Issue: Environment variables missing
**Solution:**
1. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel
2. Redeploy the production environment

### Issue: No content in forecast
**Solution:**
1. Run the backfill script (Step 3)
2. Ensure content_queue has approved, unposted content
3. Check that generateDailySchedule() has proper database access

## 🎯 Success Criteria

✅ Health endpoint returns `{ ok: true, table_ok: true }`
✅ Forecast API returns 200 with 6 slots
✅ Admin UI shows "Forecast - What Will Post" table
✅ Platform diversity is maintained across slots
✅ No 503 errors about missing table

## 📊 What This Enables

- **Deterministic Forecasting**: Exact preview of what will post
- **Platform Diversity**: Automated balancing across content sources
- **Timezone Accuracy**: Proper ET to UTC conversion
- **Self-Healing**: Auto-generates schedule when empty
- **Production Parity**: Same code for dev and prod

## 🔄 Daily Operations

Once set up, the system automatically:
1. Generates daily schedules via GitHub Actions
2. Shows real-time forecast in admin panel
3. Tracks posted vs upcoming vs missed slots
4. Maintains platform diversity quotas

## 📝 Files Created/Modified

- `supabase/migrations/20251009_create_scheduled_posts_prod.sql` - Production migration
- `scripts/generateScheduleForDate.ts` - Manual schedule generation
- `app/api/admin/schedule/forecast/health/route.ts` - Health check endpoint
- `package.json` - Added `schedule:day` script

---

**Phase 5.12.3 Status: READY FOR PRODUCTION** 🚀