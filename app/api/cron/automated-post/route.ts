import { NextRequest, NextResponse } from 'next/server'
import { automatedPostingService } from '@/lib/services/automated-posting'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // Verify cron authentication
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      await logToDatabase(
        LogLevel.WARNING,
        'Unauthorized automated posting attempt',
        'CronAPI',
        { 
          authHeader: authHeader?.substring(0, 20) + '...', 
          ip: request.headers.get('x-forwarded-for') || 'unknown'
        }
      )
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await logToDatabase(
      LogLevel.INFO,
      'Automated posting cron job triggered',
      'CronAPI',
      { timestamp: new Date().toISOString() }
    )

    // Run automated posting
    const results = await automatedPostingService.runAutomatedPosting()

    // Get posting statistics
    const stats = await automatedPostingService.getPostingStats()

    const response = {
      success: true,
      results: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      posts: results.map(r => ({
        contentId: r.contentId,
        platform: r.platform,
        contentType: r.contentType,
        success: r.success,
        error: r.error,
        postedAt: r.postedAt
      })),
      stats: {
        todayPosts: stats.todayPosts,
        nextPostTime: stats.nextPostTime,
        queueHealth: stats.queueHealth
      },
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response)

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'Automated posting cron job failed',
      'CronAPI',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )

    return NextResponse.json(
      { 
        success: false, 
        error: 'Automated posting failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Allow GET for health checks
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current meal time info
    const currentMealTime = automatedPostingService.getCurrentMealTime()
    const nextMealTime = automatedPostingService.getNextMealTime()
    const stats = await automatedPostingService.getPostingStats()

    return NextResponse.json({
      status: 'healthy',
      currentMealTime,
      nextMealTime,
      stats,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}