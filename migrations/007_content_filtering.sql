-- Migration: Add content filtering and analysis tables
-- This migration adds tables for content filtering, analysis, and review system

-- Create enum for filter pattern types
CREATE TYPE filter_pattern_type AS ENUM ('spam', 'inappropriate', 'unrelated', 'required');

-- Create filter_patterns table
CREATE TABLE filter_patterns (
    id SERIAL PRIMARY KEY,
    pattern_type filter_pattern_type NOT NULL,
    pattern TEXT NOT NULL,
    description TEXT,
    is_regex BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create content_analysis table
CREATE TABLE content_analysis (
    id SERIAL PRIMARY KEY,
    content_queue_id INTEGER REFERENCES content_queue(id) ON DELETE CASCADE,
    is_spam BOOLEAN DEFAULT FALSE,
    is_inappropriate BOOLEAN DEFAULT FALSE,
    is_unrelated BOOLEAN DEFAULT FALSE,
    is_valid_hotdog BOOLEAN DEFAULT FALSE,
    confidence_score DECIMAL(3,2) DEFAULT 0.0,
    flagged_patterns TEXT[] DEFAULT ARRAY[]::TEXT[],
    processing_notes TEXT[] DEFAULT ARRAY[]::TEXT[],
    similarity_hash VARCHAR(32),
    duplicate_of INTEGER REFERENCES content_queue(id),
    filter_results JSONB DEFAULT '{}',
    is_flagged BOOLEAN DEFAULT FALSE,
    flagged_reason TEXT,
    admin_override BOOLEAN DEFAULT FALSE,
    admin_notes TEXT,
    reviewed_by INTEGER REFERENCES admin_users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create filtering_stats table for tracking performance
CREATE TABLE filtering_stats (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    total_processed INTEGER DEFAULT 0,
    auto_approved INTEGER DEFAULT 0,
    auto_rejected INTEGER DEFAULT 0,
    flagged_for_review INTEGER DEFAULT 0,
    spam_detected INTEGER DEFAULT 0,
    inappropriate_detected INTEGER DEFAULT 0,
    unrelated_detected INTEGER DEFAULT 0,
    duplicates_detected INTEGER DEFAULT 0,
    false_positives INTEGER DEFAULT 0,
    false_negatives INTEGER DEFAULT 0,
    accuracy_rate DECIMAL(5,4) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create content_reviews table for review workflow
CREATE TABLE content_reviews (
    id SERIAL PRIMARY KEY,
    content_queue_id INTEGER REFERENCES content_queue(id) ON DELETE CASCADE,
    content_analysis_id INTEGER REFERENCES content_analysis(id) ON DELETE CASCADE,
    review_action VARCHAR(20) NOT NULL CHECK (review_action IN ('approve', 'reject', 'flag')),
    review_reason TEXT,
    admin_notes TEXT,
    reviewed_by INTEGER REFERENCES admin_users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_filter_patterns_type ON filter_patterns (pattern_type);
CREATE INDEX idx_filter_patterns_enabled ON filter_patterns (is_enabled);
CREATE INDEX idx_content_analysis_content_id ON content_analysis (content_queue_id);
CREATE INDEX idx_content_analysis_spam ON content_analysis (is_spam);
CREATE INDEX idx_content_analysis_inappropriate ON content_analysis (is_inappropriate);
CREATE INDEX idx_content_analysis_unrelated ON content_analysis (is_unrelated);
CREATE INDEX idx_content_analysis_valid_hotdog ON content_analysis (is_valid_hotdog);
CREATE INDEX idx_content_analysis_flagged ON content_analysis (is_flagged);
CREATE INDEX idx_content_analysis_similarity ON content_analysis (similarity_hash);
CREATE INDEX idx_content_analysis_duplicate ON content_analysis (duplicate_of);
CREATE INDEX idx_content_analysis_created_at ON content_analysis (created_at);
CREATE INDEX idx_filtering_stats_date ON filtering_stats (date);
CREATE INDEX idx_content_reviews_content_id ON content_reviews (content_queue_id);
CREATE INDEX idx_content_reviews_action ON content_reviews (review_action);
CREATE INDEX idx_content_reviews_reviewed_by ON content_reviews (reviewed_by);
CREATE INDEX idx_content_reviews_reviewed_at ON content_reviews (reviewed_at);

-- Create GIN indexes for array and JSONB fields
CREATE INDEX idx_content_analysis_flagged_patterns ON content_analysis USING GIN (flagged_patterns);
CREATE INDEX idx_content_analysis_processing_notes ON content_analysis USING GIN (processing_notes);
CREATE INDEX idx_content_analysis_filter_results ON content_analysis USING GIN (filter_results);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_filter_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_filter_patterns_updated_at
    BEFORE UPDATE ON filter_patterns
    FOR EACH ROW
    EXECUTE FUNCTION update_filter_patterns_updated_at();

CREATE OR REPLACE FUNCTION update_content_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_content_analysis_updated_at
    BEFORE UPDATE ON content_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_content_analysis_updated_at();

CREATE OR REPLACE FUNCTION update_filtering_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_filtering_stats_updated_at
    BEFORE UPDATE ON filtering_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_filtering_stats_updated_at();

-- Add constraints
ALTER TABLE content_analysis 
ADD CONSTRAINT check_confidence_score_range 
CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0);

ALTER TABLE filtering_stats 
ADD CONSTRAINT check_accuracy_rate_range 
CHECK (accuracy_rate >= 0.0 AND accuracy_rate <= 1.0);

ALTER TABLE filtering_stats 
ADD CONSTRAINT unique_filtering_stats_date 
UNIQUE (date);

-- Create views for easier querying
CREATE VIEW content_with_analysis AS
SELECT 
    cq.*,
    ca.is_spam,
    ca.is_inappropriate,
    ca.is_unrelated,
    ca.is_valid_hotdog,
    ca.confidence_score,
    ca.flagged_patterns,
    ca.processing_notes,
    ca.similarity_hash,
    ca.duplicate_of,
    ca.is_flagged,
    ca.flagged_reason,
    ca.admin_override,
    ca.admin_notes,
    ca.reviewed_by,
    ca.reviewed_at as analysis_created_at,
    au.username as reviewed_by_username
FROM content_queue cq
LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
LEFT JOIN admin_users au ON ca.reviewed_by = au.id;

CREATE VIEW flagged_content AS
SELECT 
    cq.*,
    ca.is_spam,
    ca.is_inappropriate,
    ca.is_unrelated,
    ca.confidence_score,
    ca.flagged_patterns,
    ca.flagged_reason,
    ca.processing_notes,
    ca.created_at as flagged_at
FROM content_queue cq
JOIN content_analysis ca ON cq.id = ca.content_queue_id
WHERE ca.is_flagged = true
ORDER BY ca.created_at DESC;

CREATE VIEW duplicate_content AS
SELECT 
    cq.*,
    ca.similarity_hash,
    ca.duplicate_of,
    orig_cq.content_text as original_content_text,
    orig_cq.created_at as original_created_at
FROM content_queue cq
JOIN content_analysis ca ON cq.id = ca.content_queue_id
LEFT JOIN content_queue orig_cq ON ca.duplicate_of = orig_cq.id
WHERE ca.duplicate_of IS NOT NULL
ORDER BY ca.created_at DESC;

-- Insert default filter patterns
INSERT INTO filter_patterns (pattern_type, pattern, description, is_regex, is_enabled) VALUES
-- Spam patterns
('spam', 'buy now', 'Common spam phrase', false, true),
('spam', 'limited time', 'Urgency spam phrase', false, true),
('spam', 'discount', 'Promotional spam', false, true),
('spam', 'promo code', 'Promotional code spam', false, true),
('spam', 'click here', 'Call to action spam', false, true),
('spam', 'free shipping', 'Free shipping spam', false, true),
('spam', 'act now', 'Urgency spam', false, true),
('spam', 'don''t miss', 'FOMO spam', false, true),
('spam', 'special offer', 'Promotional spam', false, true),
('spam', 'save \\$\\d+', 'Money saving spam', true, true),
('spam', 'follow us', 'Social media spam', false, true),
('spam', 'link in bio', 'Social media spam', false, true),
('spam', 'dm me', 'Direct message spam', false, true),
('spam', 'check out my', 'Self-promotion spam', false, true),
('spam', 'instagram\\.com', 'Instagram link spam', true, true),
('spam', 'onlyfans', 'Adult content spam', false, true),
('spam', 'bitcoin', 'Cryptocurrency spam', false, true),
('spam', 'crypto', 'Cryptocurrency spam', false, true),
('spam', 'nft', 'NFT spam', false, true),

-- Inappropriate patterns
('inappropriate', 'fuck', 'Profanity', false, true),
('inappropriate', 'shit', 'Profanity', false, true),
('inappropriate', 'damn', 'Mild profanity', false, true),
('inappropriate', 'sex', 'Adult content', false, true),
('inappropriate', 'porn', 'Adult content', false, true),
('inappropriate', 'nude', 'Adult content', false, true),
('inappropriate', 'xxx', 'Adult content', false, true),
('inappropriate', 'kill', 'Violence', false, true),
('inappropriate', 'murder', 'Violence', false, true),
('inappropriate', 'suicide', 'Violence/harm', false, true),
('inappropriate', 'die', 'Violence/harm', false, true),
('inappropriate', 'hate', 'Hate speech', false, true),
('inappropriate', 'racist', 'Hate speech', false, true),
('inappropriate', 'nazi', 'Hate speech', false, true),
('inappropriate', 'drug', 'Drug content', false, true),
('inappropriate', 'cocaine', 'Drug content', false, true),
('inappropriate', 'heroin', 'Drug content', false, true),
('inappropriate', 'marijuana', 'Drug content', false, true),
('inappropriate', 'weed', 'Drug content', false, true),

-- Unrelated patterns
('unrelated', 'hotdog[,!\\s]+that''s amazing', 'Exclamatory unrelated usage', true, true),
('unrelated', 'hotdog[,!\\s]+wow', 'Exclamatory unrelated usage', true, true),
('unrelated', 'hotdog[,!\\s]+incredible', 'Exclamatory unrelated usage', true, true),
('unrelated', 'hotdog[,!\\s]+no way', 'Exclamatory unrelated usage', true, true),
('unrelated', 'hotdog[,!\\s]+really', 'Exclamatory unrelated usage', true, true),
('unrelated', 'hotdog[,!\\s]+seriously', 'Exclamatory unrelated usage', true, true),
('unrelated', 'hotdog[,!\\s]+dude', 'Exclamatory unrelated usage', true, true),
('unrelated', 'hotdog[,!\\s]+man', 'Exclamatory unrelated usage', true, true),
('unrelated', 'hotdog[,!\\s]+omg', 'Exclamatory unrelated usage', true, true),
('unrelated', 'hotdog[,!\\s]+lol', 'Exclamatory unrelated usage', true, true),
('unrelated', 'hotdog[,!\\s]+wtf', 'Exclamatory unrelated usage', true, true),

-- Required patterns
('required', 'hot\\s*dog', 'Basic hotdog term', true, true),
('required', 'hotdog', 'Basic hotdog term', false, true),
('required', 'hot-dog', 'Hyphenated hotdog term', false, true),
('required', 'frankfurter', 'Hotdog synonym', false, true),
('required', 'wiener', 'Hotdog synonym', false, true),
('required', 'sausage', 'Hotdog synonym', false, true),
('required', 'bratwurst', 'Hotdog type', false, true),
('required', 'polish sausage', 'Hotdog type', false, true),
('required', 'kielbasa', 'Hotdog type', false, true),
('required', 'corn dog', 'Hotdog variant', false, true),
('required', 'chili dog', 'Hotdog variant', false, true),
('required', 'coney', 'Hotdog variant', false, true),
('required', 'vienna sausage', 'Hotdog type', false, true),
('required', 'cocktail sausage', 'Small hotdog', false, true),
('required', 'breakfast sausage', 'Sausage type', false, true),
('required', 'italian sausage', 'Sausage type', false, true),
('required', 'turkey dog', 'Hotdog variant', false, true),
('required', 'veggie dog', 'Hotdog variant', false, true),
('required', 'vegan dog', 'Hotdog variant', false, true),
('required', 'beef frank', 'Hotdog type', false, true),
('required', 'kosher dog', 'Hotdog type', false, true),
('required', 'hebrew national', 'Hotdog brand', false, true),
('required', 'nathan''s', 'Hotdog brand', false, true),
('required', 'oscar mayer', 'Hotdog brand', false, true),
('required', 'johnsonville', 'Hotdog brand', false, true),
('required', 'ballpark frank', 'Hotdog brand', false, true),
('required', 'street dog', 'Hotdog context', false, true),
('required', 'stadium dog', 'Hotdog context', false, true),
('required', 'baseball dog', 'Hotdog context', false, true),
('required', 'cart dog', 'Hotdog context', false, true),
('required', 'vendor dog', 'Hotdog context', false, true),
('required', 'foot long', 'Hotdog size', false, true),
('required', 'jumbo dog', 'Hotdog size', false, true),
('required', 'mini dog', 'Hotdog size', false, true),
('required', 'mustard', 'Hotdog condiment', false, true),
('required', 'ketchup', 'Hotdog condiment', false, true),
('required', 'relish', 'Hotdog condiment', false, true),
('required', 'sauerkraut', 'Hotdog condiment', false, true),
('required', 'chili', 'Hotdog topping', false, true),
('required', 'onions', 'Hotdog topping', false, true),
('required', 'bun', 'Hotdog component', false, true),
('required', 'grill', 'Hotdog cooking method', false, true),
('required', 'bbq', 'Hotdog cooking context', false, true),
('required', 'barbecue', 'Hotdog cooking context', false, true),
('required', 'cookout', 'Hotdog context', false, true),
('required', 'picnic', 'Hotdog context', false, true),
('required', 'baseball game', 'Hotdog context', false, true),
('required', 'ballpark', 'Hotdog context', false, true),
('required', 'stadium', 'Hotdog context', false, true),
('required', 'fair', 'Hotdog context', false, true),
('required', 'carnival', 'Hotdog context', false, true),
('required', 'food truck', 'Hotdog context', false, true),
('required', 'street vendor', 'Hotdog context', false, true);

-- Add comments
COMMENT ON TABLE filter_patterns IS 'Configurable patterns for content filtering';
COMMENT ON TABLE content_analysis IS 'Analysis results for content filtering';
COMMENT ON TABLE filtering_stats IS 'Daily statistics for filtering performance';
COMMENT ON TABLE content_reviews IS 'Manual review workflow for flagged content';
COMMENT ON COLUMN filter_patterns.pattern_type IS 'Type of filter pattern (spam, inappropriate, unrelated, required)';
COMMENT ON COLUMN filter_patterns.pattern IS 'The pattern to match (regex or literal)';
COMMENT ON COLUMN filter_patterns.is_regex IS 'Whether the pattern is a regular expression';
COMMENT ON COLUMN content_analysis.confidence_score IS 'Confidence score from 0.0 to 1.0';
COMMENT ON COLUMN content_analysis.similarity_hash IS 'Hash for duplicate detection';
COMMENT ON COLUMN content_analysis.duplicate_of IS 'Reference to original content if duplicate';
COMMENT ON COLUMN content_analysis.is_flagged IS 'Whether content is flagged for manual review';
COMMENT ON COLUMN content_analysis.admin_override IS 'Whether admin manually overrode the filter decision';
COMMENT ON VIEW content_with_analysis IS 'Content queue with analysis results';
COMMENT ON VIEW flagged_content IS 'Content flagged for manual review';
COMMENT ON VIEW duplicate_content IS 'Content identified as duplicates';