import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Create table if it doesn't exist
async function ensureVideoErrorsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS video_playback_errors (
      id SERIAL PRIMARY KEY,
      platform VARCHAR(50) NOT NULL,
      url TEXT NOT NULL,
      error_type VARCHAR(100) NOT NULL,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT NOW()
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
    
    const { platform, url, error } = await request.json()
    
    const userAgent = request.headers.get('user-agent')
    
    await db.query(`
      INSERT INTO video_playback_errors (platform, url, error_type, user_agent, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [platform, url, error, userAgent])
    
    console.log(`[VIDEO ERROR] ${platform}: ${error} - ${url}`)
    
    return NextResponse.json({ 
      success: true, 
      logged: true,
      timestamp: new Date().toISOString() 
    })
    
  } catch (error) {
    console.error('[VIDEO ERROR TRACKING] Failed to log error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to log video error' 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureVideoErrorsTable()
    
    const url = new URL(request.url)
    const hours = parseInt(url.searchParams.get('hours') || '1')
    
    const [errorSummary, recentErrors] = await Promise.all([
      db.query(`
        SELECT 
          platform, 
          COUNT(*) as error_count,
          array_agg(DISTINCT error_type) as error_types,
          array_agg(DISTINCT LEFT(url, 80)) as sample_urls
        FROM video_playback_errors
        WHERE created_at > NOW() - INTERVAL '${hours} hours'
        GROUP BY platform
        ORDER BY error_count DESC
      `),
      
      db.query(`
        SELECT platform, url, error_type, created_at
        FROM video_playback_errors
        WHERE created_at > NOW() - INTERVAL '${hours} hours'
        ORDER BY created_at DESC
        LIMIT 20
      `)
    ])
    
    return NextResponse.json({
      success: true,
      data: {
        timeWindow: `${hours} hours`,
        summary: errorSummary.rows,
        recentErrors: recentErrors.rows,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get video errors',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}