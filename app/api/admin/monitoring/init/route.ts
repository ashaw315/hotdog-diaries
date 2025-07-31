import { NextRequest, NextResponse } from 'next/server'
import { monitoringInit } from '@/lib/services/monitoring-init'
import { errorHandler } from '@/lib/middleware/error-handler'

export const GET = errorHandler.withErrorHandling(async (request: NextRequest) => {
  const status = await monitoringInit.getMonitoringStatus()
  
  return NextResponse.json(status, {
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
    case 'initialize':
      if (monitoringInit.isInitialized()) {
        return NextResponse.json(
          { error: 'Monitoring services are already initialized' },
          { status: 409 }
        )
      }
      
      await monitoringInit.initialize()
      return NextResponse.json({ 
        success: true, 
        message: 'Monitoring services initialized successfully' 
      })

    case 'shutdown':
      await monitoringInit.shutdown()
      return NextResponse.json({ 
        success: true, 
        message: 'Monitoring services shut down successfully' 
      })

    case 'health_check':
      const healthCheck = await monitoringInit.runHealthCheck()
      return NextResponse.json(healthCheck)

    case 'status':
      const status = await monitoringInit.getMonitoringStatus()
      return NextResponse.json(status)

    default:
      return NextResponse.json(
        { error: 'Invalid action. Supported actions: initialize, shutdown, health_check, status' },
        { status: 400 }
      )
  }
})