import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyTableColumns, verifyAdminSchema } from '@/lib/db-schema-utils'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('[SchemaVerifyAPI] Starting comprehensive database schema verification')

    const requiredTables = [
      'content_queue', 
      'posted_content', 
      'admin_users',
      'system_alerts', 
      'system_logs', 
      'system_metrics'
    ]

    const tableDetails: Record<string, any> = {}
    const missingTables: string[] = []
    const existingTables: string[] = []
    const columnIssues: Record<string, string[]> = {}

    // Check each table and its columns
    for (const table of requiredTables) {
      try {
        const columns = await verifyTableColumns(table)
        
        if (columns.length === 0) {
          // Table doesn't exist
          missingTables.push(table)
          console.log(`[SchemaVerifyAPI] ❌ Missing table: ${table}`)
        } else {
          existingTables.push(table)
          tableDetails[table] = {
            columnCount: columns.length,
            columns: columns
          }
          console.log(`[SchemaVerifyAPI] ✅ Table exists: ${table} (${columns.length} columns)`)
          
          // Check for critical columns
          const criticalColumns: Record<string, string[]> = {
            content_queue: ['id', 'content_text', 'content_type', 'source_platform'],
            posted_content: ['id', 'content_queue_id', 'posted_at'],
            admin_users: ['id', 'username', 'password_hash']
          }
          
          if (criticalColumns[table]) {
            const missing = criticalColumns[table].filter(col => !columns.includes(col))
            if (missing.length > 0) {
              columnIssues[table] = missing
              console.log(`[SchemaVerifyAPI] ⚠️  Missing critical columns in ${table}: ${missing.join(', ')}`)
            }
          }
        }
      } catch (error: any) {
        console.error(`[SchemaVerifyAPI] Error checking table ${table}:`, error.message)
        missingTables.push(table)
      }
    }

    // Get comprehensive schema validation
    const schemaValidation = await verifyAdminSchema()

    // Additional table information (non-destructive query)
    let allTables: string[] = []
    try {
      const isPostgres = process.env.DATABASE_URL?.includes('postgres') || 
                         process.env.POSTGRES_URL || 
                         process.env.NODE_ENV === 'production'
      
      if (isPostgres) {
        const tableListResult = await db.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          ORDER BY table_name
        `)
        allTables = tableListResult.rows.map((row: any) => row.table_name)
      } else {
        // SQLite
        const tableListResult = await db.query(`
          SELECT name FROM sqlite_master 
          WHERE type='table' 
          ORDER BY name
        `)
        allTables = tableListResult.rows.map((row: any) => row.name)
      }
    } catch (error: any) {
      console.warn('[SchemaVerifyAPI] Could not list all tables:', error.message)
    }

    const schemaValid = missingTables.length === 0 && Object.keys(columnIssues).length === 0

    return NextResponse.json({
      success: true,
      schemaValid,
      summary: {
        existingTables: existingTables.length,
        missingTables: missingTables.length,
        totalRequired: requiredTables.length,
        tablesWithColumnIssues: Object.keys(columnIssues).length,
        totalTablesInDatabase: allTables.length
      },
      existingTables,
      missingTables,
      columnIssues,
      tableDetails,
      allTablesInDatabase: allTables,
      validation: schemaValidation,
      recommendations: schemaValidation.recommendations,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('[SchemaVerifyAPI] Schema verification failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Schema verification failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: error?.code,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}