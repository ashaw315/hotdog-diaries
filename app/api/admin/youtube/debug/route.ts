import { NextRequest, NextResponse } from 'next/server'
import { youtubeScanningService } from '@/lib/services/youtube-scanning'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    console.log('[YOUTUBE] Debug endpoint called')
    
    // Test API connection
    const connectionTest = await youtubeScanningService.testConnection()
    
    // Get database statistics
    const [youtubeCountResult, recentYoutubeResult, mockCountResult] = await Promise.all([
      db.query(`
        SELECT COUNT(*) as total_count 
        FROM content_queue 
        WHERE source_platform = 'youtube'
      `),
      db.query(`
        SELECT id, content_video_url, content_text, created_at
        FROM content_queue 
        WHERE source_platform = 'youtube' 
        ORDER BY created_at DESC 
        LIMIT 5
      `),
      db.query(`
        SELECT COUNT(*) as mock_count 
        FROM content_queue 
        WHERE source_platform = 'youtube' 
        AND (content_video_url LIKE '%placeholder%' OR content_video_url LIKE '%mock%')
      `)
    ])

    const debugInfo = {
      timestamp: new Date().toISOString(),
      
      // Environment check
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        hasYouTubeApiKey: !!process.env.YOUTUBE_API_KEY,
        apiKeyLength: process.env.YOUTUBE_API_KEY?.length || 0,
        apiKeyPreview: process.env.YOUTUBE_API_KEY ? 
          process.env.YOUTUBE_API_KEY.substring(0, 10) + '...' : 'NOT_FOUND'
      },
      
      // API connection test
      connectionTest,
      
      // Database statistics
      database: {
        totalYouTubeVideos: parseInt(youtubeCountResult.rows[0]?.total_count || '0'),
        mockVideosRemaining: parseInt(mockCountResult.rows[0]?.mock_count || '0'),
        recentVideos: recentYoutubeResult.rows.map(row => ({
          id: row.id,
          url: row.content_video_url,
          text: row.content_text?.substring(0, 100) + '...',
          createdAt: row.created_at,
          isMock: row.content_video_url?.includes('placeholder') || row.content_video_url?.includes('mock')
        }))
      },
      
      // Health checks
      healthChecks: {
        apiKeyLoaded: !!process.env.YOUTUBE_API_KEY,
        connectionSuccessful: connectionTest.success,
        hasMockData: parseInt(mockCountResult.rows[0]?.mock_count || '0') > 0,
        hasRealData: parseInt(youtubeCountResult.rows[0]?.total_count || '0') > parseInt(mockCountResult.rows[0]?.mock_count || '0')
      }
    }

    return NextResponse.json({
      success: true,
      data: debugInfo
    })

  } catch (error) {
    console.error('[YOUTUBE] Debug endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: 'Debug information retrieval failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}