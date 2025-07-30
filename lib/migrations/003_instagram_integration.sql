-- Instagram Integration Migration
-- Migration 003: Add Instagram-specific tables and configuration

-- Instagram Scan Configuration Table
-- Stores Instagram scanning configuration and settings
CREATE TABLE instagram_scan_config (
    id SERIAL PRIMARY KEY,
    is_enabled BOOLEAN DEFAULT FALSE,
    scan_interval INTEGER DEFAULT 60, -- minutes
    max_posts_per_scan INTEGER DEFAULT 20,
    target_hashtags TEXT[] DEFAULT ARRAY['hotdog', 'hotdogs', 'hotdoglovers', 'frankfurter', 'bratwurst', 'foodporn', 'grilling', 'bbq'],
    min_likes INTEGER DEFAULT 5,
    include_stories BOOLEAN DEFAULT FALSE,
    last_scan_id VARCHAR(255),
    last_scan_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Instagram Scan Results Table
-- Stores results and analytics from each Instagram scan
CREATE TABLE instagram_scan_results (
    id SERIAL PRIMARY KEY,
    scan_id VARCHAR(255) NOT NULL UNIQUE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    posts_found INTEGER DEFAULT 0,
    posts_processed INTEGER DEFAULT 0,
    posts_approved INTEGER DEFAULT 0,
    posts_rejected INTEGER DEFAULT 0,
    posts_flagged INTEGER DEFAULT 0,
    duplicates_found INTEGER DEFAULT 0,
    hashtags_scanned TEXT[] DEFAULT ARRAY[]::TEXT[],
    highest_likes INTEGER DEFAULT 0,
    errors TEXT[] DEFAULT ARRAY[]::TEXT[],
    rate_limit_hit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Instagram Authentication Table
-- Stores Instagram API tokens and authentication data
CREATE TABLE instagram_auth (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scope TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add Instagram data column to content_queue if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'content_queue' 
        AND column_name = 'instagram_data'
    ) THEN
        ALTER TABLE content_queue ADD COLUMN instagram_data JSONB;
    END IF;
END $$;

-- Create indexes for Instagram tables

-- Instagram scan config indexes
CREATE INDEX idx_instagram_scan_config_enabled ON instagram_scan_config(is_enabled);
CREATE INDEX idx_instagram_scan_config_last_scan ON instagram_scan_config(last_scan_time);

-- Instagram scan results indexes
CREATE INDEX idx_instagram_scan_results_scan_id ON instagram_scan_results(scan_id);
CREATE INDEX idx_instagram_scan_results_start_time ON instagram_scan_results(start_time);
CREATE INDEX idx_instagram_scan_results_end_time ON instagram_scan_results(end_time);
CREATE INDEX idx_instagram_scan_results_posts_approved ON instagram_scan_results(posts_approved);
CREATE INDEX idx_instagram_scan_results_created_at ON instagram_scan_results(created_at);

-- Instagram auth indexes
CREATE INDEX idx_instagram_auth_user_id ON instagram_auth(user_id);
CREATE INDEX idx_instagram_auth_is_active ON instagram_auth(is_active);
CREATE INDEX idx_instagram_auth_expires_at ON instagram_auth(expires_at);

-- Content queue Instagram data index
CREATE INDEX idx_content_queue_instagram_data ON content_queue USING GIN(instagram_data);

-- Create triggers for updated_at columns
CREATE TRIGGER update_instagram_scan_config_updated_at 
    BEFORE UPDATE ON instagram_scan_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_instagram_auth_updated_at 
    BEFORE UPDATE ON instagram_auth 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add constraints
ALTER TABLE instagram_scan_config 
    ADD CONSTRAINT chk_instagram_scan_interval_valid 
    CHECK (scan_interval BETWEEN 15 AND 1440);

ALTER TABLE instagram_scan_config 
    ADD CONSTRAINT chk_instagram_max_posts_valid 
    CHECK (max_posts_per_scan BETWEEN 1 AND 50);

ALTER TABLE instagram_scan_config 
    ADD CONSTRAINT chk_instagram_min_likes_valid 
    CHECK (min_likes >= 0);

ALTER TABLE instagram_scan_results 
    ADD CONSTRAINT chk_instagram_posts_counts_valid 
    CHECK (
        posts_found >= 0 AND 
        posts_processed >= 0 AND 
        posts_approved >= 0 AND 
        posts_rejected >= 0 AND 
        posts_flagged >= 0 AND
        duplicates_found >= 0
    );

ALTER TABLE instagram_auth 
    ADD CONSTRAINT chk_instagram_expires_at_future 
    CHECK (expires_at > created_at);

-- Insert default Instagram configuration
INSERT INTO instagram_scan_config (
    is_enabled,
    scan_interval,
    max_posts_per_scan,
    target_hashtags,
    min_likes,
    include_stories
) VALUES (
    FALSE, -- disabled by default
    60, -- 60 minutes
    20, -- 20 posts per scan
    ARRAY['hotdog', 'hotdogs', 'hotdoglovers', 'hotdoglunch', 'frankfurter', 'wiener', 'bratwurst', 'foodporn'],
    5, -- minimum 5 likes
    FALSE -- no stories by default
);