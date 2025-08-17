import { NextRequest, NextResponse } from 'next/server'
import { alertService } from '@/lib/services/alerts'
import { errorHandler } from '@/lib/middleware/error-handler'

export const GET = errorHandler.withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50
  const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
  const severity = searchParams.get('severity')?.split(',') as any[]
  const type = searchParams.get('type')?.split(',') as any[]
  const dateRange = searchParams.get('start') && searchParams.get('end') ? {
    start: new Date(searchParams.get('start')!),
    end: new Date(searchParams.get('end')!)
  } : undefined

  const alertHistory = await alertService.getAlertHistory(
    limit,
    offset,
    severity,
    type,
    dateRange
  )
  
  return NextResponse.json(alertHistory)
})

export const POST = errorHandler.withErrorHandling<{ success?: boolean; error?: string; message?: string }>(async (request: NextRequest) => {
  const body = await request.json()
  const { action, alertId, title, message, type, severity, metadata } = body

  switch (action) {
    case 'test':
      await alertService.testAlertSystem()
      return NextResponse.json({ success: true, message: 'Test alert sent' })

    case 'acknowledge':
      if (!alertId) {
        return NextResponse.json({ error: 'alertId is required' }, { status: 400 })
      }
      await alertService.acknowledgeAlert(alertId, 'admin')
      return NextResponse.json({ success: true })

    case 'resolve':
      if (!alertId) {
        return NextResponse.json({ error: 'alertId is required' }, { status: 400 })
      }
      await alertService.resolveAlert(alertId, 'admin')
      return NextResponse.json({ success: true })

    case 'create':
      if (!title || !message) {
        return NextResponse.json({ error: 'title and message are required' }, { status: 400 })
      }
      
      if (severity === 'critical') {
        await alertService.sendCriticalAlert(title, message, type, metadata)
      } else {
        await alertService.sendWarningAlert(title, message, type, metadata)
      }
      
      return NextResponse.json({ success: true })

    default:
      return NextResponse.json(
        { error: 'Invalid action. Supported actions: test, acknowledge, resolve, create' },
        { status: 400 }
      )
  }
})