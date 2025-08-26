import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🚨 Emergency content rebalancing started...')
    
    // Auth check
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSimpleClient()
    const results: Record<string, any> = {}

    // 1. Reduce Bluesky dominance (from 174 to ~24 items)
    console.log('📉 Step 1: Reducing Bluesky dominance...')
    
    // Get lowest scoring Bluesky content to unapprove
    const { data: blueskyToRemove, error: blueskyError } = await supabase
      .from('content_queue')
      .select('id, confidence_score')
      .eq('source_platform', 'bluesky')
      .eq('is_posted', false)
      .eq('is_approved', true)
      .order('confidence_score', { ascending: true })
      .limit(150)

    if (blueskyError) {
      throw new Error(`Failed to get Bluesky content: ${blueskyError.message}`)
    }

    if (blueskyToRemove && blueskyToRemove.length > 0) {
      const blueskyIds = blueskyToRemove.map(item => item.id)
      
      const { error: unapproveError } = await supabase
        .from('content_queue')
        .update({ is_approved: false })
        .in('id', blueskyIds)

      if (unapproveError) {
        throw new Error(`Failed to unapprove Bluesky content: ${unapproveError.message}`)
      }

      results.bluesky_reduced = blueskyToRemove.length
      console.log(`✅ Unapproved ${blueskyToRemove.length} low-quality Bluesky items`)
    }

    // 2. Approve more YouTube content
    console.log('🎬 Step 2: Approving more YouTube content...')
    
    const { data: youtubeToApprove, error: youtubeError } = await supabase
      .from('content_queue')
      .select('id, confidence_score')
      .eq('source_platform', 'youtube')
      .eq('is_posted', false)
      .eq('is_approved', false)
      .gte('confidence_score', 0.3)
      .order('confidence_score', { ascending: false })
      .limit(20)

    if (!youtubeError && youtubeToApprove && youtubeToApprove.length > 0) {
      const youtubeIds = youtubeToApprove.map(item => item.id)
      
      const { error: approveYouTubeError } = await supabase
        .from('content_queue')
        .update({ is_approved: true })
        .in('id', youtubeIds)

      if (!approveYouTubeError) {
        results.youtube_approved = youtubeToApprove.length
        console.log(`✅ Approved ${youtubeToApprove.length} YouTube items`)
      }
    }

    // 3. Balance other platforms
    console.log('⚖️ Step 3: Balancing other platforms...')
    
    const { data: otherToApprove, error: otherError } = await supabase
      .from('content_queue')
      .select('id, source_platform, confidence_score')
      .in('source_platform', ['reddit', 'lemmy', 'tumblr', 'mastodon'])
      .eq('is_posted', false)
      .eq('is_approved', false)
      .gte('confidence_score', 0.4)
      .order('confidence_score', { ascending: false })
      .limit(30)

    if (!otherError && otherToApprove && otherToApprove.length > 0) {
      const otherIds = otherToApprove.map(item => item.id)
      
      const { error: approveOtherError } = await supabase
        .from('content_queue')
        .update({ is_approved: true })
        .in('id', otherIds)

      if (!approveOtherError) {
        results.other_platforms_approved = otherToApprove.length
        console.log(`✅ Approved ${otherToApprove.length} items from other platforms`)
      }
    }

    // 4. Get updated statistics
    const { data: newStats } = await supabase
      .from('content_queue')
      .select('source_platform, is_approved, is_posted')

    const platformStats: Record<string, any> = {}
    if (newStats) {
      newStats.forEach(item => {
        const platform = item.source_platform
        if (!platformStats[platform]) {
          platformStats[platform] = { total: 0, approved: 0, ready: 0 }
        }
        platformStats[platform].total++
        if (item.is_approved) platformStats[platform].approved++
        if (item.is_approved && !item.is_posted) platformStats[platform].ready++
      })
    }

    const totalReady = Object.values(platformStats).reduce((sum: number, stats: any) => sum + stats.ready, 0)

    console.log('📊 Rebalancing complete!')

    return NextResponse.json({
      success: true,
      message: 'Emergency rebalancing completed successfully',
      changes: results,
      new_distribution: Object.entries(platformStats)
        .map(([platform, stats]: [string, any]) => ({
          platform,
          ready: stats.ready,
          percentage: totalReady > 0 ? Math.round((stats.ready / totalReady) * 100) : 0
        }))
        .sort((a, b) => b.ready - a.ready),
      summary: {
        total_ready: totalReady,
        bluesky_percentage: totalReady > 0 ? Math.round((platformStats.bluesky?.ready || 0) / totalReady * 100) : 0,
        youtube_ready: platformStats.youtube?.ready || 0
      }
    })

  } catch (error) {
    console.error('❌ Emergency rebalancing failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}