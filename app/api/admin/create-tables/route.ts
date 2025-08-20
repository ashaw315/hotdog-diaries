import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function POST(request: NextRequest) {
  console.log('🗄️ Creating missing database tables...')
  
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer eyJ1c2VybmFtZSI6ImFkbWluIiwiaWQiOjF9`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create posted_content table using Vercel Postgres
    await sql`
      CREATE TABLE IF NOT EXISTS posted_content (
        id SERIAL PRIMARY KEY,
        content_queue_id INTEGER REFERENCES content_queue(id) ON DELETE CASCADE,
        posted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        scheduled_time VARCHAR(10),
        post_order INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `

    // Create indexes for posted_content
    await sql`CREATE INDEX IF NOT EXISTS idx_posted_content_posted_at ON posted_content(posted_at);`
    await sql`CREATE INDEX IF NOT EXISTS idx_posted_content_content_queue_id ON posted_content(content_queue_id);`
    await sql`CREATE INDEX IF NOT EXISTS idx_posted_content_post_order ON posted_content(post_order);`

    // Create posting_schedule table
    await sql`
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
    `

    // Create indexes for posting_schedule
    await sql`CREATE INDEX IF NOT EXISTS idx_posting_schedule_scheduled_time ON posting_schedule(scheduled_time);`
    await sql`CREATE INDEX IF NOT EXISTS idx_posting_schedule_status ON posting_schedule(status);`
    await sql`CREATE INDEX IF NOT EXISTS idx_posting_schedule_meal_slot ON posting_schedule(meal_slot);`

    console.log('✅ Tables created successfully')

    // Verify tables exist by counting records
    const postedContentCount = await sql`SELECT COUNT(*) as count FROM posted_content;`
    const postingScheduleCount = await sql`SELECT COUNT(*) as count FROM posting_schedule;`

    return NextResponse.json({
      success: true,
      message: 'Database tables created successfully',
      tables: {
        posted_content: { created: true, count: postedContentCount.rows[0].count },
        posting_schedule: { created: true, count: postingScheduleCount.rows[0].count }
      }
    })

  } catch (error) {
    console.error('❌ Table creation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}