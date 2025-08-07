-- Migration: Add Bluesky platform and remove Flickr
-- This migration adds Bluesky support with video capabilities and removes Flickr

-- Add Bluesky to the source platform enum
ALTER TYPE source_platform_enum ADD VALUE IF NOT EXISTS 'bluesky';
ALTER TYPE source_platform_enum ADD VALUE IF NOT EXISTS 'pixabay';

-- Remove Flickr-specific data column and indexes (cleanup from previous migration)
DROP INDEX IF EXISTS idx_content_queue_flickr_data;
ALTER TABLE content_queue DROP COLUMN IF EXISTS flickr_data;
DROP INDEX IF EXISTS idx_content_queue_source_platform_flickr;

-- Add Bluesky-specific data column
ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS bluesky_data JSONB;

-- Add Pixabay-specific data column  
ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS pixabay_data JSONB;

-- Create indexes for the new platforms
CREATE INDEX IF NOT EXISTS idx_content_queue_source_platform_bluesky ON content_queue(source_platform) WHERE source_platform = 'bluesky';
CREATE INDEX IF NOT EXISTS idx_content_queue_source_platform_pixabay ON content_queue(source_platform) WHERE source_platform = 'pixabay';

-- Create indexes for the JSONB columns
CREATE INDEX IF NOT EXISTS idx_content_queue_bluesky_data ON content_queue USING GIN (bluesky_data) WHERE bluesky_data IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_queue_pixabay_data ON content_queue USING GIN (pixabay_data) WHERE pixabay_data IS NOT NULL;

-- Ensure video content fields are properly set up
-- Add video thumbnail support for better video preview
ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS content_video_thumbnail_url TEXT;

-- Add video duration for better content management
ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS content_video_duration INTEGER; -- in seconds

-- Add video format information for compatibility
ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS content_video_format VARCHAR(50);

-- Add comments for the new columns
COMMENT ON COLUMN content_queue.bluesky_data IS 'Bluesky-specific metadata (post_uri, author_did, likes, reposts, etc.)';
COMMENT ON COLUMN content_queue.pixabay_data IS 'Pixabay-specific metadata (image_id, photographer, tags, downloads, etc.)';
COMMENT ON COLUMN content_queue.content_video_thumbnail_url IS 'Thumbnail URL for video content preview';
COMMENT ON COLUMN content_queue.content_video_duration IS 'Video duration in seconds';
COMMENT ON COLUMN content_queue.content_video_format IS 'Video format/codec (mp4, webm, etc.)';

-- Create Bluesky scan configuration table
CREATE TABLE IF NOT EXISTS bluesky_scan_config (
    id SERIAL PRIMARY KEY,
    is_enabled BOOLEAN DEFAULT true, -- Bluesky is enabled by default (no auth required)
    scan_interval INTEGER DEFAULT 240, -- 4 hours in minutes
    max_posts_per_scan INTEGER DEFAULT 30,
    search_terms TEXT[] DEFAULT ARRAY['hotdog', 'hot dog', 'hot-dog', 'sausage', 'frankfurter', 'wiener', 'bratwurst', 'corn dog', 'chili dog'],
    include_videos BOOLEAN DEFAULT true,
    include_images BOOLEAN DEFAULT true,
    include_text_only BOOLEAN DEFAULT true,
    min_engagement INTEGER DEFAULT 0, -- minimum likes + reposts
    published_within INTEGER DEFAULT 24, -- hours
    content_languages TEXT[] DEFAULT ARRAY['en'], -- language codes
    last_scan_id VARCHAR(255),
    last_scan_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Bluesky scan results tracking table
CREATE TABLE IF NOT EXISTS bluesky_scan_results (
    id SERIAL PRIMARY KEY,
    scan_id VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    posts_found INTEGER DEFAULT 0,
    posts_processed INTEGER DEFAULT 0,
    posts_approved INTEGER DEFAULT 0,
    posts_rejected INTEGER DEFAULT 0,
    posts_flagged INTEGER DEFAULT 0,
    duplicates_found INTEGER DEFAULT 0,
    text_posts INTEGER DEFAULT 0,
    image_posts INTEGER DEFAULT 0,
    video_posts INTEGER DEFAULT 0,
    mixed_posts INTEGER DEFAULT 0,
    api_requests INTEGER DEFAULT 0,
    search_terms_used TEXT[] DEFAULT ARRAY[]::TEXT[],
    highest_engagement INTEGER DEFAULT 0,
    errors TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drop Flickr-related tables (cleanup)
DROP TABLE IF EXISTS flickr_scan_config CASCADE;
DROP TABLE IF EXISTS flickr_scan_results CASCADE;

-- Create indexes for Bluesky scan results
CREATE INDEX IF NOT EXISTS idx_bluesky_scan_results_scan_id ON bluesky_scan_results (scan_id);
CREATE INDEX IF NOT EXISTS idx_bluesky_scan_results_start_time ON bluesky_scan_results (start_time);

-- Create trigger for updated_at on Bluesky config
CREATE OR REPLACE FUNCTION update_bluesky_scan_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS trigger_bluesky_scan_config_updated_at
    BEFORE UPDATE ON bluesky_scan_config
    FOR EACH ROW
    EXECUTE FUNCTION update_bluesky_scan_config_updated_at();

-- Insert default Bluesky configuration
INSERT INTO bluesky_scan_config (
    is_enabled, 
    search_terms, 
    include_videos, 
    include_images,
    max_posts_per_scan
) VALUES (
    true, 
    ARRAY['hotdog', 'hot dog', 'hot-dog', 'sausage', 'frankfurter', 'wiener', 'bratwurst', 'corn dog', 'chili dog'],
    true,
    true,
    30
) ON CONFLICT DO NOTHING;

-- Update existing content types to support mixed content better
-- Add check constraint for content_type to include all valid types
ALTER TABLE content_queue 
DROP CONSTRAINT IF EXISTS content_queue_content_type_check;

ALTER TABLE content_queue 
ADD CONSTRAINT content_queue_content_type_check 
CHECK (content_type IN ('text', 'image', 'video', 'mixed'));

-- Create indexes for video-related queries
CREATE INDEX IF NOT EXISTS idx_content_queue_video_content ON content_queue(content_type, scraped_at) WHERE content_type IN ('video', 'mixed');
CREATE INDEX IF NOT EXISTS idx_content_queue_has_video ON content_queue(scraped_at) WHERE content_video_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_queue_video_duration ON content_queue(content_video_duration) WHERE content_video_duration IS NOT NULL;

-- Add comments for clarity
COMMENT ON TABLE bluesky_scan_config IS 'Configuration for Bluesky content scanning with video support';
COMMENT ON TABLE bluesky_scan_results IS 'Results from Bluesky scanning operations tracking multimedia content';
COMMENT ON INDEX idx_content_queue_video_content IS 'Optimizes queries for video and mixed content';
COMMENT ON INDEX idx_content_queue_has_video IS 'Optimizes queries for content with video URLs';

-- Create view for video content statistics
CREATE OR REPLACE VIEW video_content_stats AS
SELECT 
    source_platform,
    COUNT(*) as total_video_content,
    COUNT(*) FILTER (WHERE content_type = 'video') as pure_video,
    COUNT(*) FILTER (WHERE content_type = 'mixed') as mixed_content,
    AVG(content_video_duration) as avg_duration,
    COUNT(*) FILTER (WHERE is_approved = true) as approved_videos,
    COUNT(*) FILTER (WHERE content_video_thumbnail_url IS NOT NULL) as videos_with_thumbnails
FROM content_queue 
WHERE content_video_url IS NOT NULL
GROUP BY source_platform;

COMMENT ON VIEW video_content_stats IS 'Statistics for video content across all platforms';