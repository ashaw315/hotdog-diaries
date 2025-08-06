-- Content Status Workflow Migration
-- Migration 007: Add content status workflow system

-- Create content status enum
CREATE TYPE content_status_enum AS ENUM (
    'discovered',
    'pending_review', 
    'approved',
    'scheduled',
    'posted',
    'rejected',
    'archived'
);

-- Add content_status column to content_queue table
ALTER TABLE content_queue 
ADD COLUMN content_status content_status_enum NOT NULL DEFAULT 'discovered';

-- Create index for performance on status queries
CREATE INDEX idx_content_queue_status ON content_queue(content_status);
CREATE INDEX idx_content_queue_status_created ON content_queue(content_status, created_at);

-- Add review-related columns
ALTER TABLE content_queue
ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN reviewed_by VARCHAR(255),
ADD COLUMN rejection_reason TEXT,
ADD COLUMN scheduled_for TIMESTAMP WITH TIME ZONE,
ADD COLUMN edit_history JSONB DEFAULT '[]'::jsonb;

-- Create indexes for new columns
CREATE INDEX idx_content_queue_reviewed_at ON content_queue(reviewed_at);
CREATE INDEX idx_content_queue_scheduled_for ON content_queue(scheduled_for);

-- Update existing records to set appropriate status based on current is_approved and is_posted values
UPDATE content_queue 
SET content_status = CASE 
    WHEN is_posted = true THEN 'posted'::content_status_enum
    WHEN is_approved = true AND is_posted = false THEN 'approved'::content_status_enum
    WHEN is_approved = false THEN 'rejected'::content_status_enum
    ELSE 'pending_review'::content_status_enum
END;

-- Create function to automatically update content_status when is_approved or is_posted changes
CREATE OR REPLACE FUNCTION update_content_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update content_status based on is_approved and is_posted
    IF NEW.is_posted = true AND OLD.is_posted = false THEN
        NEW.content_status = 'posted';
    ELSIF NEW.is_approved = true AND OLD.is_approved IS DISTINCT FROM true THEN
        NEW.content_status = 'approved';
        NEW.reviewed_at = NOW();
    ELSIF NEW.is_approved = false AND OLD.is_approved IS DISTINCT FROM false THEN
        NEW.content_status = 'rejected';
        NEW.reviewed_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update status
CREATE TRIGGER trigger_update_content_status
    BEFORE UPDATE ON content_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_content_status();

-- Create content_edits table to track editing history
CREATE TABLE IF NOT EXISTS content_edits (
    id SERIAL PRIMARY KEY,
    content_queue_id INTEGER NOT NULL,
    edited_by VARCHAR(255) NOT NULL,
    edited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    field_changed VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    edit_reason TEXT,
    FOREIGN KEY (content_queue_id) REFERENCES content_queue(id) ON DELETE CASCADE
);

-- Create indexes for content_edits
CREATE INDEX idx_content_edits_content_queue_id ON content_edits(content_queue_id);
CREATE INDEX idx_content_edits_edited_at ON content_edits(edited_at);

-- Add comments for documentation
COMMENT ON COLUMN content_queue.content_status IS 'Current status of content in the workflow pipeline';
COMMENT ON COLUMN content_queue.reviewed_at IS 'Timestamp when content was last reviewed by admin';
COMMENT ON COLUMN content_queue.reviewed_by IS 'Admin user who last reviewed this content';
COMMENT ON COLUMN content_queue.rejection_reason IS 'Reason provided when content is rejected';
COMMENT ON COLUMN content_queue.scheduled_for IS 'Timestamp when content is scheduled to be posted';
COMMENT ON COLUMN content_queue.edit_history IS 'JSON array of edit operations performed on this content';