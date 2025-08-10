-- Add new columns to content_queue table
ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS scheduled_post_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS posting_priority INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS posting_attempt_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_posting_attempt TIMESTAMP;

-- Create posting status enum
DO $$ BEGIN
    CREATE TYPE posting_status AS ENUM ('pending', 'posted', 'failed', 'skipped');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create posting_schedule table
CREATE TABLE IF NOT EXISTS posting_schedule (
    id SERIAL PRIMARY KEY,
    content_queue_id INTEGER NOT NULL REFERENCES content_queue(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMP NOT NULL,
    posted_at TIMESTAMP,
    status posting_status NOT NULL DEFAULT 'pending',
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_content_schedule UNIQUE (content_queue_id, scheduled_for)
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_posting_schedule_scheduled_for ON posting_schedule(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_posting_schedule_status ON posting_schedule(status);

-- Create posting_history table
CREATE TABLE IF NOT EXISTS posting_history (
    id SERIAL PRIMARY KEY,
    content_queue_id INTEGER NOT NULL REFERENCES content_queue(id) ON DELETE CASCADE,
    posted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    platform VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT false,
    response_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for posting_history
CREATE INDEX IF NOT EXISTS idx_posting_history_content_id ON posting_history(content_queue_id);
CREATE INDEX IF NOT EXISTS idx_posting_history_posted_at ON posting_history(posted_at);
CREATE INDEX IF NOT EXISTS idx_posting_history_success ON posting_history(success);

-- Add indexes to content_queue for new columns
CREATE INDEX IF NOT EXISTS idx_content_queue_scheduled_post_time ON content_queue(scheduled_post_time);
CREATE INDEX IF NOT EXISTS idx_content_queue_posting_priority ON content_queue(posting_priority);
CREATE INDEX IF NOT EXISTS idx_content_queue_is_posted_approved ON content_queue(is_posted, is_approved);