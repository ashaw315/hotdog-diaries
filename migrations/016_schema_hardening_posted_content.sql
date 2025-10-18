-- SQLite Schema Hardening: posted_content table
-- Add constraints, foreign keys, and indexes for data integrity

-- 1. Add scheduled_post_id column if it doesn't exist
-- SQLite doesn't have IF NOT EXISTS for ALTER TABLE ADD COLUMN, so we use a workaround
PRAGMA table_info(posted_content);

-- Create new table with all required columns and constraints
CREATE TABLE IF NOT EXISTS posted_content_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_queue_id INTEGER NOT NULL,
  scheduled_post_id INTEGER, -- Nullable for legacy compatibility
  platform TEXT,
  posted_at TEXT NOT NULL DEFAULT (datetime('now')),
  post_order INTEGER,
  scheduled_time TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  -- Constraints
  UNIQUE (content_queue_id), -- Prevent reposting same content
  UNIQUE (scheduled_post_id), -- One post per schedule slot
  CHECK (posted_at >= '2020-01-01' AND posted_at <= datetime('now', '+1 hour')), -- Reasonable time range
  
  -- Foreign keys
  FOREIGN KEY (content_queue_id) REFERENCES content_queue(id) ON DELETE CASCADE,
  FOREIGN KEY (scheduled_post_id) REFERENCES scheduled_posts(id) ON DELETE SET NULL
);

-- 2. Copy existing data, handling missing columns gracefully
INSERT OR IGNORE INTO posted_content_new 
(id, content_queue_id, scheduled_post_id, platform, posted_at, post_order, scheduled_time, created_at, updated_at)
SELECT 
  id,
  content_queue_id,
  CASE 
    WHEN EXISTS(SELECT 1 FROM pragma_table_info('posted_content') WHERE name='scheduled_post_id') 
    THEN scheduled_post_id 
    ELSE NULL 
  END as scheduled_post_id,
  platform,
  posted_at,
  post_order,
  scheduled_time,
  COALESCE(created_at, datetime('now')) as created_at,
  COALESCE(updated_at, datetime('now')) as updated_at
FROM posted_content
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='posted_content');

-- 3. Drop old table and rename new one
DROP TABLE IF EXISTS posted_content;
ALTER TABLE posted_content_new RENAME TO posted_content;

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_posted_content_posted_at 
ON posted_content (posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_posted_content_platform 
ON posted_content (platform);

CREATE INDEX IF NOT EXISTS idx_posted_content_scheduled_lookup 
ON posted_content (scheduled_post_id) 
WHERE scheduled_post_id IS NOT NULL;

-- 5. Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_posted_content_date_platform 
ON posted_content (date(posted_at), platform);

CREATE INDEX IF NOT EXISTS idx_posted_content_content_queue_lookup 
ON posted_content (content_queue_id, posted_at DESC);

-- 6. Audit queries index
CREATE INDEX IF NOT EXISTS idx_posted_content_audit 
ON posted_content (posted_at, scheduled_post_id, content_queue_id);

-- 7. Create trigger for updated_at
CREATE TRIGGER IF NOT EXISTS trg_posted_content_updated_at
AFTER UPDATE ON posted_content
FOR EACH ROW
BEGIN
  UPDATE posted_content 
  SET updated_at = datetime('now') 
  WHERE id = NEW.id;
END;

-- 8. Verify constraints are working (these will fail if data violates constraints)
-- Test unique constraint on content_queue_id
INSERT OR IGNORE INTO posted_content (content_queue_id, posted_at) 
SELECT 999999, datetime('now') 
WHERE NOT EXISTS (SELECT 1 FROM posted_content WHERE content_queue_id = 999999);

DELETE FROM posted_content WHERE content_queue_id = 999999;

-- Test unique constraint on scheduled_post_id  
INSERT OR IGNORE INTO posted_content (content_queue_id, scheduled_post_id, posted_at) 
SELECT 999998, 999999, datetime('now') 
WHERE NOT EXISTS (SELECT 1 FROM posted_content WHERE scheduled_post_id = 999999);

DELETE FROM posted_content WHERE content_queue_id = 999998;