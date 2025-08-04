import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db-query-builder'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    const scans = await query('flickr_scan_results')
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(Math.min(limit, 50))
      .offset(offset)
    
    const formattedScans = scans.map(scan => ({
      scanId: scan.scan_id,
      startTime: scan.start_time,
      endTime: scan.end_time,
      photosFound: scan.photos_found,
      photosProcessed: scan.photos_processed,
      photosApproved: scan.photos_approved,
      photosRejected: scan.photos_rejected,
      photosFlagged: scan.photos_flagged,
      duplicatesFound: scan.duplicates_found,
      requestsUsed: scan.requests_used,
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
    console.error('Flickr scans get error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get Flickr scan results',
        details: error.message
      },
      { status: 500 }
    )
  }
}