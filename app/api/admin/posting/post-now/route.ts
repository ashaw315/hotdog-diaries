import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'
import { selectUniqueContentToPost, verifyContentUniqueness } from '@/lib/utils/posting-deduplication'

export async function POST(request: NextRequest) {
  console.log('🚀 Manual post-now triggered...')
  
  try {
    // Auth check for GitHub Actions
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
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

    // 1. Find unique approved content to post (with duplicate checking)
    let availableContent
    try {
      availableContent = await selectUniqueContentToPost({
        maxPosts: maxPosts * 2, // Get extra candidates
        contentType,
        platform,
        forcePost
      })
    } catch (error) {
      console.error('❌ Error selecting unique content:', error)
      return NextResponse.json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to select unique content for posting',
        suggestion: 'Try running cleanup-duplicates or approve more content'
      }, { status: 404 })
    }

    // 2. Post the selected content
    const postedItems = []
    const errors = []
    const now = new Date().toISOString()

    for (const content of availableContent.slice(0, maxPosts)) {
      try {
        // Double-check uniqueness before posting
        const uniqueCheck = await verifyContentUniqueness(content.id)
        if (!uniqueCheck.isUnique) {
          console.log(`🔍 Skipping content ${content.id}: ${uniqueCheck.reason}`)
          errors.push(`Content ${content.id} skipped: ${uniqueCheck.reason}`)
          continue
        }
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
    // Auth check for GitHub Actions
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
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