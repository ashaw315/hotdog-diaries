import { NextRequest, NextResponse } from 'next/server'
import { db, logToDatabase } from '@/lib/db'
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

    // Ensure table exists (SQLite compatible)
    await db.query(`
      CREATE TABLE IF NOT EXISTS reddit_scan_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_id TEXT UNIQUE NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        posts_found INTEGER DEFAULT 0,
        posts_processed INTEGER DEFAULT 0,
        posts_approved INTEGER DEFAULT 0,
        posts_rejected INTEGER DEFAULT 0,
        posts_flagged INTEGER DEFAULT 0,
        duplicates_found INTEGER DEFAULT 0,
        subreddits_scanned TEXT DEFAULT '[]',
        highest_score INTEGER DEFAULT 0,
        errors TEXT DEFAULT '[]',
        rate_limit_hit BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT (NOW())
      )
    `)

    // Get scan history from database
    const scanResults = await db.query(`
      SELECT 
        scan_id,
        start_time,
        end_time,
        posts_found,
        posts_processed,
        posts_approved,
        posts_rejected,
        posts_flagged,
        duplicates_found,
        subreddits_scanned,
        highest_score,
        errors,
        rate_limit_hit,
        created_at
      FROM reddit_scan_results
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset])

    // Get total count for pagination
    const totalCountResult = await db.query('SELECT COUNT(*) as count FROM reddit_scan_results')
    const totalCount = parseInt(totalCountResult.rows[0]?.count || '0')

    // Transform database results to match RedditScanResult interface
    const history: RedditScanResult[] = scanResults.rows.map((row: any) => ({
      scanId: row.scan_id,
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      postsFound: row.posts_found || 0,
      postsProcessed: row.posts_processed || 0,
      postsApproved: row.posts_approved || 0,
      postsRejected: row.posts_rejected || 0,
      postsFlagged: row.posts_flagged || 0,
      duplicatesFound: row.duplicates_found || 0,
      errors: row.errors ? JSON.parse(row.errors) : [],
      rateLimitHit: Boolean(row.rate_limit_hit),
      subredditsScanned: row.subreddits_scanned ? JSON.parse(row.subreddits_scanned) : [],
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