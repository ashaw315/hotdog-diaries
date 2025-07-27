-- Rollback: Remove queue alerts table and related objects
-- This rollback removes the queue_alerts table and related objects

-- Drop view
DROP VIEW IF EXISTS active_alerts;

-- Drop indexes
DROP INDEX IF EXISTS idx_queue_alerts_acknowledged;
DROP INDEX IF EXISTS idx_queue_alerts_created_at;
DROP INDEX IF EXISTS idx_queue_alerts_alert_type;
DROP INDEX IF EXISTS idx_queue_alerts_severity;
DROP INDEX IF EXISTS idx_queue_alerts_active;
DROP INDEX IF EXISTS idx_queue_alerts_metadata;

-- Drop table
DROP TABLE IF EXISTS queue_alerts;

-- Drop enums
DROP TYPE IF EXISTS alert_severity;
DROP TYPE IF EXISTS alert_type;