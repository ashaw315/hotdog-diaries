import { NextRequest, NextResponse } from 'next/server'
import { socialMediaService } from '@/lib/services/social-media'

export async function POST(request: NextRequest) {
  try {
    const result = await socialMediaService.startAllScanning()
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      data: {
        results: result.results,
        successfulPlatforms: result.results.filter(r => r.success).length,
        failedPlatforms: result.results.filter(r => !r.success).length,
        startTime: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Social media scan start error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to start social media scanning',
        details: error.message
      },
      { status: 500 }
    )
  }
}