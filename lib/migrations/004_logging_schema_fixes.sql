-- Logging Schema Fixes Migration
-- Migration 004: Fix system_logs table schema and constraints

-- Drop system_logs table if it exists to recreate with proper schema
DROP TABLE IF EXISTS system_logs CASCADE;

-- Create system_logs table with complete schema
CREATE TABLE system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_level VARCHAR(20) NOT NULL,
    component VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    stack_trace TEXT,
    user_id VARCHAR(255),
    session_id VARCHAR(255),
    request_id VARCHAR(255),
    environment VARCHAR(50) DEFAULT 'development',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_log_level ON system_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_system_logs_component ON system_logs(component);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_request_id ON system_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_environment ON system_logs(environment);

-- Add constraints
ALTER TABLE system_logs 
    ADD CONSTRAINT chk_log_level_valid 
    CHECK (log_level IN ('error', 'warning', 'info', 'debug'));

ALTER TABLE system_logs 
    ADD CONSTRAINT chk_component_not_empty 
    CHECK (LENGTH(component) > 0);

ALTER TABLE system_logs 
    ADD CONSTRAINT chk_message_not_empty 
    CHECK (LENGTH(message) > 0);

-- Create or update update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';