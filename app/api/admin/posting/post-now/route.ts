import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'
import { selectUniqueContentToPost, verifyContentUniqueness } from '@/lib/utils/posting-deduplication'
import { selectDiverseContent, analyzePlatformDiversity } from '@/lib/utils/platform-diversity'
import { db } from '@/lib/db'

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

    const isDevelopment = process.env.NODE_ENV === 'development'
    
    // Parse request body for options
    const body = await request.json().catch(() => ({}))
    const { 
      maxPosts = 1,
      contentType = null, // Filter by content type if specified 
      platform = null,    // Filter by platform if specified
      forcePost = false,  // Override recent post checks
      useDiverseSelection = true, // Use platform diversity algorithm (default: true)
      mealTime = null     // Meal time for rotation-based selection
    } = body

    // 1. Select content using platform diversity algorithm or fallback to unique selection
    let availableContent
    try {
      if (useDiverseSelection && !platform) {
        // Use the new platform diversity algorithm for better content selection
        console.log('🎯 Using platform diversity selection algorithm')
        const diversityAnalysis = await analyzePlatformDiversity()
        console.log('📊 Current diversity score:', diversityAnalysis.diversityScore)
        console.log('🔍 Recent platforms:', diversityAnalysis.recentPlatforms.slice(0, 3))
        
        availableContent = await selectDiverseContent({
          maxPosts,
          mealTime: mealTime || getCurrentMealTime(),
          avoidRecentPlatforms: true,
          enforceContentTypeMix: maxPosts > 1
        })
        
        console.log('✅ Platform diversity selection successful')
      } else {
        // Fallback to original unique selection (for specific platform requests or legacy mode)
        console.log('📋 Using legacy unique content selection')
        availableContent = await selectUniqueContentToPost({
          maxPosts: maxPosts * 2, // Get extra candidates
          contentType,
          platform,
          forcePost
        })
      }
    } catch (error) {
      console.error('❌ Error selecting content:', error)
      
      // If diverse selection fails, try fallback to unique selection
      if (useDiverseSelection && !platform) {
        console.log('🔄 Diverse selection failed, trying fallback to unique selection...')
        try {
          availableContent = await selectUniqueContentToPost({
            maxPosts: maxPosts * 2,
            contentType,
            platform,
            forcePost: true // Force post to get any available content
          })
          console.log('✅ Fallback selection successful')
        } catch (fallbackError) {
          return NextResponse.json({ 
            success: false, 
            error: `Both diverse and fallback selection failed. Original: ${error instanceof Error ? error.message : 'Unknown'}. Fallback: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown'}`,
            suggestion: 'Try running cleanup-duplicates, approve more content, or enable more platforms'
          }, { status: 404 })
        }
      } else {
        return NextResponse.json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to select content for posting',
          suggestion: 'Try running cleanup-duplicates or approve more content'
        }, { status: 404 })
      }
    }

    // 2. Post the selected content
    const postedItems = []
    const errors = []
    const now = new Date().toISOString()

    for (const content of availableContent.slice(0, maxPosts)) {
      try {
        // Double-check uniqueness before posting (skip for diverse selection as it already handles this)
        if (!useDiverseSelection) {
          const uniqueCheck = await verifyContentUniqueness(content.id)
          if (!uniqueCheck.isUnique) {
            console.log(`🔍 Skipping content ${content.id}: ${uniqueCheck.reason}`)
            errors.push(`Content ${content.id} skipped: ${uniqueCheck.reason}`)
            continue
          }
        } else {
          console.log(`🎯 Using diverse selection - skipping redundant uniqueness check for content ${content.id}`)
        }
        // Database operations using abstraction
        if (isDevelopment) {
          await db.connect()
          
          // Mark content as posted in content_queue
          console.log(`🔄 Updating content_queue for ID ${content.id}...`)
          const updateResult = await db.query(
            'UPDATE content_queue SET is_posted = 1, updated_at = ? WHERE id = ?',
            [now, content.id]
          )
          
          console.log(`📝 Update result:`, { changes: updateResult.changes, affected: updateResult.rowCount })
          
          const rowsAffected = updateResult.changes || updateResult.rowCount || 0
          if (rowsAffected === 0) {
            errors.push(`Failed to mark content ${content.id} as posted: No rows affected (changes: ${updateResult.changes}, rowCount: ${updateResult.rowCount})`)
            continue
          }

          // Add to posted_content table
          console.log(`📝 Inserting into posted_content for ID ${content.id}...`)
          const insertResult = await db.query(
            'INSERT INTO posted_content (content_queue_id, posted_at, scheduled_time, post_order) VALUES (?, ?, NULL, ?)',
            [content.id, now, Math.floor(Date.now() / 1000)]
          )
          
          console.log(`📝 Insert result:`, { changes: insertResult.changes, insertId: insertResult.insertId, rowCount: insertResult.rowCount })
          
          const insertRowsAffected = insertResult.changes || insertResult.rowCount || 0
          if (insertRowsAffected === 0) {
            errors.push(`Failed to record posted content ${content.id}: Insert failed (changes: ${insertResult.changes}, rowCount: ${insertResult.rowCount})`)
            
            // Revert the content_queue update
            await db.query('UPDATE content_queue SET is_posted = 0 WHERE id = ?', [content.id])
            continue
          }
          
          // Get the inserted ID
          const insertedId = insertResult.insertId || insertResult.changes
          var postedData = { id: insertedId }
          
          console.log(`✅ Successfully posted content ${content.id} with posted_content ID ${insertedId}`)
        } else {
          const supabase = createSimpleClient()
          
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
          const { data: supabasePostedData, error: postError } = await supabase
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
          
          var postedData = supabasePostedData
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
    let stats
    
    if (isDevelopment) {
      await db.connect()
      
      const totalResult = await db.query('SELECT COUNT(*) as count FROM content_queue')
      const approvedResult = await db.query('SELECT COUNT(*) as count FROM content_queue WHERE is_approved = 1 AND is_posted = 0')
      const postedResult = await db.query('SELECT COUNT(*) as count FROM content_queue WHERE is_posted = 1')
      
      const totalContent = totalResult.rows[0]?.count || 0
      const approvedContent = approvedResult.rows[0]?.count || 0  
      const postedContent = postedResult.rows[0]?.count || 0
      
      stats = {
        totalContent,
        approvedContent,
        postedContent,
        daysOfContent: Math.floor(approvedContent / 6)
      }
    } else {
      const supabase = createSimpleClient()
      const { data: queueStats } = await supabase
        .from('content_queue')
        .select('id, is_approved, is_posted')

      stats = {
        totalContent: queueStats?.length || 0,
        approvedContent: queueStats?.filter(c => c.is_approved && !c.is_posted).length || 0,
        postedContent: queueStats?.filter(c => c.is_posted).length || 0,
        daysOfContent: Math.floor((queueStats?.filter(c => c.is_approved && !c.is_posted).length || 0) / 6)
      }
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

    const isDevelopment = process.env.NODE_ENV === 'development'
    
    let availableContent, recentPosts
    
    if (isDevelopment) {
      await db.connect()
      
      // Get available content for posting
      const availableResult = await db.query(`
        SELECT id, content_text, content_type, source_platform,
               confidence_score, is_approved, is_posted, created_at
        FROM content_queue
        WHERE is_approved = 1 AND is_posted = 0
        ORDER BY confidence_score DESC
        LIMIT 10
      `)
      
      availableContent = availableResult.rows || []

      // Get recent posts
      const recentResult = await db.query(`
        SELECT 
          pc.id,
          pc.posted_at,
          pc.content_queue_id,
          cq.content_text,
          cq.source_platform,
          cq.content_type
        FROM posted_content pc
        JOIN content_queue cq ON pc.content_queue_id = cq.id
        ORDER BY pc.posted_at DESC
        LIMIT 5
      `)
      
      recentPosts = recentResult.rows?.map(post => ({
        id: post.id,
        posted_at: post.posted_at,
        content_queue_id: post.content_queue_id,
        content_queue: {
          content_text: post.content_text,
          source_platform: post.source_platform,
          content_type: post.content_type
        }
      })) || []
    } else {
      const supabase = createSimpleClient()

      // Get available content for posting
      const { data: supabaseAvailable, error: contentError } = await supabase
        .from('content_queue')
        .select(`
          id, content_text, content_type, source_platform, 
          confidence_score, is_approved, is_posted, created_at
        `)
        .eq('is_approved', true)
        .eq('is_posted', false)
        .order('confidence_score', { ascending: false })
        .limit(10)

      availableContent = supabaseAvailable || []

      // Get recent posts
      const { data: supabaseRecent, error: postsError } = await supabase
        .from('posted_content')
        .select(`
          id, posted_at, content_queue_id,
          content_queue (content_text, source_platform, content_type)
        `)
        .order('posted_at', { ascending: false })
        .limit(5)
      
      recentPosts = supabaseRecent || []
    }

    // Get platform diversity analysis for the response
    let diversityInfo = null
    try {
      const diversityAnalysis = await analyzePlatformDiversity()
      diversityInfo = {
        diversityScore: diversityAnalysis.diversityScore,
        recentPlatforms: diversityAnalysis.recentPlatforms.slice(0, 5),
        recommendations: diversityAnalysis.recommendations,
        currentMealTime: getCurrentMealTime()
      }
    } catch (diversityError) {
      console.warn('Could not get diversity analysis:', diversityError)
    }

    return NextResponse.json({
      success: true,
      availableContent: availableContent || [],
      recentPosts: recentPosts || [],
      readyToPost: availableContent?.length || 0,
      diversity: diversityInfo,
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

/**
 * Determine current meal time based on UTC hour
 */
function getCurrentMealTime(): string {
  const currentHour = new Date().getUTCHours()
  
  if (currentHour >= 6 && currentHour < 10) return 'breakfast'
  if (currentHour >= 10 && currentHour < 14) return 'lunch' 
  if (currentHour >= 14 && currentHour < 17) return 'snack'
  if (currentHour >= 17 && currentHour < 21) return 'dinner'
  if (currentHour >= 21 && currentHour < 23) return 'evening'
  return 'late_night' // 23-6
}