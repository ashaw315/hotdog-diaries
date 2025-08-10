import { NextRequest, NextResponse } from 'next/server'
import { PostingScheduler } from '@/lib/services/posting-scheduler'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    
    // Get basic posting stats
    const stats = await PostingScheduler.getPostingStats()
    
    // Get additional detailed information
    const [
      pendingContentResult,
      recentPostsResult,
      postingHistoryResult,
      scheduledPostsResult
    ] = await Promise.all([
      // Count of pending approved content
      db.query(`
        SELECT COUNT(*) as count 
        FROM content_queue 
        WHERE is_approved = true AND is_posted = false
          AND (posting_attempt_count < 3 OR posting_attempt_count IS NULL)
      `),
      
      // Recent posts (last 24 hours)
      db.query(`
        SELECT 
          id, source_platform, content_type, posted_at,
          SUBSTRING(content_text, 1, 100) as preview
        FROM content_queue 
        WHERE is_posted = true 
          AND posted_at > NOW() - INTERVAL '24 hours'
        ORDER BY posted_at DESC
        LIMIT 10
      `),
      
      // Posting history from posting_history table
      db.query(`
        SELECT 
          ph.posted_at, ph.platform, ph.success, ph.response_data,
          cq.content_type
        FROM posting_history ph
        LEFT JOIN content_queue cq ON ph.content_queue_id = cq.id
        ORDER BY ph.posted_at DESC
        LIMIT 5
      `),
      
      // Scheduled posts
      db.query(`
        SELECT 
          ps.id, ps.scheduled_for, ps.status, ps.failure_reason,
          cq.source_platform, cq.content_type
        FROM posting_schedule ps
        LEFT JOIN content_queue cq ON ps.content_queue_id = cq.id
        WHERE ps.status IN ('pending', 'failed')
        ORDER BY ps.scheduled_for ASC
        LIMIT 10
      `)
    ])

    const response = {
      success: true,
      timestamp: now.toISOString(),
      
      // Current status
      currentStatus: {
        time: now.toISOString(),
        hour: now.getUTCHours(),
        minutes: now.getUTCMinutes(),
        isWithinPostingWindow: PostingScheduler.isWithinPostingWindow(now),
        hasPostedRecently: await PostingScheduler.hasPostedRecently(),
        nextScheduledTime: PostingScheduler.getNextScheduledTime(now).toISOString()
      },
      
      // Statistics
      statistics: {
        lastPostTime: stats.lastPostTime,
        lastPostPlatform: stats.lastPostPlatform,
        postsToday: stats.postsToday,
        postsLast24Hours: stats.postsLast24Hours,
        targetPostsPerDay: stats.postsPerDay,
        remainingPostsToday: Math.max(0, stats.postsPerDay - stats.postsToday)
      },
      
      // Content queue health
      queueStatus: {
        pendingContent: parseInt(pendingContentResult.rows[0]?.count || '0'),
        recentPosts: recentPostsResult.rows.map(row => ({
          id: row.id,
          platform: row.source_platform,
          contentType: row.content_type,
          postedAt: row.posted_at,
          preview: row.preview + '...'
        }))
      },
      
      // Posting history
      recentHistory: postingHistoryResult.rows.map(row => ({
        postedAt: row.posted_at,
        platform: row.platform,
        contentType: row.content_type,
        success: row.success,
        responseData: row.response_data
      })),
      
      // Scheduled posts
      scheduledPosts: scheduledPostsResult.rows.map(row => ({
        id: row.id,
        scheduledFor: row.scheduled_for,
        status: row.status,
        platform: row.source_platform,
        contentType: row.content_type,
        failureReason: row.failure_reason
      })),
      
      // System health indicators
      healthChecks: {
        databaseConnected: true,
        postingSchedulerActive: true,
        queueHasContent: parseInt(pendingContentResult.rows[0]?.count || '0') > 0,
        recentPostingActivity: stats.postsLast24Hours > 0
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to get posting status',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      
      // Minimal fallback status
      healthChecks: {
        databaseConnected: false,
        postingSchedulerActive: false,
        queueHasContent: false,
        recentPostingActivity: false
      }
    }, { status: 500 })
  }
}