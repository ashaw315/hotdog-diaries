-- Initial Database Schema for Hotdog Diaries
-- Migration 001: Create all core tables

-- Enable UUID extension for primary keys if needed
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types
CREATE TYPE content_type_enum AS ENUM ('text', 'image', 'video', 'mixed');
CREATE TYPE source_platform_enum AS ENUM ('reddit', 'youtube', 'flickr', 'unsplash', 'news', 'mastodon');
CREATE TYPE log_level_enum AS ENUM ('debug', 'info', 'warn', 'error', 'fatal');

-- Content Queue Table
-- Stores scraped content waiting to be posted
CREATE TABLE content_queue (
    id SERIAL PRIMARY KEY,
    content_text TEXT,
    content_image_url TEXT,
    content_video_url TEXT,
    content_type content_type_enum NOT NULL,
    source_platform source_platform_enum NOT NULL,
    original_url TEXT NOT NULL,
    original_author VARCHAR(255),
    scraped_at TIMESTAMP WITH TIME ZONE NOT NULL,
    content_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash for deduplication
    is_posted BOOLEAN DEFAULT FALSE,
    posted_at TIMESTAMP WITH TIME ZONE,
    is_approved BOOLEAN DEFAULT FALSE,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Posted Content Table
-- Tracks content that has been posted to social media
CREATE TABLE posted_content (
    id SERIAL PRIMARY KEY,
    content_queue_id INTEGER NOT NULL REFERENCES content_queue(id) ON DELETE CASCADE,
    posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_time TIMESTAMP WITH TIME ZONE,
    post_order INTEGER NOT NULL, -- Order within the day (1-6)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System Logs Table
-- Application logging and monitoring
CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY,
    log_level log_level_enum NOT NULL,
    message TEXT NOT NULL,
    component VARCHAR(100) NOT NULL,
    metadata JSONB, -- Additional structured data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin Users Table
-- Administrative users for the system
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance

-- Content Queue indexes
CREATE INDEX idx_content_queue_content_hash ON content_queue(content_hash);
CREATE INDEX idx_content_queue_source_platform ON content_queue(source_platform);
CREATE INDEX idx_content_queue_scraped_at ON content_queue(scraped_at);
CREATE INDEX idx_content_queue_is_posted ON content_queue(is_posted);
CREATE INDEX idx_content_queue_is_approved ON content_queue(is_approved);
CREATE INDEX idx_content_queue_posted_at ON content_queue(posted_at);

-- Posted Content indexes
CREATE INDEX idx_posted_content_queue_id ON posted_content(content_queue_id);
CREATE INDEX idx_posted_content_posted_at ON posted_content(posted_at);
CREATE INDEX idx_posted_content_post_order ON posted_content(post_order);
CREATE INDEX idx_posted_content_scheduled_time ON posted_content(scheduled_time);

-- System Logs indexes
CREATE INDEX idx_system_logs_level ON system_logs(log_level);
CREATE INDEX idx_system_logs_component ON system_logs(component);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX idx_system_logs_metadata ON system_logs USING GIN(metadata);

-- Admin Users indexes
CREATE INDEX idx_admin_users_username ON admin_users(username);
CREATE INDEX idx_admin_users_last_login ON admin_users(last_login);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_content_queue_updated_at 
    BEFORE UPDATE ON content_queue 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posted_content_updated_at 
    BEFORE UPDATE ON posted_content 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_users_updated_at 
    BEFORE UPDATE ON admin_users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add constraints
ALTER TABLE content_queue 
    ADD CONSTRAINT chk_content_not_empty 
    CHECK (
        content_text IS NOT NULL OR 
        content_image_url IS NOT NULL OR 
        content_video_url IS NOT NULL
    );

ALTER TABLE posted_content 
    ADD CONSTRAINT chk_post_order_valid 
    CHECK (post_order BETWEEN 1 AND 6);

-- Insert initial admin user (password: admin123)
-- Note: In production, this should be done separately with a secure password
INSERT INTO admin_users (username, password_hash) 
VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

-- Create view for posted content with queue details
CREATE VIEW posted_content_with_details AS
SELECT 
    pc.id,
    pc.content_queue_id,
    pc.posted_at,
    pc.scheduled_time,
    pc.post_order,
    cq.content_text,
    cq.content_image_url,
    cq.content_video_url,
    cq.content_type,
    cq.source_platform,
    cq.original_url,
    cq.original_author,
    cq.scraped_at
FROM posted_content pc
JOIN content_queue cq ON pc.content_queue_id = cq.id
ORDER BY pc.posted_at DESC;