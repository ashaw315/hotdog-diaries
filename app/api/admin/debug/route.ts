import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Admin Debug - Testing database tables and schema')
    
    const results: any = {
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    }
    
    // Test 1: Check if content_queue table exists
    try {
      const contentQueueTest = await db.query('SELECT COUNT(*) as count FROM content_queue LIMIT 1')
      results.content_queue = {
        exists: true,
        count: contentQueueTest.rows[0]?.count || 0
      }
      console.log('✅ content_queue table exists')
    } catch (error) {
      results.content_queue = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      console.log('❌ content_queue table error:', error)
    }
    
    // Test 2: Check if posts table exists
    try {
      const postsTest = await db.query('SELECT COUNT(*) as count FROM posts LIMIT 1')
      results.posts_table = {
        exists: true,
        count: postsTest.rows[0]?.count || 0
      }
      console.log('✅ posts table exists')
    } catch (error) {
      results.posts_table = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      console.log('❌ posts table error:', error)
    }
    
    // Test 3: Check if posted_content table exists  
    try {
      const postedContentTest = await db.query('SELECT COUNT(*) as count FROM posted_content LIMIT 1')
      results.posted_content_table = {
        exists: true,
        count: postedContentTest.rows[0]?.count || 0
      }
      console.log('✅ posted_content table exists')
    } catch (error) {
      results.posted_content_table = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      console.log('❌ posted_content table error:', error)
    }
    
    // Test 4: Simple content_queue query (if table exists)
    if (results.content_queue?.exists) {
      try {
        const sampleContent = await db.query(`
          SELECT id, content_text, source_platform, is_posted, is_approved 
          FROM content_queue 
          ORDER BY created_at DESC 
          LIMIT 3
        `)
        results.sample_content = sampleContent.rows
        console.log('✅ Sample content query successful')
      } catch (error) {
        results.sample_content_error = error instanceof Error ? error.message : 'Unknown error'
        console.log('❌ Sample content query failed:', error)
      }
    }
    
    // Test 5: Check content_queue schema
    if (results.content_queue?.exists) {
      try {
        const schemaQuery = process.env.NODE_ENV === 'production' 
          ? `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'content_queue'
            ORDER BY ordinal_position
          `
          : `PRAGMA table_info(content_queue)`
        
        const schemaResult = await db.query(schemaQuery)
        results.content_queue_schema = schemaResult.rows.slice(0, 10) // Limit output
        console.log('✅ content_queue schema retrieved')
      } catch (error) {
        results.schema_error = error instanceof Error ? error.message : 'Unknown error'
        console.log('❌ Schema check failed:', error)
      }
    }
    
    return NextResponse.json({
      success: true,
      debug: results
    })
    
  } catch (error) {
    console.error('❌ Admin debug failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}