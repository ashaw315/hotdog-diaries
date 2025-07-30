import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db-query-builder'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { RedditScanResult } from '@/lib/services/reddit-scanning'

export async function GET(request: NextRequest) {
  try {
    // TODO: Add authentication check here
    // const auth = await verifyAdminAuth(request)
    // if (!auth.success) {
    //   return NextResponse.json(
    //     { success: false, error: 'Unauthorized' },
    //     { status: 401 }
    //   )
    // }

    // Get query parameters for pagination
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    // Validate parameters
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Limit must be between 1 and 100',
          message: 'Invalid pagination parameters'
        },
        { status: 400 }
      )
    }

    if (offset < 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Offset cannot be negative',
          message: 'Invalid pagination parameters'
        },
        { status: 400 }
      )
    }

    // Get scan history from database
    const scanResults = await query('reddit_scan_results')
      .select([
        'scan_id',
        'start_time',
        'end_time',
        'posts_found',
        'posts_processed',
        'posts_approved',
        'posts_rejected',
        'posts_flagged',
        'duplicates_found',
        'subreddits_scanned',
        'highest_score',
        'errors',
        'rate_limit_hit',
        'created_at'
      ])
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)

    // Get total count for pagination
    const totalCountResult = await query('reddit_scan_results')
      .count('*')
      .first()
    
    const totalCount = parseInt(totalCountResult?.count || '0')

    // Transform database results to match RedditScanResult interface
    const history: RedditScanResult[] = scanResults.map((row: any) => ({
      scanId: row.scan_id,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      postsFound: row.posts_found,
      postsProcessed: row.posts_processed,
      postsApproved: row.posts_approved,
      postsRejected: row.posts_rejected,
      postsFlagged: row.posts_flagged,
      duplicatesFound: row.duplicates_found,
      errors: Array.isArray(row.errors) ? row.errors : [],
      rateLimitHit: row.rate_limit_hit,
      subredditsScanned: Array.isArray(row.subreddits_scanned) ? row.subreddits_scanned : [],
      highestScoredPost: row.highest_score > 0 ? {
        id: 'unknown',
        title: 'Unknown',
        score: row.highest_score,
        subreddit: 'unknown'
      } : undefined
    }))

    return NextResponse.json({
      success: true,
      data: history,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount
      },
      message: 'Scan history retrieved successfully'
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await logToDatabase(
      LogLevel.ERROR,
      'REDDIT_SCAN_HISTORY_GET_ERROR',
      `Failed to get Reddit scan history: ${errorMessage}`,
      { error: errorMessage }
    )

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Failed to retrieve scan history'
      },
      { status: 500 }
    )
  }
}