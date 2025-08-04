-- Logging Schema Fixes Rollback Migration
-- Rollback for Migration 004: Remove system_logs schema fixes

-- Drop system_logs table and all related objects
DROP TABLE IF EXISTS system_logs CASCADE;

-- Drop function if it exists
DROP FUNCTION IF EXISTS update_updated_at_column();