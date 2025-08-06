-- Create posts table for published content
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    content_queue_id INTEGER UNIQUE REFERENCES content_queue(id),
    title VARCHAR(500) NOT NULL,
    content TEXT,
    image_url TEXT,
    video_url TEXT,
    content_type VARCHAR(50) NOT NULL DEFAULT 'text',
    source_platform VARCHAR(100) NOT NULL,
    original_url TEXT,
    original_author VARCHAR(500),
    posted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- SEO and meta fields
    slug VARCHAR(200) UNIQUE,
    meta_description TEXT,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    
    -- Content flags
    is_featured BOOLEAN DEFAULT false,
    is_visible BOOLEAN DEFAULT true,
    
    -- Indexing
    CONSTRAINT posts_content_queue_id_unique UNIQUE (content_queue_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_posted_at ON posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_source_platform ON posts(source_platform);
CREATE INDEX IF NOT EXISTS idx_posts_content_type ON posts(content_type);
CREATE INDEX IF NOT EXISTS idx_posts_is_visible ON posts(is_visible);
CREATE INDEX IF NOT EXISTS idx_posts_is_featured ON posts(is_featured);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug) WHERE slug IS NOT NULL;

-- Create function to generate slug
CREATE OR REPLACE FUNCTION generate_post_slug(post_title TEXT, post_id INTEGER)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Create base slug from title
    base_slug := lower(regexp_replace(regexp_replace(post_title, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    
    -- Limit length
    base_slug := substr(base_slug, 1, 100);
    
    -- Ensure uniqueness
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM posts WHERE slug = final_slug AND id != post_id) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate slug
CREATE OR REPLACE FUNCTION posts_generate_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := generate_post_slug(NEW.title, NEW.id);
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_slug_trigger
    BEFORE INSERT OR UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION posts_generate_slug();

-- Create posting_history table for audit trail
CREATE TABLE IF NOT EXISTS posting_history (
    id SERIAL PRIMARY KEY,
    content_queue_id INTEGER REFERENCES content_queue(id),
    post_id INTEGER REFERENCES posts(id),
    action VARCHAR(50) NOT NULL, -- 'posted', 'updated', 'featured', 'hidden'
    details JSONB,
    performed_by VARCHAR(100),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posting_history_content_queue_id ON posting_history(content_queue_id);
CREATE INDEX IF NOT EXISTS idx_posting_history_post_id ON posting_history(post_id);
CREATE INDEX IF NOT EXISTS idx_posting_history_action ON posting_history(action);
CREATE INDEX IF NOT EXISTS idx_posting_history_performed_at ON posting_history(performed_at DESC);