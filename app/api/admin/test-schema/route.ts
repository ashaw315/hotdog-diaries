import { NextRequest, NextResponse } from 'next/server'
import { verifyTableColumns, buildSafeSelectClause } from '@/lib/db-schema-utils'
import { db } from '@/lib/db'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('[TestSchemaAPI] Testing schema utilities in production')
    
    // Test column detection
    const contentQueueColumns = await verifyTableColumns('content_queue')
    const postedContentColumns = await verifyTableColumns('posted_content')
    
    // Test safe SELECT clause generation
    const desiredColumns = [
      'id', 
      'content_text', 
      'admin_notes', // This column might not exist
      'confidence_score',
      'non_existent_column' // This definitely doesn't exist
    ]
    
    const safeSelect = await buildSafeSelectClause('content_queue', desiredColumns, 'cq')
    
    // Try a simple query with the safe select
    let testQueryResult = null
    try {
      const testQuery = `SELECT ${safeSelect} FROM content_queue cq LIMIT 1`
      const result = await db.query(testQuery)
      testQueryResult = {
        success: true,
        rowCount: result.rows.length,
        firstRow: result.rows[0] || null
      }
    } catch (err: any) {
      testQueryResult = {
        success: false,
        error: err.message,
        code: err.code
      }
    }
    
    return NextResponse.json({
      success: true,
      schemaInfo: {
        contentQueueColumns: {
          count: contentQueueColumns.length,
          hasAdminNotes: contentQueueColumns.includes('admin_notes'),
          hasConfidenceScore: contentQueueColumns.includes('confidence_score'),
          sample: contentQueueColumns.slice(0, 5)
        },
        postedContentColumns: {
          count: postedContentColumns.length,
          sample: postedContentColumns.slice(0, 5)
        }
      },
      safeSelectTest: {
        desiredColumns,
        generatedClause: safeSelect,
        queryTest: testQueryResult
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasPostgresUrl: Boolean(process.env.POSTGRES_URL),
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL)
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('[TestSchemaAPI] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error?.code,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}