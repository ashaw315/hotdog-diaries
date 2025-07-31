import { NextRequest, NextResponse } from 'next/server'
import { metricsService } from '@/lib/services/metrics'
import { errorHandler } from '@/lib/middleware/error-handler'

export const GET = errorHandler.withErrorHandling(async (request: NextRequest) => {
  const performanceStats = await metricsService.getPerformanceStats()
  
  return NextResponse.json(performanceStats, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  })
})