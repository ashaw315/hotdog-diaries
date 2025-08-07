import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const logs = await db.query(`
      SELECT created_at, log_level, message, component, metadata 
      FROM system_logs 
      ORDER BY created_at DESC 
      LIMIT 20
    `)
    
    return NextResponse.json({
      success: true,
      logs: logs.rows
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}