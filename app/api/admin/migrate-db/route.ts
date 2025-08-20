import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  console.log('🗄️ Starting database migration...')
  
  try {
    // Auth check
    let userId: string | null = null
    let username: string | null = null

    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
        if (decoded.username === 'admin' && decoded.id === 1) {
          userId = '1'
          username = 'admin'
        }
      } catch (e) {
        // Fall through
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ Authentication successful for database migration')

    const supabase = createSimpleClient()
    
    // Create both tables needed for automation
    const { error } = await supabase.rpc('exec_sql', {
      query: `
        -- Create posted_content table
        CREATE TABLE IF NOT EXISTS posted_content (
          id SERIAL PRIMARY KEY,
          content_queue_id INTEGER REFERENCES content_queue(id) ON DELETE CASCADE,
          posted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          scheduled_time VARCHAR(10), -- e.g. '07:00', '12:00', etc.
          post_order INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create indexes for posted_content
        CREATE INDEX IF NOT EXISTS idx_posted_content_posted_at ON posted_content(posted_at);
        CREATE INDEX IF NOT EXISTS idx_posted_content_content_queue_id ON posted_content(content_queue_id);
        CREATE INDEX IF NOT EXISTS idx_posted_content_post_order ON posted_content(post_order);

        -- Create posting_schedule table
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

        -- Insert initial meal time slots for tomorrow if none exist
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
      console.error('❌ Database migration failed:', error)
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    console.log('✅ Database migration completed successfully')

    // Verify tables exist
    const { data: tables, error: listError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .in('table_name', ['posted_content', 'posting_schedule'])

    return NextResponse.json({
      success: true,
      message: 'Database migration completed successfully',
      tables: tables?.map(t => t.table_name) || [],
      created: [
        'posted_content table with indexes',
        'posting_schedule table with indexes', 
        'Initial meal time slots for tomorrow'
      ]
    })

  } catch (error) {
    console.error('❌ Migration error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}