-- Schema Hardening: posted_content table
-- Add constraints, foreign keys, and indexes for data integrity

-- 1. Add scheduled_post_id column if it doesn't exist (nullable for legacy compatibility)
ALTER TABLE public.posted_content 
ADD COLUMN IF NOT EXISTS scheduled_post_id BIGINT;

-- 2. Add UNIQUE constraint on content_queue_id to prevent reposting same item
ALTER TABLE public.posted_content 
DROP CONSTRAINT IF EXISTS posted_content_content_queue_id_unique;

ALTER TABLE public.posted_content 
ADD CONSTRAINT posted_content_content_queue_id_unique 
UNIQUE (content_queue_id);

-- 3. Add UNIQUE constraint on scheduled_post_id when not null
ALTER TABLE public.posted_content 
DROP CONSTRAINT IF EXISTS posted_content_scheduled_post_id_unique;

ALTER TABLE public.posted_content 
ADD CONSTRAINT posted_content_scheduled_post_id_unique 
UNIQUE (scheduled_post_id) 
DEFERRABLE INITIALLY DEFERRED;

-- Note: Using DEFERRABLE to allow for edge cases during migration

-- 4. Add foreign key to scheduled_posts (nullable for legacy rows)
ALTER TABLE public.posted_content 
DROP CONSTRAINT IF EXISTS posted_content_scheduled_post_fk;

-- Only add FK if scheduled_posts table exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'scheduled_posts'
  ) THEN
    ALTER TABLE public.posted_content 
    ADD CONSTRAINT posted_content_scheduled_post_fk 
    FOREIGN KEY (scheduled_post_id) 
    REFERENCES public.scheduled_posts(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Add foreign key to content_queue if it exists
ALTER TABLE public.posted_content 
DROP CONSTRAINT IF EXISTS posted_content_content_queue_fk;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'content_queue'
  ) THEN
    ALTER TABLE public.posted_content 
    ADD CONSTRAINT posted_content_content_queue_fk 
    FOREIGN KEY (content_queue_id) 
    REFERENCES public.content_queue(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- 6. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_posted_content_posted_at 
ON public.posted_content (posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_posted_content_platform 
ON public.posted_content (platform);

CREATE INDEX IF NOT EXISTS idx_posted_content_scheduled_lookup 
ON public.posted_content (scheduled_post_id) 
WHERE scheduled_post_id IS NOT NULL;

-- 7. Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_posted_content_date_platform 
ON public.posted_content (DATE(posted_at), platform);

CREATE INDEX IF NOT EXISTS idx_posted_content_content_queue_lookup 
ON public.posted_content (content_queue_id, posted_at DESC);

-- 8. Add index for audit queries
CREATE INDEX IF NOT EXISTS idx_posted_content_audit 
ON public.posted_content (posted_at, scheduled_post_id, content_queue_id);

-- 9. Ensure posted_at has a default value
ALTER TABLE public.posted_content 
ALTER COLUMN posted_at SET DEFAULT NOW();

-- 10. Add check constraint for reasonable posted_at times (not too far in future/past)
ALTER TABLE public.posted_content 
DROP CONSTRAINT IF EXISTS posted_content_posted_at_reasonable;

ALTER TABLE public.posted_content 
ADD CONSTRAINT posted_content_posted_at_reasonable 
CHECK (
  posted_at >= '2020-01-01'::timestamp AND 
  posted_at <= (NOW() + INTERVAL '1 hour')
);

-- Force PostgREST to reload schema cache
SELECT pg_notify('pgrst', 'reload schema');