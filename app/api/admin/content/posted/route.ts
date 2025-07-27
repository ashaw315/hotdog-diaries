import { NextRequest, NextResponse } from 'next/server'
import { postingService } from '@/lib/services/posting'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (limit > 100) {
      return NextResponse.json({
        error: 'Limit cannot exceed 100'
      }, { status: 400 })
    }

    const history = await postingService.getPostingHistory(limit + offset)
    const content = history.slice(offset, offset + limit)

    return NextResponse.json({
      content,
      pagination: {
        limit,
        offset,
        total: history.length,
        hasMore: history.length > offset + limit
      }
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Failed to get posting history',
      'PostingHistoryAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}