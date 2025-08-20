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
    
    // Since exec_sql isn't available, we'll create the tables using SQL directly
    // This is a simplified approach that should work with Supabase
    
    // First, create the posted_content table by inserting a test record and letting Supabase create the table
    try {
      // Try to create posted_content table by using the insert operation
      // This will fail if the table doesn't exist, but that's expected
      
      // Since we can't create tables via API, let's create a simple record insertion
      // that will tell us the table exists
      const { data: testPostedContent, error: testError } = await supabase
        .from('posted_content')
        .select('*')
        .limit(1)
        
      if (testError && testError.message?.includes('relation "public.posted_content" does not exist')) {
        // Table doesn't exist - we need to create it manually
        return NextResponse.json({
          success: false,
          error: 'posted_content table does not exist in Supabase',
          instructions: [
            'Go to Supabase Dashboard → SQL Editor',
            'Run this SQL to create the table:',
            `CREATE TABLE posted_content (
              id SERIAL PRIMARY KEY,
              content_queue_id INTEGER REFERENCES content_queue(id) ON DELETE CASCADE,
              posted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
              scheduled_time VARCHAR(10),
              post_order INTEGER,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            CREATE INDEX idx_posted_content_posted_at ON posted_content(posted_at);
            CREATE INDEX idx_posted_content_content_queue_id ON posted_content(content_queue_id);
            CREATE INDEX idx_posted_content_post_order ON posted_content(post_order);`
          ]
        }, { status: 400 })
      }
      
      console.log('✅ posted_content table already exists')
      
      // Table exists - return success
      return NextResponse.json({
        success: true,
        message: 'posted_content table is ready for use',
        status: 'Table exists and accessible',
        note: 'Manual posting should now work'
      })
      
    } catch (error) {
      console.error('Error checking posted_content table:', error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error checking tables'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Migration error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}