import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Auth check for admin users
    const authHeader = request.headers.get('authorization')
    
    // Allow both admin token and GitHub Actions token
    const adminToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const isGitHubActions = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!adminToken && !isGitHubActions) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSimpleClient()
    
    // Get posting statistics
    const { data: postedContent, error: postedError } = await supabase
      .from('posted_content')
      .select(`
        id, posted_at, content_queue_id,
        content_queue (content_type, source_platform)
      `)
      .order('posted_at', { ascending: false })

    if (postedError) {
      throw new Error(`Failed to fetch posted content: ${postedError.message}`)
    }

    // Calculate statistics
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    const stats = {
      totalPosted: postedContent?.length || 0,
      postedToday: postedContent?.filter(p => new Date(p.posted_at) >= todayStart).length || 0,
      averageEngagement: 75, // Placeholder - would need engagement tracking
      platformBreakdown: {},
      contentTypeBreakdown: {},
      recentPosts: postedContent?.slice(0, 5) || []
    }

    // Calculate platform and content type breakdowns
    if (postedContent) {
      for (const post of postedContent) {
        const platform = post.content_queue?.source_platform || 'unknown'
        const contentType = post.content_queue?.content_type || 'unknown'
        
        stats.platformBreakdown[platform] = (stats.platformBreakdown[platform] || 0) + 1
        stats.contentTypeBreakdown[contentType] = (stats.contentTypeBreakdown[contentType] || 0) + 1
      }
    }

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('❌ Error fetching posting stats:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}