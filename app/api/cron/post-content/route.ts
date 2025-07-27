import { NextRequest, NextResponse } from 'next/server'
import { postingService } from '@/lib/services/posting'
import { schedulingService } from '@/lib/services/scheduling'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      await logToDatabase(
        LogLevel.WARN,
        'Unauthorized cron request',
        'CronAPI',
        { authHeader: authHeader ? 'present' : 'missing' }
      )
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { manual = false } = await request.json().catch(() => ({}))

    const result = await postingService.processScheduledPost()

    if (result.success) {
      await logToDatabase(
        LogLevel.INFO,
        'Cron job executed successfully',
        'CronAPI',
        { 
          contentId: result.contentId,
          postOrder: result.postOrder,
          manual
        }
      )

      return NextResponse.json({
        success: true,
        message: 'Content posted successfully',
        contentId: result.contentId,
        postOrder: result.postOrder
      })
    } else {
      await logToDatabase(
        LogLevel.WARN,
        'Cron job completed with no action',
        'CronAPI',
        { 
          reason: result.error,
          manual
        }
      )

      return NextResponse.json({
        success: false,
        message: result.error || 'No action taken'
      }, { status: 200 })
    }

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Cron job execution failed',
      'CronAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const [schedule, queueStatus] = await Promise.all([
      schedulingService.getPostingSchedule(),
      postingService.getQueueStatus()
    ])

    return NextResponse.json({
      schedule,
      queueStatus,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Failed to get cron status',
      'CronAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}