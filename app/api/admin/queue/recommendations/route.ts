import { NextRequest, NextResponse } from 'next/server'
import { queueManager } from '@/lib/services/queue-manager'

export async function GET(request: NextRequest) {
  try {
    const recommendations = await queueManager.getScanRecommendations()
    
    return NextResponse.json({
      success: true,
      data: recommendations
    })
  } catch (error) {
    console.error('Failed to get scan recommendations:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}