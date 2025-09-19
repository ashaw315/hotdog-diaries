-- Comprehensive Supabase Schema Migration
-- This migration creates all missing tables and columns needed for Hotdog Diaries
-- Safe to run multiple times - uses IF NOT EXISTS for all operations

-- ============================================
-- CORE TABLES
-- ============================================

-- 1. System Logs Table
CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  log_level VARCHAR(20) NOT NULL CHECK (log_level IN ('debug', 'info', 'warning', 'error')),
  message TEXT NOT NULL,
  component VARCHAR(100) NOT NULL,
  metadata JSONB,
  error_stack TEXT,
  user_id INTEGER,
  request_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for system_logs
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_log_level ON system_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_system_logs_component ON system_logs(component);

-- 2. System Alerts Table
CREATE TABLE IF NOT EXISTS system_alerts (
  id SERIAL PRIMARY KEY,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  details JSONB,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  acknowledged_by INTEGER,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for system_alerts
CREATE INDEX IF NOT EXISTS idx_system_alerts_status ON system_alerts(status);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at ON system_alerts(created_at DESC);

-- 3. Content Analysis Table
CREATE TABLE IF NOT EXISTS content_analysis (
  id SERIAL PRIMARY KEY,
  content_queue_id INTEGER NOT NULL,
  is_valid_hotdog BOOLEAN DEFAULT FALSE,
  confidence_score DECIMAL(3,2) DEFAULT 0.00,
  failure_reason TEXT,
  detected_keywords TEXT[],
  sentiment_score DECIMAL(3,2),
  engagement_potential VARCHAR(20),
  analysis_metadata JSONB,
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_content_queue FOREIGN KEY (content_queue_id) 
    REFERENCES content_queue(id) ON DELETE CASCADE
);

-- Create indexes for content_analysis
CREATE INDEX IF NOT EXISTS idx_content_analysis_content_id ON content_analysis(content_queue_id);
CREATE INDEX IF NOT EXISTS idx_content_analysis_valid_hotdog ON content_analysis(is_valid_hotdog);
CREATE INDEX IF NOT EXISTS idx_content_analysis_confidence ON content_analysis(confidence_score DESC);

-- 4. Queue Alerts Table (for queue monitoring)
CREATE TABLE IF NOT EXISTS queue_alerts (
  id SERIAL PRIMARY KEY,
  alert_type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  metadata JSONB,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for queue_alerts
CREATE INDEX IF NOT EXISTS idx_queue_alerts_acknowledged ON queue_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_queue_alerts_created_at ON queue_alerts(created_at DESC);

-- 5. Platform Metrics Table
CREATE TABLE IF NOT EXISTS platform_metrics (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  metric_date DATE NOT NULL,
  total_posts INTEGER DEFAULT 0,
  approved_posts INTEGER DEFAULT 0,
  rejected_posts INTEGER DEFAULT 0,
  avg_confidence_score DECIMAL(3,2),
  total_api_calls INTEGER DEFAULT 0,
  api_cost_usd DECIMAL(10,4) DEFAULT 0.00,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(platform, metric_date)
);

-- Create indexes for platform_metrics
CREATE INDEX IF NOT EXISTS idx_platform_metrics_date ON platform_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_platform ON platform_metrics(platform);

-- 6. API Usage Metrics Table
CREATE TABLE IF NOT EXISTS api_usage_metrics (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  endpoint VARCHAR(255),
  method VARCHAR(10),
  status_code INTEGER,
  response_time_ms INTEGER,
  cost_usd DECIMAL(10,6) DEFAULT 0.00,
  rate_limit_remaining INTEGER,
  rate_limit_reset TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for api_usage_metrics
CREATE INDEX IF NOT EXISTS idx_api_usage_platform_timestamp ON api_usage_metrics(platform, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage_metrics(timestamp DESC);

-- 7. System Metrics Table
CREATE TABLE IF NOT EXISTS system_metrics (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(20,4) NOT NULL,
  metric_type VARCHAR(50),
  tags JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for system_metrics
CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC);

-- ============================================
-- UPDATE EXISTING TABLES - Add missing columns
-- ============================================

-- Update posted_content table
ALTER TABLE posted_content 
ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE posted_content 
ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMP WITH TIME ZONE;

ALTER TABLE posted_content 
ADD COLUMN IF NOT EXISTS post_order INTEGER;

-- Create indexes for posted_content if they don't exist
CREATE INDEX IF NOT EXISTS idx_posted_content_posted_at ON posted_content(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_posted_content_post_order ON posted_content(post_order);
CREATE INDEX IF NOT EXISTS idx_posted_content_content_queue_id ON posted_content(content_queue_id);

-- Update content_queue table (add any missing columns)
ALTER TABLE content_queue
ADD COLUMN IF NOT EXISTS content_status VARCHAR(20) DEFAULT 'pending';

ALTER TABLE content_queue
ADD COLUMN IF NOT EXISTS scheduled_post_time TIMESTAMP WITH TIME ZONE;

ALTER TABLE content_queue
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE content_queue
ADD COLUMN IF NOT EXISTS manual_review_required BOOLEAN DEFAULT FALSE;

-- ============================================
-- REDDIT INTEGRATION TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS reddit_scan_config (
  id SERIAL PRIMARY KEY,
  is_enabled BOOLEAN DEFAULT TRUE,
  scan_frequency_hours INTEGER DEFAULT 4,
  max_posts_per_scan INTEGER DEFAULT 20,
  target_subreddits TEXT[] DEFAULT ARRAY['hotdogs', 'food', 'foodporn', 'shittyfoodporn'],
  minimum_score INTEGER DEFAULT 10,
  include_comments BOOLEAN DEFAULT FALSE,
  last_scan_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reddit_scan_results (
  id SERIAL PRIMARY KEY,
  scan_id VARCHAR(100) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  total_found INTEGER DEFAULT 0,
  total_processed INTEGER DEFAULT 0,
  total_approved INTEGER DEFAULT 0,
  total_rejected INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- POSTING SYSTEM TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS posting_schedule (
  id SERIAL PRIMARY KEY,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  content_queue_id INTEGER,
  status VARCHAR(20) DEFAULT 'pending',
  posted_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (content_queue_id) REFERENCES content_queue(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_posting_schedule_scheduled_time ON posting_schedule(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_posting_schedule_status ON posting_schedule(status);

CREATE TABLE IF NOT EXISTS posting_history (
  id SERIAL PRIMARY KEY,
  content_queue_id INTEGER NOT NULL,
  platform VARCHAR(50),
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN DEFAULT TRUE,
  response_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (content_queue_id) REFERENCES content_queue(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_posting_history_content_id ON posting_history(content_queue_id);
CREATE INDEX IF NOT EXISTS idx_posting_history_posted_at ON posting_history(posted_at DESC);

-- ============================================
-- PROCESSING QUEUE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS processing_queue (
  id SERIAL PRIMARY KEY,
  content_queue_id INTEGER NOT NULL,
  priority INTEGER DEFAULT 5,
  status VARCHAR(20) DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  metadata JSONB,
  process_after TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (content_queue_id) REFERENCES content_queue(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_priority ON processing_queue(priority DESC);

-- ============================================
-- CONTENT EDITS TABLE (for tracking changes)
-- ============================================

CREATE TABLE IF NOT EXISTS content_edits (
  id SERIAL PRIMARY KEY,
  content_queue_id INTEGER NOT NULL,
  field_name VARCHAR(50),
  old_value TEXT,
  new_value TEXT,
  edited_by INTEGER,
  edit_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (content_queue_id) REFERENCES content_queue(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_content_edits_content_id ON content_edits(content_queue_id);

-- ============================================
-- MIGRATION TRACKING TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- UPDATE TRIGGERS FOR TIMESTAMPS
-- ============================================

-- Create a function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to tables with updated_at
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', t, t);
        EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END $$;

-- ============================================
-- VERIFICATION QUERY
-- ============================================

-- Run this to verify all tables exist:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;