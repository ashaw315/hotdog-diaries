import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Authentication is handled by middleware
    // User info is available in headers if needed: x-user-id, x-username

    const url = new URL(request.url)
    const period = url.searchParams.get('period') || '24h'

    let timeFilter = ''
    switch (period) {
      case '1h':
        timeFilter = "AND scraped_at >= NOW() - INTERVAL '1 hour'"
        break
      case '24h':
        timeFilter = "AND scraped_at >= NOW() - INTERVAL '1 day'"
        break
      case '7d':
        timeFilter = "AND scraped_at >= NOW() - INTERVAL '7 days'"
        break
      case '30d':
        timeFilter = "AND scraped_at >= NOW() - INTERVAL '30 days'"
        break
      default:
        timeFilter = "AND scraped_at >= NOW() - INTERVAL '1 day'"
    }

    // Get content statistics for Imgur
    const contentStats = await db.query(`
      SELECT 
        COUNT(*) as total_content,
        COUNT(CASE WHEN is_approved = true THEN 1 END) as approved,
        COUNT(CASE WHEN NOT is_posted AND is_approved = false THEN 1 END) as pending,
        COUNT(CASE WHEN is_posted = true THEN 1 END) as posted
      FROM content_queue 
      WHERE source_platform = 'imgur' ${timeFilter}
    `)

    // Get recent activity
    const recentActivity = await db.query(`
      SELECT 
        DATE_TRUNC('hour', scraped_at) as hour,
        COUNT(*) as posts_found
      FROM content_queue 
      WHERE source_platform = 'imgur' ${timeFilter}
      GROUP BY DATE_TRUNC('hour', scraped_at)
      ORDER BY hour DESC
      LIMIT 24
    `)

    // For now, we'll skip log statistics as the logs table structure is unknown
    const logStats = { rows: [] }

    // Check environment variables status
    const clientId = process.env.IMGUR_CLIENT_ID
    const mode = clientId ? 'api' : 'mock'

    const stats = {
      platform: 'imgur',
      period,
      timestamp: new Date().toISOString(),
      environment: {
        mode,
        hasClientId: Boolean(clientId),
        nodeEnv: process.env.NODE_ENV
      },
      content: {
        total: parseInt(contentStats.rows[0]?.total_content || '0'),
        approved: parseInt(contentStats.rows[0]?.approved || '0'),
        pending: parseInt(contentStats.rows[0]?.pending || '0'),
        posted: parseInt(contentStats.rows[0]?.posted || '0'),
        approvalRate: contentStats.rows[0]?.total_content > 0 
          ? (parseInt(contentStats.rows[0]?.approved || '0') / parseInt(contentStats.rows[0]?.total_content)) * 100 
          : 0
      },
      activity: {
        recentHours: recentActivity.rows.map(row => ({
          hour: row.hour,
          postsFound: parseInt(row.posts_found)
        })),
        totalRecentPosts: recentActivity.rows.reduce((sum, row) => sum + parseInt(row.posts_found), 0)
      },
      logs: {
        byLevel: logStats.rows.reduce((acc, row) => {
          acc[row.level.toLowerCase()] = parseInt(row.count)
          return acc
        }, {} as Record<string, number>),
        total: logStats.rows.reduce((sum, row) => sum + parseInt(row.count), 0)
      }
    }

    return NextResponse.json({
      success: true,
      data: stats,
      message: `Imgur statistics retrieved for ${period} period`
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Failed to retrieve Imgur statistics'
      },
      { status: 500 }
    )
  }
}