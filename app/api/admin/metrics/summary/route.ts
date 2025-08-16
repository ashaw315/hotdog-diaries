import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Mock data for now - replace with real metricsService.getMetricsSummary() once database issues are resolved
  const mockSummary = {
    totalMetrics: 1247,
    recentAPIResponseTimes: {
      reddit: 180,
      instagram: 250,
      tiktok: 320
    },
    systemResources: {
      memoryUsagePercent: 68,
      cpuUsagePercent: 35,
      diskUsagePercent: 42
    },
    businessKPIs: {
      contentProcessedLast24h: 847,
      postsCreatedLast24h: 18,
      errorRateLast1h: 2.1,
      queueSize: 23
    },
    topSlowOperations: [
      { operation: 'reddit_scan', avgResponseTime: 1250, count: 45 },
      { operation: 'image_processing', avgResponseTime: 890, count: 123 },
      { operation: 'content_validation', avgResponseTime: 450, count: 234 }
    ]
  }
  
  return NextResponse.json(mockSummary, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  })
}