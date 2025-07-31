-- TikTok Integration Database Schema
-- Migration 005: Add TikTok support only (minimal version)

-- =====================================================
-- TikTok Authentication Table
-- =====================================================
CREATE TABLE IF NOT EXISTS tiktok_auth (
    id SERIAL PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    open_id VARCHAR(255) NOT NULL,
    union_id VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scope TEXT[] DEFAULT ARRAY['user.info.basic', 'video.list'],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for active token lookup
CREATE INDEX IF NOT EXISTS idx_tiktok_auth_active ON tiktok_auth(is_active, expires_at) WHERE is_active = TRUE;

-- =====================================================
-- TikTok Scan Configuration Table
-- =====================================================
CREATE TABLE IF NOT EXISTS tiktok_scan_config (
    id SERIAL PRIMARY KEY,
    is_enabled BOOLEAN DEFAULT FALSE,
    scan_interval INTEGER DEFAULT 120, -- minutes (TikTok has stricter rate limits)
    max_videos_per_scan INTEGER DEFAULT 20,
    target_keywords TEXT[] DEFAULT ARRAY[
        'hotdog', 'hotdogs', 'frankfurter', 'wiener', 'bratwurst'
    ],
    target_hashtags TEXT[] DEFAULT ARRAY[
        'foodtok', 'hotdogchallenge', 'grilling', 'bbq', 'streetfood'
    ],
    min_views INTEGER DEFAULT 100,
    max_duration INTEGER DEFAULT 180, -- seconds
    sort_by VARCHAR(50) DEFAULT 'relevance' CHECK (sort_by IN ('relevance', 'create_time', 'view_count')),
    last_scan_id VARCHAR(255),
    last_scan_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TikTok Scan Results Table
-- =====================================================
CREATE TABLE IF NOT EXISTS tiktok_scan_results (
    id SERIAL PRIMARY KEY,
    scan_id VARCHAR(255) NOT NULL UNIQUE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    videos_found INTEGER DEFAULT 0,
    videos_processed INTEGER DEFAULT 0,
    videos_approved INTEGER DEFAULT 0,
    videos_rejected INTEGER DEFAULT 0,
    videos_flagged INTEGER DEFAULT 0,
    duplicates_found INTEGER DEFAULT 0,
    keywords_scanned TEXT[] DEFAULT ARRAY[]::TEXT[],
    hashtags_scanned TEXT[] DEFAULT ARRAY[]::TEXT[],
    highest_views INTEGER DEFAULT 0,
    errors TEXT[] DEFAULT ARRAY[]::TEXT[],
    rate_limit_hit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tiktok_scan_results_scan_id ON tiktok_scan_results(scan_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_scan_results_created_at ON tiktok_scan_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tiktok_scan_results_end_time ON tiktok_scan_results(end_time DESC);

-- =====================================================
-- Add TikTok data column to content_queue
-- =====================================================
ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS tiktok_data JSONB;

-- Index for TikTok data queries
CREATE INDEX IF NOT EXISTS idx_content_queue_tiktok_data ON content_queue USING GIN(tiktok_data);

-- =====================================================
-- Create trigger for updated_at columns
-- =====================================================
CREATE TRIGGER update_tiktok_scan_config_updated_at 
    BEFORE UPDATE ON tiktok_scan_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tiktok_auth_updated_at 
    BEFORE UPDATE ON tiktok_auth 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Add constraints
-- =====================================================
ALTER TABLE tiktok_scan_config 
    ADD CONSTRAINT chk_tiktok_scan_interval_valid 
    CHECK (scan_interval BETWEEN 30 AND 1440);

ALTER TABLE tiktok_scan_config 
    ADD CONSTRAINT chk_tiktok_max_videos_valid 
    CHECK (max_videos_per_scan BETWEEN 1 AND 100);

ALTER TABLE tiktok_scan_config 
    ADD CONSTRAINT chk_tiktok_min_views_valid 
    CHECK (min_views >= 0);

ALTER TABLE tiktok_scan_config 
    ADD CONSTRAINT chk_tiktok_max_duration_valid 
    CHECK (max_duration > 0);

ALTER TABLE tiktok_scan_results 
    ADD CONSTRAINT chk_tiktok_videos_counts_valid 
    CHECK (
        videos_found >= 0 AND 
        videos_processed >= 0 AND 
        videos_approved >= 0 AND 
        videos_rejected >= 0 AND 
        videos_flagged >= 0 AND
        duplicates_found >= 0
    );

ALTER TABLE tiktok_auth 
    ADD CONSTRAINT chk_tiktok_expires_at_future 
    CHECK (expires_at > created_at);

-- =====================================================
-- Insert default TikTok configuration
-- =====================================================
INSERT INTO tiktok_scan_config (
    is_enabled,
    scan_interval,
    max_videos_per_scan,
    target_keywords,
    target_hashtags,
    min_views,
    max_duration,
    sort_by
) VALUES (
    FALSE, -- disabled by default
    120, -- 2 hours (TikTok rate limits)
    20, -- 20 videos per scan
    ARRAY['hotdog', 'hotdogs', 'frankfurter', 'wiener', 'bratwurst'],
    ARRAY['foodtok', 'hotdogchallenge', 'grilling', 'bbq', 'streetfood'],
    100, -- minimum 100 views
    180, -- max 3 minutes
    'relevance'
) ON CONFLICT DO NOTHING;