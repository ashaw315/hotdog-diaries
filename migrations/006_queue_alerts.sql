-- Migration: Add queue alerts table
-- This migration adds the queue_alerts table to track queue health alerts

-- Create enum for alert types
CREATE TYPE alert_type AS ENUM ('low_queue', 'empty_queue', 'high_pending', 'posting_failure');

-- Create enum for severity levels
CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');

-- Create queue_alerts table
CREATE TABLE queue_alerts (
    id SERIAL PRIMARY KEY,
    alert_type alert_type NOT NULL,
    message TEXT NOT NULL,
    severity alert_severity NOT NULL,
    metadata JSONB DEFAULT '{}',
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE NULL
);

-- Create indexes for efficient querying
CREATE INDEX idx_queue_alerts_acknowledged ON queue_alerts (acknowledged);
CREATE INDEX idx_queue_alerts_created_at ON queue_alerts (created_at);
CREATE INDEX idx_queue_alerts_alert_type ON queue_alerts (alert_type);
CREATE INDEX idx_queue_alerts_severity ON queue_alerts (severity);
CREATE INDEX idx_queue_alerts_active ON queue_alerts (acknowledged, created_at) WHERE acknowledged = false;

-- Create GIN index for JSONB metadata
CREATE INDEX idx_queue_alerts_metadata ON queue_alerts USING GIN (metadata);

-- Add constraints
ALTER TABLE queue_alerts 
ADD CONSTRAINT check_acknowledged_at_logic 
CHECK (
    (acknowledged = true AND acknowledged_at IS NOT NULL) OR
    (acknowledged = false AND acknowledged_at IS NULL)
);

-- Create view for active alerts
CREATE VIEW active_alerts AS
SELECT 
    id,
    alert_type,
    message,
    severity,
    metadata,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at)) AS age_seconds
FROM queue_alerts
WHERE acknowledged = false
ORDER BY severity DESC, created_at DESC;

COMMENT ON TABLE queue_alerts IS 'Alerts for queue health monitoring';
COMMENT ON COLUMN queue_alerts.alert_type IS 'Type of alert (low_queue, empty_queue, high_pending, posting_failure)';
COMMENT ON COLUMN queue_alerts.message IS 'Human-readable alert message';
COMMENT ON COLUMN queue_alerts.severity IS 'Alert severity level';
COMMENT ON COLUMN queue_alerts.metadata IS 'Additional structured data about the alert';
COMMENT ON COLUMN queue_alerts.acknowledged IS 'Whether the alert has been acknowledged';
COMMENT ON COLUMN queue_alerts.created_at IS 'When the alert was created';
COMMENT ON COLUMN queue_alerts.acknowledged_at IS 'When the alert was acknowledged';
COMMENT ON VIEW active_alerts IS 'View of unacknowledged alerts with age calculation';