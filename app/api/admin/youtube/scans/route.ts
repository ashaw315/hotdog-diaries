import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db-query-builder'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    const scans = await query('youtube_scan_results')
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(Math.min(limit, 50))
      .offset(offset)
    
    const formattedScans = scans.map(scan => ({
      scanId: scan.scan_id,
      startTime: scan.start_time,
      endTime: scan.end_time,
      videosFound: scan.videos_found,
      videosProcessed: scan.videos_processed,
      videosApproved: scan.videos_approved,
      videosRejected: scan.videos_rejected,
      videosFlagged: scan.videos_flagged,
      duplicatesFound: scan.duplicates_found,
      quotaUsed: scan.quota_used,
      searchTermsUsed: scan.search_terms_used,
      highestViews: scan.highest_views,
      errors: scan.errors,
      createdAt: scan.created_at
    }))
    
    return NextResponse.json({
      success: true,
      data: {
        scans: formattedScans,
        pagination: {
          limit,
          offset,
          total: formattedScans.length
        }
      }
    })

  } catch (error) {
    console.error('YouTube scans get error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get YouTube scan results',
        details: error.message
      },
      { status: 500 }
    )
  }
}