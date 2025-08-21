import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSimpleClient } from '@/utils/supabase/server'

interface PostMealRequest {
  meal: string
  time: string
  immediate?: boolean
  catchUp?: boolean
  sequence?: number
}

export async function POST(request: NextRequest) {
  try {
    // Security: Verify this is from GitHub Actions or authenticated admin
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: PostMealRequest = await request.json()
    const { meal, time, immediate = false, catchUp = false, sequence = 1 } = body

    console.log(`🍽️ ${meal.toUpperCase()} posting request:`, { time, immediate, catchUp, sequence })

    // Check if we already posted for this meal time today
    if (!immediate && !catchUp) {
      const alreadyPosted = await checkIfAlreadyPostedToday(time)
      if (alreadyPosted) {
        return NextResponse.json({
          success: false,
          message: `Content for ${meal} (${time}) already posted today`,
          skipped: true
        })
      }
    }

    // Get best available content to post
    const content = await getBestContentToPost()
    if (!content) {
      return NextResponse.json({
        success: false,
        message: `No approved content available for ${meal}`,
        error: 'NO_CONTENT_AVAILABLE'
      }, { status: 404 })
    }

    // Post the content
    const result = await publishContent(content, time, meal)
    
    if (result.success) {
      console.log(`✅ ${meal.toUpperCase()} posted successfully:`, result.contentId)
      
      return NextResponse.json({
        success: true,
        message: `${meal.charAt(0).toUpperCase() + meal.slice(1)} content posted successfully`,
        data: {
          meal,
          time,
          contentId: result.contentId,
          postedAt: result.postedAt,
          sequence: catchUp ? sequence : undefined
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        message: `Failed to post ${meal} content: ${result.error}`,
        error: result.error
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error(`❌ ${error.message}`)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// Check if we already posted at this meal time today
async function checkIfAlreadyPostedToday(timeSlot: string): Promise<boolean> {
  try {
    const isVercel = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) && process.env.NODE_ENV === 'production'
    const isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !process.env.DATABASE_URL?.includes('postgres')
    
    if (isSqlite) {
      await db.connect()
      const result = await db.query(`
        SELECT COUNT(*) as count
        FROM posted_content
        WHERE DATE(posted_at) = DATE('now')
        AND scheduled_time = ?
      `, [timeSlot])
      await db.disconnect()
      return (result.rows[0]?.count || 0) > 0
    } else {
      const supabase = createSimpleClient()
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('posted_content')
        .select('id')
        .gte('posted_at', `${today}T00:00:00.000Z`)
        .lt('posted_at', `${today}T23:59:59.999Z`)
        .eq('scheduled_time', timeSlot)
      
      return !error && data && data.length > 0
    }
  } catch (error) {
    console.error('Error checking if already posted:', error)
    return false // Default to allow posting if check fails
  }
}

// Get the best content to post
async function getBestContentToPost(): Promise<any> {
  try {
    const isVercel = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) && process.env.NODE_ENV === 'production'
    const isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !process.env.DATABASE_URL?.includes('postgres')
    
    if (isSqlite) {
      await db.connect()
      const result = await db.query(`
        SELECT * FROM content_queue
        WHERE is_approved = 1 AND is_posted = 0
        ORDER BY confidence_score DESC, created_at ASC
        LIMIT 1
      `)
      await db.disconnect()
      return result.rows && result.rows.length > 0 ? result.rows[0] : null
    } else {
      const supabase = createSimpleClient()
      const { data, error } = await supabase
        .from('content_queue')
        .select('*')
        .eq('is_approved', true)
        .eq('is_posted', false)
        .order('confidence_score', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
      
      return !error && data && data.length > 0 ? data[0] : null
    }
  } catch (error) {
    console.error('Error getting content to post:', error)
    return null
  }
}

// Publish content and record in posted_content
async function publishContent(content: any, timeSlot: string, meal: string): Promise<{ success: boolean; contentId?: number; postedAt?: string; error?: string }> {
  try {
    const now = new Date().toISOString()
    const postOrder = Math.floor(Date.now() / 1000)
    
    const isVercel = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) && process.env.NODE_ENV === 'production'
    const isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !process.env.DATABASE_URL?.includes('postgres')
    
    if (isSqlite) {
      await db.connect()
      
      // Check for duplicates
      const existingPost = await db.query(`
        SELECT id FROM posted_content WHERE content_queue_id = ?
      `, [content.id])
      
      if (existingPost.rows && existingPost.rows.length > 0) {
        await db.disconnect()
        return { success: false, error: 'Content already posted' }
      }
      
      // Mark as posted in content_queue
      await db.query(`
        UPDATE content_queue 
        SET is_posted = 1, posted_at = ? 
        WHERE id = ?
      `, [now, content.id])
      
      // Record in posted_content
      await db.query(`
        INSERT INTO posted_content (content_queue_id, scheduled_time, posted_at, post_order)
        VALUES (?, ?, ?, ?)
      `, [content.id, timeSlot, now, postOrder])
      
      await db.disconnect()
      return { success: true, contentId: content.id, postedAt: now }
      
    } else {
      const supabase = createSimpleClient()
      
      // Check for duplicates
      const { data: existing } = await supabase
        .from('posted_content')
        .select('id')
        .eq('content_queue_id', content.id)
      
      if (existing && existing.length > 0) {
        return { success: false, error: 'Content already posted' }
      }
      
      // Mark as posted in content_queue
      const { error: updateError } = await supabase
        .from('content_queue')
        .update({ is_posted: true, posted_at: now })
        .eq('id', content.id)
      
      if (updateError) {
        return { success: false, error: updateError.message }
      }
      
      // Record in posted_content
      const { error: insertError } = await supabase
        .from('posted_content')
        .insert({
          content_queue_id: content.id,
          scheduled_time: timeSlot,
          posted_at: now,
          post_order: postOrder
        })
      
      if (insertError) {
        return { success: false, error: insertError.message }
      }
      
      return { success: true, contentId: content.id, postedAt: now }
    }
  } catch (error: any) {
    console.error('Error publishing content:', error)
    return { success: false, error: error.message }
  }
}