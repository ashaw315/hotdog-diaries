import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  console.log('🚀 Manual post-now triggered...')
  
  try {
    // Auth check
    let userId: string | null = null
    let username: string | null = null

    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
        if (decoded.username === 'admin' && decoded.id === 1) {
          userId = '1'
          username = 'admin'
        }
      } catch (e) {
        // Fall through to normal auth
      }
    }

    if (!userId) {
      userId = request.headers.get('x-user-id')
      username = request.headers.get('x-username')
    }

    if (!userId || !username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ Authentication successful for post-now')

    const supabase = createSimpleClient()
    
    // Parse request body for options
    const body = await request.json().catch(() => ({}))
    const { 
      maxPosts = 1,
      contentType = null, // Filter by content type if specified 
      platform = null,    // Filter by platform if specified
      forcePost = false   // Override recent post checks
    } = body

    // 1. Find the best approved content to post
    let query = supabase
      .from('content_queue')
      .select(`
        id, content_text, content_image_url, content_video_url, 
        content_type, source_platform, original_url, original_author,
        content_hash, confidence_score, created_at
      `)
      .eq('is_approved', true)
      .eq('is_posted', false)
      .order('confidence_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(maxPosts * 2) // Get extra in case some fail

    // Apply filters if specified
    if (contentType) {
      query = query.eq('content_type', contentType)
    }
    if (platform) {
      query = query.eq('source_platform', platform)
    }

    const { data: availableContent, error: selectError } = await query

    if (selectError) {
      console.error('❌ Error selecting content:', selectError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to select content for posting' 
      }, { status: 500 })
    }

    if (!availableContent || availableContent.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No approved content available for posting',
        suggestion: 'Run a content scan or manually approve some content first'
      }, { status: 404 })
    }

    // 2. Post the selected content
    const postedItems = []
    const errors = []
    const now = new Date().toISOString()

    for (const content of availableContent.slice(0, maxPosts)) {
      try {
        // Mark content as posted in content_queue
        const { error: updateError } = await supabase
          .from('content_queue')
          .update({ 
            is_posted: true, 
            updated_at: now 
          })
          .eq('id', content.id)

        if (updateError) {
          errors.push(`Failed to mark content ${content.id} as posted: ${updateError.message}`)
          continue
        }

        // Add to posted_content table
        const { data: postedData, error: postError } = await supabase
          .from('posted_content')
          .insert({
            content_queue_id: content.id,
            posted_at: now,
            scheduled_time: null, // Manual post - not scheduled
            post_order: Math.floor(Date.now() / 1000) // Use timestamp as order
          })
          .select()
          .single()

        if (postError) {
          errors.push(`Failed to record posted content ${content.id}: ${postError.message}`)
          
          // Revert the content_queue update
          await supabase
            .from('content_queue')
            .update({ is_posted: false })
            .eq('id', content.id)
          continue
        }

        postedItems.push({
          contentId: content.id,
          contentText: content.content_text?.substring(0, 100) + '...',
          contentType: content.content_type,
          platform: content.source_platform,
          originalAuthor: content.original_author,
          postedAt: now,
          postId: postedData.id
        })

        console.log(`✅ Posted content ${content.id}: ${content.content_text?.substring(0, 50)}...`)
      } catch (itemError) {
        const errorMessage = itemError instanceof Error ? itemError.message : 'Unknown error'
        errors.push(`Content ${content.id}: ${errorMessage}`)
        console.error(`❌ Failed to post content ${content.id}:`, itemError)
      }
    }

    // 3. Get updated queue stats
    const { data: queueStats } = await supabase
      .from('content_queue')
      .select('id, is_approved, is_posted')

    const stats = {
      totalContent: queueStats?.length || 0,
      approvedContent: queueStats?.filter(c => c.is_approved && !c.is_posted).length || 0,
      postedContent: queueStats?.filter(c => c.is_posted).length || 0,
      daysOfContent: Math.floor((queueStats?.filter(c => c.is_approved && !c.is_posted).length || 0) / 6)
    }

    const successCount = postedItems.length
    const success = successCount > 0

    console.log(`📊 Post-now complete: ${successCount} items posted, ${errors.length} errors`)

    return NextResponse.json({
      success,
      message: success 
        ? `Successfully posted ${successCount} item${successCount > 1 ? 's' : ''}!`
        : 'No content was posted due to errors',
      posted: successCount,
      requested: maxPosts,
      items: postedItems,
      stats,
      errors: errors.length > 0 ? errors : undefined,
      nextActions: {
        recommendedActions: stats.approvedContent < 6 ? ['Run content scan', 'Approve more content'] : ['Content queue healthy'],
        daysRemaining: stats.daysOfContent
      }
    }, { status: success ? 200 : 500 })

  } catch (error) {
    console.error('❌ Critical error in post-now:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      posted: 0
    }, { status: 500 })
  }
}

// GET endpoint for posting status and available content
export async function GET(request: NextRequest) {
  try {
    // Auth check
    let userId: string | null = null
    let username: string | null = null

    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
        if (decoded.username === 'admin' && decoded.id === 1) {
          userId = '1'
          username = 'admin'
        }
      } catch (e) {
        // Fall through
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSimpleClient()

    // Get available content for posting
    const { data: availableContent, error: contentError } = await supabase
      .from('content_queue')
      .select(`
        id, content_text, content_type, source_platform, 
        confidence_score, is_approved, is_posted, created_at
      `)
      .eq('is_approved', true)
      .eq('is_posted', false)
      .order('confidence_score', { ascending: false })
      .limit(10)

    // Get recent posts
    const { data: recentPosts, error: postsError } = await supabase
      .from('posted_content')
      .select(`
        id, posted_at, content_queue_id,
        content_queue (content_text, source_platform, content_type)
      `)
      .order('posted_at', { ascending: false })
      .limit(5)

    return NextResponse.json({
      success: true,
      availableContent: availableContent || [],
      recentPosts: recentPosts || [],
      readyToPost: availableContent?.length || 0,
      mealTimes: [
        { hour: 7, minute: 0, name: 'breakfast' },
        { hour: 12, minute: 0, name: 'lunch' },
        { hour: 15, minute: 0, name: 'snack' },
        { hour: 18, minute: 0, name: 'dinner' },
        { hour: 20, minute: 0, name: 'evening' },
        { hour: 22, minute: 0, name: 'late_night' }
      ]
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}