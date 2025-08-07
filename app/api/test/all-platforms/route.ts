import { NextRequest, NextResponse } from 'next/server'
import { lemmyScanningService } from '@/lib/services/lemmy-scanning'
import { imgurScanningService } from '@/lib/services/imgur-scanning'
import { tumblrScanningService } from '@/lib/services/tumblr-scanning'
import { pixabayScanningService } from '@/lib/services/pixabay-scanning'

export async function GET(request: NextRequest) {
  try {
    console.log('🌐 Testing all user-generated content platforms...')
    
    // Test all new platforms with smaller limits to avoid overwhelming
    const platformTests = await Promise.allSettled([
      lemmyScanningService.performScan({ maxPosts: 3 }),
      imgurScanningService.performScan({ maxPosts: 3 }),
      tumblrScanningService.performScan({ maxPosts: 3 }),
      pixabayScanningService.performScan({ maxPosts: 3 })
    ])

    const results = {
      lemmy: platformTests[0].status === 'fulfilled' ? platformTests[0].value : { error: platformTests[0].reason },
      imgur: platformTests[1].status === 'fulfilled' ? platformTests[1].value : { error: platformTests[1].reason },
      tumblr: platformTests[2].status === 'fulfilled' ? platformTests[2].value : { error: platformTests[2].reason },
      pixabay: platformTests[3].status === 'fulfilled' ? platformTests[3].value : { error: platformTests[3].reason }
    }

    // Summarize results
    const summary = {
      totalPlatforms: 4,
      workingPlatforms: Object.values(results).filter(r => !r.error).length,
      totalFound: Object.values(results).reduce((sum, r) => sum + (r.totalFound || 0), 0),
      totalProcessed: Object.values(results).reduce((sum, r) => sum + (r.processed || 0), 0),
      totalApproved: Object.values(results).reduce((sum, r) => sum + (r.approved || 0), 0)
    }

    // Get final database counts
    const { db } = await import('@/lib/db')
    const countQuery = `
      SELECT 
        source_platform,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_approved = true) as approved,
        COUNT(*) FILTER (WHERE is_approved = false) as rejected
      FROM content_queue 
      WHERE source_platform IN ('lemmy', 'imgur', 'tumblr', 'pixabay')
      GROUP BY source_platform
      ORDER BY source_platform
    `
    const dbCounts = await db.query(countQuery)

    return NextResponse.json({
      success: true,
      message: `All platforms test completed - ${summary.workingPlatforms}/${summary.totalPlatforms} working`,
      timestamp: new Date().toISOString(),
      summary,
      results,
      databaseCounts: dbCounts.rows
    })

  } catch (error) {
    console.error('❌ All platforms test failed:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error
      },
      { status: 500 }
    )
  }
}