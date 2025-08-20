import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  console.log('📊 Getting automation status...')
  
  try {
    // Auth check
    let userId: string | null = null
    let username: string | null = null

    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
        if (decoded.username === 'admin' && decoded.id === 1) {
          userId = '1'
          username = 'admin'
        }
      } catch (e) {
        // Fall through
      }
    }

    if (!userId) {
      userId = request.headers.get('x-user-id')
      username = request.headers.get('x-username')
    }

    if (!userId || !username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSimpleClient()
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // 1. Check environment configuration
    const automationConfig = {
      cronSecret: !!process.env.CRON_SECRET,
      autoScanning: process.env.ENABLE_AUTO_SCANNING === 'true',
      autoPosting: process.env.ENABLE_AUTO_POSTING === 'true',
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV || 'development'
    }

    // 2. Calculate next cron execution (daily at 10 AM UTC)
    const nextCron = new Date()
    nextCron.setUTCHours(10, 0, 0, 0)
    if (nextCron <= now) {
      nextCron.setUTCDate(nextCron.getUTCDate() + 1) // Tomorrow if today's has passed
    }

    // 3. Get content queue health
    const { data: queueData, error: queueError } = await supabase
      .from('content_queue')
      .select('id, is_approved, is_posted, source_platform, content_type, created_at, scraped_at')

    const queueStats = {
      totalContent: queueData?.length || 0,
      approvedContent: queueData?.filter(c => c.is_approved && !c.is_posted).length || 0,
      postedContent: queueData?.filter(c => c.is_posted).length || 0,
      pendingContent: queueData?.filter(c => !c.is_approved && !c.is_posted).length || 0,
      daysOfContent: Math.floor((queueData?.filter(c => c.is_approved && !c.is_posted).length || 0) / 6),
      platformBreakdown: {}
    }

    // Platform breakdown
    if (queueData) {
      const platforms = [...new Set(queueData.map(c => c.source_platform))]
      platforms.forEach(platform => {
        const platformContent = queueData.filter(c => c.source_platform === platform)
        queueStats.platformBreakdown[platform] = {
          total: platformContent.length,
          approved: platformContent.filter(c => c.is_approved).length,
          posted: platformContent.filter(c => c.is_posted).length
        }
      })
    }

    // 4. Get today's posting activity
    const { data: todayPosts, error: postsError } = await supabase
      .from('posted_content')
      .select(`
        id, posted_at, content_queue_id,
        content_queue (source_platform, content_type)
      `)
      .gte('posted_at', today + 'T00:00:00Z')
      .order('posted_at', { ascending: false })

    // 5. Get recent scanning activity (last 7 days)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentContent, error: recentError } = await supabase
      .from('content_queue')
      .select('id, source_platform, scraped_at')
      .gte('scraped_at', weekAgo)
      .order('scraped_at', { ascending: false })

    // Group recent content by day
    const scanningActivity = {}
    if (recentContent) {
      recentContent.forEach(item => {
        const day = item.scraped_at.split('T')[0]
        if (!scanningActivity[day]) {
          scanningActivity[day] = { total: 0, platforms: {} }
        }
        scanningActivity[day].total++
        scanningActivity[day].platforms[item.source_platform] = 
          (scanningActivity[day].platforms[item.source_platform] || 0) + 1
      })
    }

    // 6. Calculate meal time posting status for today
    const mealTimes = [
      { hour: 7, minute: 0, name: 'breakfast' },
      { hour: 12, minute: 0, name: 'lunch' },
      { hour: 15, minute: 0, name: 'snack' },
      { hour: 18, minute: 0, name: 'dinner' },
      { hour: 20, minute: 0, name: 'evening' },
      { hour: 22, minute: 0, name: 'late_night' }
    ]

    const mealTimeStatus = mealTimes.map(mealTime => {
      const mealDateTime = new Date()
      mealDateTime.setUTCHours(mealTime.hour, mealTime.minute, 0, 0)
      
      const hasPosted = todayPosts?.some(post => {
        const postTime = new Date(post.posted_at)
        return Math.abs(postTime.getTime() - mealDateTime.getTime()) < 30 * 60 * 1000 // Within 30 minutes
      }) || false

      return {
        ...mealTime,
        scheduled: mealDateTime.toISOString(),
        hasPassed: mealDateTime <= now,
        hasPosted,
        status: hasPosted ? 'posted' : mealDateTime <= now ? 'missed' : 'pending'
      }
    })

    // 7. Health check
    const health = {
      queueHealthy: queueStats.daysOfContent >= 3,
      automationConfigured: automationConfig.cronSecret && (automationConfig.autoScanning || automationConfig.autoPosting),
      databaseConnected: !queueError,
      postsToday: todayPosts?.length || 0,
      missedMealsToday: mealTimeStatus.filter(m => m.status === 'missed').length,
      nextMealTime: mealTimeStatus.find(m => m.status === 'pending')
    }

    const overallStatus = health.queueHealthy && health.automationConfigured && health.databaseConnected
      ? 'healthy' 
      : 'warning'

    return NextResponse.json({
      success: true,
      status: overallStatus,
      timestamp: now.toISOString(),
      
      automation: {
        configured: automationConfig,
        nextCronExecution: nextCron.toISOString(),
        cronSchedule: '0 10 * * * (Daily at 10 AM UTC)',
        timeUntilNextCron: Math.round((nextCron.getTime() - now.getTime()) / (1000 * 60)) // minutes
      },

      queue: queueStats,
      
      posting: {
        todaysPosts: todayPosts?.length || 0,
        mealTimeStatus,
        postsScheduledToday: 6,
        completionRate: Math.round(((todayPosts?.length || 0) / 6) * 100)
      },

      scanning: {
        recentActivity: scanningActivity,
        lastScanTime: recentContent?.[0]?.scraped_at || null,
        totalScannedThisWeek: recentContent?.length || 0
      },

      health,

      recommendations: [
        ...(queueStats.daysOfContent < 3 ? ['Queue low - run emergency scan'] : []),
        ...(health.missedMealsToday > 0 ? [`${health.missedMealsToday} missed meals today - run manual post`] : []),
        ...(!automationConfig.cronSecret ? ['Set CRON_SECRET environment variable'] : []),
        ...(!automationConfig.autoScanning && !automationConfig.autoPosting ? ['Enable automation with ENABLE_AUTO_SCANNING/ENABLE_AUTO_POSTING'] : [])
      ]
    })

  } catch (error) {
    console.error('❌ Error getting automation status:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}