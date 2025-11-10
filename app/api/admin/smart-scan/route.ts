import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

// Smart scanning thresholds for platform content management
// ADJUSTED FOR BETTER DIVERSITY - reduce high-volume platform thresholds
const PLATFORM_THRESHOLDS = {
  // High-volume platforms - REDUCED thresholds to prevent domination
  pixabay: { readyToPost: 15, approved: 40 },  // Was 30/80, now 15/40
  bluesky: { readyToPost: 15, approved: 40 },  // Was 25/70, now 15/40

  // Medium-volume platforms - INCREASED to encourage more diversity
  reddit: { readyToPost: 25, approved: 60 },   // Was 20/50, now 25/60
  giphy: { readyToPost: 25, approved: 60 },    // Was 20/50, now 25/60
  imgur: { readyToPost: 25, approved: 60 },    // Was 20/50, now 25/60

  // Low-volume platforms - INCREASED to prioritize underrepresented content
  youtube: { readyToPost: 20, approved: 50 },  // Was 10/25, now 20/50
  tumblr: { readyToPost: 20, approved: 50 },   // Was 10/25, now 20/50
  lemmy: { readyToPost: 15, approved: 40 },    // Was 8/20, now 15/40
  mastodon: { readyToPost: 15, approved: 40 }  // Was 8/20, now 15/40
}

export async function POST(request: NextRequest) {
  try {
    // Auth check - support both GitHub Actions TOKEN and JWT authentication
    const authHeader = request.headers.get('authorization')
    
    // Method 1: GitHub Actions AUTH_TOKEN (simple bearer token)
    const hasValidToken = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    // Method 2: JWT authentication (for admin dashboard and manual testing)
    let hasValidJWT = false
    if (!hasValidToken && authHeader?.startsWith('Bearer ')) {
      try {
        const { AuthService } = await import('@/lib/services/auth')
        const token = authHeader.substring(7)
        const decoded = AuthService.verifyJWT(token)
        hasValidJWT = decoded && decoded.username === 'admin'
      } catch (jwtError) {
        console.log('JWT verification failed:', jwtError.message)
      }
    }
    
    const isAuthenticated = hasValidToken || hasValidJWT
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { 
      platform,
      forceOverride = false,
      maxPosts = 20,
      skipThresholdCheck = false 
    } = body

    if (!platform) {
      return NextResponse.json({ error: 'Platform parameter required' }, { status: 400 })
    }

    console.log(`🔍 Smart scan check for platform: ${platform}`)

    // Skip threshold check if explicitly requested
    if (skipThresholdCheck || forceOverride) {
      console.log(`⏭️ Skipping threshold check (forceOverride: ${forceOverride}, skipThresholdCheck: ${skipThresholdCheck})`)
      return await performScan(platform, maxPosts, 'threshold_bypassed')
    }

    // Get current platform content status
    const supabase = createSimpleClient()
    const { data: platformContent, error } = await supabase
      .from('content_queue')
      .select('is_approved, is_posted')
      .eq('source_platform', platform)

    if (error) {
      console.error(`❌ Failed to check ${platform} content:`, error.message)
      return NextResponse.json({ error: 'Failed to check content status' }, { status: 500 })
    }

    // Calculate current stats
    const stats = {
      total: platformContent?.length || 0,
      approved: platformContent?.filter(c => c.is_approved).length || 0,
      readyToPost: platformContent?.filter(c => c.is_approved && !c.is_posted).length || 0,
      posted: platformContent?.filter(c => c.is_posted).length || 0
    }

    console.log(`📊 ${platform} current stats:`, stats)

    // Get thresholds for this platform
    const thresholds = PLATFORM_THRESHOLDS[platform.toLowerCase()] || PLATFORM_THRESHOLDS.reddit

    // Decision logic
    const shouldScan = shouldScanPlatform(stats, thresholds, platform)
    
    if (!shouldScan.scan) {
      console.log(`🚫 Skipping ${platform} scan: ${shouldScan.reason}`)
      return NextResponse.json({
        success: true,
        skipped: true,
        platform,
        reason: shouldScan.reason,
        currentStats: stats,
        thresholds,
        message: `${platform} scan skipped - content levels sufficient`,
        nextCheckRecommended: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() // 6 hours
      })
    }

    console.log(`✅ ${platform} scan approved: ${shouldScan.reason}`)
    return await performScan(platform, maxPosts, shouldScan.reason)

  } catch (error) {
    console.error('❌ Smart scan check failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Smart scan check failed'
    }, { status: 500 })
  }
}

// Decision engine for whether to scan a platform
function shouldScanPlatform(stats: any, thresholds: any, platform: string) {
  const { readyToPost, approved, total } = stats
  const { readyToPost: maxReady, approved: maxApproved } = thresholds

  // Priority 1: Always scan if ready-to-post is critically low
  if (readyToPost < 5) {
    return { scan: true, reason: `critical_low_ready_to_post (${readyToPost} < 5)` }
  }

  // Priority 2: Always scan underrepresented platforms (YouTube, Lemmy, Tumblr)
  const underrepresentedPlatforms = ['youtube', 'lemmy', 'tumblr', 'mastodon']
  if (underrepresentedPlatforms.includes(platform.toLowerCase())) {
    if (readyToPost < maxReady) {
      return { scan: true, reason: `underrepresented_platform_below_threshold (${readyToPost} < ${maxReady})` }
    }
  }

  // Priority 3: Skip high-volume platforms if they're at surplus
  const highVolumePlatforms = ['pixabay', 'bluesky']
  if (highVolumePlatforms.includes(platform.toLowerCase())) {
    if (readyToPost >= maxReady) {
      return { scan: false, reason: `high_volume_platform_at_surplus (${readyToPost} >= ${maxReady})` }
    }
  }

  // Priority 4: General threshold check
  if (readyToPost >= maxReady) {
    return { scan: false, reason: `sufficient_ready_to_post_content (${readyToPost} >= ${maxReady})` }
  }

  if (approved >= maxApproved) {
    return { scan: false, reason: `sufficient_approved_content (${approved} >= ${maxApproved})` }
  }

  // Default: scan if below thresholds
  return { scan: true, reason: `below_content_thresholds (ready: ${readyToPost}/${maxReady}, approved: ${approved}/${maxApproved})` }
}

// Perform the actual scan by calling the platform-specific endpoint
async function performScan(platform: string, maxPosts: number, reason: string) {
  const scanUrl = `/api/admin/${platform}/scan`

  try {
    console.log(`🚀 Performing ${platform} scan (${maxPosts} max posts) - Reason: ${reason}`)

    // Construct base URL - use SITE_URL in production, localhost in dev
    const baseUrl = process.env.SITE_URL || 'http://localhost:3000'

    // Create a new request to the platform scan endpoint
    const scanResponse = await fetch(`${baseUrl}${scanUrl}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ maxPosts })
    })

    if (!scanResponse.ok) {
      throw new Error(`Scan request failed: ${scanResponse.status} ${scanResponse.statusText}`)
    }

    const scanResult = await scanResponse.json()
    
    return NextResponse.json({
      success: true,
      scanned: true,
      platform,
      reason,
      maxPostsRequested: maxPosts,
      scanResult,
      message: `${platform} scan completed successfully`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error(`❌ Failed to perform ${platform} scan:`, error)
    return NextResponse.json({
      success: false,
      platform,
      reason,
      error: error instanceof Error ? error.message : 'Scan execution failed'
    }, { status: 500 })
  }
}