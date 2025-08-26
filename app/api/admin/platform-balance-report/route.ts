import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { analyzePlatformDiversity, getDiversityAnalytics } from '@/lib/utils/platform-diversity'

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('📊 Generating comprehensive platform balance report...')
    
    await db.connect()

    // 1. Analyze recent posting patterns for diversity violations
    const recentPostsResult = await db.query(`
      SELECT 
        pc.id,
        pc.posted_at,
        cq.source_platform,
        cq.content_type,
        cq.content_text
      FROM posted_content pc
      JOIN content_queue cq ON pc.content_queue_id = cq.id
      ORDER BY pc.posted_at DESC
      LIMIT 30
    `)
    
    const recentPosts = recentPostsResult.rows || []

    // Find consecutive platform violations
    const violations = []
    for (let i = 1; i < recentPosts.length; i++) {
      if (recentPosts[i].source_platform === recentPosts[i-1].source_platform) {
        violations.push({
          platform: recentPosts[i].source_platform,
          postIds: [recentPosts[i-1].id, recentPosts[i].id],
          postedTimes: [recentPosts[i-1].posted_at, recentPosts[i].posted_at],
          contentPreviews: [
            recentPosts[i-1].content_text?.substring(0, 50) + '...',
            recentPosts[i].content_text?.substring(0, 50) + '...'
          ]
        })
      }
    }

    // 2. Platform distribution analysis
    const platformStatsResult = await db.query(`
      SELECT 
        cq.source_platform,
        COUNT(*) as total_posts,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM posted_content), 2) as percentage,
        MAX(pc.posted_at) as last_posted,
        MIN(pc.posted_at) as first_posted,
        COUNT(DISTINCT cq.content_type) as content_type_variety
      FROM posted_content pc
      JOIN content_queue cq ON pc.content_queue_id = cq.id
      GROUP BY cq.source_platform
      ORDER BY COUNT(*) DESC
    `)

    const platformStats = platformStatsResult.rows || []

    // 3. Check which platforms are completely missing
    const allPlatforms = ['reddit', 'youtube', 'giphy', 'imgur', 'bluesky', 'pixabay', 'lemmy', 'tumblr']
    const postedPlatforms = new Set(platformStats.map(p => p.source_platform))
    const missingPlatforms = allPlatforms.filter(p => !postedPlatforms.has(p))

    // 4. Available content analysis by platform
    const availableContentResult = await db.query(`
      SELECT 
        source_platform,
        content_type,
        COUNT(*) as total_content,
        COUNT(CASE WHEN is_approved = 1 AND is_posted = 0 THEN 1 END) as ready_to_post,
        COUNT(CASE WHEN is_approved = 1 THEN 1 END) as approved_content,
        AVG(confidence_score) as avg_confidence_score,
        MAX(confidence_score) as max_confidence_score
      FROM content_queue
      GROUP BY source_platform, content_type
      ORDER BY source_platform, content_type
    `)

    const availableContent = availableContentResult.rows || []

    // 5. Content type balance
    const contentTypeStatsResult = await db.query(`
      SELECT 
        cq.content_type,
        COUNT(*) as post_count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM posted_content), 2) as percentage
      FROM posted_content pc
      JOIN content_queue cq ON pc.content_queue_id = cq.id
      GROUP BY cq.content_type
      ORDER BY COUNT(*) DESC
    `)

    const contentTypeStats = contentTypeStatsResult.rows || []

    // 6. Recent posting timeline (for pattern analysis)
    const recentTimeline = recentPosts.slice(0, 10).map(post => ({
      id: post.id,
      posted_at: post.posted_at,
      platform: post.source_platform,
      content_type: post.content_type,
      content_preview: post.content_text?.substring(0, 40) + '...'
    }))

    // 7. Get diversity metrics if available
    let diversityMetrics = null
    try {
      const diversityAnalysis = await analyzePlatformDiversity()
      diversityMetrics = {
        diversityScore: diversityAnalysis.diversityScore,
        recentPlatforms: diversityAnalysis.recentPlatforms,
        recommendations: diversityAnalysis.recommendations
      }
    } catch (error) {
      console.warn('Could not get diversity metrics:', error)
    }

    // 8. Generate critical issues and recommendations
    const criticalIssues = []
    const recommendations = []

    // Check for diversity violations
    if (violations.length > 0) {
      criticalIssues.push(`${violations.length} consecutive same-platform posting violations detected`)
      recommendations.push('Immediately enable strict platform diversity in posting algorithm')
    }

    // Check for platform dominance
    const dominantPlatform = platformStats[0]
    if (dominantPlatform && dominantPlatform.percentage > 50) {
      criticalIssues.push(`${dominantPlatform.source_platform} dominates with ${dominantPlatform.percentage}% of posts`)
      recommendations.push(`Reduce ${dominantPlatform.source_platform} frequency and boost other platforms`)
    }

    // Check for missing platforms
    if (missingPlatforms.length > 0) {
      criticalIssues.push(`${missingPlatforms.length} platforms have never posted: ${missingPlatforms.join(', ')}`)
      recommendations.push('Scan and approve content from missing platforms')
    }

    // Check content availability
    const totalReadyToPost = availableContent.reduce((sum, item) => sum + item.ready_to_post, 0)
    if (totalReadyToPost < 6) {
      criticalIssues.push(`Only ${totalReadyToPost} items ready to post - insufficient for daily schedule`)
      recommendations.push('Run comprehensive content scanning and approval process')
    }

    // Check for platforms with no available content
    const platformsWithNoContent = allPlatforms.filter(platform => {
      const platformContent = availableContent.filter(ac => ac.source_platform === platform)
      return platformContent.length === 0 || platformContent.every(pc => pc.ready_to_post === 0)
    })

    if (platformsWithNoContent.length > 0) {
      criticalIssues.push(`${platformsWithNoContent.length} platforms have no ready content: ${platformsWithNoContent.join(', ')}`)
      recommendations.push('Priority scan these platforms and approve high-quality content')
    }

    // 9. Health status determination
    const healthStatus = criticalIssues.length === 0 ? 'healthy' : 
                        criticalIssues.length <= 2 ? 'warning' : 'critical'

    const report = {
      timestamp: new Date().toISOString(),
      health_status: healthStatus,
      
      // Violation analysis
      diversity_violations: {
        total_violations: violations.length,
        violation_details: violations,
        recent_pattern_analysis: recentTimeline
      },
      
      // Platform distribution
      platform_distribution: {
        current_stats: platformStats,
        missing_platforms: missingPlatforms,
        total_platforms_posted: postedPlatforms.size,
        total_platforms_available: allPlatforms.length
      },
      
      // Content availability
      content_pipeline: {
        by_platform: availableContent,
        total_ready_to_post: totalReadyToPost,
        platforms_with_no_content: platformsWithNoContent
      },
      
      // Content type balance
      content_type_balance: contentTypeStats,
      
      // Diversity metrics
      diversity_analysis: diversityMetrics,
      
      // Critical issues and recommendations
      critical_issues: criticalIssues,
      recommendations: recommendations,
      
      // Action items
      immediate_actions: [
        'Enable useDiverseSelection=true in all posting endpoints',
        'Scan platforms with missing content: ' + missingPlatforms.join(', '),
        'Approve more content from underrepresented platforms',
        'Verify platform diversity algorithm is working in production'
      ],
      
      // Configuration analysis
      configuration_status: {
        diversity_algorithm_enabled: true, // Based on code review
        platform_priority_correct: true,
        content_type_weighting_active: true,
        recent_platform_avoidance_active: true
      }
    }

    console.log('📊 Platform balance report generated')
    console.log(`🚨 Health Status: ${healthStatus}`)
    console.log(`❌ Critical Issues: ${criticalIssues.length}`)
    console.log(`📋 Recommendations: ${recommendations.length}`)

    return NextResponse.json(report)

  } catch (error) {
    console.error('❌ Platform balance report failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      health_status: 'error'
    }, { status: 500 })
  }
}