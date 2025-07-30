-- TikTok Integration Database Schema
-- Migration 004: Add TikTok support and unified social media coordination

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
-- Social Media Coordination Configuration Table
-- =====================================================
CREATE TABLE IF NOT EXISTS social_media_coordination_config (
    id SERIAL PRIMARY KEY,
    enable_coordination BOOLEAN DEFAULT TRUE,
    scan_interval INTEGER DEFAULT 60, -- minutes
    platform_priority TEXT[] DEFAULT ARRAY['reddit', 'instagram', 'tiktok'],
    content_balancing_enabled BOOLEAN DEFAULT TRUE,
    reddit_weight INTEGER DEFAULT 40 CHECK (reddit_weight >= 0 AND reddit_weight <= 100),
    instagram_weight INTEGER DEFAULT 35 CHECK (instagram_weight >= 0 AND instagram_weight <= 100),
    tiktok_weight INTEGER DEFAULT 25 CHECK (tiktok_weight >= 0 AND tiktok_weight <= 100),
    target_distribution JSONB DEFAULT '{
        "posts": 40,
        "images": 35,
        "videos": 25
    }'::jsonb,
    rate_limit_coordination BOOLEAN DEFAULT TRUE,
    error_threshold INTEGER DEFAULT 5,
    intelligent_scheduling JSONB DEFAULT '{
        "enabled": true,
        "peakContentTimes": {
            "reddit": ["09", "12", "15", "18", "21"],
            "instagram": ["08", "11", "14", "17", "19"],
            "tiktok": ["16", "18", "20", "21", "22"]
        },
        "adaptiveIntervals": true
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint to ensure weights sum to 100
    CONSTRAINT valid_weights CHECK (reddit_weight + instagram_weight + tiktok_weight = 100)
);

-- =====================================================
-- Unified Scan Results Table
-- =====================================================
CREATE TABLE IF NOT EXISTS unified_scan_results (
    id SERIAL PRIMARY KEY,
    scan_id VARCHAR(255) NOT NULL UNIQUE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    platforms_scanned TEXT[] DEFAULT ARRAY[]::TEXT[],
    total_posts_found INTEGER DEFAULT 0,
    total_posts_approved INTEGER DEFAULT 0,
    successful_platforms INTEGER DEFAULT 0,
    failed_platforms INTEGER DEFAULT 0,
    platform_results JSONB DEFAULT '[]'::jsonb,
    content_distribution JSONB DEFAULT '{
        "posts": 0,
        "images": 0,
        "videos": 0
    }'::jsonb,
    errors TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for unified scan results
CREATE INDEX IF NOT EXISTS idx_unified_scan_results_scan_id ON unified_scan_results(scan_id);
CREATE INDEX IF NOT EXISTS idx_unified_scan_results_created_at ON unified_scan_results(created_at DESC);

-- =====================================================
-- Update Content Queue for TikTok Support
-- =====================================================
-- Add TikTok-specific columns to content_queue if they don't exist
DO $$ 
BEGIN
    -- Add tiktok_data column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'content_queue' AND column_name = 'tiktok_data'
    ) THEN
        ALTER TABLE content_queue ADD COLUMN tiktok_data JSONB;
    END IF;
    
    -- Update source_platform constraint to include tiktok
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'content_queue' AND constraint_name = 'content_queue_source_platform_check'
    ) THEN
        ALTER TABLE content_queue DROP CONSTRAINT content_queue_source_platform_check;
    END IF;
    
    ALTER TABLE content_queue ADD CONSTRAINT content_queue_source_platform_check 
        CHECK (source_platform IN ('reddit', 'instagram', 'tiktok'));
END $$;

-- =====================================================
-- Platform Monitoring Tables
-- =====================================================
CREATE TABLE IF NOT EXISTS platform_health_metrics (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('reddit', 'instagram', 'tiktok')),
    metric_type VARCHAR(100) NOT NULL,
    metric_value NUMERIC,
    metric_data JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for monitoring queries
CREATE INDEX IF NOT EXISTS idx_platform_health_metrics_platform ON platform_health_metrics(platform);
CREATE INDEX IF NOT EXISTS idx_platform_health_metrics_recorded_at ON platform_health_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_health_metrics_type ON platform_health_metrics(metric_type);

-- =====================================================
-- Platform Alerts Table
-- =====================================================
CREATE TABLE IF NOT EXISTS platform_alerts (
    id SERIAL PRIMARY KEY,
    alert_id VARCHAR(255) NOT NULL UNIQUE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('reddit', 'instagram', 'tiktok')),
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for alert management
CREATE INDEX IF NOT EXISTS idx_platform_alerts_platform ON platform_alerts(platform);
CREATE INDEX IF NOT EXISTS idx_platform_alerts_resolved ON platform_alerts(resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_alerts_severity ON platform_alerts(severity, created_at DESC);

-- =====================================================
-- Content Analytics Table
-- =====================================================
CREATE TABLE IF NOT EXISTS content_analytics (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('reddit', 'instagram', 'tiktok')),
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('posts', 'images', 'videos', 'mixed')),
    date_recorded DATE NOT NULL,
    content_found INTEGER DEFAULT 0,
    content_approved INTEGER DEFAULT 0,
    content_rejected INTEGER DEFAULT 0,
    avg_engagement_score NUMERIC(10,2) DEFAULT 0,
    top_keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
    top_hashtags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicate daily records
    UNIQUE(platform, content_type, date_recorded)
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_content_analytics_platform ON content_analytics(platform);
CREATE INDEX IF NOT EXISTS idx_content_analytics_date ON content_analytics(date_recorded DESC);
CREATE INDEX IF NOT EXISTS idx_content_analytics_type ON content_analytics(content_type);

-- =====================================================
-- Rate Limit Tracking Table
-- =====================================================
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('reddit', 'instagram', 'tiktok')),
    limit_type VARCHAR(50) NOT NULL, -- 'hourly', 'daily', 'requests_per_minute'
    current_usage INTEGER DEFAULT 0,
    limit_cap INTEGER NOT NULL,
    reset_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint for current rate limit tracking
    UNIQUE(platform, limit_type)
);

-- Index for rate limit lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_platform ON rate_limit_tracking(platform, limit_type);

-- =====================================================
-- Default Data Insertion
-- =====================================================

-- Insert default TikTok scan configuration
INSERT INTO tiktok_scan_config (id) VALUES (1) 
ON CONFLICT (id) DO NOTHING;

-- Insert default social media coordination configuration
INSERT INTO social_media_coordination_config (id) VALUES (1) 
ON CONFLICT (id) DO NOTHING;

-- Insert initial rate limit tracking for TikTok
INSERT INTO rate_limit_tracking (platform, limit_type, limit_cap, reset_time) VALUES 
('tiktok', 'hourly', 100, NOW() + INTERVAL '1 hour'),
('tiktok', 'daily', 1000, NOW() + INTERVAL '1 day')
ON CONFLICT (platform, limit_type) DO NOTHING;

-- =====================================================
-- Triggers for Updated At Timestamps
-- =====================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at columns
DROP TRIGGER IF EXISTS update_tiktok_auth_updated_at ON tiktok_auth;
CREATE TRIGGER update_tiktok_auth_updated_at 
    BEFORE UPDATE ON tiktok_auth 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tiktok_scan_config_updated_at ON tiktok_scan_config;
CREATE TRIGGER update_tiktok_scan_config_updated_at 
    BEFORE UPDATE ON tiktok_scan_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_coordination_config_updated_at ON social_media_coordination_config;
CREATE TRIGGER update_coordination_config_updated_at 
    BEFORE UPDATE ON social_media_coordination_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rate_limit_tracking_updated_at ON rate_limit_tracking;
CREATE TRIGGER update_rate_limit_tracking_updated_at 
    BEFORE UPDATE ON rate_limit_tracking 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Views for Reporting
-- =====================================================

-- Platform summary view
CREATE OR REPLACE VIEW platform_summary AS
SELECT 
    'reddit' as platform,
    'posts' as content_type,
    (SELECT COUNT(*) FROM reddit_scan_results) as total_scans,
    (SELECT COALESCE(SUM(posts_found), 0) FROM reddit_scan_results) as total_content_found,
    (SELECT COALESCE(SUM(posts_approved), 0) FROM reddit_scan_results) as total_content_approved,
    (SELECT MAX(end_time) FROM reddit_scan_results) as last_scan_time
UNION ALL
SELECT 
    'instagram' as platform,
    'images' as content_type,
    (SELECT COUNT(*) FROM instagram_scan_results) as total_scans,
    (SELECT COALESCE(SUM(posts_found), 0) FROM instagram_scan_results) as total_content_found,
    (SELECT COALESCE(SUM(posts_approved), 0) FROM instagram_scan_results) as total_content_approved,
    (SELECT MAX(end_time) FROM instagram_scan_results) as last_scan_time
UNION ALL
SELECT 
    'tiktok' as platform,
    'videos' as content_type,
    (SELECT COUNT(*) FROM tiktok_scan_results) as total_scans,
    (SELECT COALESCE(SUM(videos_found), 0) FROM tiktok_scan_results) as total_content_found,
    (SELECT COALESCE(SUM(videos_approved), 0) FROM tiktok_scan_results) as total_content_approved,
    (SELECT MAX(end_time) FROM tiktok_scan_results) as last_scan_time;

-- Content distribution view
CREATE OR REPLACE VIEW content_distribution AS
SELECT 
    content_type,
    COUNT(*) as total_items,
    COUNT(*) FILTER (WHERE status = 'approved') as approved_items,
    ROUND(
        (COUNT(*) FILTER (WHERE status = 'approved')::NUMERIC / COUNT(*)) * 100, 
        2
    ) as approval_rate
FROM (
    SELECT 
        CASE 
            WHEN source_platform = 'reddit' THEN 'posts'
            WHEN source_platform = 'instagram' THEN 'images'
            WHEN source_platform = 'tiktok' THEN 'videos'
            ELSE 'unknown'
        END as content_type,
        status
    FROM content_queue
    WHERE created_at >= NOW() - INTERVAL '30 days'
) grouped_content
GROUP BY content_type;

-- =====================================================
-- Cleanup and Maintenance
-- =====================================================

-- Function to cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_monitoring_data()
RETURNS INTEGER AS $$
DECLARE
    rows_deleted INTEGER := 0;
BEGIN
    -- Delete platform health metrics older than 7 days
    DELETE FROM platform_health_metrics 
    WHERE recorded_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    
    -- Delete resolved alerts older than 30 days
    DELETE FROM platform_alerts 
    WHERE resolved = TRUE AND resolved_at < NOW() - INTERVAL '30 days';
    
    -- Delete old scan results older than 90 days (keep 3 months of history)
    DELETE FROM tiktok_scan_results WHERE created_at < NOW() - INTERVAL '90 days';
    DELETE FROM unified_scan_results WHERE created_at < NOW() - INTERVAL '90 days';
    
    RETURN rows_deleted;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comments for Documentation
-- =====================================================
COMMENT ON TABLE tiktok_auth IS 'Stores TikTok API authentication tokens';
COMMENT ON TABLE tiktok_scan_config IS 'Configuration settings for TikTok content scanning';
COMMENT ON TABLE tiktok_scan_results IS 'Results and metrics from TikTok scanning operations';
COMMENT ON TABLE social_media_coordination_config IS 'Configuration for coordinated scanning across all platforms';
COMMENT ON TABLE unified_scan_results IS 'Results from unified scans across multiple platforms';
COMMENT ON TABLE platform_health_metrics IS 'Health and performance metrics for all platforms';
COMMENT ON TABLE platform_alerts IS 'Alert system for platform monitoring';
COMMENT ON TABLE content_analytics IS 'Daily analytics for content discovery and approval';
COMMENT ON TABLE rate_limit_tracking IS 'Real-time tracking of API rate limits';

COMMENT ON VIEW platform_summary IS 'Summary statistics for all social media platforms';
COMMENT ON VIEW content_distribution IS 'Content type distribution and approval rates';

COMMENT ON FUNCTION cleanup_old_monitoring_data() IS 'Maintenance function to clean up old monitoring data';