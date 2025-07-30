import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db-query-builder'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)

    // Get TikTok scan history
    const scanHistory = await query('tiktok_scan_results')
      .select([
        'scan_id',
        'start_time',
        'end_time',
        'videos_found',
        'videos_processed',
        'videos_approved',
        'videos_rejected',
        'videos_flagged',
        'duplicates_found',
        'keywords_scanned',
        'hashtags_scanned',
        'highest_views',
        'errors',
        'rate_limit_hit',
        'created_at'
      ])
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)

    // Transform the data for API response
    const formattedHistory = scanHistory.map(scan => ({
      scanId: scan.scan_id,
      startTime: scan.start_time,
      endTime: scan.end_time,
      videosFound: scan.videos_found,
      videosProcessed: scan.videos_processed,
      videosApproved: scan.videos_approved,
      videosRejected: scan.videos_rejected,
      videosFlagged: scan.videos_flagged,
      duplicatesFound: scan.duplicates_found,
      keywordsScanned: scan.keywords_scanned || [],
      hashtagsScanned: scan.hashtags_scanned || [],
      highestViews: scan.highest_views,
      errors: scan.errors || [],
      rateLimitHit: scan.rate_limit_hit,
      duration: scan.end_time && scan.start_time 
        ? new Date(scan.end_time).getTime() - new Date(scan.start_time).getTime()
        : 0,
      successRate: scan.videos_processed > 0 
        ? Math.round((scan.videos_approved / scan.videos_processed) * 100)
        : 0,
      createdAt: scan.created_at
    }))

    return NextResponse.json({
      success: true,
      data: formattedHistory,
      pagination: {
        limit,
        offset,
        hasMore: formattedHistory.length === limit
      }
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'TIKTOK_SCAN_HISTORY_API_ERROR',
      `Failed to get TikTok scan history via API: ${error.message}`,
      { error: error.message }
    )

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}