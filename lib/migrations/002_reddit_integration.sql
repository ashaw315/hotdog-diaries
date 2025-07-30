-- Reddit Integration Migration
-- Migration 002: Add Reddit-specific tables and configuration

-- Reddit Scan Configuration Table
-- Stores Reddit scanning configuration and settings
CREATE TABLE reddit_scan_config (
    id SERIAL PRIMARY KEY,
    is_enabled BOOLEAN DEFAULT FALSE,
    scan_interval INTEGER DEFAULT 30, -- minutes
    max_posts_per_scan INTEGER DEFAULT 25,
    target_subreddits TEXT[] DEFAULT ARRAY['hotdogs', 'food', 'FoodPorn', 'grilling', 'baseball'],
    search_terms TEXT[] DEFAULT ARRAY['hotdog', 'hot dog', 'frankfurter', 'bratwurst'],
    min_score INTEGER DEFAULT 10,
    sort_by VARCHAR(20) DEFAULT 'hot', -- hot, top, new, relevance
    time_range VARCHAR(20) DEFAULT 'week', -- hour, day, week, month, year, all
    include_nsfw BOOLEAN DEFAULT FALSE,
    last_scan_id VARCHAR(255),
    last_scan_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reddit Scan Results Table
-- Stores results and analytics from each Reddit scan
CREATE TABLE reddit_scan_results (
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
    subreddits_scanned TEXT[] DEFAULT ARRAY[]::TEXT[],
    highest_score INTEGER DEFAULT 0,
    errors TEXT[] DEFAULT ARRAY[]::TEXT[],
    rate_limit_hit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content Analysis Table (if it doesn't exist)
-- Enhanced content analysis for filtering and quality assessment
CREATE TABLE IF NOT EXISTS content_analysis (
    id SERIAL PRIMARY KEY,
    content_queue_id INTEGER NOT NULL REFERENCES content_queue(id) ON DELETE CASCADE,
    is_spam BOOLEAN DEFAULT FALSE,
    is_inappropriate BOOLEAN DEFAULT FALSE,
    is_unrelated BOOLEAN DEFAULT FALSE,
    is_valid_hotdog BOOLEAN DEFAULT TRUE,
    confidence_score DECIMAL(3,2) DEFAULT 0.0, -- 0.00 to 1.00
    flagged_patterns TEXT[] DEFAULT ARRAY[]::TEXT[],
    processing_notes TEXT[] DEFAULT ARRAY[]::TEXT[],
    similarity_hash VARCHAR(64), -- For duplicate detection
    duplicate_of INTEGER REFERENCES content_queue(id),
    filter_results JSONB, -- Detailed filter results
    is_flagged BOOLEAN DEFAULT FALSE,
    flagged_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(content_queue_id)
);

-- Processing Queue Table (if it doesn't exist)
-- Queue for content processing with retry logic
CREATE TABLE IF NOT EXISTS processing_queue (
    id SERIAL PRIMARY KEY,
    content_queue_id INTEGER NOT NULL REFERENCES content_queue(id) ON DELETE CASCADE,
    priority VARCHAR(10) DEFAULT 'medium', -- high, medium, low
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for Reddit tables

-- Reddit scan config indexes
CREATE INDEX idx_reddit_scan_config_enabled ON reddit_scan_config(is_enabled);
CREATE INDEX idx_reddit_scan_config_last_scan ON reddit_scan_config(last_scan_time);

-- Reddit scan results indexes
CREATE INDEX idx_reddit_scan_results_scan_id ON reddit_scan_results(scan_id);
CREATE INDEX idx_reddit_scan_results_start_time ON reddit_scan_results(start_time);
CREATE INDEX idx_reddit_scan_results_end_time ON reddit_scan_results(end_time);
CREATE INDEX idx_reddit_scan_results_posts_approved ON reddit_scan_results(posts_approved);
CREATE INDEX idx_reddit_scan_results_created_at ON reddit_scan_results(created_at);

-- Content analysis indexes
CREATE INDEX idx_content_analysis_queue_id ON content_analysis(content_queue_id);
CREATE INDEX idx_content_analysis_is_spam ON content_analysis(is_spam);
CREATE INDEX idx_content_analysis_is_inappropriate ON content_analysis(is_inappropriate);
CREATE INDEX idx_content_analysis_is_valid_hotdog ON content_analysis(is_valid_hotdog);
CREATE INDEX idx_content_analysis_confidence_score ON content_analysis(confidence_score);
CREATE INDEX idx_content_analysis_similarity_hash ON content_analysis(similarity_hash);
CREATE INDEX idx_content_analysis_duplicate_of ON content_analysis(duplicate_of);
CREATE INDEX idx_content_analysis_is_flagged ON content_analysis(is_flagged);

-- Processing queue indexes  
CREATE INDEX idx_processing_queue_content_id ON processing_queue(content_queue_id);
CREATE INDEX idx_processing_queue_status ON processing_queue(status);
CREATE INDEX idx_processing_queue_priority ON processing_queue(priority);
CREATE INDEX idx_processing_queue_attempts ON processing_queue(attempts);
CREATE INDEX idx_processing_queue_created_at ON processing_queue(created_at);

-- Create triggers for updated_at columns
CREATE TRIGGER update_reddit_scan_config_updated_at 
    BEFORE UPDATE ON reddit_scan_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_analysis_updated_at 
    BEFORE UPDATE ON content_analysis 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processing_queue_updated_at 
    BEFORE UPDATE ON processing_queue 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add constraints
ALTER TABLE reddit_scan_config 
    ADD CONSTRAINT chk_scan_interval_valid 
    CHECK (scan_interval BETWEEN 5 AND 1440);

ALTER TABLE reddit_scan_config 
    ADD CONSTRAINT chk_max_posts_valid 
    CHECK (max_posts_per_scan BETWEEN 1 AND 100);

ALTER TABLE reddit_scan_config 
    ADD CONSTRAINT chk_min_score_valid 
    CHECK (min_score >= 0);

ALTER TABLE reddit_scan_config 
    ADD CONSTRAINT chk_sort_by_valid 
    CHECK (sort_by IN ('hot', 'top', 'new', 'relevance'));

ALTER TABLE reddit_scan_config 
    ADD CONSTRAINT chk_time_range_valid 
    CHECK (time_range IN ('hour', 'day', 'week', 'month', 'year', 'all'));

ALTER TABLE content_analysis 
    ADD CONSTRAINT chk_confidence_score_valid 
    CHECK (confidence_score BETWEEN 0.0 AND 1.0);

ALTER TABLE processing_queue 
    ADD CONSTRAINT chk_priority_valid 
    CHECK (priority IN ('high', 'medium', 'low'));

ALTER TABLE processing_queue 
    ADD CONSTRAINT chk_status_valid 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

ALTER TABLE processing_queue 
    ADD CONSTRAINT chk_attempts_valid 
    CHECK (attempts >= 0);

-- Insert default Reddit configuration
INSERT INTO reddit_scan_config (
    is_enabled,
    scan_interval,
    max_posts_per_scan,
    target_subreddits,
    search_terms,
    min_score,
    sort_by,
    time_range,
    include_nsfw
) VALUES (
    FALSE, -- disabled by default
    30, -- 30 minutes
    25, -- 25 posts per scan
    ARRAY['hotdogs', 'food', 'FoodPorn', 'grilling', 'baseball', 'sausages', 'BBQ', 'Cooking'],
    ARRAY['hotdog', 'hot dog', 'frankfurter', 'bratwurst', 'wiener', 'ballpark frank', 'chili dog'],
    10, -- minimum 10 upvotes
    'hot', -- sort by hot posts
    'week', -- past week
    FALSE -- no NSFW content
);