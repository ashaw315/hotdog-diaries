import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100
  
  // Mock data for now - replace with real alertService.getAlertHistory() once dependencies are resolved
  const mockAlertHistory = {
    alerts: [
      {
        id: 'alert_1',
        type: 'performance_degradation',
        severity: 'medium',
        title: 'YouTube API Slow Response',
        message: 'YouTube API response times above 400ms threshold. Current: 450ms',
        createdAt: new Date(Date.now() - 1000 * 60 * 23).toISOString(),
        resolvedAt: null,
        acknowledged: false
      },
      {
        id: 'alert_2',
        type: 'system_info',
        severity: 'low',
        title: 'System Backup Completed',
        message: 'Daily backup completed successfully. Database backed up: 2.3GB',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 1.5).toISOString(),
        acknowledged: true
      },
      {
        id: 'alert_3',
        type: 'queue_issue',
        severity: 'low',
        title: 'Content Queue Processing Delay',
        message: 'Queue processing took longer than expected: 45 seconds',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
        resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 3.5).toISOString(),
        acknowledged: true
      }
    ].slice(0, limit),
    total: 7,
    byType: {
      performance_degradation: 1,
      system_info: 3,
      queue_issue: 2,
      api_failure: 1
    },
    bySeverity: {
      low: 5,
      medium: 2,
      high: 0,
      critical: 0
    },
    resolvedCount: 6,
    unresolvedCount: 1
  }
  
  return NextResponse.json(mockAlertHistory, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  })
}