-- Rollback: Remove scheduling configuration table
-- This rollback removes the schedule_config table and related objects

-- Drop trigger and function
DROP TRIGGER IF EXISTS trigger_schedule_config_updated_at ON schedule_config;
DROP FUNCTION IF EXISTS update_schedule_config_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_schedule_config_enabled;
DROP INDEX IF EXISTS idx_schedule_config_created_at;

-- Drop table
DROP TABLE IF EXISTS schedule_config;