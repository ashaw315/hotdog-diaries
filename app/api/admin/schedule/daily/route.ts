import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSimpleClient } from '@/utils/supabase/server'
import { parseISO, startOfDay, endOfDay, addHours, format, isSameDay } from 'date-fns'
// Temporary fallback timezone conversion for testing

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

// Timezone utility functions for accurate status determination
const toEastern = (ts: string | Date | null | undefined) => {
  if (!ts) return null
  const date = typeof ts === 'string' ? parseISO(ts) : ts
  // Temporary fallback: Eastern Time is UTC-5 (EST) or UTC-4 (EDT)
  // Use UTC-4 for testing (EDT)
  return addHours(date, -4)
}

// Get current time in Eastern timezone
const getNowEastern = () => {
  // Temporary fallback: Eastern Time is UTC-4 (EDT)
  return addHours(new Date(), -4)
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
        // Expanded query for scheduled content with broader conditions
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
            cq.is_posted,
            cq.is_approved,
            cq.created_at
          FROM content_queue cq
          WHERE (
            (cq.scheduled_for >= ? AND cq.scheduled_for <= ?)
            OR (cq.is_approved = 1 AND cq.is_posted = 0)
            OR (cq.status IN ('scheduled', 'pending', 'approved'))
          )
          AND (
            cq.scheduled_for IS NOT NULL 
            OR cq.is_approved = 1
            OR cq.status IN ('scheduled', 'pending', 'approved')
          )
          ORDER BY cq.scheduled_for ASC, cq.created_at ASC
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
            1 as is_posted,
            cq.is_approved,
            pc.scheduled_time as original_scheduled_time
          FROM content_queue cq
          JOIN posted_content pc ON cq.id = pc.content_queue_id
          WHERE pc.posted_at >= ? 
            AND pc.posted_at <= ?
          ORDER BY pc.posted_at ASC
        `, [startWindowStr, endWindowStr])
        
        // Additional cross-table fallback for missed items
        const crossTableResult = await db.query(`
          SELECT 
            cq.id,
            cq.source_platform as platform,
            cq.content_type,
            cq.original_author as source,
            COALESCE(pc.posted_at, cq.scheduled_for) as scheduled_time,
            SUBSTR(cq.content_text, 1, 100) as title,
            cq.confidence_score,
            CASE 
              WHEN pc.id IS NOT NULL THEN 'posted'
              WHEN cq.scheduled_for > datetime('now') THEN 'upcoming'
              ELSE 'scheduled'
            END as status,
            COALESCE(cq.is_posted, 0) as is_posted,
            cq.is_approved,
            pc.posted_at as actual_posted_at
          FROM content_queue cq
          LEFT JOIN posted_content pc ON cq.id = pc.content_queue_id
          WHERE (
            DATE(COALESCE(pc.posted_at, cq.scheduled_for)) = DATE(?)
            OR (cq.is_approved = 1 AND cq.is_posted = 0)
          )
          ORDER BY COALESCE(pc.posted_at, cq.scheduled_for) ASC
        `, [targetDateStr])
        
        // Helper function for status normalization with Eastern Time
        const determineStatus = (item: any): 'scheduled' | 'posted' | 'upcoming' => {
          const nowET = getNowEastern()
          const timeET = toEastern(item.scheduled_time || item.actual_posted_at)
          
          // STRICT posted flag validation (Phase 5.8) - defensive clause first
          // Only consider posted if EXPLICITLY posted with clear evidence
          if (item.actual_posted_at && item.is_posted === 1) {
            return 'posted'
          }
          
          // Explicit NOT posted check - defensive validation
          if (!item.actual_posted_at && (item.is_posted === 0 || item.is_posted === false)) {
            if (timeET && timeET > nowET) {
              return 'upcoming'
            }
            return 'scheduled'
          }
          
          // Additional posted checks for edge cases
          if (item.is_posted === 1 && !item.actual_posted_at) {
            // Flag says posted but no timestamp - assume posted
            return 'posted'
          }
          
          // Fallback to original status only if it's explicitly 'posted'
          if (item.status === 'posted' && item.is_posted === 1) {
            return 'posted'
          }
          
          // Final time-based fallback
          return timeET && timeET > nowET ? 'upcoming' : 'scheduled'
        }
        
        // Process scheduled content with normalization
        scheduledContent = (scheduledResult.rows || []).map((row: any) => ({
          id: String(row.id),
          platform: row.platform || 'unknown',
          content_type: mapContentType(row.content_type),
          source: row.source || 'Unknown Source',
          scheduled_time: row.scheduled_time ? new Date(row.scheduled_time).toISOString() : new Date().toISOString(),
          title: row.title,
          confidence_score: row.confidence_score,
          status: determineStatus(row)
        }))
        
        // Process posted content with normalization
        postedContent = (postedResult.rows || []).map((row: any) => ({
          id: String(row.id),
          platform: row.platform || 'unknown',
          content_type: mapContentType(row.content_type),
          source: row.source || 'Unknown Source',
          scheduled_time: row.scheduled_time ? new Date(row.scheduled_time).toISOString() : new Date().toISOString(),
          title: row.title,
          confidence_score: row.confidence_score,
          status: 'posted' as const
        }))
        
        // Process cross-table results as additional source
        const crossTableContent = (crossTableResult.rows || []).map((row: any) => ({
          id: String(row.id),
          platform: row.platform || 'unknown',
          content_type: mapContentType(row.content_type),
          source: row.source || 'Unknown Source',
          scheduled_time: row.scheduled_time ? new Date(row.scheduled_time).toISOString() : new Date().toISOString(),
          title: row.title,
          confidence_score: row.confidence_score,
          status: determineStatus(row)
        }))
        
        // Combine all sources with deduplication preference: crossTable > posted > scheduled
        const allSources = [
          ...scheduledContent.map(item => ({ ...item, source_type: 'scheduled' })),
          ...postedContent.map(item => ({ ...item, source_type: 'posted' })),
          ...crossTableContent.map(item => ({ ...item, source_type: 'crossTable' }))
        ]
        
        // Deduplicate by ID, preferring crossTable > posted > scheduled
        const dedupedMap = allSources.reduce((acc, cur) => {
          const existing = acc[cur.id]
          if (!existing || 
              (cur.source_type === 'crossTable') ||
              (cur.source_type === 'posted' && existing.source_type === 'scheduled')) {
            acc[cur.id] = cur
          }
          return acc
        }, {} as Record<string, any>)
        
        // Use the deduplicated content as both scheduled and posted
        const deduplicatedContent = Object.values(dedupedMap).map(item => {
          const { source_type, ...cleanItem } = item
          return cleanItem
        })
        
        scheduledContent = deduplicatedContent.filter(item => item.status !== 'posted')
        postedContent = deduplicatedContent.filter(item => item.status === 'posted')
        
      } catch (error) {
        console.error('SQLite query error:', error)
      } finally {
        await db.disconnect()
      }
    } else {
      // Use Supabase for production with enhanced queries
      const supabase = createSimpleClient()
      
      try {
        // Expanded query for scheduled content with broader conditions
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
            status,
            is_posted,
            is_approved
          `)
          .or(`scheduled_for.gte.${startWindow.toISOString()},scheduled_for.lte.${endWindow.toISOString()},and(is_approved.eq.true,is_posted.eq.false),status.in.(scheduled,pending,approved)`)
          .order('scheduled_for', { ascending: true })
        
        // Query for posted content with cross-table join
        const { data: postedData, error: postedError } = await supabase
          .from('posted_content')
          .select(`
            content_queue_id,
            posted_at,
            scheduled_time,
            content_queue (
              id,
              source_platform,
              content_type,
              original_author,
              content_text,
              confidence_score,
              is_approved
            )
          `)
          .gte('posted_at', startWindow.toISOString())
          .lte('posted_at', endWindow.toISOString())
          .order('posted_at', { ascending: true })
        
        // Additional cross-table query for comprehensive coverage
        const { data: crossTableData, error: crossTableError } = await supabase
          .from('content_queue')
          .select(`
            id,
            source_platform,
            content_type,
            original_author,
            scheduled_for,
            content_text,
            confidence_score,
            status,
            is_posted,
            is_approved,
            posted_content (
              posted_at,
              scheduled_time
            )
          `)
          .or(`scheduled_for.like.${targetDateStr}%,posted_content.posted_at.like.${targetDateStr}%,and(is_approved.eq.true,is_posted.eq.false)`)
        
        // Helper function for status normalization (Supabase version) with Eastern Time
        const determineSupabaseStatus = (item: any): 'scheduled' | 'posted' | 'upcoming' => {
          const nowET = getNowEastern()
          const timeET = toEastern(item.scheduled_time || item.posted_at)
          
          // STRICT posted flag validation for Supabase (Phase 5.8) - defensive clause first
          // Only consider posted if EXPLICITLY posted with clear evidence
          if (item.posted_at && (item.is_posted === true || item.posted_content?.length > 0)) {
            return 'posted'
          }
          
          // Explicit NOT posted check - defensive validation
          if (!item.posted_at && (item.is_posted === false || item.posted_content?.length === 0)) {
            if (timeET && timeET > nowET) {
              return 'upcoming'
            }
            return 'scheduled'
          }
          
          // Additional posted checks for edge cases
          if (item.is_posted === true && !item.posted_at) {
            // Flag says posted but no timestamp - assume posted
            return 'posted'
          }
          
          // Fallback to original status only if it's explicitly 'posted'
          if (item.status === 'posted' && item.is_posted === true) {
            return 'posted'
          }
          
          // Final time-based fallback
          return timeET && timeET > nowET ? 'upcoming' : 'scheduled'
        }
        
        if (scheduledError) {
          console.error('Supabase scheduled query error:', scheduledError)
        } else {
          scheduledContent = (scheduledData || []).map((row: any) => ({
            id: String(row.id),
            platform: row.source_platform || 'unknown',
            content_type: mapContentType(row.content_type),
            source: row.original_author || 'Unknown Source',
            scheduled_time: row.scheduled_for || new Date().toISOString(),
            title: row.content_text?.substring(0, 100),
            confidence_score: row.confidence_score,
            status: determineSupabaseStatus(row)
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
            status: 'posted' as const
          }))
        }
        
        // Process cross-table results
        if (!crossTableError && crossTableData) {
          const crossTableContent = crossTableData.map((row: any) => ({
            id: String(row.id),
            platform: row.source_platform || 'unknown',
            content_type: mapContentType(row.content_type),
            source: row.original_author || 'Unknown Source',
            scheduled_time: row.posted_content?.[0]?.posted_at || row.scheduled_for || new Date().toISOString(),
            title: row.content_text?.substring(0, 100),
            confidence_score: row.confidence_score,
            status: determineSupabaseStatus({
              ...row,
              posted_at: row.posted_content?.[0]?.posted_at,
              scheduled_time: row.posted_content?.[0]?.posted_at || row.scheduled_for
            })
          }))
          
          // Merge with existing data, prioritizing cross-table results
          const allSupabaseContent = [
            ...scheduledContent,
            ...postedContent,
            ...crossTableContent
          ]
          
          // Deduplicate by ID
          const dedupedSupabaseMap = allSupabaseContent.reduce((acc, cur) => {
            acc[cur.id] = cur
            return acc
          }, {} as Record<string, any>)
          
          const deduplicatedSupabaseContent = Object.values(dedupedSupabaseMap)
          scheduledContent = deduplicatedSupabaseContent.filter(item => item.status !== 'posted')
          postedContent = deduplicatedSupabaseContent.filter(item => item.status === 'posted')
        }
        
      } catch (error) {
        console.error('Supabase connection error:', error)
      }
    }
    
    // Timezone-aware range filtering using Eastern Time
    const inRange = (ts: string, targetDateStr: string) => {
      if (!ts) return false
      const tET = toEastern(ts)
      const targetET = toEastern(targetDateStr + 'T12:00:00Z') // Use noon to center the target day
      
      if (!tET || !targetET) return false
      
      // Create Eastern Time day boundaries with 6-hour buffer
      const dayStart = addHours(startOfDay(targetET), -6)
      const dayEnd = addHours(endOfDay(targetET), +6)
      
      return tET >= dayStart && tET <= dayEnd
    }
    
    const nowET = getNowEastern()
    
    // Enhanced status determination function with strict Eastern Time logic (Phase 5.8)
    const determineStatus = (item: any): 'scheduled' | 'posted' | 'upcoming' => {
      const timeET = toEastern(item.scheduled_time || item.actual_posted_at)
      
      // STRICT posted flag validation (Phase 5.8) - defensive clause first
      // Only consider posted if EXPLICITLY posted with clear evidence
      if (item.actual_posted_at && item.is_posted === 1) {
        return 'posted'
      }
      
      // Explicit NOT posted check - defensive validation
      if (!item.actual_posted_at && (item.is_posted === 0 || item.is_posted === false)) {
        if (timeET && timeET > nowET) {
          return 'upcoming'
        }
        return 'scheduled'
      }
      
      // Additional posted checks for edge cases
      if (item.is_posted === 1 && !item.actual_posted_at) {
        // Flag says posted but no timestamp - assume posted
        return 'posted'
      }
      
      // Fallback to original status only if it's explicitly 'posted'
      if (item.status === 'posted' && item.is_posted === 1) {
        return 'posted'
      }
      
      // Final time-based fallback
      return timeET && timeET > nowET ? 'upcoming' : 'scheduled'
    }
    
    // Process scheduled content with enhanced filtering
    const processedScheduled = scheduledContent.map(item => ({
      ...item,
      status: determineStatus(item)
    }))
    
    // Process posted content
    const processedPosted = postedContent.map(item => ({
      ...item,
      status: 'posted' as const
    }))
    
    // Combine all content using unified dataset logic  
    const combined = [
      ...processedScheduled,
      ...processedPosted
    ]
    
    // Deduplicate by ID, keeping the most accurate status
    const dedupedMap = combined.reduce((acc, cur) => {
      const existing = acc[cur.id]
      if (!existing || cur.status === 'posted' || (existing.status !== 'posted' && cur.status === 'upcoming')) {
        acc[cur.id] = cur
      }
      return acc
    }, {} as Record<string, DailyScheduleItem>)
    
    let filteredContent = Object.values(dedupedMap)
    
    // Apply timezone-aware range filtering for the target date
    filteredContent = filteredContent.filter(item => 
      inRange(item.scheduled_time, targetDateStr) || 
      item.status === 'posted' ||
      (item.status === 'upcoming' && toEastern(item.scheduled_time)?.toDateString() === targetDate.toDateString())
    )
    
    // Sort by scheduled/posted time
    filteredContent.sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
    
    // Enhanced fallback for missing day data with range expansion
    if (filteredContent.length === 0) {
      console.log(`No content found for ${targetDateStr}, attempting expanded fallback query...`)
      
      if (isSqlite) {
        await db.connect()
        try {
          // Fallback with expanded date range
          const fallbackResult = await db.query(`
            SELECT 
              cq.id,
              cq.source_platform as platform,
              cq.content_type,
              cq.original_author as source,
              COALESCE(pc.posted_at, cq.scheduled_for) as scheduled_time,
              SUBSTR(cq.content_text, 1, 100) as title,
              cq.confidence_score,
              CASE 
                WHEN pc.id IS NOT NULL THEN 'posted'
                WHEN cq.scheduled_for > datetime('now') THEN 'upcoming'
                ELSE 'scheduled'
              END as status
            FROM content_queue cq
            LEFT JOIN posted_content pc ON cq.id = pc.content_queue_id
            WHERE (
              cq.scheduled_for BETWEEN datetime(?, '-1 day') AND datetime(?, '+1 day')
              OR pc.posted_at BETWEEN datetime(?, '-1 day') AND datetime(?, '+1 day')
              OR (cq.is_approved = 1 AND cq.is_posted = 0)
            )
            ORDER BY ABS(julianday(COALESCE(pc.posted_at, cq.scheduled_for)) - julianday(?)) ASC
            LIMIT 20
          `, [targetDateStr, targetDateStr, targetDateStr, targetDateStr, targetDate.toISOString()])
          
          if (fallbackResult.rows && fallbackResult.rows.length > 0) {
            console.log(`📊 Fallback query found ${fallbackResult.rows.length} nearby items`)
            const fallbackItems = fallbackResult.rows.map((row: any) => ({
              id: String(row.id),
              platform: row.platform || 'unknown',
              content_type: mapContentType(row.content_type),
              source: row.source || 'Unknown Source',
              scheduled_time: row.scheduled_time ? new Date(row.scheduled_time).toISOString() : new Date().toISOString(),
              title: row.title,
              confidence_score: row.confidence_score,
              status: row.status as 'scheduled' | 'posted' | 'upcoming'
            }))
            
            // Add fallback items if they're relevant
            filteredContent.push(...fallbackItems.slice(0, 10))
          }
        } catch (error) {
          console.error('Enhanced fallback query error:', error)
        } finally {
          await db.disconnect()
        }
      }
    }
    
    // Recalculate diversity after filtering using combined data
    const platforms = new Set(filteredContent.map(c => c.platform))
    const types = new Set(filteredContent.map(c => c.content_type))
    
    const platformScore = Math.min((platforms.size / 5) * 50, 50) // 5 unique platforms = 50 points
    const typeScore = Math.min((types.size / 4) * 50, 50)        // 4 types = 50 points  
    const diversityScore = Math.round(platformScore + typeScore)
    
    // Calculate summary statistics using filtered content
    const totalPosts = filteredContent.length
    
    // Count statuses
    const postedCount = filteredContent.filter(c => c.status === 'posted').length
    const scheduledCount = filteredContent.filter(c => c.status === 'scheduled').length
    const upcomingCount = filteredContent.filter(c => c.status === 'upcoming').length
    
    // Build platform and content type distributions
    const platformCounts = Object.fromEntries([...platforms].map(p => [p, filteredContent.filter(c => c.platform === p).length]))
    const contentTypeCounts = Object.fromEntries([...types].map(t => [t, filteredContent.filter(c => c.content_type === t).length]))
    
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
    
    // Add debug validation for timezone conversions (Phase 5.8)
    console.log('🕓 Timezone Validation', { 
      nowET, 
      firstFive: filteredContent.slice(0,5).map(i => ({ 
        id: i.id, 
        schedET: toEastern(i.scheduled_time), 
        rawUTC: i.scheduled_time, 
        status: i.status 
      })) 
    })
    
    // Comprehensive debug logging for verification
    console.log("📊 Schedule Stats", {
      total: filteredContent.length,
      posted: filteredContent.filter(c => c.status === 'posted').length,
      upcoming: filteredContent.filter(c => c.status === 'upcoming').length,
      scheduled: filteredContent.filter(c => c.status === 'scheduled').length,
      date: targetDateStr,
      startWindow: startWindowStr,
      endWindow: endWindowStr,
      platforms: [...platforms],
      contentTypes: [...types],
      diversityScore,
      nextPost: nextPost ? {
        time: nextPost.time,
        platform: nextPost.platform,
        type: nextPost.content_type
      } : null
    })
    
    // Log detailed content breakdown for debugging
    if (filteredContent.length > 0) {
      console.log("📋 Content Breakdown:")
      filteredContent.slice(0, 5).forEach((item, index) => {
        console.log(`  ${index + 1}. [${item.status.toUpperCase()}] ${item.platform} - ${item.content_type} at ${item.scheduled_time}`)
      })
      if (filteredContent.length > 5) {
        console.log(`  ... and ${filteredContent.length - 5} more items`)
      }
    }
    
    const response: DailyScheduleResponse = {
      date: targetDateStr,
      scheduled_content: filteredContent.sort(
        (a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
      ),
      summary: {
        total_posts: totalPosts,
        platforms: platformCounts,
        content_types: contentTypeCounts,
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