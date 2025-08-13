import { NextRequest, NextResponse } from 'next/server'
import { giphyScanningService } from '@/lib/services/giphy-scanning'

export async function POST(request: NextRequest) {
  try {
    console.log('🎨 Testing Giphy scanning with debug...')
    
    // Capture console logs
    const logs: string[] = []
    const originalConsoleLog = console.log
    const originalConsoleError = console.error
    
    console.log = (...args) => {
      logs.push(`[LOG] ${args.join(' ')}`)
      originalConsoleLog(...args)
    }
    
    console.error = (...args) => {
      logs.push(`[ERROR] ${args.join(' ')}`)
      originalConsoleError(...args)
    }
    
    const result = await giphyScanningService.performScan({ maxPosts: 2 })
    
    // Restore console
    console.log = originalConsoleLog
    console.error = originalConsoleError
    
    return NextResponse.json({
      success: true,
      result,
      logs: logs.slice(-50) // Last 50 log messages
    })

  } catch (error) {
    console.error('Giphy debug error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}