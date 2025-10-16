# Migration Sequence for Ingestion Rebalance

## Order of Operations (CRITICAL - Must be done in this order!)

### Phase 1: Database Schema Update
**File:** `add_ingest_priority_migration.sql`
```sql
ALTER TABLE public.content_queue 
ADD COLUMN IF NOT EXISTS ingest_priority INTEGER DEFAULT 0;
```

Run this FIRST in Supabase SQL editor or via psql:
```bash
psql "$DATABASE_URL" < add_ingest_priority_migration.sql
```

### Phase 2: Soft Rebalance (After Column Exists)
**File:** `soft_rebalance_commands.sql`

This will:
- Deprioritize 347 excess Pixabay items
- Deprioritize 47 excess Bluesky items  
- Keep 300 items from each platform active

Run ONLY after Phase 1 is complete:
```bash
psql "$DATABASE_URL" < soft_rebalance_commands.sql
```

### Phase 3: Deploy Code Changes
Deploy the scheduler enhancements from `scheduler_query_improvements.md`:
- Add `.gte('ingest_priority', 0)` filter to candidate queries
- Implement diversity boost for underrepresented platforms
- Deploy quota enforcement from `ingestion_quota_system.md`

### Phase 4: Verify Success
Check the rebalanced distribution:
```sql
SELECT 
  lower(source_platform) AS platform,
  COUNT(*) FILTER (WHERE COALESCE(ingest_priority, 0) >= 0) AS active_items,
  COUNT(*) FILTER (WHERE COALESCE(ingest_priority, 0) < 0) AS deprioritized,
  COUNT(*) AS total
FROM public.content_queue
WHERE is_approved = true AND COALESCE(is_posted, false) = false
GROUP BY 1
ORDER BY active_items DESC;
```

Expected result:
- pixabay: 300 active, 347 deprioritized
- bluesky: 300 active, 47 deprioritized
- Other platforms: unchanged

### Phase 5: Monitor
Set up the GitHub Actions workflow and run the monitoring script:
```bash
npx tsx scripts/ingestion-balance-report.ts
```

## Emergency Rollback
If issues occur, run `quick_rollback.sql` to reset all priorities:
```sql
UPDATE public.content_queue 
SET ingest_priority = 0
WHERE ingest_priority < 0;
```

## Important Notes
- **DO NOT** run soft_rebalance_commands.sql before adding the column
- **DO NOT** deploy code changes before running the SQL migrations
- **ALWAYS** test in development environment first if possible
- **KEEP** rollback script ready during deployment