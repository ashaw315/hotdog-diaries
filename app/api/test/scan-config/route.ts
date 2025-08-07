import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Check scan_config table
    const scanConfig = await db.query(`
      SELECT * FROM scan_config ORDER BY created_at DESC LIMIT 1;
    `)

    // Check platform-specific default limits by examining each platform's scan results
    const platformLimits = await db.query(`
      WITH platform_scan_analysis AS (
        SELECT 
          source_platform,
          DATE_TRUNC('hour', scraped_at) as scan_session,
          COUNT(*) as items_in_session,
          MAX(scraped_at) as session_end,
          MIN(scraped_at) as session_start
        FROM content_queue
        WHERE scraped_at > NOW() - INTERVAL '7 days'
        GROUP BY source_platform, DATE_TRUNC('hour', scraped_at)
      )
      SELECT 
        source_platform,
        MAX(items_in_session) as max_items_per_scan,
        AVG(items_in_session) as avg_items_per_scan,
        COUNT(*) as total_scan_sessions
      FROM platform_scan_analysis
      GROUP BY source_platform
      ORDER BY max_items_per_scan DESC;
    `)

    // Check for any reactive scanning triggers by looking at scan patterns vs posting patterns
    const scanVsPost = await db.query(`
      WITH posting_times AS (
        SELECT DATE_TRUNC('hour', posted_at) as post_hour
        FROM content_queue 
        WHERE is_posted = true AND posted_at > NOW() - INTERVAL '7 days'
        GROUP BY DATE_TRUNC('hour', posted_at)
      ),
      scan_times AS (
        SELECT DATE_TRUNC('hour', scraped_at) as scan_hour
        FROM content_queue
        WHERE scraped_at > NOW() - INTERVAL '7 days'
        GROUP BY DATE_TRUNC('hour', scraped_at)
      )
      SELECT 
        'scans' as type, COUNT(*) as count
      FROM scan_times
      UNION ALL
      SELECT 
        'posts' as type, COUNT(*) as count  
      FROM posting_times;
    `)

    // Look at cron configuration
    const cronConfig = {
      scanContent: "0 */4 * * *", // Every 4 hours
      automatedPost: "0 7,12,15,18,20,22 * * *" // 6x daily at meal times
    }

    return NextResponse.json({
      success: true,
      configuration: {
        scanConfig: scanConfig.rows[0] || null,
        platformLimits: platformLimits.rows,
        scanVsPost: scanVsPost.rows,
        cronConfig,
        defaults: {
          platforms: ['reddit', 'mastodon', 'youtube', 'pixabay', 'bluesky', 'lemmy', 'imgur', 'tumblr'],
          frequencyHours: 4,
          maxPostsPerScan: 50
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Scan config error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}