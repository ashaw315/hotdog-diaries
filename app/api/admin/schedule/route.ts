import { NextRequest, NextResponse } from 'next/server'
import { schedulingService } from '@/lib/services/scheduling'
import { postingService } from '@/lib/services/posting'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const [config, schedule, queueStatus, stats] = await Promise.all([
      schedulingService.getScheduleConfig(),
      schedulingService.getPostingSchedule(),
      postingService.getQueueStatus(),
      postingService.getPostingStats()
    ])

    return NextResponse.json({
      config,
      schedule,
      queueStatus,
      stats
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Failed to get schedule info',
      'ScheduleAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { meal_times, timezone, is_enabled } = body

    if (meal_times && !Array.isArray(meal_times)) {
      return NextResponse.json({
        error: 'meal_times must be an array'
      }, { status: 400 })
    }

    if (meal_times) {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
      for (const time of meal_times) {
        if (!timeRegex.test(time)) {
          return NextResponse.json({
            error: `Invalid time format: ${time}. Use HH:MM format.`
          }, { status: 400 })
        }
      }
    }

    const updatedConfig = await schedulingService.updateScheduleConfig({
      meal_times,
      timezone,
      is_enabled
    })

    await logToDatabase(
      LogLevel.INFO,
      'Schedule config updated via API',
      'ScheduleAPI',
      { updatedConfig }
    )

    return NextResponse.json({
      success: true,
      config: updatedConfig
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Failed to update schedule config',
      'ScheduleAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}