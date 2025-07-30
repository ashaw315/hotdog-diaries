import { NextRequest, NextResponse } from 'next/server'
import { tiktokService } from '@/lib/services/tiktok'
import { tiktokMonitoringService } from '@/lib/services/tiktok-monitoring'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    // Get TikTok API status and health metrics
    const [apiStatus, healthMetrics] = await Promise.all([
      tiktokService.getApiStatus(),
      tiktokMonitoringService.getHealthMetrics()
    ])

    const statusData = {
      api: apiStatus,
      health: healthMetrics,
      alerts: tiktokMonitoringService.getActiveAlerts(),
      performance: tiktokMonitoringService.getPerformanceMetrics()
    }

    return NextResponse.json({
      success: true,
      data: statusData
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'TIKTOK_STATUS_API_ERROR',
      `Failed to get TikTok status via API: ${error.message}`,
      { error: error.message }
    )

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}