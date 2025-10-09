import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSimpleClient } from '@/utils/supabase/server'
import { parseISO, format, setHours, setMinutes, setSeconds, addHours, addMinutes, differenceInMinutes, startOfDay, endOfDay } from 'date-fns'

// Configuration constants
const PLATFORM_DAILY_CAP = 2
const FORECAST_SLOT_TOLERANCE_MINUTES = 45
const DEFAULT_SLOTS_ET = ['08:00', '12:00', '15:00', '18:00', '21:00', '23:30']

// Type definitions
type SlotStatus = 'posted' | 'upcoming' | 'projected'

interface ForecastItem {
  id: string
  platform: string
  content_type: 'image' | 'video' | 'text' | 'link'
  source?: string
  title?: string
  url?: string
  confidence: number
}

interface SlotResult {
  slot_index: number
  time_local: string // 'hh:mm a' ET
  iso: string        // ISO in ET→UTC .toISOString()
  status: SlotStatus
  content: ForecastItem | null
  reasoning: string
}

interface ForecastResponse {
  date: string // YYYY-MM-DD (ET)
  timezone: 'America/New_York'
  slots: SlotResult[]
  summary: {
    posted: number
    upcoming: number
    projected: number
    platforms: Record<string, number>
    content_types: Record<string, number>
    diversity_score: number // 0..100
  }
}

interface SelectionState {
  usedPlatformsCount: Record<string, number>
  lastPlatform: string | null
  lastType: string | null
  usedContentIds: Set<string>
}

// Timezone utility functions (using fallback approach from earlier)
const toET = (dateInput: Date | string): Date => {
  const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput
  // Temporary fallback: Eastern Time is UTC-4 (EDT)
  return addHours(date, -4)
}

const formatET = (date: Date, formatStr: string): string => {
  return format(date, formatStr)
}

const etDayRange = (targetDateET: Date) => {
  const startET = startOfDay(targetDateET)
  const endET = endOfDay(targetDateET)
  return {
    startET: addHours(startET, 4), // Convert back to UTC
    endET: addHours(endET, 4)      // Convert back to UTC
  }
}

const buildSlotsForDate = (targetDateET: Date, slotsET: string[]): Date[] => {
  return slotsET.map(timeStr => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const slotTime = setSeconds(setMinutes(setHours(targetDateET, hours), minutes), 0)
    return slotTime
  })
}

const mapPostedToNearestSlot = (postedItems: any[], slots: Date[], toleranceMinutes = 45) => {
  const slotMap = new Map<number, any>()
  
  for (const posted of postedItems) {
    const postedTime = toET(posted.actual_posted_at || posted.posted_at)
    
    // Find nearest slot within tolerance
    let nearestSlotIndex = -1
    let minDifference = Infinity
    
    slots.forEach((slotTime, index) => {
      const diff = Math.abs(differenceInMinutes(postedTime, slotTime))
      if (diff <= toleranceMinutes && diff < minDifference) {
        minDifference = diff
        nearestSlotIndex = index
      }
    })
    
    if (nearestSlotIndex >= 0) {
      slotMap.set(nearestSlotIndex, {
        ...posted,
        mappedSlotTime: slots[nearestSlotIndex],
        actualPostedTime: postedTime
      })
    }
  }
  
  return slotMap
}

const selectNextCandidate = (
  pool: any[], 
  state: SelectionState, 
  platformCap: number
): { candidate: any | null; reasoning: string } => {
  if (pool.length === 0) {
    return { candidate: null, reasoning: 'no approved content available in queue' }
  }
  
  // Filter out already used content
  const availablePool = pool.filter(item => !state.usedContentIds.has(item.id))
  
  if (availablePool.length === 0) {
    return { candidate: null, reasoning: 'all available content already used today' }
  }
  
  // Apply diversity constraints with fallback strategy
  let candidates = availablePool
  let reasoning = 'selected based on queue priority'
  
  // 1. Platform diversity (avoid same platform consecutively)
  if (state.lastPlatform) {
    const nonRepeatPlatform = candidates.filter(c => c.platform !== state.lastPlatform)
    if (nonRepeatPlatform.length > 0) {
      candidates = nonRepeatPlatform
      reasoning = `selected to avoid repeating platform '${state.lastPlatform}'`
    }
  }
  
  // 2. Platform daily cap
  const withinCap = candidates.filter(c => 
    (state.usedPlatformsCount[c.platform] || 0) < platformCap
  )
  if (withinCap.length > 0) {
    candidates = withinCap
    if (reasoning === 'selected based on queue priority') {
      reasoning = `selected within platform daily cap (${platformCap})`
    }
  } else if (candidates.length > 0) {
    reasoning = `relaxed platform cap (${platformCap}) because no other candidates available`
  }
  
  // 3. Content type diversity (prefer alternating types)
  if (state.lastType && candidates.length > 1) {
    const nonRepeatType = candidates.filter(c => c.content_type !== state.lastType)
    if (nonRepeatType.length > 0) {
      candidates = nonRepeatType
      reasoning += ` and alternate type '${state.lastType}'`
    }
  }
  
  // Return first candidate (FIFO by approved_at due to pre-sorting)
  return {
    candidate: candidates[0] || null,
    reasoning: candidates[0] ? reasoning : 'no suitable candidates found'
  }
}

const calculateDiversityScore = (content: (ForecastItem | null)[]): number => {
  const validContent = content.filter(c => c !== null) as ForecastItem[]
  
  if (validContent.length === 0) return 0
  
  const platforms = new Set(validContent.map(c => c.platform))
  const types = new Set(validContent.map(c => c.content_type))
  
  const platformScore = Math.min(platforms.size / 5 * 50, 50)
  const typeScore = Math.min(types.size / 4 * 50, 50)
  
  return Math.round(platformScore + typeScore)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    
    // Parse and validate target date
    let targetDateET: Date
    try {
      if (dateParam) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
          return NextResponse.json({
            error: 'Invalid date format. Use YYYY-MM-DD format.'
          }, { status: 400 })
        }
        targetDateET = toET(parseISO(dateParam + 'T12:00:00Z'))
      } else {
        targetDateET = toET(new Date())
      }
    } catch (error) {
      return NextResponse.json({
        error: 'Invalid date provided. Use YYYY-MM-DD format.'
      }, { status: 400 })
    }
    
    const dateStr = format(targetDateET, 'yyyy-MM-dd')
    const nowET = toET(new Date())
    
    // Build slot times for the target date
    const slotTimes = buildSlotsForDate(targetDateET, DEFAULT_SLOTS_ET)
    
    // Get date range for fetching posted content
    const { startET, endET } = etDayRange(targetDateET)
    
    // Determine database type
    const isVercel = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) && process.env.NODE_ENV === 'production'
    const isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !process.env.DATABASE_URL?.includes('postgres')
    
    let postedItems: any[] = []
    let approvedPool: any[] = []
    
    if (isSqlite) {
      await db.connect()
      
      try {
        // Fetch posted content for the target date
        const postedResult = await db.query(`
          SELECT 
            cq.id,
            cq.source_platform as platform,
            cq.content_type,
            cq.original_author as source,
            SUBSTR(cq.content_text, 1, 100) as title,
            cq.original_url as url,
            cq.confidence_score,
            pc.posted_at as actual_posted_at
          FROM content_queue cq
          JOIN posted_content pc ON cq.id = pc.content_queue_id
          WHERE pc.posted_at >= ? AND pc.posted_at <= ?
          ORDER BY pc.posted_at ASC
        `, [startET.toISOString(), endET.toISOString()])
        
        postedItems = postedResult.rows || []
        
        // Fetch approved unposted content pool
        const poolResult = await db.query(`
          SELECT 
            id,
            source_platform as platform,
            content_type,
            original_author as source,
            SUBSTR(content_text, 1, 100) as title,
            original_url as url,
            confidence_score,
            created_at as approved_at
          FROM content_queue
          WHERE is_approved = 1 
            AND is_posted = 0
          ORDER BY confidence_score DESC, created_at ASC
        `)
        
        approvedPool = poolResult.rows || []
        
      } finally {
        await db.disconnect()
      }
    } else {
      // Supabase implementation
      const supabase = createSimpleClient()
      
      // Fetch posted content
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
            original_url,
            confidence_score
          )
        `)
        .gte('posted_at', startET.toISOString())
        .lte('posted_at', endET.toISOString())
        .order('posted_at', { ascending: true })
      
      if (!postedError && postedData) {
        postedItems = postedData.map((item: any) => ({
          id: item.content_queue.id,
          platform: item.content_queue.source_platform,
          content_type: item.content_queue.content_type,
          source: item.content_queue.original_author,
          title: item.content_queue.content_text?.substring(0, 100),
          url: item.content_queue.original_url,
          confidence_score: item.content_queue.confidence_score,
          actual_posted_at: item.posted_at
        }))
      }
      
      // Fetch approved unposted content pool
      const { data: poolData, error: poolError } = await supabase
        .from('content_queue')
        .select('id, source_platform, content_type, original_author, content_text, original_url, confidence_score, created_at')
        .eq('is_approved', true)
        .eq('is_posted', false)
        .order('confidence_score', { ascending: false })
        .order('created_at', { ascending: true })
      
      if (!poolError && poolData) {
        approvedPool = poolData.map((item: any) => ({
          id: item.id,
          platform: item.source_platform,
          content_type: item.content_type,
          source: item.original_author,
          title: item.content_text?.substring(0, 100),
          url: item.original_url,
          confidence_score: item.confidence_score,
          approved_at: item.created_at
        }))
      }
    }
    
    // Map posted items to nearest slots
    const postedSlotMap = mapPostedToNearestSlot(postedItems, slotTimes, FORECAST_SLOT_TOLERANCE_MINUTES)
    
    // Initialize selection state
    const state: SelectionState = {
      usedPlatformsCount: {},
      lastPlatform: null,
      lastType: null,
      usedContentIds: new Set()
    }
    
    // Build forecast slots
    const slots: SlotResult[] = []
    
    for (let i = 0; i < slotTimes.length; i++) {
      const slotTime = slotTimes[i]
      const slotTimeUTC = addHours(slotTime, 4) // Convert ET back to UTC for ISO
      
      // Check if this slot already has posted content
      if (postedSlotMap.has(i)) {
        const postedItem = postedSlotMap.get(i)
        const content: ForecastItem = {
          id: postedItem.id,
          platform: postedItem.platform,
          content_type: postedItem.content_type,
          source: postedItem.source,
          title: postedItem.title,
          url: postedItem.url,
          confidence: postedItem.confidence_score || 0.5
        }
        
        // Update state tracking
        state.usedPlatformsCount[content.platform] = (state.usedPlatformsCount[content.platform] || 0) + 1
        state.lastPlatform = content.platform
        state.lastType = content.content_type
        state.usedContentIds.add(content.id)
        
        const actualTime = formatET(postedItem.actualPostedTime, 'hh:mm a')
        const slotDisplayTime = formatET(slotTime, 'hh:mm a')
        
        slots.push({
          slot_index: i,
          time_local: formatET(slotTime, 'hh:mm a'),
          iso: slotTimeUTC.toISOString(),
          status: 'posted',
          content,
          reasoning: `already posted at ${actualTime} ET (mapped to ${slotDisplayTime} slot)`
        })
        
        continue
      }
      
      // Try to fill slot from approved pool
      const { candidate, reasoning } = selectNextCandidate(approvedPool, state, PLATFORM_DAILY_CAP)
      
      if (candidate) {
        const content: ForecastItem = {
          id: candidate.id,
          platform: candidate.platform,
          content_type: candidate.content_type,
          source: candidate.source,
          title: candidate.title,
          url: candidate.url,
          confidence: candidate.confidence_score || 0.5
        }
        
        // Update state tracking
        state.usedPlatformsCount[content.platform] = (state.usedPlatformsCount[content.platform] || 0) + 1
        state.lastPlatform = content.platform
        state.lastType = content.content_type
        state.usedContentIds.add(content.id)
        
        // Determine status based on time
        const status: SlotStatus = slotTime > nowET ? 'upcoming' : 'projected'
        
        slots.push({
          slot_index: i,
          time_local: formatET(slotTime, 'hh:mm a'),
          iso: slotTimeUTC.toISOString(),
          status,
          content,
          reasoning
        })
      } else {
        // No content available for this slot
        const status: SlotStatus = slotTime > nowET ? 'upcoming' : 'projected'
        
        slots.push({
          slot_index: i,
          time_local: formatET(slotTime, 'hh:mm a'),
          iso: slotTimeUTC.toISOString(),
          status,
          content: null,
          reasoning
        })
      }
    }
    
    // Calculate summary statistics
    const postedCount = slots.filter(s => s.status === 'posted').length
    const upcomingCount = slots.filter(s => s.status === 'upcoming').length
    const projectedCount = slots.filter(s => s.status === 'projected').length
    
    const platforms: Record<string, number> = {}
    const contentTypes: Record<string, number> = {}
    
    slots.forEach(slot => {
      if (slot.content) {
        platforms[slot.content.platform] = (platforms[slot.content.platform] || 0) + 1
        contentTypes[slot.content.content_type] = (contentTypes[slot.content.content_type] || 0) + 1
      }
    })
    
    const diversityScore = calculateDiversityScore(slots.map(s => s.content))
    
    const response: ForecastResponse = {
      date: dateStr,
      timezone: 'America/New_York',
      slots,
      summary: {
        posted: postedCount,
        upcoming: upcomingCount,
        projected: projectedCount,
        platforms,
        content_types: contentTypes,
        diversity_score: diversityScore
      }
    }
    
    console.log('🔮 Forecast Generated:', {
      date: dateStr,
      slots: slots.length,
      posted: postedCount,
      upcoming: upcomingCount,
      projected: projectedCount,
      diversity: diversityScore
    })
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    
  } catch (error) {
    console.error('Error in forecast API:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}