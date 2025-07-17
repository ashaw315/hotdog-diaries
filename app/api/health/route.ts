import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withErrorHandling, validateRequestMethod, createSuccessResponse } from '@/lib/api-middleware'
import { EnhancedHealthResponse } from '@/types'

async function healthHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['GET', 'HEAD'])

  if (request.method === 'HEAD') {
    return new NextResponse(null, { status: 200 })
  }

  const startTime = Date.now()

  // Check database health
  const databaseHealth = await db.healthCheck()

  // Calculate response time
  const responseTime = Date.now() - startTime

  const healthData: EnhancedHealthResponse = {
    status: databaseHealth.connected ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    service: 'hotdog-diaries',
    version: '1.0.0',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    checks: {
      database: databaseHealth,
      socialMediaScanner: 'pending', // Will be implemented later
      contentScheduler: 'pending', // Will be implemented later
    }
  }

  // Add additional metadata for development
  if (process.env.NODE_ENV === 'development') {
    ;(healthData as any).responseTime = responseTime
    ;(healthData as any).memory = {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    }
  }

  const status = databaseHealth.connected ? 200 : 503

  return createSuccessResponse(healthData, undefined, status)
}

export const GET = withErrorHandling(healthHandler, '/api/health')
export const HEAD = withErrorHandling(healthHandler, '/api/health')