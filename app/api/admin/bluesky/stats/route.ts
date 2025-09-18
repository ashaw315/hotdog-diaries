import { NextResponse } from 'next/server'
import { blueskyService } from '@/lib/services/bluesky-scanning'
import { db } from '@/lib/db'

export async function GET() {
  try {
    console.log('📈 Getting Bluesky statistics...')
    
    // Get basic stats from service
    const stats = await blueskyService.getScanningStats()
    
    // Get detailed database statistics
    const detailedStats = await db.query(`
      SELECT 
        COUNT(*) as total_posts,
        COUNT(*) FILTER (WHERE content_status = 'approved') as approved_posts,
        COUNT(*) FILTER (WHERE content_status = 'rejected') as rejected_posts,
        COUNT(*) FILTER (WHERE content_status = 'pending_review') as pending_posts,
        COUNT(*) FILTER (WHERE content_type = 'text') as text_posts,
        COUNT(*) FILTER (WHERE content_type = 'image') as image_posts,
        COUNT(*) FILTER (WHERE content_type = 'video') as video_posts,
        COUNT(*) FILTER (WHERE content_type = 'mixed') as mixed_posts,
        AVG(LENGTH(content_text)) as avg_text_length,
        MIN(scraped_at) as first_post_time,
        MAX(scraped_at) as last_post_time
      FROM content_queue 
      WHERE source_platform = 'bluesky'
      AND scraped_at >= NOW() - INTERVAL '$1 days'
    `)

    // Get hourly breakdown for the last 24 hours
    const hourlyStats = await db.query(`
      SELECT 
        DATE_TRUNC('hour', scraped_at) as hour,
        COUNT(*) as posts_count,
        COUNT(*) FILTER (WHERE content_status = 'approved') as approved_count
      FROM content_queue 
      WHERE source_platform = 'bluesky'
      AND scraped_at >= NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', scraped_at)
      ORDER BY hour DESC
    `)

    const dbStats = detailedStats.rows[0]
    
    const enrichedStats = {
      // Basic stats
      totalPostsFound: parseInt(String(dbStats.total_posts)) || 0,
      postsProcessed: parseInt(String(dbStats.total_posts)) || 0,
      postsApproved: parseInt(String(dbStats.approved_posts)) || 0,
      postsRejected: parseInt(String(dbStats.rejected_posts)) || 0,
      postsPending: parseInt(String(dbStats.pending_posts)) || 0,
      
      // Content type breakdown
      contentTypes: {
        text: parseInt(String(dbStats.text_posts)) || 0,
        image: parseInt(String(dbStats.image_posts)) || 0,
        video: parseInt(String(dbStats.video_posts)) || 0,
        mixed: parseInt(String(dbStats.mixed_posts)) || 0
      },
      
      // Performance metrics
      successRate: stats.successRate,
      approvalRate: parseInt(String(dbStats.total_posts)) > 0 ? 
        (parseInt(String(dbStats.approved_posts)) / parseInt(String(dbStats.total_posts))) : 0,
      
      // Time-based stats
      timeRange: {
        firstPost: dbStats.first_post_time,
        lastPost: dbStats.last_post_time,
        lastScanTime: stats.lastScanTime,
        nextScanTime: stats.nextScanTime
      },
      
      // Content quality metrics
      averageTextLength: Math.round(parseFloat(String(dbStats.avg_text_length)) || 0),
      
      // Hourly breakdown
      hourlyActivity: hourlyStats.rows.map((row: any) => ({
        hour: row.hour,
        postsFound: parseInt(String(row.posts_count)),
        postsApproved: parseInt(String(row.approved_count)),
        approvalRate: parseInt(String(row.posts_count)) > 0 ? 
          (parseInt(String(row.approved_count)) / parseInt(String(row.posts_count))) : 0
      })),
      
      // Health indicators
      healthMetrics: {
        isActive: stats.totalPostsFound > 0,
        recentActivity: hourlyStats.rows.length > 0,
        contentDiversity: Object.values({
          text: parseInt(String(dbStats.text_posts)) || 0,
          image: parseInt(String(dbStats.image_posts)) || 0,
          video: parseInt(String(dbStats.video_posts)) || 0,
          mixed: parseInt(String(dbStats.mixed_posts)) || 0
        }).filter(count => count > 0).length
      }
    }

    console.log(`✅ Bluesky stats retrieved: ${enrichedStats.totalPostsFound} total posts`)
    
    return NextResponse.json({
      success: true,
      data: enrichedStats
    })

  } catch (error) {
    console.error('Error getting Bluesky statistics:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get Bluesky statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}