-- SQLite Schema Hardening: scheduled_posts table
-- Add constraints and indexes for data integrity

-- 1. Create new table with constraints (SQLite doesn't support ALTER TABLE ADD CONSTRAINT for CHECK)
CREATE TABLE IF NOT EXISTS scheduled_posts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER,
  platform TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image','video','text','link')),
  source TEXT,
  title TEXT,
  scheduled_post_time TEXT NOT NULL, -- ISO string in SQLite
  scheduled_slot_index INTEGER NOT NULL CHECK (scheduled_slot_index BETWEEN 0 AND 5),
  actual_posted_at TEXT, -- ISO string in SQLite
  reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posting','posted','failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (content_id) REFERENCES content_queue(id) ON DELETE CASCADE
);

-- 2. Copy data from old table if it exists
INSERT OR IGNORE INTO scheduled_posts_new 
(id, content_id, platform, content_type, source, title, scheduled_post_time, 
 scheduled_slot_index, actual_posted_at, reasoning, status, created_at, updated_at)
SELECT 
  id, content_id, platform, content_type, source, title, scheduled_post_time,
  scheduled_slot_index, actual_posted_at, reasoning, 
  COALESCE(status, 'pending') as status,
  COALESCE(created_at, datetime('now')) as created_at,
  COALESCE(updated_at, datetime('now')) as updated_at
FROM scheduled_posts
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='scheduled_posts');

-- 3. Drop old table and rename new one
DROP TABLE IF EXISTS scheduled_posts;
ALTER TABLE scheduled_posts_new RENAME TO scheduled_posts;

-- 4. Create unique index on (scheduled_post_time, platform) rounded to minute
-- SQLite approach: use date/time functions to ensure one row per platform per minute
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_posts_unique_slot_platform 
ON scheduled_posts (
  substr(scheduled_post_time, 1, 16), -- YYYY-MM-DDTHH:MM (minute precision)
  platform
);

-- 5. Performance indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status_time 
ON scheduled_posts (status, scheduled_post_time) 
WHERE status IN ('pending', 'posting');

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_content_lookup 
ON scheduled_posts (content_id) 
WHERE content_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_platform_status 
ON scheduled_posts (platform, status);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_slot_index 
ON scheduled_posts (scheduled_slot_index, scheduled_post_time);

-- 6. Partial index for active slots (SQLite supports WHERE clauses in indexes)
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_active 
ON scheduled_posts (scheduled_post_time, platform, content_id) 
WHERE status = 'pending' AND content_id IS NOT NULL;

-- 7. Create trigger for updated_at
CREATE TRIGGER IF NOT EXISTS trg_scheduled_posts_updated_at
AFTER UPDATE ON scheduled_posts
FOR EACH ROW
BEGIN
  UPDATE scheduled_posts 
  SET updated_at = datetime('now') 
  WHERE id = NEW.id;
END;