import { NextRequest, NextResponse } from 'next/server'
import { loggingService } from '@/lib/services/logging'
import { errorHandler } from '@/lib/middleware/error-handler'

export const GET = errorHandler.withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  
  const filters = {
    level: searchParams.get('level')?.split(',') as any[],
    component: searchParams.get('component')?.split(','),
    search: searchParams.get('search') || undefined,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
    offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    userId: searchParams.get('userId') || undefined,
    requestId: searchParams.get('requestId') || undefined,
    dateRange: searchParams.get('start') && searchParams.get('end') ? {
      start: new Date(searchParams.get('start')!),
      end: new Date(searchParams.get('end')!)
    } : undefined
  }

  const result = await loggingService.queryLogs(filters)
  
  return NextResponse.json(result)
})

export const POST = errorHandler.withErrorHandling(async (request: NextRequest) => {
  const body = await request.json()
  const { action } = body

  switch (action) {
    case 'cleanup':
      const retentionDays = body.retentionDays || 30
      const deletedCount = await loggingService.cleanupOldLogs(retentionDays)
      return NextResponse.json({ 
        success: true, 
        message: `Deleted ${deletedCount} old log entries`,
        deletedCount 
      })

    case 'export':
      const exportFilters = body.filters || {}
      const exportData = await loggingService.exportLogs(exportFilters)
      
      return new NextResponse(exportData, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="system-logs-${new Date().toISOString().split('T')[0]}.json"`
        }
      })

    case 'statistics':
      const dateRange = body.dateRange ? {
        start: new Date(body.dateRange.start),
        end: new Date(body.dateRange.end)
      } : undefined
      
      const stats = await loggingService.getLogStatistics(dateRange)
      return NextResponse.json(stats)

    default:
      return NextResponse.json(
        { error: 'Invalid action. Supported actions: cleanup, export, statistics' },
        { status: 400 }
      )
  }
})