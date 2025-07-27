-- Migration: Add scheduling configuration table
-- This migration adds the schedule_config table to store posting schedule settings

CREATE TABLE schedule_config (
    id SERIAL PRIMARY KEY,
    meal_times TEXT[] NOT NULL DEFAULT ARRAY['08:00', '10:00', '12:00', '15:00', '18:00', '20:00'],
    timezone VARCHAR(100) NOT NULL DEFAULT 'America/New_York',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_schedule_config_enabled ON schedule_config (is_enabled);
CREATE INDEX idx_schedule_config_created_at ON schedule_config (created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_schedule_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_schedule_config_updated_at
    BEFORE UPDATE ON schedule_config
    FOR EACH ROW
    EXECUTE FUNCTION update_schedule_config_updated_at();

-- Insert default configuration
INSERT INTO schedule_config (meal_times, timezone, is_enabled)
VALUES (
    ARRAY['08:00', '10:00', '12:00', '15:00', '18:00', '20:00'],
    'America/New_York',
    TRUE
);

-- Add constraints
ALTER TABLE schedule_config 
ADD CONSTRAINT check_meal_times_not_empty 
CHECK (array_length(meal_times, 1) > 0);

ALTER TABLE schedule_config 
ADD CONSTRAINT check_meal_times_valid_format 
CHECK (
    array_length(meal_times, 1) <= 10 AND
    NOT EXISTS (
        SELECT 1 FROM unnest(meal_times) AS t
        WHERE t !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
    )
);

COMMENT ON TABLE schedule_config IS 'Configuration for automated posting schedule';
COMMENT ON COLUMN schedule_config.meal_times IS 'Array of meal times in HH:MM format for daily posting';
COMMENT ON COLUMN schedule_config.timezone IS 'Timezone for scheduling (e.g., America/New_York)';
COMMENT ON COLUMN schedule_config.is_enabled IS 'Whether automatic posting is enabled';
COMMENT ON COLUMN schedule_config.created_at IS 'When this configuration was created';
COMMENT ON COLUMN schedule_config.updated_at IS 'When this configuration was last updated';