-- Migration: Twitter Integration Tables
-- This migration adds tables for Twitter API integration and scanning

-- Add twitter_data column to content_queue for storing Twitter-specific metadata
ALTER TABLE content_queue 
ADD COLUMN twitter_data JSONB DEFAULT NULL;

-- Create twitter_scan_config table for storing scan configuration
CREATE TABLE twitter_scan_config (
    id SERIAL PRIMARY KEY,
    is_enabled BOOLEAN DEFAULT FALSE,
    scan_interval INTEGER DEFAULT 30, -- minutes
    max_tweets_per_scan INTEGER DEFAULT 50,
    search_queries TEXT[] DEFAULT ARRAY[
        '(hotdog OR "hot dog" OR hotdogs OR "hot dogs") -is:retweet -is:reply lang:en',
        '#hotdog OR #hotdogs OR #nationalhotdogday -is:retweet -is:reply lang:en',
        '("hotdog" OR "hot dog") (delicious OR tasty OR amazing OR perfect) -is:retweet -is:reply has:media lang:en'
    ],
    exclude_retweets BOOLEAN DEFAULT TRUE,
    exclude_replies BOOLEAN DEFAULT TRUE,
    min_engagement_threshold INTEGER DEFAULT 1,
    last_scan_id VARCHAR(255),
    last_scan_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create twitter_scan_results table for tracking scan history
CREATE TABLE twitter_scan_results (
    id SERIAL PRIMARY KEY,
    scan_id VARCHAR(255) NOT NULL UNIQUE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    tweets_found INTEGER DEFAULT 0,
    tweets_processed INTEGER DEFAULT 0,
    tweets_approved INTEGER DEFAULT 0,
    tweets_rejected INTEGER DEFAULT 0,
    tweets_flagged INTEGER DEFAULT 0,
    duplicates_found INTEGER DEFAULT 0,
    errors TEXT[] DEFAULT ARRAY[]::TEXT[],
    rate_limit_hit BOOLEAN DEFAULT FALSE,
    api_calls_made INTEGER DEFAULT 0,
    processing_time_ms INTEGER DEFAULT 0,
    scan_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create twitter_api_usage table for tracking API usage and rate limits
CREATE TABLE twitter_api_usage (
    id SERIAL PRIMARY KEY,
    endpoint VARCHAR(255) NOT NULL,
    requests_made INTEGER DEFAULT 0,
    requests_remaining INTEGER DEFAULT 0,
    reset_time TIMESTAMP WITH TIME ZONE,
    daily_usage INTEGER DEFAULT 0,
    monthly_usage INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create twitter_content_cache table for caching Twitter data
CREATE TABLE twitter_content_cache (
    id SERIAL PRIMARY KEY,
    tweet_id VARCHAR(255) NOT NULL UNIQUE,
    author_id VARCHAR(255) NOT NULL,
    author_username VARCHAR(255) NOT NULL,
    author_name VARCHAR(255),
    tweet_text TEXT NOT NULL,
    tweet_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    media_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    video_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    hashtags TEXT[] DEFAULT ARRAY[]::TEXT[],
    mentions TEXT[] DEFAULT ARRAY[]::TEXT[],
    urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    public_metrics JSONB DEFAULT '{}',
    is_processed BOOLEAN DEFAULT FALSE,
    processing_status VARCHAR(50) DEFAULT 'pending',
    content_queue_id INTEGER REFERENCES content_queue(id) ON DELETE SET NULL,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 days'
);

-- Create indexes for performance
CREATE INDEX idx_content_queue_twitter_data ON content_queue USING GIN(twitter_data);
CREATE INDEX idx_twitter_scan_results_scan_id ON twitter_scan_results(scan_id);
CREATE INDEX idx_twitter_scan_results_start_time ON twitter_scan_results(start_time);
CREATE INDEX idx_twitter_api_usage_endpoint ON twitter_api_usage(endpoint);
CREATE INDEX idx_twitter_api_usage_reset_time ON twitter_api_usage(reset_time);
CREATE INDEX idx_twitter_content_cache_tweet_id ON twitter_content_cache(tweet_id);
CREATE INDEX idx_twitter_content_cache_author_username ON twitter_content_cache(author_username);
CREATE INDEX idx_twitter_content_cache_processing_status ON twitter_content_cache(processing_status);
CREATE INDEX idx_twitter_content_cache_expires_at ON twitter_content_cache(expires_at);

-- Create trigger for updated_at timestamps
CREATE TRIGGER update_twitter_scan_config_updated_at 
    BEFORE UPDATE ON twitter_scan_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_twitter_api_usage_updated_at 
    BEFORE UPDATE ON twitter_api_usage 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default Twitter scan configuration
INSERT INTO twitter_scan_config (
    is_enabled,
    scan_interval,
    max_tweets_per_scan,
    search_queries,
    exclude_retweets,
    exclude_replies,
    min_engagement_threshold
) VALUES (
    FALSE, -- Disabled by default until API keys are configured
    30,    -- 30 minutes
    50,    -- 50 tweets per scan
    ARRAY[
        '(hotdog OR "hot dog" OR hotdogs OR "hot dogs") -is:retweet -is:reply lang:en',
        '#hotdog OR #hotdogs OR #nationalhotdogday -is:retweet -is:reply lang:en',
        '("hotdog" OR "hot dog") (delicious OR tasty OR amazing OR perfect) -is:retweet -is:reply has:media lang:en',
        '("hotdog" OR "hot dog") (chicago OR "coney island" OR "new york") -is:retweet -is:reply lang:en',
        '("hotdog" OR "hot dog") (bbq OR barbecue OR grill OR grilling) -is:retweet -is:reply has:media lang:en'
    ],
    TRUE,  -- Exclude retweets
    TRUE,  -- Exclude replies
    1      -- Minimum 1 engagement (like, retweet, reply, or quote)
);

-- Create view for Twitter content analytics
CREATE VIEW twitter_content_analytics AS
SELECT 
    DATE(tsr.start_time) as scan_date,
    COUNT(tsr.id) as scans_count,
    SUM(tsr.tweets_found) as total_tweets_found,
    SUM(tsr.tweets_processed) as total_tweets_processed,
    SUM(tsr.tweets_approved) as total_tweets_approved,
    SUM(tsr.tweets_rejected) as total_tweets_rejected,
    SUM(tsr.tweets_flagged) as total_tweets_flagged,
    SUM(tsr.duplicates_found) as total_duplicates_found,
    AVG(tsr.processing_time_ms) as avg_processing_time_ms,
    COUNT(*) FILTER (WHERE tsr.rate_limit_hit = TRUE) as rate_limit_hits,
    AVG(CASE WHEN tsr.tweets_found > 0 THEN tsr.tweets_approved::float / tsr.tweets_found * 100 ELSE 0 END) as approval_rate
FROM twitter_scan_results tsr
GROUP BY DATE(tsr.start_time)
ORDER BY scan_date DESC;

-- Create view for content queue with Twitter data
CREATE VIEW content_queue_with_twitter AS
SELECT 
    cq.*,
    (cq.twitter_data->>'tweet_id') as tweet_id,
    (cq.twitter_data->>'author_username') as twitter_author_username,
    (cq.twitter_data->>'author_name') as twitter_author_name,
    (cq.twitter_data->'public_metrics'->>'like_count')::integer as twitter_like_count,
    (cq.twitter_data->'public_metrics'->>'retweet_count')::integer as twitter_retweet_count,
    (cq.twitter_data->'hashtags') as twitter_hashtags,
    (cq.twitter_data->>'scan_id') as twitter_scan_id
FROM content_queue cq
WHERE cq.source_platform = 'twitter'
  AND cq.twitter_data IS NOT NULL;

-- Add constraint to ensure Twitter content has twitter_data
ALTER TABLE content_queue 
ADD CONSTRAINT check_twitter_data 
CHECK (
    source_platform != 'twitter' OR 
    (source_platform = 'twitter' AND twitter_data IS NOT NULL)
);

-- Create function to clean up expired Twitter cache
CREATE OR REPLACE FUNCTION cleanup_expired_twitter_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM twitter_content_cache 
    WHERE expires_at < NOW() 
      AND is_processed = TRUE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    INSERT INTO system_logs (log_level, message, component, metadata)
    VALUES (
        'info',
        'Cleaned up expired Twitter cache entries',
        'TWITTER_CACHE_CLEANUP',
        json_build_object('deleted_count', deleted_count)
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get Twitter scanning summary
CREATE OR REPLACE FUNCTION get_twitter_scan_summary(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
    total_scans INTEGER,
    total_tweets_found INTEGER,
    total_tweets_approved INTEGER,
    approval_rate NUMERIC,
    avg_processing_time_ms NUMERIC,
    last_scan_time TIMESTAMP WITH TIME ZONE,
    rate_limit_hits INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_scans,
        COALESCE(SUM(tsr.tweets_found), 0)::INTEGER as total_tweets_found,
        COALESCE(SUM(tsr.tweets_approved), 0)::INTEGER as total_tweets_approved,
        CASE 
            WHEN SUM(tsr.tweets_found) > 0 
            THEN ROUND(SUM(tsr.tweets_approved)::NUMERIC / SUM(tsr.tweets_found) * 100, 2)
            ELSE 0
        END as approval_rate,
        ROUND(AVG(tsr.processing_time_ms), 2) as avg_processing_time_ms,
        MAX(tsr.end_time) as last_scan_time,
        COUNT(*) FILTER (WHERE tsr.rate_limit_hit = TRUE)::INTEGER as rate_limit_hits
    FROM twitter_scan_results tsr
    WHERE tsr.start_time >= NOW() - INTERVAL '1 day' * days_back;
END;
$$ LANGUAGE plpgsql;