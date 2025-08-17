import { NextRequest, NextResponse } from 'next/server'
import { queueManager } from '@/lib/services/queue-manager'

export async function GET(request: NextRequest) {
  try {
    const stats = await queueManager.getQueueStats()
    
    return NextResponse.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Failed to get queue stats:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}