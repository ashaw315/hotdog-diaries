import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Create table if it doesn't exist
async function ensureVideoErrorsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS video_playback_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      url TEXT NOT NULL,
      error_type TEXT NOT NULL,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_video_errors_platform ON video_playback_errors(platform)
  `)
  
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_video_errors_created_at ON video_playback_errors(created_at)
  `)
}

export async function POST(request: NextRequest) {
  try {
    await ensureVideoErrorsTable()
    
    const body = await request.json()
    console.log('[VIDEO ERROR]', body)
    
    const userAgent = request.headers.get('user-agent')
    
    // Log to database without auth
    await db.query(`
      INSERT INTO video_playback_errors (platform, url, error_type, user_agent, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `, [body.platform || 'unknown', body.url, body.errorType, userAgent])
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Error logging failed:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}