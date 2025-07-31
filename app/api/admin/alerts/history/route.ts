import { NextRequest, NextResponse } from 'next/server'
import { alertService } from '@/lib/services/alerts'
import { errorHandler } from '@/lib/middleware/error-handler'

export const GET = errorHandler.withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100
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
  
  return NextResponse.json(alertHistory, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  })
})