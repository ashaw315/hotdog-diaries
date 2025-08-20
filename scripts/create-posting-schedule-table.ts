import { createSimpleClient } from '@/utils/supabase/server'

async function createPostingScheduleTable() {
  console.log('🗄️ Creating posting_schedule table...')
  
  try {
    const supabase = createSimpleClient()
    
    // Create posting_schedule table
    const { error } = await supabase.rpc('exec_sql', {
      query: `
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

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_posting_schedule_scheduled_time ON posting_schedule(scheduled_time);
        CREATE INDEX IF NOT EXISTS idx_posting_schedule_status ON posting_schedule(status);
        CREATE INDEX IF NOT EXISTS idx_posting_schedule_meal_slot ON posting_schedule(meal_slot);
        CREATE INDEX IF NOT EXISTS idx_posting_schedule_content_queue_id ON posting_schedule(content_queue_id);

        -- Insert initial meal time slots for today if none exist
        INSERT INTO posting_schedule (scheduled_time, meal_slot, status)
        SELECT 
          (CURRENT_DATE + interval '1 day' + INTERVAL (slot_hour::text || ' hours'))::TIMESTAMP WITH TIME ZONE as scheduled_time,
          slot_name,
          'pending'
        FROM (
          VALUES 
            (7, 'breakfast'),
            (12, 'lunch'), 
            (15, 'snack'),
            (18, 'dinner'),
            (20, 'evening'),
            (22, 'late_night')
        ) AS meal_slots(slot_hour, slot_name)
        WHERE NOT EXISTS (
          SELECT 1 FROM posting_schedule 
          WHERE scheduled_time::date = CURRENT_DATE + interval '1 day'
        );
      `
    })

    if (error) {
      console.error('❌ Failed to create posting_schedule table:', error)
      return false
    }

    console.log('✅ posting_schedule table created successfully')
    
    // Verify table exists
    const { data: tables, error: listError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'posting_schedule')
      .limit(1)

    if (listError) {
      console.error('⚠️ Could not verify table creation:', listError)
    } else if (tables && tables.length > 0) {
      console.log('✅ Table verified in database schema')
    }

    return true
  } catch (error) {
    console.error('❌ Error creating table:', error)
    return false
  }
}

// Run if called directly
if (require.main === module) {
  createPostingScheduleTable()
    .then(success => {
      if (success) {
        console.log('🎉 Migration completed successfully')
        process.exit(0)
      } else {
        console.log('❌ Migration failed')
        process.exit(1)
      }
    })
    .catch(error => {
      console.error('❌ Migration error:', error)
      process.exit(1)
    })
}

export default createPostingScheduleTable