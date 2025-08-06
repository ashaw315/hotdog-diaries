import { NextRequest, NextResponse } from 'next/server'
import { NextAuthUtils } from '@/lib/auth'
import { automatedPostingService } from '@/lib/services/automated-posting'
import { db, logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const authResult = await NextAuthUtils.verifyRequestAuth(request)
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      contentIds, 
      mode = 'immediate',
      maxItems = 1,
      platformBalance = true,
      qualityThreshold = 0.6 
    } = body

    await logToDatabase(
      LogLevel.INFO,
      'Manual posting triggered',
      'AdminAPI',
      { 
        user: authResult.user.username,
        mode,
        contentIds: contentIds?.length ? contentIds : 'auto-select',
        maxItems
      }
    )

    let selectedContent
    let results = []

    if (contentIds && contentIds.length > 0) {
      // Post specific content items
      const contentQuery = `
        SELECT * FROM content_queue 
        WHERE id = ANY($1) 
        AND content_status IN ('approved', 'scheduled')
      `
      const contentResult = await db.query(contentQuery, [contentIds])
      selectedContent = contentResult.rows

      if (selectedContent.length === 0) {
        return NextResponse.json({ 
          error: 'No valid content found with provided IDs',
          validStatuses: ['approved', 'scheduled']
        }, { status: 400 })
      }

      // Post each selected item
      for (const content of selectedContent) {
        const result = await automatedPostingService.postContent(content)
        results.push(result)
      }

    } else {
      // Auto-select content based on criteria
      selectedContent = await automatedPostingService.selectContentForPosting({
        maxItems,
        platformBalance,
        qualityThreshold,
        avoidRecentDuplicates: true,
        recentHours: 24
      })

      if (selectedContent.length === 0) {
        return NextResponse.json({ 
          error: 'No suitable content found for posting',
          suggestion: 'Try lowering quality threshold or check if approved content is available'
        }, { status: 404 })
      }

      // Post selected content
      for (const content of selectedContent) {
        const result = await automatedPostingService.postContent(content)
        results.push(result)
      }
    }

    const successCount = results.filter(r => r.success).length
    const stats = await automatedPostingService.getPostingStats()

    await logToDatabase(
      LogLevel.INFO,
      `Manual posting completed: ${successCount}/${results.length} successful`,
      'AdminAPI',
      { 
        user: authResult.user.username,
        results: results.length,
        successful: successCount,
        contentIds: results.map(r => r.contentId)
      }
    )

    return NextResponse.json({
      success: true,
      results: results.length,
      successful: successCount,
      failed: results.length - successCount,
      posts: results.map(r => ({
        contentId: r.contentId,
        platform: r.platform,
        contentType: r.contentType,
        success: r.success,
        error: r.error,
        postedAt: r.postedAt
      })),
      stats: {
        todayPosts: stats.todayPosts,
        nextPostTime: stats.nextPostTime,
        queueHealth: stats.queueHealth
      }
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Manual posting failed',
      'AdminAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json(
      { error: 'Manual posting failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await NextAuthUtils.verifyRequestAuth(request)
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get posting statistics and queue health
    const stats = await automatedPostingService.getPostingStats()
    const currentMealTime = automatedPostingService.getCurrentMealTime()
    const nextMealTime = automatedPostingService.getNextMealTime()

    // Get recent posts
    const recentPostsQuery = `
      SELECT 
        p.*,
        cq.source_platform,
        cq.original_author
      FROM posts p
      JOIN content_queue cq ON p.content_queue_id = cq.id
      ORDER BY p.posted_at DESC
      LIMIT 10
    `
    const recentPostsResult = await db.query(recentPostsQuery)

    // Get available content for manual posting
    const availableContentQuery = `
      SELECT 
        cq.*,
        ca.confidence_score
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
      WHERE cq.content_status IN ('approved', 'scheduled')
      ORDER BY ca.confidence_score DESC NULLS LAST, cq.created_at DESC
      LIMIT 20
    `
    const availableContentResult = await db.query(availableContentQuery)

    return NextResponse.json({
      stats,
      currentMealTime,
      nextMealTime,
      recentPosts: recentPostsResult.rows,
      availableContent: availableContentResult.rows,
      mealTimes: [
        { hour: 7, minute: 0, name: 'breakfast' },
        { hour: 12, minute: 0, name: 'lunch' },
        { hour: 15, minute: 0, name: 'snack' },
        { hour: 18, minute: 0, name: 'dinner' },
        { hour: 20, minute: 0, name: 'evening' },
        { hour: 22, minute: 0, name: 'late_night' }
      ]
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Failed to fetch manual posting data',
      'AdminAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json(
      { error: 'Failed to fetch posting data' },
      { status: 500 }
    )
  }
}