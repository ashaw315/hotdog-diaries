import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Production Database Table Check')
    
    // Check if posted_content table exists and its structure
    let tablesInfo = []
    
    try {
      // For PostgreSQL (production)
      if (process.env.NODE_ENV === 'production') {
        console.log('📊 Checking PostgreSQL tables...')
        
        // Check if posted_content table exists
        const tableExists = await db.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'posted_content'
          ) as exists
        `)
        
        const postedTableExists = tableExists.rows[0]?.exists
        console.log('📋 posted_content table exists:', postedTableExists)
        
        // Get table structure
        const tableStructure = await db.query(`
          SELECT 
            table_name,
            column_name,
            data_type,
            is_nullable
          FROM information_schema.columns 
          WHERE table_name IN ('content_queue', 'posted_content')
          AND table_schema = 'public'
          ORDER BY table_name, ordinal_position
        `)
        
        tablesInfo = tableStructure.rows
        
        // Test simple query on content_queue
        const contentCount = await db.query('SELECT COUNT(*) as count FROM content_queue')
        const totalContent = contentCount.rows[0]?.count || 0
        
        // Test simple query on posted_content if it exists
        let postedCount = 0
        if (postedTableExists) {
          const postedCountResult = await db.query('SELECT COUNT(*) as count FROM posted_content')
          postedCount = postedCountResult.rows[0]?.count || 0
        }
        
        return NextResponse.json({
          success: true,
          environment: 'production',
          database: 'postgresql',
          tables: {
            posted_content_exists: postedTableExists,
            content_queue_count: totalContent,
            posted_content_count: postedCount,
            structure: tablesInfo
          }
        })
      } else {
        // SQLite development check
        console.log('📊 Checking SQLite tables...')
        
        const contentInfo = await db.query('PRAGMA table_info(content_queue)')
        const postedInfo = await db.query('PRAGMA table_info(posted_content)')
        
        return NextResponse.json({
          success: true,
          environment: 'development', 
          database: 'sqlite',
          tables: {
            content_queue_columns: contentInfo.rows,
            posted_content_columns: postedInfo.rows
          }
        })
      }
      
    } catch (dbError) {
      console.error('❌ Database error:', dbError)
      return NextResponse.json({
        success: false,
        error: 'Database connection or query failed',
        details: dbError instanceof Error ? dbError.message : 'Unknown error',
        environment: process.env.NODE_ENV
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('❌ General error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check tables',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}