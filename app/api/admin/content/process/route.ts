import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Return simplified processing result
    return NextResponse.json({
      success: true,
      processed: 0,
      approved: 0,
      rejected: 0,
      flagged: 0,
      errors: [],
      message: 'Content processing not implemented - using manual approval'
    })
  } catch (error) {
    console.error('Error processing content:', error)
    return NextResponse.json(
      { error: 'Failed to process content' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSimpleClient()

    // Get current processing statistics from content_queue
    const { data: contentStats, error: statsError } = await supabase
      .from('content_queue')
      .select('is_approved, is_posted, created_at, source_platform')

    if (statsError) {
      throw new Error(`Failed to get content stats: ${statsError.message}`)
    }

    const total = contentStats?.length || 0
    const approved = contentStats?.filter(c => c.is_approved).length || 0
    const pending = contentStats?.filter(c => !c.is_approved).length || 0
    const posted = contentStats?.filter(c => c.is_posted).length || 0

    // Calculate processing rate (items per day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayItems = contentStats?.filter(c => 
      new Date(c.created_at) >= today
    ).length || 0

    const processingStats = {
      queue: {
        total: total,
        pending: pending,
        approved: approved,
        posted: posted,
        processing: 0
      },
      throughput: {
        items_per_day: todayItems,
        total_processed_today: todayItems,
        avg_processing_time: '< 1 minute',
        success_rate: total > 0 ? (approved / total * 100).toFixed(1) : '0'
      },
      current_batch: {
        size: 0,
        progress: 0,
        estimated_completion: 'N/A'
      },
      daily_processing: [
        {
          date: today.toISOString().split('T')[0],
          processed: todayItems,
          approved: contentStats?.filter(c => 
            c.is_approved && new Date(c.created_at) >= today
          ).length || 0,
          rejected: contentStats?.filter(c => 
            !c.is_approved && new Date(c.created_at) >= today
          ).length || 0
        }
      ]
    }

    return NextResponse.json(processingStats, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error fetching processing statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch processing stats' },
      { status: 500 }
    )
  }
}