import { NextRequest, NextResponse } from 'next/server'
import { socialMediaService } from '@/lib/services/social-media'
import { query } from '@/lib/db-query-builder'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '24h' // 24h, 7d, 30d
    const includeErrors = searchParams.get('includeErrors') === 'true'

    // Calculate time boundaries
    const now = new Date()
    let startTime: Date
    
    switch (timeRange) {
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default: // 24h
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }

    // Get unified stats
    const unifiedStats = await socialMediaService.getUnifiedStats()

    // Get recent scan performance data
    const [redditScans, instagramScans, tiktokScans] = await Promise.all([
      query('reddit_scan_results')
        .select(['end_time', 'posts_found', 'posts_approved', 'errors'])
        .where('end_time', '>=', startTime)
        .orderBy('end_time', 'desc')
        .limit(100),
      
      query('instagram_scan_results')
        .select(['end_time', 'posts_found', 'posts_approved', 'errors'])
        .where('end_time', '>=', startTime)
        .orderBy('end_time', 'desc')
        .limit(100),
      
      query('tiktok_scan_results')
        .select(['end_time', 'videos_found as posts_found', 'videos_approved as posts_approved', 'errors'])
        .where('end_time', '>=', startTime)
        .orderBy('end_time', 'desc')
        .limit(100)
    ])

    // Calculate performance metrics
    const performanceData = {
      timeRange,
      period: {
        start: startTime.toISOString(),
        end: now.toISOString()
      },
      overview: unifiedStats,
      platforms: {
        reddit: this.calculatePlatformMetrics(redditScans, 'reddit'),
        instagram: this.calculatePlatformMetrics(instagramScans, 'instagram'),
        tiktok: this.calculatePlatformMetrics(tiktokScans, 'tiktok')
      },
      trends: {
        contentVolume: this.calculateContentVolumeTrends([redditScans, instagramScans, tiktokScans]),
        successRates: this.calculateSuccessRateTrends([redditScans, instagramScans, tiktokScans]),
        errorFrequency: includeErrors ? this.calculateErrorTrends([redditScans, instagramScans, tiktokScans]) : null
      },
      recommendations: this.generatePerformanceRecommendations(unifiedStats, [redditScans, instagramScans, tiktokScans])
    }

    return NextResponse.json({
      success: true,
      data: performanceData
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'SOCIAL_MEDIA_PERFORMANCE_API_ERROR',
      `Failed to get social media performance via API: ${error.message}`,
      { error: error.message }
    )

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// Helper function to calculate platform-specific metrics
function calculatePlatformMetrics(scans: any[], platform: string) {
  if (scans.length === 0) {
    return {
      totalScans: 0,
      totalContent: 0,
      totalApproved: 0,
      successRate: 0,
      averageContentPerScan: 0,
      errorCount: 0
    }
  }

  const totalContent = scans.reduce((sum, scan) => sum + (scan.posts_found || 0), 0)
  const totalApproved = scans.reduce((sum, scan) => sum + (scan.posts_approved || 0), 0)
  const errorCount = scans.reduce((sum, scan) => sum + (scan.errors?.length || 0), 0)

  return {
    totalScans: scans.length,
    totalContent,
    totalApproved,
    successRate: totalContent > 0 ? Math.round((totalApproved / totalContent) * 100) : 0,
    averageContentPerScan: Math.round(totalContent / scans.length),
    errorCount
  }
}

// Helper function to calculate content volume trends
function calculateContentVolumeTrends(platformScans: any[][]) {
  // Group scans by hour for trend analysis
  const hourlyData = new Map()
  
  platformScans.forEach((scans, platformIndex) => {
    const platformName = ['reddit', 'instagram', 'tiktok'][platformIndex]
    
    scans.forEach(scan => {
      const hour = new Date(scan.end_time).toISOString().slice(0, 13) // YYYY-MM-DDTHH
      
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, { reddit: 0, instagram: 0, tiktok: 0 })
      }
      
      hourlyData.get(hour)[platformName] += scan.posts_found || 0
    })
  })

  return Array.from(hourlyData.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-24) // Last 24 hours
    .map(([hour, data]) => ({ hour, ...data }))
}

// Helper function to calculate success rate trends
function calculateSuccessRateTrends(platformScans: any[][]) {
  const trends = []
  
  platformScans.forEach((scans, platformIndex) => {
    const platformName = ['reddit', 'instagram', 'tiktok'][platformIndex]
    
    // Calculate moving average success rate over time
    const recentScans = scans.slice(0, 10) // Last 10 scans
    const totalFound = recentScans.reduce((sum, scan) => sum + (scan.posts_found || 0), 0)
    const totalApproved = recentScans.reduce((sum, scan) => sum + (scan.posts_approved || 0), 0)
    
    trends.push({
      platform: platformName,
      recentSuccessRate: totalFound > 0 ? Math.round((totalApproved / totalFound) * 100) : 0,
      scanCount: recentScans.length
    })
  })

  return trends
}

// Helper function to calculate error trends
function calculateErrorTrends(platformScans: any[][]) {
  const errorTrends = []
  
  platformScans.forEach((scans, platformIndex) => {
    const platformName = ['reddit', 'instagram', 'tiktok'][platformIndex]
    
    const recentErrors = scans
      .slice(0, 20) // Last 20 scans
      .reduce((sum, scan) => sum + (scan.errors?.length || 0), 0)
    
    errorTrends.push({
      platform: platformName,
      recentErrorCount: recentErrors,
      errorRate: scans.length > 0 ? Math.round((recentErrors / scans.length) * 100) / 100 : 0
    })
  })

  return errorTrends
}

// Helper function to generate performance recommendations
function generatePerformanceRecommendations(unifiedStats: any, platformScans: any[][]) {
  const recommendations = []

  // Check content distribution balance
  const distribution = unifiedStats.contentDistribution
  if (distribution.posts < 30) {
    recommendations.push({
      type: 'content_balance',
      priority: 'medium',
      message: 'Text post content is low. Consider increasing Reddit scanning frequency.',
      action: 'Increase Reddit scan frequency or expand subreddit targets'
    })
  }
  
  if (distribution.videos < 20) {
    recommendations.push({
      type: 'content_balance',
      priority: 'medium',
      message: 'Video content is low. Consider increasing TikTok scanning frequency.',
      action: 'Increase TikTok scan frequency or expand keyword targets'
    })
  }

  // Check platform performance
  unifiedStats.platformBreakdown.forEach(platform => {
    if (platform.successRate < 50) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: `${platform.platform} success rate is low (${platform.successRate}%)`,
        action: `Review ${platform.platform} scanning criteria and content filters`
      })
    }
  })

  // Check scan frequency
  const recentActivity = platformScans.some(scans => 
    scans.length > 0 && new Date(scans[0].end_time) > new Date(Date.now() - 2 * 60 * 60 * 1000)
  )
  
  if (!recentActivity) {
    recommendations.push({
      type: 'activity',
      priority: 'high',
      message: 'No recent scanning activity detected across platforms',
      action: 'Check platform authentication and enable automated scanning'
    })
  }

  return recommendations
}