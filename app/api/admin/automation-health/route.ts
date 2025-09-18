import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function GET(_request: NextRequest) {
  try {
    console.log('🔍 Checking automation health...')
    
    const supabase = createSimpleClient()
    
    // Get content statistics by platform
    const { data: contentStats } = await supabase
      .from('content_queue')
      .select('source_platform, created_at, is_approved, is_posted')

    const { data: recentPosts } = await supabase
      .from('posted_content')
      .select(`
        id, posted_at,
        content_queue!inner (source_platform, content_type)
      `)
      .order('posted_at', { ascending: false })
      .limit(10)

    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Analyze platform activity
    const platformHealth: Record<string, any> = {}
    const allPlatforms = ['youtube', 'reddit', 'giphy', 'imgur', 'bluesky', 'pixabay', 'lemmy', 'tumblr', 'mastodon']
    
    allPlatforms.forEach(platform => {
      platformHealth[platform] = {
        total: 0,
        approved: 0,
        readyToPost: 0,
        posted: 0,
        addedToday: 0,
        addedThisWeek: 0,
        lastScanDate: null,
        status: 'unknown'
      }
    })

    contentStats?.forEach(item => {
      const platform = item.source_platform
      const createdAt = new Date(item.created_at)
      
      if (platformHealth[platform]) {
        platformHealth[platform].total++
        if (item.is_approved) platformHealth[platform].approved++
        if (item.is_approved && !item.is_posted) platformHealth[platform].readyToPost++
        if (item.is_posted) platformHealth[platform].posted++
        
        if (createdAt > oneDayAgo) platformHealth[platform].addedToday++
        if (createdAt > oneWeekAgo) platformHealth[platform].addedThisWeek++
        
        if (!platformHealth[platform].lastScanDate || createdAt > new Date(platformHealth[platform].lastScanDate)) {
          platformHealth[platform].lastScanDate = item.created_at
        }
      }
    })

    // Determine health status for each platform
    Object.keys(platformHealth).forEach(platform => {
      const stats = platformHealth[platform]
      const daysSinceLastScan = stats.lastScanDate 
        ? Math.floor((now.getTime() - new Date(stats.lastScanDate).getTime()) / (24 * 60 * 60 * 1000))
        : 999

      if (stats.readyToPost === 0) {
        stats.status = 'critical'
        stats.issue = 'No ready content'
      } else if (stats.readyToPost < 3) {
        stats.status = 'warning'
        stats.issue = 'Low content'
      } else if (daysSinceLastScan > 7) {
        stats.status = 'warning'
        stats.issue = 'Scanning stale'
      } else {
        stats.status = 'healthy'
      }

      stats.daysSinceLastScan = daysSinceLastScan
    })

    // Calculate posting patterns
    const postingPatterns: {
      totalPostsToday: number
      recentPlatforms: string[]
      diversityViolations: number
      lastPostedPlatform: string | null
      postsLast24h: number
    } = {
      totalPostsToday: 0,
      recentPlatforms: [],
      diversityViolations: 0,
      lastPostedPlatform: null,
      postsLast24h: 0
    }

    if (recentPosts && Array.isArray(recentPosts)) {
      const typedRecentPosts = recentPosts as Array<{ 
        posted_at: string; 
        content_queue?: { source_platform: string; content_type: string } 
      }>
      
      postingPatterns.recentPlatforms = typedRecentPosts.map(p => p.content_queue?.source_platform).filter(Boolean) as string[]
      postingPatterns.lastPostedPlatform = typedRecentPosts[0]?.content_queue?.source_platform || null
      
      // Count violations (consecutive same platform)
      for (let i = 1; i < typedRecentPosts.length; i++) {
        if (typedRecentPosts[i]?.content_queue?.source_platform === typedRecentPosts[i-1]?.content_queue?.source_platform) {
          postingPatterns.diversityViolations++
        }
      }

      // Posts in last 24h
      postingPatterns.postsLast24h = typedRecentPosts.filter(p => 
        new Date(p.posted_at) > oneDayAgo
      ).length
    }

    // Overall health assessment
    const criticalPlatforms = Object.entries(platformHealth).filter(([_, stats]) => stats.status === 'critical')
    const warningPlatforms = Object.entries(platformHealth).filter(([_, stats]) => stats.status === 'warning')
    const totalReadyContent = Object.values(platformHealth).reduce((sum, stats) => sum + stats.readyToPost, 0)
    const daysOfContentRemaining = Math.floor(totalReadyContent / 6) // 6 posts per day

    const overallHealth = criticalPlatforms.length > 0 ? 'critical' :
                         warningPlatforms.length > 3 ? 'warning' : 
                         daysOfContentRemaining < 7 ? 'warning' : 'healthy'

    // Generate recommendations
    const recommendations = []
    if (criticalPlatforms.length > 0) {
      recommendations.push(`Immediate scanning needed for: ${criticalPlatforms.map(([p]) => p).join(', ')}`)
    }
    if (postingPatterns.diversityViolations > 0) {
      recommendations.push(`${postingPatterns.diversityViolations} platform diversity violations detected`)
    }
    if (daysOfContentRemaining < 14) {
      recommendations.push(`Only ${daysOfContentRemaining} days of content remaining`)
    }

    return NextResponse.json({
      timestamp: now.toISOString(),
      overallHealth,
      
      // Platform health details
      platformHealth: Object.entries(platformHealth)
        .map(([platform, stats]) => ({ platform, ...stats }))
        .sort((a, b) => {
          if (a.status === 'critical' && b.status !== 'critical') return -1
          if (b.status === 'critical' && a.status !== 'critical') return 1
          return b.readyToPost - a.readyToPost
        }),

      // Content pipeline summary  
      contentSummary: {
        totalReady: totalReadyContent,
        daysRemaining: daysOfContentRemaining,
        addedToday: Object.values(platformHealth).reduce((sum, stats: any) => sum + stats.addedToday, 0),
        addedThisWeek: Object.values(platformHealth).reduce((sum, stats: any) => sum + stats.addedThisWeek, 0)
      },

      // Posting health
      postingHealth: {
        ...postingPatterns,
        diversityScore: postingPatterns.recentPlatforms.length > 0 
          ? new Set(postingPatterns.recentPlatforms.slice(0, 5)).size / Math.min(5, postingPatterns.recentPlatforms.length)
          : 0,
        recommendedAction: postingPatterns.diversityViolations > 0 
          ? 'Enable strict platform diversity' 
          : 'Continue current posting pattern'
      },

      // Critical issues
      criticalIssues: criticalPlatforms.map(([platform, stats]) => 
        `${platform}: ${stats.issue} (${stats.daysSinceLastScan} days since scan)`
      ),

      recommendations,

      // Next actions
      nextActions: [
        ...criticalPlatforms.map(([platform]) => `Scan ${platform} immediately`),
        daysOfContentRemaining < 14 ? 'Run comprehensive content scanning' : null,
        postingPatterns.diversityViolations > 0 ? 'Fix platform diversity violations' : null
      ].filter(Boolean)
    })

  } catch (error) {
    console.error('❌ Automation health check failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      overallHealth: 'error'
    }, { status: 500 })
  }
}