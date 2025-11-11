import { NextRequest, NextResponse } from 'next/server'
import { queueManager } from '@/lib/services/queue-manager'
import { postingService } from '@/lib/services/posting'
import { mockAdminDataIfCI } from '@/app/api/admin/_testMock'
import { USE_MOCK_DATA } from '@/lib/env'

export async function GET(request: NextRequest) {
  // Return mock data for CI/test environments
  if (USE_MOCK_DATA) {
    const mockData = mockAdminDataIfCI('dashboard')
    if (mockData) {
      return NextResponse.json({ success: true, data: mockData })
    }
  }
  
  try {
    // Get queue statistics
    const queueStats = await queueManager.getQueueStats()
    
    // Get content balance
    const contentBalance = {
      video: (queueStats.contentTypePercentages.video || 0) * 100,
      gif: (queueStats.contentTypePercentages.gif || 0) * 100,
      image: (queueStats.contentTypePercentages.image || 0) * 100,
      text: (queueStats.contentTypePercentages.text || 0) * 100
    }

    // Get posting schedule for today using Supabase
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ulaadphxfsrihoubjdrb.supabase.co'
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    const { count: todaysPosts } = await supabase
      .from('posted_content')
      .select('*', { count: 'exact', head: true })
      .gte('posted_at', `${today}T00:00:00`)
      .lte('posted_at', `${today}T23:59:59`)

    // Get next scheduled post time (simplified)
    const nextPost = new Date()
    const currentHour = nextPost.getHours()
    const scheduleTimes = [8, 12, 18] // 3 posts/day: breakfast, lunch, dinner
    let nextScheduleHour = scheduleTimes.find(hour => hour > currentHour)
    
    if (!nextScheduleHour) {
      // Next day's first post
      nextPost.setDate(nextPost.getDate() + 1)
      nextScheduleHour = scheduleTimes[0]
    }
    
    nextPost.setHours(nextScheduleHour, 0, 0, 0)

    // Get upcoming posts preview
    const { data: upcomingPostsResult } = await supabase
      .from('content_queue')
      .select('id, source_platform, content_text, content_image_url, content_video_url')
      .eq('is_approved', true)
      .eq('is_posted', false)
      .order('confidence_score', { ascending: false })
      .limit(3)

    const upcomingPosts = scheduleTimes.map((hour, index) => {
      const post = upcomingPostsResult?.[index]
      return {
        time: `${hour.toString().padStart(2, '0')}:00`,
        content: post || null,
        type: post ? (
          post.content_video_url ? 'video' :
          post.content_image_url && (post.content_image_url.includes('.gif') || post.source_platform === 'giphy') ? 'gif' :
          post.content_image_url ? 'image' : 'text'
        ) : 'unknown',
        platform: post?.source_platform || 'unknown'
      }
    })

    // Get last scan times per platform from content_queue using Supabase
    const { data: allScans } = await supabase
      .from('content_queue')
      .select('source_platform, scraped_at')
      .not('source_platform', 'is', null)
      .not('scraped_at', 'is', null)

    const lastScans: Record<string, string> = {}
    allScans?.forEach((row: any) => {
      if (!lastScans[row.source_platform] || row.scraped_at > lastScans[row.source_platform]) {
        lastScans[row.source_platform] = row.scraped_at
      }
    })

    // Get platform status - operational if has content
    const platformStatus = {
      reddit: { operational: (queueStats.platforms.reddit || 0) > 0, itemCount: queueStats.platforms.reddit || 0, lastScan: lastScans.reddit || null, status: 'Active' },
      youtube: { operational: (queueStats.platforms.youtube || 0) > 0, itemCount: queueStats.platforms.youtube || 0, lastScan: lastScans.youtube || null, status: 'Active' },
      pixabay: { operational: (queueStats.platforms.pixabay || 0) > 0, itemCount: queueStats.platforms.pixabay || 0, lastScan: lastScans.pixabay || null, status: 'Active' },
      giphy: { operational: (queueStats.platforms.giphy || 0) > 0, itemCount: queueStats.platforms.giphy || 0, lastScan: lastScans.giphy || null, status: 'Active' },
      bluesky: { operational: (queueStats.platforms.bluesky || 0) > 0, itemCount: queueStats.platforms.bluesky || 0, lastScan: lastScans.bluesky || null, status: 'Active' },
      tumblr: { operational: (queueStats.platforms.tumblr || 0) > 0, itemCount: queueStats.platforms.tumblr || 0, lastScan: lastScans.tumblr || null, status: 'Active' },
      imgur: { operational: (queueStats.platforms.imgur || 0) > 0, itemCount: queueStats.platforms.imgur || 0, lastScan: lastScans.imgur || null, status: 'Active' },
      lemmy: { operational: (queueStats.platforms.lemmy || 0) > 0, itemCount: queueStats.platforms.lemmy || 0, lastScan: lastScans.lemmy || null, status: 'Active' }
    }

    // Calculate API savings
    const daysOverCapacity = Math.max(0, queueStats.daysOfContent - 14)
    const callsSavedToday = daysOverCapacity > 0 ? 80 : 0 // 8 platforms * ~10 calls each
    const estimatedMonthlySavings = callsSavedToday * 30

    // Generate alerts based on current state
    const alerts = []
    
    if (contentBalance.video === 0) {
      alerts.push({
        type: 'critical' as const,
        message: '🚨 CRITICAL: No videos in queue! Content variety at risk.',
        action: 'Add videos now'
      })
    }
    
    if (contentBalance.gif < 15) {
      alerts.push({
        type: 'warning' as const,
        message: `⚠️ Low GIF content: ${contentBalance.gif.toFixed(1)}% (target: 25%)`,
        action: 'Add more GIFs'
      })
    }
    
    if (queueStats.daysOfContent > 30) {
      alerts.push({
        type: 'info' as const,
        message: `📋 Queue well stocked: ${queueStats.daysOfContent.toFixed(1)} days of content`,
        action: 'Review content quality'
      })
    }

    if (contentBalance.text > 10) {
      alerts.push({
        type: 'warning' as const,
        message: `📝 High text content: ${contentBalance.text.toFixed(1)}% (target: 5%)`,
        action: 'Balance with media'
      })
    }

    const data = {
      queueStats: {
        totalApproved: queueStats.totalApproved,
        totalPending: queueStats.totalPending,
        totalContent: queueStats.totalApproved + queueStats.totalPending,
        daysOfContent: queueStats.daysOfContent,
        needsScanning: queueStats.needsScanning,
        contentBalance
      },
      postingSchedule: {
        todaysPosts,
        nextPost,
        upcomingPosts
      },
      platformStatus,
      apiSavings: {
        callsSavedToday,
        estimatedMonthlySavings,
        nextScanDate: daysOverCapacity > 0 ? new Date(Date.now() + daysOverCapacity * 24 * 60 * 60 * 1000) : new Date()
      },
      alerts
    }

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error) {
    console.error('Failed to get dashboard data:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}