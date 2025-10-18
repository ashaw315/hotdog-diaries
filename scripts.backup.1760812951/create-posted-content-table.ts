import { createSimpleClient } from '@/utils/supabase/server'

async function createPostedContentTable() {
  console.log('🗄️ Creating posted_content table in production...')
  
  try {
    const supabase = createSimpleClient()
    
    // Create posted_content table
    const { error } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS posted_content (
          id SERIAL PRIMARY KEY,
          content_queue_id INTEGER REFERENCES content_queue(id) ON DELETE CASCADE,
          posted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          scheduled_time VARCHAR(10), -- e.g. '07:00', '12:00', etc.
          post_order INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_posted_content_posted_at ON posted_content(posted_at);
        CREATE INDEX IF NOT EXISTS idx_posted_content_content_queue_id ON posted_content(content_queue_id);
        CREATE INDEX IF NOT EXISTS idx_posted_content_post_order ON posted_content(post_order);

        -- Create posting_schedule table as well
        CREATE TABLE IF NOT EXISTS posting_schedule (
          id SERIAL PRIMARY KEY,
          content_queue_id INTEGER REFERENCES content_queue(id) ON DELETE CASCADE,
          scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
          meal_slot VARCHAR(50) NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          posted_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create indexes for posting_schedule
        CREATE INDEX IF NOT EXISTS idx_posting_schedule_scheduled_time ON posting_schedule(scheduled_time);
        CREATE INDEX IF NOT EXISTS idx_posting_schedule_status ON posting_schedule(status);
        CREATE INDEX IF NOT EXISTS idx_posting_schedule_meal_slot ON posting_schedule(meal_slot);
      `
    })

    if (error) {
      console.error('❌ Failed to create tables:', error)
      return false
    }

    console.log('✅ posted_content and posting_schedule tables created successfully')
    return true

  } catch (error) {
    console.error('❌ Error creating tables:', error)
    return false
  }
}

// Export for use in other modules
export default createPostedContentTable

// Run if called directly
if (require.main === module) {
  createPostedContentTable()
    .then(success => {
      if (success) {
        console.log('🎉 Database migration completed successfully')
        process.exit(0)
      } else {
        console.log('❌ Database migration failed')
        process.exit(1)
      }
    })
    .catch(error => {
      console.error('❌ Migration error:', error)
      process.exit(1)
    })
}