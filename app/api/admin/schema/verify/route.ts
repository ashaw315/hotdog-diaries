import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('[SchemaVerifyAPI] Starting database schema verification')

    const requiredTables = [
      'system_alerts', 
      'system_logs', 
      'system_metrics',
      'content_queue', 
      'posted_content', 
      'admin_users'
    ]

    const missingTables: string[] = []
    const existingTables: string[] = []

    for (const table of requiredTables) {
      try {
        await db.query(`SELECT 1 FROM ${table} LIMIT 1`)
        existingTables.push(table)
        console.log(`[SchemaVerifyAPI] ✅ Table exists: ${table}`)
      } catch (error) {
        missingTables.push(table)
        console.log(`[SchemaVerifyAPI] ❌ Missing table: ${table}`)
      }
    }

    // Additional table information (non-destructive query)
    let tableInfo: any = {}
    try {
      const tableListResult = await db.query(`
        SELECT table_name, table_type 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `)
      tableInfo = {
        publicTables: tableListResult.rows.map(row => row.table_name),
        totalPublicTables: tableListResult.rows.length
      }
    } catch (error) {
      console.warn('[SchemaVerifyAPI] Could not query information_schema:', error.message)
    }

    const schemaValid = missingTables.length === 0

    return NextResponse.json({
      success: true,
      schemaValid,
      summary: {
        existingTables: existingTables.length,
        missingTables: missingTables.length,
        totalRequired: requiredTables.length
      },
      existingTables,
      missingTables,
      tableInfo,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[SchemaVerifyAPI] Schema verification failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Schema verification failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}