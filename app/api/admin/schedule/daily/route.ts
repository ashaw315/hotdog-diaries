import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSimpleClient } from '@/utils/supabase/server'
import { parseISO, startOfDay, endOfDay, addHours, format, isSameDay } from 'date-fns'

interface DailyScheduleItem {
  id: string
  platform: string
  content_type: 'image' | 'video' | 'text' | 'link'
  source: string
  scheduled_time: string
  title?: string
  confidence_score?: number
  status?: 'scheduled' | 'posted'
}

interface NextPost {
  time: string
  platform: string
  content_type: 'image' | 'video' | 'text' | 'link'
  source: string
}

interface DailyScheduleResponse {
  date: string
  scheduled_content: DailyScheduleItem[]
  summary: {
    total_posts: number
    platforms: { [platform: string]: number }
    content_types: { [type: string]: number }
    diversity_score: number
    posted_count: number
    scheduled_count: number
    upcoming_count: number
    total_today: number
    next_post?: NextPost | null
  }
}

function calculateDiversityScore(platforms: { [platform: string]: number }, contentTypes: { [type: string]: number }, totalPosts: number): number {
  if (totalPosts === 0) return 0
  
  // Calculate platform diversity (0-50 points)
  const platformCount = Object.keys(platforms).length
  const maxPlatforms = 6 // reddit, bluesky, tumblr, lemmy, giphy, imgur
  const platformScore = Math.min(platformCount / maxPlatforms, 1) * 50
  
  // Calculate content type diversity (0-50 points)
  const typeCount = Object.keys(contentTypes).length
  const maxTypes = 4 // image, video, text, link
  const typeScore = Math.min(typeCount / maxTypes, 1) * 50
  
  return Math.round(platformScore + typeScore)
}

function mapContentType(originalType: string): 'image' | 'video' | 'text' | 'link' {
  const normalizedType = originalType?.toLowerCase()
  
  switch (normalizedType) {
    case 'image':
    case 'gif':
    case 'photo':
      return 'image'
    case 'video':
    case 'mp4':
      return 'video'
    case 'link':
    case 'url':
      return 'link'
    case 'text':
    case 'self':
    default:
      return 'text'
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const includeUpcoming = searchParams.get('includeUpcoming') !== 'false' // Default true
    
    // Default to today if no date provided, normalize date input
    let targetDate: Date
    try {
      if (dateParam) {
        // Validate and parse provided date
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
          return NextResponse.json({
            error: 'Invalid date format. Use YYYY-MM-DD format.'
          }, { status: 400 })
        }
        targetDate = parseISO(dateParam)
      } else {
        targetDate = new Date()
      }
    } catch (error) {
      return NextResponse.json({
        error: 'Invalid date provided. Use YYYY-MM-DD format.'
      }, { status: 400 })
    }
    
    // Create expanded time window to handle timezone variations
    // 12-hour buffer ensures content scheduled in different timezones is captured
    const startWindow = addHours(startOfDay(targetDate), -6)
    const endWindow = addHours(endOfDay(targetDate), +6)
    const startWindowStr = startWindow.toISOString()
    const endWindowStr = endWindow.toISOString()
    const targetDateStr = format(targetDate, 'yyyy-MM-dd')
    
    let scheduledContent: DailyScheduleItem[] = []
    let postedContent: DailyScheduleItem[] = []
    
    // Determine database type
    const isVercel = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) && process.env.NODE_ENV === 'production'
    const isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !process.env.DATABASE_URL?.includes('postgres')
    
    if (isSqlite) {
      // Use SQLite for development
      await db.connect()
      
      try {
        // Query for scheduled content with expanded time window
        const scheduledResult = await db.query(`
          SELECT 
            cq.id,
            cq.source_platform as platform,
            cq.content_type,
            cq.original_author as source,
            cq.scheduled_for as scheduled_time,
            SUBSTR(cq.content_text, 1, 100) as title,
            cq.confidence_score,
            cq.status,
            cq.is_posted
          FROM content_queue cq
          WHERE cq.scheduled_for >= ? 
            AND cq.scheduled_for <= ?
            AND (cq.status = 'scheduled' OR cq.is_approved = 1)
          ORDER BY cq.scheduled_for ASC
        `, [startWindowStr, endWindowStr])
        
        // Query for content that was already posted within the time window
        const postedResult = await db.query(`
          SELECT DISTINCT
            cq.id,
            cq.source_platform as platform,
            cq.content_type,
            cq.original_author as source,
            pc.posted_at as scheduled_time,
            SUBSTR(cq.content_text, 1, 100) as title,
            cq.confidence_score,
            'posted' as status,
            1 as is_posted
          FROM content_queue cq
          JOIN posted_content pc ON cq.id = pc.content_queue_id
          WHERE pc.posted_at >= ? 
            AND pc.posted_at <= ?
          ORDER BY pc.posted_at ASC
        `, [startWindowStr, endWindowStr])
        
        scheduledContent = (scheduledResult.rows || []).map((row: any) => ({
          id: String(row.id),
          platform: row.platform || 'unknown',
          content_type: mapContentType(row.content_type),
          source: row.source || 'Unknown Source',
          scheduled_time: row.scheduled_time ? new Date(row.scheduled_time).toISOString() : row.scheduled_time,
          title: row.title,
          confidence_score: row.confidence_score,
          status: row.status
        }))
        
        postedContent = (postedResult.rows || []).map((row: any) => ({
          id: String(row.id),
          platform: row.platform || 'unknown',
          content_type: mapContentType(row.content_type),
          source: row.source || 'Unknown Source',
          scheduled_time: row.scheduled_time ? new Date(row.scheduled_time).toISOString() : row.scheduled_time,
          title: row.title,
          confidence_score: row.confidence_score,
          status: row.status
        }))
        
      } catch (error) {
        console.error('SQLite query error:', error)
      } finally {
        await db.disconnect()
      }
    } else {
      // Use Supabase for production
      const supabase = createSimpleClient()
      
      try {
        // Query for scheduled content with expanded time window
        const { data: scheduledData, error: scheduledError } = await supabase
          .from('content_queue')
          .select(`
            id,
            source_platform,
            content_type,
            original_author,
            scheduled_for,
            content_text,
            confidence_score,
            status
          `)
          .or(`status.eq.scheduled,is_approved.eq.true`)
          .gte('scheduled_for', startWindow)
          .lte('scheduled_for', endWindow)
          .order('scheduled_for', { ascending: true })
        
        // Query for posted content
        const { data: postedData, error: postedError } = await supabase
          .from('posted_content')
          .select(`
            content_queue_id,
            posted_at,
            content_queue (
              id,
              source_platform,
              content_type,
              original_author,
              content_text,
              confidence_score
            )
          `)
          .gte('posted_at', `${targetDateStr}T00:00:00.000Z`)
          .lt('posted_at', `${targetDateStr}T23:59:59.999Z`)
          .order('posted_at', { ascending: true })
        
        if (scheduledError) {
          console.error('Supabase scheduled query error:', scheduledError)
        } else {
          scheduledContent = (scheduledData || []).map((row: any) => ({
            id: String(row.id),
            platform: row.source_platform || 'unknown',
            content_type: mapContentType(row.content_type),
            source: row.original_author || 'Unknown Source',
            scheduled_time: row.scheduled_for,
            title: row.content_text?.substring(0, 100),
            confidence_score: row.confidence_score,
            status: 'scheduled'
          }))
        }
        
        if (postedError) {
          console.error('Supabase posted query error:', postedError)
        } else {
          postedContent = (postedData || []).map((row: any) => ({
            id: String(row.content_queue.id),
            platform: row.content_queue.source_platform || 'unknown',
            content_type: mapContentType(row.content_queue.content_type),
            source: row.content_queue.original_author || 'Unknown Source',
            scheduled_time: row.posted_at,
            title: row.content_queue.content_text?.substring(0, 100),
            confidence_score: row.content_queue.confidence_score,
            status: 'posted'
          }))
        }
      } catch (error) {
        console.error('Supabase connection error:', error)
      }
    }
    
    // Normalize and merge all content with proper status assignment
    const now = new Date()
    
    // Process scheduled content with proper status determination
    const processedScheduled = scheduledContent.map(item => {
      const scheduledTime = new Date(item.scheduled_time)
      let status: 'scheduled' | 'posted' | 'upcoming' = 'scheduled'
      
      // Determine actual status based on current time and posted flag
      if (item.status === 'posted') {
        status = 'posted'
      } else if (scheduledTime > now && isSameDay(scheduledTime, targetDate)) {
        status = 'upcoming'
      } else if (scheduledTime <= now) {
        // Past scheduled time but not marked as posted
        status = 'scheduled'
      }
      
      return { ...item, status }
    })
    
    // Process posted content
    const processedPosted = postedContent.map(item => ({
      ...item,
      status: 'posted' as const
    }))
    
    // Combine all content
    const combined = [
      ...processedScheduled,
      ...processedPosted
    ]
    
    // Deduplicate by ID (last entry wins)
    const dedupedMap = combined.reduce((acc, cur) => {
      acc[cur.id] = cur
      return acc
    }, {} as Record<string, DailyScheduleItem>)
    
    const allContent = Object.values(dedupedMap)
    
    // Sort by scheduled/posted time
    allContent.sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
    
    // Filter to only content actually on target date (considering timezone buffer)
    const filteredContent = allContent.filter(item => {
      const itemDate = new Date(item.scheduled_time)
      return isSameDay(itemDate, targetDate) || 
             (itemDate >= startWindow && itemDate <= endWindow && 
              Math.abs(itemDate.getDate() - targetDate.getDate()) <= 1)
    })
    
    // If no results found, try fallback query for nearby dates
    if (allContent.length === 0) {
      console.log(`No content found for ${targetDateStr}, attempting fallback query...`)
      
      if (isSqlite) {
        await db.connect()
        try {
          const fallbackResult = await db.query(`
            SELECT 
              cq.id,
              cq.source_platform as platform,
              cq.content_type,
              cq.original_author as source,
              cq.scheduled_for as scheduled_time,
              SUBSTR(cq.content_text, 1, 100) as title,
              cq.confidence_score
            FROM content_queue cq
            WHERE cq.scheduled_for > datetime('now', '-2 days')
              AND cq.scheduled_for < datetime('now', '+7 days')
              AND (cq.status = 'scheduled' OR cq.is_approved = 1)
            ORDER BY ABS(julianday(cq.scheduled_for) - julianday(?)) ASC
            LIMIT 10
          `, [targetDate.toISOString()])
          
          if (fallbackResult.rows && fallbackResult.rows.length > 0) {
            console.log(`Fallback query found ${fallbackResult.rows.length} nearby items`)
          }
        } catch (error) {
          console.error('Fallback query error:', error)
        } finally {
          await db.disconnect()
        }
      }
    }
    
    // Calculate summary statistics using filtered content
    const totalPosts = filteredContent.length
    const platforms: { [platform: string]: number } = {}
    const contentTypes: { [type: string]: number } = {}
    
    // Count statuses
    let postedCount = 0
    let scheduledCount = 0
    let upcomingCount = 0
    
    filteredContent.forEach(item => {
      // Count platforms
      platforms[item.platform] = (platforms[item.platform] || 0) + 1
      
      // Count content types
      contentTypes[item.content_type] = (contentTypes[item.content_type] || 0) + 1
      
      // Count by status
      if (item.status === 'posted') {
        postedCount++
      } else if (item.status === 'upcoming') {
        upcomingCount++
      } else if (item.status === 'scheduled') {
        scheduledCount++
      }
    })
    
    const diversityScore = calculateDiversityScore(platforms, contentTypes, totalPosts)
    
    // Calculate next post if requested
    let nextPost: NextPost | null = null
    
    if (includeUpcoming) {
      const currentDate = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD format
      const isToday = targetDateStr === currentDate
      
      if (isToday || new Date(targetDateStr) > new Date(currentDate)) {
        // Find upcoming posts (status = 'upcoming')
        const upcomingPosts = filteredContent.filter(item => item.status === 'upcoming')
        
        // Find the next post (earliest upcoming post)
        if (upcomingPosts.length > 0) {
          const sortedUpcoming = upcomingPosts.sort((a, b) => 
            new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
          )
          
          const next = sortedUpcoming[0]
          nextPost = {
            time: next.scheduled_time,
            platform: next.platform,
            content_type: next.content_type,
            source: next.source
          }
        } else if (new Date(targetDateStr) > new Date(currentDate) && filteredContent.length > 0) {
          // For future dates with no upcoming, show first scheduled item
          const first = filteredContent[0]
          nextPost = {
            time: first.scheduled_time,
            platform: first.platform,
            content_type: first.content_type,
            source: first.source
          }
        }
      }
      // For past dates, we don't show next post
    }
    
    const response: DailyScheduleResponse = {
      date: targetDateStr,
      scheduled_content: filteredContent,
      summary: {
        total_posts: totalPosts,
        platforms,
        content_types: contentTypes,
        diversity_score: diversityScore,
        posted_count: postedCount,
        scheduled_count: scheduledCount,
        upcoming_count: upcomingCount,
        total_today: totalPosts,
        ...(includeUpcoming && { 
          next_post: nextPost 
        })
      }
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Error in daily schedule API:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}