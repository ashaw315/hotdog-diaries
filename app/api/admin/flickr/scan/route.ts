import { NextRequest, NextResponse } from 'next/server'
import { flickrScanningService } from '@/lib/services/flickr-scanning'

export async function POST(request: NextRequest) {
  try {
    const result = await flickrScanningService.performScan()
    
    return NextResponse.json({
      success: true,
      data: {
        scanId: result.scanId,
        startTime: result.startTime.toISOString(),
        endTime: result.endTime.toISOString(),
        photosFound: result.photosFound,
        photosProcessed: result.photosProcessed,
        photosApproved: result.photosApproved,
        photosRejected: result.photosRejected,
        photosFlagged: result.photosFlagged,
        duplicatesFound: result.duplicatesFound,
        requestsUsed: result.requestsUsed,
        searchTermsUsed: result.searchTermsUsed,
        errors: result.errors,
        nextScanTime: result.nextScanTime?.toISOString(),
        highestViewedPhoto: result.highestViewedPhoto
      }
    })

  } catch (error) {
    console.error('Flickr scan error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Flickr scan failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}