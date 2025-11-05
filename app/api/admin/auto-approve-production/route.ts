import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  console.log('🤖 Production Auto-approval API triggered...')
  
  try {
    // Auth check for GitHub Actions
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request options
    const body = await request.json().catch(() => ({}))
    const { 
      forceApproval = false,
      maxItems = 200,
      minConfidenceScore = 0.4,
      balancePlatforms = true
    } = body

    console.log('🔧 Production auto-approval options:', { forceApproval, maxItems, minConfidenceScore, balancePlatforms })

    // Run production auto-approval logic
    const approvalResults = await runProductionAutoApproval(maxItems, minConfidenceScore, forceApproval, balancePlatforms)
    
    // Get updated queue statistics
    const supabase = createSimpleClient()
    const { data: queueData } = await supabase
      .from('content_queue')
      .select('is_approved, is_posted')
    
    const updatedStats = {
      total: queueData?.length || 0,
      approved: queueData?.filter(c => c.is_approved).length || 0,
      readyToPost: queueData?.filter(c => c.is_approved && !c.is_posted).length || 0,
      pendingApproval: queueData?.filter(c => !c.is_approved && !c.is_posted).length || 0,
      daysOfContent: Math.floor((queueData?.filter(c => c.is_approved && !c.is_posted).length || 0) / 6)
    }

    const success = approvalResults.total > 0
    
    console.log(`✅ Production auto-approval complete: ${approvalResults.total} items approved`)
    
    return NextResponse.json({
      success,
      message: success 
        ? `Auto-approved ${approvalResults.total} items successfully in production`
        : 'No items needed approval',
      approvalResults,
      updatedStats,
      recommendations: generateProductionRecommendations(updatedStats),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Production auto-approval failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Production auto-approval failed',
      approvalResults: { immediate: 0, aged24h: 0, aged48h: 0, aged72h: 0, balanced: 0, total: 0 }
    }, { status: 500 })
  }
}

// Core production auto-approval logic using Supabase
async function runProductionAutoApproval(maxItems: number, minConfidenceScore: number, forceApproval: boolean, balancePlatforms: boolean) {
  console.log('🤖 Running production auto-approval with Supabase...')
  
  const supabase = createSimpleClient()
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)
  const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000)
  
  let totalApproved = 0
  const results = { immediate: 0, aged24h: 0, aged48h: 0, aged72h: 0, balanced: 0 }
  
  // 1. Immediately approve high-quality content (confidence >= 0.8)
  const { data: highQualityData, error: highQualityError } = await supabase
    .from('content_queue')
    .select('id')
    .eq('is_approved', false)
    .eq('is_posted', false)
    .gte('confidence_score', 0.8)
    .limit(forceApproval ? maxItems : Math.floor(maxItems * 0.3))
  
  if (!highQualityError && highQualityData?.length) {
    const ids = highQualityData.map(item => item.id)
    const { error: updateError } = await supabase
      .from('content_queue')
      .update({
        is_approved: true,
        updated_at: now.toISOString()
      })
      .in('id', ids)
    
    if (!updateError) {
      results.immediate = highQualityData.length
      totalApproved += results.immediate
      console.log(`✅ Approved ${results.immediate} high-quality items`)
    }
  }
  
  // 2. Approve medium-quality content after 24 hours
  const { data: aged24Data, error: aged24Error } = await supabase
    .from('content_queue')
    .select('id')
    .eq('is_approved', false)
    .eq('is_posted', false)
    .gte('confidence_score', 0.6)
    .lt('confidence_score', 0.8)
    .lte('created_at', oneDayAgo.toISOString())
    .limit(forceApproval ? maxItems : Math.floor(maxItems * 0.25))
  
  if (!aged24Error && aged24Data?.length) {
    const ids = aged24Data.map(item => item.id)
    const { error: updateError } = await supabase
      .from('content_queue')
      .update({
        is_approved: true,
        updated_at: now.toISOString()
      })
      .in('id', ids)
    
    if (!updateError) {
      results.aged24h = aged24Data.length
      totalApproved += results.aged24h
      console.log(`✅ Approved ${results.aged24h} medium-quality aged 24h items`)
    }
  }
  
  // 3. Approve decent content after 48 hours
  const { data: aged48Data, error: aged48Error } = await supabase
    .from('content_queue')
    .select('id')
    .eq('is_approved', false)
    .eq('is_posted', false)
    .gte('confidence_score', 0.5)
    .lt('confidence_score', 0.6)
    .lte('created_at', twoDaysAgo.toISOString())
    .limit(forceApproval ? maxItems : Math.floor(maxItems * 0.25))
  
  if (!aged48Error && aged48Data?.length) {
    const ids = aged48Data.map(item => item.id)
    const { error: updateError } = await supabase
      .from('content_queue')
      .update({
        is_approved: true,
        updated_at: now.toISOString()
      })
      .in('id', ids)
    
    if (!updateError) {
      results.aged48h = aged48Data.length
      totalApproved += results.aged48h
      console.log(`✅ Approved ${results.aged48h} decent-quality aged 48h items`)
    }
  }
  
  // 4. Approve any non-spam content after 72 hours
  const { data: aged72Data, error: aged72Error } = await supabase
    .from('content_queue')
    .select('id')
    .eq('is_approved', false)
    .eq('is_posted', false)
    .gte('confidence_score', minConfidenceScore)
    .lt('confidence_score', 0.5)
    .lte('created_at', threeDaysAgo.toISOString())
    .limit(forceApproval ? maxItems : Math.floor(maxItems * 0.2))
  
  if (!aged72Error && aged72Data?.length) {
    const ids = aged72Data.map(item => item.id)
    const { error: updateError } = await supabase
      .from('content_queue')
      .update({
        is_approved: true,
        updated_at: now.toISOString()
      })
      .in('id', ids)
    
    if (!updateError) {
      results.aged72h = aged72Data.length
      totalApproved += results.aged72h
      console.log(`✅ Approved ${results.aged72h} non-spam aged 72h items`)
    }
  }
  
  // 5. Platform-balanced approval for underrepresented platforms
  if (balancePlatforms) {
    const platformBalanceResult = await runProductionPlatformBalancing(maxItems * 0.2, minConfidenceScore)
    results.balanced = platformBalanceResult
    totalApproved += results.balanced
  }
  
  console.log(`🎉 Production progressive approval complete: ${totalApproved} total items approved`)
  console.log('📊 Breakdown:', results)
  
  return {
    ...results,
    total: totalApproved
  }
}

// Production platform balancing using Supabase
async function runProductionPlatformBalancing(maxPerPlatform: number, minConfidenceScore: number) {
  console.log('🎯 Running production platform balancing...')
  
  const supabase = createSimpleClient()
  
  // First, get current platform distribution of approved content
  const { data: approvedDistribution, error: distError } = await supabase
    .from('content_queue')
    .select('source_platform')
    .eq('is_approved', true)
    .eq('is_posted', false)
  
  if (distError) {
    console.error('❌ Failed to get platform distribution:', distError.message)
    return 0
  }
  
  // Calculate current approved counts per platform
  const platformCounts: Record<string, number> = {}
  approvedDistribution?.forEach(item => {
    platformCounts[item.source_platform] = (platformCounts[item.source_platform] || 0) + 1
  })
  
  // Identify underrepresented platforms (those with < 10 approved items)
  const underrepresentedPlatforms = ['youtube', 'reddit', 'giphy', 'imgur', 'tumblr', 'lemmy', 'mastodon']
    .filter(platform => (platformCounts[platform] || 0) < 10)
  
  console.log('📊 Current approved distribution:', platformCounts)
  console.log('🎯 Underrepresented platforms:', underrepresentedPlatforms)
  
  let totalBalanced = 0
  
  // Approve content from underrepresented platforms
  for (const platform of underrepresentedPlatforms) {
    try {
      const { data: platformData, error: platformError } = await supabase
        .from('content_queue')
        .select('id')
        .eq('is_approved', false)
        .eq('is_posted', false)
        .eq('source_platform', platform)
        .gte('confidence_score', minConfidenceScore)
        .order('confidence_score', { ascending: false })
        .limit(Math.floor(maxPerPlatform))
      
      if (!platformError && platformData?.length) {
        const ids = platformData.map(item => item.id)
        const { error: updateError } = await supabase
          .from('content_queue')
          .update({
            is_approved: true,
            updated_at: new Date().toISOString()
          })
          .in('id', ids)
        
        if (!updateError) {
          totalBalanced += platformData.length
          console.log(`✅ Balanced platform ${platform}: approved ${platformData.length} items`)
        } else {
          console.error(`❌ Failed to approve ${platform} content:`, updateError.message)
        }
      }
    } catch (error) {
      console.error(`❌ Platform balancing failed for ${platform}:`, error)
    }
  }
  
  console.log(`🎯 Platform balancing complete: ${totalBalanced} items approved for balance`)
  return totalBalanced
}

// Generate recommendations based on queue status
function generateProductionRecommendations(stats: any): string[] {
  const recommendations = []
  
  if (stats.daysOfContent < 7) {
    recommendations.push('URGENT: Run comprehensive content scanning across all platforms')
  } else if (stats.daysOfContent < 14) {
    recommendations.push('Run additional platform scanning, prioritizing underrepresented platforms')
  }
  
  if (stats.pendingApproval > 100) {
    recommendations.push('High volume of pending approval - run auto-approval more frequently')
  } else if (stats.pendingApproval < 20) {
    recommendations.push('Content pipeline healthy - maintain current scanning frequency')
  }
  
  if (stats.daysOfContent > 30) {
    recommendations.push('Abundant content - focus on quality and platform diversity')
  }
  
  // Platform-specific recommendations
  recommendations.push('Monitor platform diversity in daily posts')
  recommendations.push('Increase scanning frequency for YouTube, Reddit, Tumblr, and Lemmy')
  recommendations.push('Consider reducing Pixabay and Bluesky dominance in content mix')
  
  return recommendations
}