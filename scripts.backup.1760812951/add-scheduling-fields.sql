-- Migration: Add scheduling and status tracking fields for content scheduling system
-- Date: 2025-01-27
-- Description: Adds required fields for deterministic content scheduling with platform diversity

-- Add priority field for content scheduling (if not exists)
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- Add status field for scheduling pipeline (if not exists) 
-- Values: 'approved', 'scheduled', 'posted', 'failed'
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' 
  CHECK (status IN ('approved', 'scheduled', 'posted', 'failed'));

-- Create indexes for scheduling performance
CREATE INDEX IF NOT EXISTS idx_content_queue_scheduled_for ON content_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_content_queue_status_new ON content_queue(status);
CREATE INDEX IF NOT EXISTS idx_content_queue_priority ON content_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_content_queue_scheduling ON content_queue(status, scheduled_for, priority);

-- Create composite index for efficient scheduler queries
CREATE INDEX IF NOT EXISTS idx_content_queue_scheduler ON content_queue(is_approved, is_posted, status, source_platform, scheduled_for);

-- Update existing content to have proper status values
-- Map existing content_status to new status field
UPDATE content_queue SET status = 
  CASE 
    WHEN is_posted = TRUE THEN 'posted'
    WHEN scheduled_for IS NOT NULL AND scheduled_for > datetime('now') THEN 'scheduled'
    WHEN is_approved = TRUE THEN 'approved'
    ELSE 'approved'
  END
WHERE status = 'approved'; -- Only update rows that still have the default value

-- Verify the migration
SELECT 'Migration verification:' as info;
SELECT 
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN scheduled_for IS NOT NULL THEN 1 END) as with_schedule
FROM content_queue 
GROUP BY status;