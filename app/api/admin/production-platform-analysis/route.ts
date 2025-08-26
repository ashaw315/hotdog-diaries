import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('📊 Analyzing PRODUCTION platform distribution...')
    
    const supabase = createSimpleClient()
    
    // 1. Get recent posts with platform distribution
    const { data: recentPosts, error: postsError } = await supabase
      .from('posted_content')
      .select(`
        id, posted_at,
        content_queue!inner (
          source_platform,
          content_type,
          content_text
        )
      `)
      .order('posted_at', { ascending: false })
      .limit(50)

    if (postsError) {
      throw new Error(`Failed to get recent posts: ${postsError.message}`)
    }

    console.log(`📋 Found ${recentPosts?.length || 0} recent posts in production`)

    // 2. Analyze platform distribution
    const platformStats: Record<string, number> = {}
    const contentTypeStats: Record<string, number> = {}
    const recentPostsData = recentPosts || []

    recentPostsData.forEach(post => {
      const platform = post.content_queue.source_platform
      const contentType = post.content_queue.content_type
      
      platformStats[platform] = (platformStats[platform] || 0) + 1
      contentTypeStats[contentType] = (contentTypeStats[contentType] || 0) + 1
    })

    // 3. Find consecutive platform violations
    const violations = []
    for (let i = 1; i < recentPostsData.length; i++) {
      const current = recentPostsData[i-1]
      const previous = recentPostsData[i]
      
      if (current.content_queue.source_platform === previous.content_queue.source_platform) {
        violations.push({
          platform: current.content_queue.source_platform,
          post1: {
            id: previous.id,
            posted_at: previous.posted_at,
            content: previous.content_queue.content_text?.substring(0, 50) + '...'
          },
          post2: {
            id: current.id, 
            posted_at: current.posted_at,
            content: current.content_queue.content_text?.substring(0, 50) + '...'
          }
        })
      }
    }

    // 4. Check available content by platform in production
    const { data: availableContent, error: contentError } = await supabase
      .from('content_queue')
      .select('source_platform, content_type, is_approved, is_posted, confidence_score')

    if (contentError) {
      throw new Error(`Failed to get available content: ${contentError.message}`)
    }

    // Process available content stats
    const contentPipeline: Record<string, any> = {}
    const allPlatforms = ['reddit', 'youtube', 'giphy', 'imgur', 'bluesky', 'pixabay', 'lemmy', 'tumblr']
    
    // Initialize all platforms
    allPlatforms.forEach(platform => {
      contentPipeline[platform] = {
        total: 0,
        approved: 0,
        ready_to_post: 0,
        posted: 0,
        avg_confidence: 0,
        content_types: {}
      }
    })

    // Process content stats
    availableContent?.forEach(item => {
      const platform = item.source_platform
      
      if (!contentPipeline[platform]) {
        contentPipeline[platform] = {
          total: 0,
          approved: 0,
          ready_to_post: 0,
          posted: 0,
          avg_confidence: 0,
          content_types: {}
        }
      }
      
      contentPipeline[platform].total++
      
      if (item.is_approved) {
        contentPipeline[platform].approved++
        
        if (!item.is_posted) {
          contentPipeline[platform].ready_to_post++
        }
      }
      
      if (item.is_posted) {
        contentPipeline[platform].posted++
      }
      
      const contentType = item.content_type
      contentPipeline[platform].content_types[contentType] = 
        (contentPipeline[platform].content_types[contentType] || 0) + 1
    })

    // Calculate average confidence scores
    for (const platform in contentPipeline) {
      const platformContent = availableContent?.filter(item => 
        item.source_platform === platform && item.confidence_score
      ) || []
      
      if (platformContent.length > 0) {
        const totalConfidence = platformContent.reduce((sum, item) => sum + item.confidence_score, 0)
        contentPipeline[platform].avg_confidence = totalConfidence / platformContent.length
      }
    }

    // 5. Identify missing platforms and critical issues
    const missingPlatforms = allPlatforms.filter(platform => 
      !platformStats[platform] || platformStats[platform] === 0
    )
    
    const platformsNeedingContent = allPlatforms.filter(platform =>
      contentPipeline[platform].ready_to_post === 0
    )

    const platformsWithLowContent = allPlatforms.filter(platform =>
      contentPipeline[platform].ready_to_post > 0 && contentPipeline[platform].ready_to_post < 3
    )

    // 6. Calculate diversity metrics
    const totalPosts = recentPostsData.length
    const uniquePlatforms = Object.keys(platformStats).length
    const maxPossibleDiversity = Math.min(totalPosts, allPlatforms.length)
    const diversityScore = totalPosts > 0 ? uniquePlatforms / maxPossibleDiversity : 0

    // 7. Generate critical issues and recommendations
    const criticalIssues = []
    const recommendations = []

    if (violations.length > 0) {
      criticalIssues.push(`${violations.length} consecutive same-platform violations detected`)
      recommendations.push('Fix platform diversity algorithm immediately')
    }

    if (missingPlatforms.length > 0) {
      criticalIssues.push(`${missingPlatforms.length} platforms never posted: ${missingPlatforms.join(', ')}`)
      recommendations.push('Scan and approve content from missing platforms')
    }

    if (platformsNeedingContent.length > 0) {
      criticalIssues.push(`${platformsNeedingContent.length} platforms have no ready content: ${platformsNeedingContent.join(', ')}`)
      recommendations.push('Priority content scanning for empty platforms')
    }

    // Check for platform dominance
    const sortedPlatforms = Object.entries(platformStats)
      .sort(([,a], [,b]) => b - a)
    
    if (sortedPlatforms.length > 0) {
      const [dominantPlatform, dominantCount] = sortedPlatforms[0]
      const dominantPercentage = (dominantCount / totalPosts) * 100
      
      if (dominantPercentage > 40) {
        criticalIssues.push(`${dominantPlatform} dominates with ${dominantPercentage.toFixed(1)}% of posts`)
        recommendations.push(`Reduce ${dominantPlatform} frequency and diversify`)
      }
    }

    // 8. Health status
    const healthStatus = criticalIssues.length === 0 ? 'healthy' : 
                        criticalIssues.length <= 2 ? 'warning' : 'critical'

    const report = {
      timestamp: new Date().toISOString(),
      health_status: healthStatus,
      
      // Summary stats
      summary: {
        total_recent_posts: totalPosts,
        unique_platforms_posting: uniquePlatforms,
        diversity_score: Math.round(diversityScore * 100) / 100,
        violation_count: violations.length,
        violation_rate: totalPosts > 0 ? Math.round((violations.length / totalPosts) * 100) : 0
      },
      
      // Platform posting distribution (from recent posts)
      platform_posting_stats: Object.entries(platformStats)
        .map(([platform, count]) => ({
          platform,
          post_count: count,
          percentage: Math.round((count / totalPosts) * 100 * 100) / 100
        }))
        .sort((a, b) => b.post_count - a.post_count),
      
      // Content pipeline by platform
      content_pipeline: Object.entries(contentPipeline)
        .map(([platform, stats]) => ({
          platform,
          ...stats,
          status: stats.ready_to_post === 0 ? 'NEEDS_CONTENT' :
                  stats.ready_to_post < 3 ? 'LOW_CONTENT' : 'HEALTHY'
        }))
        .sort((a, b) => b.ready_to_post - a.ready_to_post),
      
      // Diversity violations
      diversity_violations: {
        total_violations: violations.length,
        violation_details: violations.slice(0, 10), // Show first 10
        recent_pattern: recentPostsData.slice(0, 15).map(post => ({
          id: post.id,
          posted_at: post.posted_at,
          platform: post.content_queue.source_platform,
          content_type: post.content_queue.content_type
        }))
      },
      
      // Missing platforms
      missing_platforms: missingPlatforms,
      platforms_needing_content: platformsNeedingContent,
      platforms_with_low_content: platformsWithLowContent,
      
      // Issues and recommendations
      critical_issues: criticalIssues,
      recommendations,
      
      // Immediate actions
      immediate_actions: [
        'Scan platforms with no content: ' + platformsNeedingContent.join(', '),
        'Fix posting algorithm to prevent consecutive same-platform posts',
        'Approve more content from underrepresented platforms',
        violations.length > 0 ? 'Immediately enable strict platform diversity' : 'Monitor posting patterns'
      ].filter(Boolean)
    }

    console.log(`📊 Production analysis complete - Health: ${healthStatus}`)
    console.log(`🚨 Critical Issues: ${criticalIssues.length}`)
    console.log(`📈 Diversity Violations: ${violations.length}/${totalPosts} (${report.summary.violation_rate}%)`)

    return NextResponse.json(report)

  } catch (error) {
    console.error('❌ Production platform analysis failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      health_status: 'error'
    }, { status: 500 })
  }
}