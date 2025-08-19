import { NextResponse } from 'next/server'
import { metricsService } from '@/lib/services/metrics-service'

export async function GET() {
  try {
    // Get comprehensive analytics using our metrics service
    const dashboardMetrics = await metricsService.getDashboardMetrics()
    
    // Get platform performance for last 7 days
    const platforms = ['reddit', 'bluesky', 'pixabay', 'lemmy', 'giphy', 'imgur', 'tumblr', 'youtube']
    const platformPerformance = await Promise.all(
      platforms.map(async (platform) => {
        try {
          const performance = await metricsService.getPlatformPerformance(platform, 7)
          return { platform, performance }
        } catch {
          return { platform, performance: [] }
        }
      })
    )

    // Get content trends for last 30 days
    const contentTrends = await metricsService.getContentTrends(30)

    // Transform data to match frontend expectations
    const analytics = {
      // Summary metrics
      overview: {
        totalContent: dashboardMetrics.contentMetrics.totalContent,
        approvedContent: dashboardMetrics.contentMetrics.approvedContent,
        postedContent: dashboardMetrics.contentMetrics.postedContent,
        approvalRate: dashboardMetrics.contentMetrics.approvalRate,
        avgConfidenceScore: dashboardMetrics.contentMetrics.avgConfidenceScore,
        queueSize: dashboardMetrics.systemHealth.queueSize,
        errorRate: dashboardMetrics.systemHealth.errorRate
      },

      // Platform breakdown
      platformMetrics: dashboardMetrics.platformMetrics.map(platform => ({
        platform: platform.platform,
        totalScanned: platform.totalScanned,
        totalApproved: platform.totalApproved,
        totalPosted: platform.totalPosted,
        approvalRate: platform.approvalRate,
        avgConfidenceScore: platform.avgConfidenceScore,
        lastScanDate: platform.lastScanDate
      })),

      // Engagement metrics (using confidence as proxy)
      engagementMetrics: {
        totalViews: dashboardMetrics.engagementMetrics.totalViews,
        avgEngagementScore: dashboardMetrics.engagementMetrics.avgEngagementScore,
        topPerformingContent: dashboardMetrics.engagementMetrics.topPerformingContent
      },

      // Filtering effectiveness
      filteringMetrics: {
        totalAnalyzed: dashboardMetrics.filteringMetrics.totalAnalyzed,
        avgConfidenceScore: dashboardMetrics.filteringMetrics.avgConfidenceScore,
        flaggedCount: dashboardMetrics.filteringMetrics.flaggedCount,
        flaggedPatterns: dashboardMetrics.filteringMetrics.flaggedPatterns
      },

      // Time-based trends
      contentTrends: contentTrends.map((trend: any) => ({
        date: trend.date,
        totalContent: trend.totalContent,
        approvedContent: trend.approvedContent,
        postedContent: trend.postedContent,
        approvalRate: trend.approvalRate,
        avgConfidence: trend.avgConfidence
      })),

      // Platform performance over time
      platformTrends: platformPerformance.reduce((acc, { platform, performance }) => {
        acc[platform] = performance
        return acc
      }, {} as Record<string, any[]>),

      // Queue health metrics
      queueHealth: {
        queueSize: dashboardMetrics.systemHealth.queueSize,
        lastScanTime: dashboardMetrics.systemHealth.lastScanTime,
        lastPostTime: dashboardMetrics.systemHealth.lastPostTime,
        errorRate: dashboardMetrics.systemHealth.errorRate,
        isHealthy: dashboardMetrics.systemHealth.queueSize < 100 && dashboardMetrics.systemHealth.errorRate < 0.1
      }
    }

    return NextResponse.json(analytics, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
}