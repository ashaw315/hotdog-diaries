import { NextRequest, NextResponse } from 'next/server'
import { lemmyScanningService } from '@/lib/services/lemmy-scanning'

export async function GET(request: NextRequest) {
  try {
    console.log('🌭 Testing Lemmy community content fetching...')
    
    // Get the scan configuration
    const config = await lemmyScanningService.getScanConfig()
    
    // Test fetching from each community directly
    const communityTests = []
    
    for (const community of config.targetCommunities) {
      try {
        // Use the internal method to fetch posts (we need to access it)
        const response = await fetch(`https://${community.instance}/api/v3/post/list?community_name=${encodeURIComponent(community.community)}&sort=Hot&limit=5`)
        
        if (response.ok) {
          const data = await response.json()
          const posts = data.posts || []
          
          const processedPosts = posts.slice(0, 3).map((item: any) => ({
            id: item.post.id,
            title: item.post.name,
            body_preview: item.post.body ? item.post.body.substring(0, 100) + (item.post.body.length > 100 ? '...' : '') : null,
            title_length: item.post.name ? item.post.name.length : 0,
            body_length: item.post.body ? item.post.body.length : 0,
            score: item.counts.score,
            author: item.creator?.name,
            has_image: !!item.post.url && (item.post.url.includes('.jpg') || item.post.url.includes('.png') || item.post.url.includes('.jpeg') || item.post.url.includes('pictrs')),
            has_video: !!item.post.url && (item.post.url.includes('.mp4') || item.post.url.includes('video')),
            url: item.post.url,
            published: item.post.published,
            passes_title_filter: item.post.name ? item.post.name.length <= 150 : true,
            passes_body_filter: item.post.body ? item.post.body.length <= 300 : true // Using relaxed community limit
          }))
          
          communityTests.push({
            community: `${community.instance}/c/${community.community}`,
            description: community.description,
            success: true,
            total_posts: posts.length,
            sample_posts: processedPosts,
            quality_analysis: {
              avg_title_length: processedPosts.reduce((sum, p) => sum + p.title_length, 0) / processedPosts.length,
              avg_body_length: processedPosts.reduce((sum, p) => sum + p.body_length, 0) / processedPosts.length,
              posts_with_images: processedPosts.filter(p => p.has_image).length,
              posts_with_videos: processedPosts.filter(p => p.has_video).length,
              posts_passing_filters: processedPosts.filter(p => p.passes_title_filter && p.passes_body_filter).length
            }
          })
        } else {
          communityTests.push({
            community: `${community.instance}/c/${community.community}`,
            description: community.description,
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`
          })
        }
      } catch (error) {
        communityTests.push({
          community: `${community.instance}/c/${community.community}`,
          description: community.description,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    // Perform a full scan test
    const scanResult = await lemmyScanningService.performScan({ maxPosts: 10 })
    
    return NextResponse.json({
      success: true,
      message: 'Lemmy community content analysis completed',
      config: {
        target_communities: config.targetCommunities,
        max_posts_per_scan: config.maxPostsPerScan,
        scan_interval: config.scanInterval
      },
      community_tests: communityTests,
      full_scan_test: {
        total_found: scanResult.totalFound,
        processed: scanResult.processed,
        approved: scanResult.approved,
        rejected: scanResult.rejected,
        approval_rate: scanResult.processed > 0 ? Math.round((scanResult.approved / scanResult.processed) * 100) : 0,
        errors: scanResult.errors
      },
      comparison_with_old_approach: {
        old_approach: "Random search across instances - got political articles, long content",
        new_approach: "Targeted hotdog communities - getting actual hotdog content",
        improvement: "From 0% to 100% approval rate expected"
      }
    })

  } catch (error) {
    console.error('Lemmy community content test error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}