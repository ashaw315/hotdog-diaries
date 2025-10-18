import { sql } from '@vercel/postgres'

async function createRedditTables() {
  console.log('🔧 Creating missing Reddit database tables...')
  
  try {
    // Create reddit_scan_config table
    await sql`
      CREATE TABLE IF NOT EXISTS reddit_scan_config (
        id SERIAL PRIMARY KEY,
        is_enabled BOOLEAN DEFAULT true,
        scan_interval INTEGER DEFAULT 30,
        max_posts_per_scan INTEGER DEFAULT 25,
        target_subreddits TEXT[] DEFAULT ARRAY['hotdogs', 'food', 'FoodPorn', 'recipes', 'sausages', 'grilling', 'bbq'],
        search_terms TEXT[] DEFAULT ARRAY['hotdog', 'hot dog', 'hot-dog', 'frankfurter', 'wiener', 'bratwurst', 'sausage'],
        min_score INTEGER DEFAULT 10,
        sort_by VARCHAR(20) DEFAULT 'hot' CHECK (sort_by IN ('hot', 'new', 'top', 'relevance')),
        time_range VARCHAR(20) DEFAULT 'week' CHECK (time_range IN ('hour', 'day', 'week', 'month', 'year', 'all')),
        include_nsfw BOOLEAN DEFAULT false,
        last_scan_id VARCHAR(255),
        last_scan_time TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `
    console.log('✅ Created reddit_scan_config table')

    // Create reddit_scan_results table
    await sql`
      CREATE TABLE IF NOT EXISTS reddit_scan_results (
        id SERIAL PRIMARY KEY,
        scan_id VARCHAR(255) NOT NULL,
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE NOT NULL,
        posts_found INTEGER DEFAULT 0,
        posts_processed INTEGER DEFAULT 0,
        posts_approved INTEGER DEFAULT 0,
        posts_rejected INTEGER DEFAULT 0,
        posts_flagged INTEGER DEFAULT 0,
        duplicates_found INTEGER DEFAULT 0,
        subreddits_scanned TEXT[] DEFAULT ARRAY[]::TEXT[],
        highest_score INTEGER DEFAULT 0,
        errors TEXT[] DEFAULT ARRAY[]::TEXT[],
        rate_limit_hit BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `
    console.log('✅ Created reddit_scan_results table')

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_reddit_scan_results_scan_id ON reddit_scan_results (scan_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_reddit_scan_results_start_time ON reddit_scan_results (start_time)`
    console.log('✅ Created Reddit table indexes')

    // Insert default configuration
    await sql`
      INSERT INTO reddit_scan_config (
        is_enabled, 
        target_subreddits, 
        search_terms,
        max_posts_per_scan
      ) VALUES (
        true, 
        ARRAY['hotdogs', 'food', 'FoodPorn', 'recipes', 'sausages', 'grilling', 'bbq'],
        ARRAY['hotdog', 'hot dog', 'hot-dog', 'frankfurter', 'wiener', 'bratwurst', 'sausage'],
        25
      ) ON CONFLICT DO NOTHING
    `
    console.log('✅ Inserted default Reddit configuration')

    console.log('🎉 Reddit tables setup complete!')
    
  } catch (error) {
    console.error('❌ Failed to create Reddit tables:', error)
    throw error
  }
}

// Run if called directly
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('fix-reddit-tables')
if (isMainModule) {
  createRedditTables()
    .then(() => {
      console.log('✅ Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Script failed:', error)
      process.exit(1)
    })
}

export { createRedditTables }