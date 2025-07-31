import { NextRequest, NextResponse } from 'next/server'
import { metricsService } from '@/lib/services/metrics'
import { errorHandler } from '@/lib/middleware/error-handler'

export const GET = errorHandler.withErrorHandling(async (request: NextRequest) => {
  const summary = await metricsService.getMetricsSummary()
  
  return NextResponse.json(summary, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  })
})