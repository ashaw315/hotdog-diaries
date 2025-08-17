import { NextRequest, NextResponse } from 'next/server'
import { queueManager } from '@/lib/services/queue-manager'

export async function GET(request: NextRequest) {
  try {
    const health = await queueManager.isQueueHealthy()
    
    return NextResponse.json({
      success: true,
      data: health
    })
  } catch (error) {
    console.error('Failed to get queue health:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}