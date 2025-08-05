import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // In a real implementation, this would load from database
    // For now, return sample scan results
    const sampleScans = [
      {
        scanId: 'unsplash_sample_1',
        startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        endTime: new Date(Date.now() - 2 * 60 * 60 * 1000 + 30000).toISOString(), // 30 seconds later
        photosFound: 15,
        photosProcessed: 12,
        photosApproved: 8,
        photosRejected: 3,
        photosFlagged: 1,
        duplicatesFound: 0,
        requestsUsed: 3,
        searchTermsUsed: ['hotdog', 'frankfurter'],
        highestRatedPhoto: {
          id: 'sample123',
          description: 'Gourmet hotdog with artisanal toppings',
          likes: 245,
          downloads: 1250,
          photographerName: 'Food Photographer'
        }
      }
    ]

    return NextResponse.json({
      success: true,
      data: {
        scans: sampleScans.slice(0, limit),
        totalScans: sampleScans.length
      },
      message: 'Recent Unsplash scans retrieved successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Unsplash scans error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get scan history',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}