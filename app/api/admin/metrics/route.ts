import { NextRequest, NextResponse } from 'next/server'
import { metricsService } from '@/lib/services/metrics'
import { errorHandler } from '@/lib/middleware/error-handler'

export const GET = errorHandler.withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  
  const filters = {
    name: searchParams.get('name')?.split(','),
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
    offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    aggregation: searchParams.get('aggregation') as 'avg' | 'sum' | 'count' | 'min' | 'max' | undefined,
    dateRange: searchParams.get('start') && searchParams.get('end') ? {
      start: new Date(searchParams.get('start')!),
      end: new Date(searchParams.get('end')!)
    } : undefined,
    tags: searchParams.get('tags') ? JSON.parse(searchParams.get('tags')!) : undefined
  }

  const result = await metricsService.queryMetrics(filters)
  
  return NextResponse.json(result)
})

export const POST = errorHandler.withErrorHandling(async (request: NextRequest) => {
  const body = await request.json()
  const { name, value, unit, tags, metadata } = body

  if (!name || value === undefined || !unit) {
    return NextResponse.json(
      { error: 'Missing required fields: name, value, unit' },
      { status: 400 }
    )
  }

  await metricsService.recordCustomMetric(name, value, unit, tags, metadata)
  
  return NextResponse.json({ success: true })
})