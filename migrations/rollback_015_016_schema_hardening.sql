-- Rollback Script for Schema Hardening Migrations 015 and 016
-- Use with caution: this will remove constraints and indexes

-- SQLite Rollback: Remove hardening from posted_content
DROP TRIGGER IF EXISTS trg_posted_content_updated_at;
DROP INDEX IF EXISTS idx_posted_content_posted_at;
DROP INDEX IF EXISTS idx_posted_content_platform;
DROP INDEX IF EXISTS idx_posted_content_scheduled_lookup;
DROP INDEX IF EXISTS idx_posted_content_date_platform;
DROP INDEX IF EXISTS idx_posted_content_content_queue_lookup;
DROP INDEX IF EXISTS idx_posted_content_audit;

-- Create simple posted_content without constraints
CREATE TABLE IF NOT EXISTS posted_content_rollback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_queue_id INTEGER,
  platform TEXT,
  posted_at TEXT,
  post_order INTEGER,
  scheduled_time TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- Copy data back (excluding new columns)
INSERT INTO posted_content_rollback 
(id, content_queue_id, platform, posted_at, post_order, scheduled_time, created_at, updated_at)
SELECT id, content_queue_id, platform, posted_at, post_order, scheduled_time, created_at, updated_at
FROM posted_content;

DROP TABLE posted_content;
ALTER TABLE posted_content_rollback RENAME TO posted_content;

-- SQLite Rollback: Remove hardening from scheduled_posts  
DROP TRIGGER IF EXISTS trg_scheduled_posts_updated_at;
DROP INDEX IF EXISTS idx_scheduled_posts_unique_slot_platform;
DROP INDEX IF EXISTS idx_scheduled_posts_status_time;
DROP INDEX IF EXISTS idx_scheduled_posts_content_lookup;
DROP INDEX IF EXISTS idx_scheduled_posts_platform_status;
DROP INDEX IF EXISTS idx_scheduled_posts_slot_index;
DROP INDEX IF EXISTS idx_scheduled_posts_active;

-- Create simple scheduled_posts without strict constraints
CREATE TABLE IF NOT EXISTS scheduled_posts_rollback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER,
  platform TEXT,
  content_type TEXT,
  source TEXT,
  title TEXT,
  scheduled_post_time TEXT,
  scheduled_slot_index INTEGER,
  actual_posted_at TEXT,
  reasoning TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Copy data back
INSERT INTO scheduled_posts_rollback 
SELECT * FROM scheduled_posts;

DROP TABLE scheduled_posts;
ALTER TABLE scheduled_posts_rollback RENAME TO scheduled_posts;

-- Note: This rollback removes all constraints and indexes.
-- You may need to recreate basic indexes for performance:
-- CREATE INDEX idx_scheduled_posts_time ON scheduled_posts(scheduled_post_time);
-- CREATE INDEX idx_posted_content_posted_at ON posted_content(posted_at);