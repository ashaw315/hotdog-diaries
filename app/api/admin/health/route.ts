import { NextRequest, NextResponse } from 'next/server'
import { healthService } from '@/lib/services/health'
import { errorHandler } from '@/lib/middleware/error-handler'

export const GET = errorHandler.withErrorHandling(async (request: NextRequest) => {
  const healthReport = await healthService.generateHealthReport()
  
  return NextResponse.json(healthReport, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  })
})

export const POST = errorHandler.withErrorHandling(async (request: NextRequest) => {
  const body = await request.json()
  const { action } = body

  switch (action) {
    case 'check':
      const healthReport = await healthService.generateHealthReport()
      return NextResponse.json(healthReport)

    case 'quick':
      // Quick health check - just check if service is responsive
      const isHealthy = await healthService.isHealthy()
      return NextResponse.json({
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: healthService.getUptime()
      })

    default:
      return NextResponse.json(
        { error: 'Invalid action. Supported actions: check, quick' },
        { status: 400 }
      )
  }
})