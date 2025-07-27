import { NextRequest, NextResponse } from 'next/server'
import { queueMonitorService } from '@/lib/services/queue-monitor'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

    let alerts
    if (activeOnly) {
      alerts = await queueMonitorService.getActiveAlerts()
    } else {
      alerts = await queueMonitorService.getAlertHistory(limit)
    }

    return NextResponse.json({
      alerts,
      count: alerts.length
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Failed to get queue alerts',
      'QueueAlertsAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, alertId } = body

    if (action === 'acknowledge') {
      if (alertId) {
        await queueMonitorService.acknowledgeAlert(alertId)
        return NextResponse.json({
          success: true,
          message: 'Alert acknowledged'
        })
      } else {
        await queueMonitorService.acknowledgeAllAlerts()
        return NextResponse.json({
          success: true,
          message: 'All alerts acknowledged'
        })
      }
    }

    if (action === 'check') {
      const healthCheck = await queueMonitorService.checkQueueHealth()
      return NextResponse.json({
        success: true,
        ...healthCheck
      })
    }

    return NextResponse.json({
      error: 'Invalid action'
    }, { status: 400 })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Failed to process queue alert action',
      'QueueAlertsAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}