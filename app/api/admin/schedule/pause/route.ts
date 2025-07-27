import { NextRequest, NextResponse } from 'next/server'
import { schedulingService } from '@/lib/services/scheduling'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { paused } = body

    if (typeof paused !== 'boolean') {
      return NextResponse.json({
        error: 'paused must be a boolean value'
      }, { status: 400 })
    }

    if (paused) {
      await schedulingService.pauseScheduling()
    } else {
      await schedulingService.resumeScheduling()
    }

    const config = await schedulingService.getScheduleConfig()

    await logToDatabase(
      LogLevel.INFO,
      `Scheduling ${paused ? 'paused' : 'resumed'} via API`,
      'ScheduleAPI',
      { paused, enabled: config.is_enabled }
    )

    return NextResponse.json({
      success: true,
      paused: !config.is_enabled,
      config
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Failed to pause/resume scheduling',
      'ScheduleAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}