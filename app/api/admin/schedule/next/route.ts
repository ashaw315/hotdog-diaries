import { NextRequest, NextResponse } from 'next/server'
import { schedulingService } from '@/lib/services/scheduling'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const schedule = await schedulingService.getPostingSchedule()

    return NextResponse.json({
      nextPostTime: schedule.nextPostTime,
      nextMealTime: schedule.nextMealTime,
      timeUntilNext: schedule.timeUntilNext,
      isPostingTime: schedule.isPostingTime,
      todaysSchedule: schedule.todaysSchedule
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Failed to get next scheduled time',
      'ScheduleAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}