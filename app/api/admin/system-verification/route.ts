import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Running system verification...')
    
    // Check environment variables
    const envChecks = {
      auth: {
        tokenSet: !!process.env.AUTH_TOKEN,
        jwtSecretSet: !!process.env.JWT_SECRET,
        tokenLength: process.env.AUTH_TOKEN?.length || 0
      },
      database: {
        supabaseUrlSet: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseKeySet: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        postgresUrlSet: !!process.env.POSTGRES_URL
      },
      platforms: {
        giphy: !!process.env.GIPHY_API_KEY,
        youtube: !!process.env.YOUTUBE_API_KEY,
        reddit: !!process.env.REDDIT_CLIENT_ID,
        pixabay: !!process.env.PIXABAY_API_KEY,
        imgur: !!process.env.IMGUR_CLIENT_ID,
        bluesky: !!process.env.BLUESKY_IDENTIFIER,
        tumblr: !!process.env.TUMBLR_API_KEY
      }
    }

    // Test database connection
    let databaseStatus = { connected: false, error: null, stats: null }
    try {
      const supabase = createSimpleClient()
      
      // Test basic connection
      const { data: testData, error: testError, count } = await supabase
        .from('content_queue')
        .select('*', { count: 'exact', head: true })

      if (testError) {
        databaseStatus.error = testError.message
      } else {
        databaseStatus.connected = true
        
        // Get comprehensive stats
        const { data: queueData } = await supabase
          .from('content_queue')
          .select('source_platform, is_approved, is_posted')

        const { data: postedData } = await supabase
          .from('posted_content')
          .select(`
            id, posted_at,
            content_queue!inner (source_platform, content_type)
          `)
          .order('posted_at', { ascending: false })
          .limit(10)

        if (queueData) {
          const platformStats: Record<string, any> = {}
          queueData.forEach(item => {
            const platform = item.source_platform
            if (!platformStats[platform]) {
              platformStats[platform] = { total: 0, approved: 0, posted: 0, ready: 0 }
            }
            platformStats[platform].total++
            if (item.is_approved) platformStats[platform].approved++
            if (item.is_posted) platformStats[platform].posted++
            if (item.is_approved && !item.is_posted) platformStats[platform].ready++
          })

          databaseStatus.stats = {
            totalContent: queueData.length,
            approvedContent: queueData.filter(c => c.is_approved).length,
            postedContent: queueData.filter(c => c.is_posted).length,
            readyToPost: queueData.filter(c => c.is_approved && !c.is_posted).length,
            platformDistribution: platformStats,
            recentPosts: postedData?.map(p => ({
              id: p.id,
              posted_at: p.posted_at,
              platform: p.content_queue.source_platform,
              content_type: p.content_queue.content_type
            })) || []
          }
        }
      }
    } catch (dbError) {
      databaseStatus.error = dbError instanceof Error ? dbError.message : 'Unknown database error'
    }

    // Analyze platform diversity issues
    const diversityAnalysis = {
      issues: [] as string[],
      recommendations: [] as string[]
    }

    if (databaseStatus.stats) {
      const { recentPosts, platformDistribution, readyToPost } = databaseStatus.stats
      
      // Check for consecutive platform violations
      let consecutiveViolations = 0
      for (let i = 1; i < recentPosts.length; i++) {
        if (recentPosts[i].platform === recentPosts[i-1].platform) {
          consecutiveViolations++
        }
      }

      if (consecutiveViolations > 0) {
        diversityAnalysis.issues.push(`${consecutiveViolations} consecutive same-platform violations in recent posts`)
        diversityAnalysis.recommendations.push('Enable platform diversity algorithm in posting endpoints')
      }

      // Check platform balance
      const platforms = Object.keys(platformDistribution)
      const platformsWithNoReady = platforms.filter(p => platformDistribution[p].ready === 0)
      
      if (platformsWithNoReady.length > 0) {
        diversityAnalysis.issues.push(`${platformsWithNoReady.length} platforms have no ready content: ${platformsWithNoReady.join(', ')}`)
        diversityAnalysis.recommendations.push('Run content scanning for platforms with no ready content')
      }

      if (readyToPost < 6) {
        diversityAnalysis.issues.push(`Only ${readyToPost} items ready to post - insufficient for daily schedule`)
        diversityAnalysis.recommendations.push('Run comprehensive content scanning and approval')
      }

      // Check for platform dominance
      const readyContentByPlatform = Object.entries(platformDistribution)
        .map(([platform, stats]: [string, any]) => ({ platform, ready: stats.ready }))
        .sort((a, b) => b.ready - a.ready)

      if (readyContentByPlatform[0]?.ready > readyToPost * 0.6) {
        diversityAnalysis.issues.push(`${readyContentByPlatform[0].platform} dominates ready content with ${readyContentByPlatform[0].ready}/${readyToPost} items`)
        diversityAnalysis.recommendations.push('Scan and approve content from underrepresented platforms')
      }
    }

    const healthStatus = diversityAnalysis.issues.length === 0 ? 'healthy' : 
                        diversityAnalysis.issues.length <= 2 ? 'warning' : 'critical'

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL ? 'production' : 'development',
      healthStatus,
      checks: {
        environment: envChecks,
        database: databaseStatus,
        diversity: diversityAnalysis
      },
      quickFixes: [
        'Update AUTH_TOKEN in Vercel to match JWT_SECRET',
        'Run content scanning for platforms with no ready content',
        'Enable useDiverseSelection=true in posting endpoints',
        'Approve more content from underrepresented platforms'
      ]
    })

  } catch (error) {
    console.error('❌ System verification failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      healthStatus: 'error'
    }, { status: 500 })
  }
}