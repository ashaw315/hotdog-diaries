import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('🧩 [DEBUG] Scheduled content diagnostic endpoint called')
    
    const result = await db.query(`
      SELECT id, source_platform, status, scheduled_for, content_text, is_approved, is_posted
      FROM content_queue 
      WHERE status = 'scheduled'
      ORDER BY scheduled_for ASC
    `)
    
    const rows = result.rows
    
    console.log('🧩 [DEBUG] Direct DB query results:', {
      count: rows.length,
      sample: rows[0] || 'No rows found'
    })
    
    return NextResponse.json({ 
      success: true,
      count: rows.length, 
      rows,
      message: `Found ${rows.length} scheduled content items`
    })
  } catch (error) {
    console.error('🧩 [DEBUG] Diagnostic endpoint error:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message,
      count: 0,
      rows: []
    }, { status: 500 })
  }
}