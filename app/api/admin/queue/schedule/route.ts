import { NextRequest, NextResponse } from 'next/server'
import { scanningScheduler } from '@/lib/services/scanning-scheduler'

export async function GET(request: NextRequest) {
  try {
    const schedule = await scanningScheduler.getWeeklySchedule()
    
    return NextResponse.json({
      success: true,
      data: schedule
    })
  } catch (error) {
    console.error('Failed to get weekly schedule:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}