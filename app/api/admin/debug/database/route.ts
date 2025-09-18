import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Database Debug - Starting connectivity test')
    
    // Test basic connectivity
    const testQuery = 'SELECT 1 as test'
    const testResult = await db.query(testQuery)
    console.log('✅ Database connectivity test passed')
    
    // Check if content_queue table exists and has data
    const contentQueueCheck = await db.query(`
      SELECT COUNT(*) as total_content,
             COUNT(CASE WHEN is_posted = true THEN 1 END) as posted_content
      FROM content_queue
    `)
    
    const contentStats = contentQueueCheck.rows[0]
    console.log('📊 Content queue stats:', contentStats)
    
    // Check if posted_content table exists
    let postedContentExists = false
    let postedContentCount = 0
    
    try {
      const postedContentCheck = await db.query('SELECT COUNT(*) as count FROM posted_content')
      postedContentExists = true
      postedContentCount = postedContentCheck.rows[0].count
      console.log('✅ posted_content table exists with', postedContentCount, 'entries')
    } catch (error) {
      console.log('❌ posted_content table check failed:', error instanceof Error ? error.message : 'Unknown error')
    }
    
    // Test the specific JOIN query that's failing
    let joinTestResult = null
    try {
      const joinQuery = `
        SELECT 
          cq.id,
          cq.content_text,
          cq.source_platform,
          pc.posted_at,
          pc.post_order
        FROM content_queue cq
        INNER JOIN posted_content pc ON cq.id = pc.content_queue_id
        ORDER BY pc.posted_at DESC
        LIMIT 5
      `
      joinTestResult = await db.query(joinQuery)
      console.log('✅ JOIN query test passed - found', joinTestResult.rows.length, 'rows')
    } catch (error) {
      console.log('❌ JOIN query test failed:', error instanceof Error ? error.message : 'Unknown error')
    }
    
    // Check table schemas
    let schemaInfo = {}
    try {
      const schemaQuery = process.env.NODE_ENV === 'production' 
        ? `
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name IN ('content_queue', 'posted_content')
          ORDER BY table_name, ordinal_position
        `
        : `
          PRAGMA table_info(content_queue)
        `
      
      const schemaResult = await db.query(schemaQuery)
      schemaInfo = schemaResult.rows
      console.log('📋 Schema info retrieved')
    } catch (error) {
      console.log('⚠️ Schema check failed:', error instanceof Error ? error.message : 'Unknown error')
    }
    
    return NextResponse.json({
      success: true,
      environment: process.env.NODE_ENV,
      database: {
        connectivity: 'OK',
        contentQueueStats: contentStats,
        postedContentExists,
        postedContentCount,
        joinTestRows: joinTestResult?.rows.length || 0,
        schemaInfo: Array.isArray(schemaInfo) ? schemaInfo.slice(0, 10) : 'Unable to retrieve'
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Database debug failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}