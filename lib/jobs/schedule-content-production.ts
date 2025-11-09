/**
 * Production-Compatible Intelligent Content Scheduler Service
 * Updated for Phase 5.12 to populate scheduled_posts table for deterministic forecasting
 */

import { db } from '../db'
import { createSimpleClient } from '@/utils/supabase/server'
import { ContentItem, ScheduledContentItem, ContentScheduleResult, SourcePlatform } from '../../types'
import { parseISO, format, setHours, setMinutes, setSeconds, addHours, startOfDay, endOfDay } from 'date-fns'

// Supabase helper functions for refill
async function getSupabaseCandidates(supabase: any, excludeIds: number[] = [], limit = 200) {
  // First, get all content_ids that are already scheduled (prevents race conditions)
  const { data: scheduledIds, error: schedError } = await supabase
    .from('scheduled_posts')
    .select('content_id')
    .in('status', ['pending', 'posting']);

  if (schedError) throw schedError;

  // Second, get all content_ids that have been posted (prevents re-posting)
  const { data: postedIds, error: postedError } = await supabase
    .from('posted_content')
    .select('content_queue_id');

  if (postedError) throw postedError;

  // Combine with excludeIds parameter
  const allExcludeIds = [
    ...excludeIds,
    ...(scheduledIds?.map((row: any) => row.content_id).filter(Boolean) || []),
    ...(postedIds?.map((row: any) => row.content_queue_id).filter(Boolean) || [])
  ];

  console.log(`🚫 Excluding ${allExcludeIds.length} content IDs (${scheduledIds?.length || 0} scheduled, ${postedIds?.length || 0} posted, ${excludeIds.length} manual)`);

  const sel = `
    id, source_platform, content_type, content_text, original_author, created_at, confidence_score,
    is_posted, is_approved, content_status, scheduled_post_time
  `;

  let query = supabase
    .from('content_queue')
    .select(sel)
    .eq('is_approved', true)
    .or('is_posted.is.null,is_posted.eq.false') // treat null/false as not posted
    .gte('ingest_priority', 0) // only active priority content
    .order('confidence_score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (allExcludeIds.length > 0) {
    query = query.not('id', 'in', `(${allExcludeIds.join(',')})`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function getSupabaseScheduledPosts(supabase: any, dateYYYYMMDD: string) {
  // First attempt: fast path using scheduled_day
  try {
    const { data, error, status } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('scheduled_day', dateYYYYMMDD)
      .order('scheduled_slot_index', { ascending: true });

    if (error && status !== 406) throw error;
    if (data) return data;
  } catch (e: any) {
    const msg = (e?.message || '').toLowerCase();
    const missingCol = msg.includes('column') && msg.includes('scheduled_day') && msg.includes('does not exist');
    if (!missingCol) throw e;
    
    console.log(`⚠️ scheduled_day column missing, falling back to UTC time range filter`);
  }

  // Fallback: range filter on scheduled_post_time if column missing
  const [startUTC, endUTC] = getUtcWindowForEtDate(dateYYYYMMDD);
  const { data: data2, error: err2, status: status2 } = await supabase
    .from('scheduled_posts')
    .select('*')
    .gte('scheduled_post_time', startUTC)
    .lt('scheduled_post_time', endUTC)
    .order('scheduled_slot_index', { ascending: true });

  if (err2 && status2 !== 406) throw err2;
  return data2 || [];
}

// helper: 00:00–24:00 ET → UTC window
function getUtcWindowForEtDate(dateStrET: string): [string, string] {
  // dateStrET is YYYY-MM-DD in ET
  // Compute ET start/end, then convert to UTC ISO strings.
  const et = new Date(`${dateStrET}T00:00:00-05:00`); // EST fallback, could be -04:00 EDT
  const start = new Date(et);
  const end = new Date(et); 
  end.setDate(end.getDate() + 1);
  return [start.toISOString(), end.toISOString()];
}

async function upsertScheduledPostSupabase(supabase: any, row: any) {
  // Ensure we have a scheduled_day field for the upsert
  // Extract ET date from UTC scheduled_post_time if not already provided
  let scheduledDay = row.scheduled_day;
  if (!scheduledDay && row.scheduled_post_time) {
    // Convert UTC to ET date (simple approach)
    const utcDate = new Date(row.scheduled_post_time);
    const etDate = new Date(utcDate.getTime() - (5 * 60 * 60 * 1000)); // EST offset
    scheduledDay = etDate.toISOString().split('T')[0];
  }
  
  const upsertRow = {
    ...row,
    scheduled_day: scheduledDay,
    updated_at: new Date().toISOString()
  };
  
  // Try with scheduled_day constraint first
  try {
    const { data, error } = await supabase
      .from('scheduled_posts')
      .upsert([upsertRow], { onConflict: 'scheduled_day,scheduled_slot_index' })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (e: any) {
    const msg = (e?.message || '').toLowerCase();
    const missingConstraint = msg.includes('scheduled_day') && (msg.includes('does not exist') || msg.includes('violates'));
    
    if (missingConstraint) {
      console.log(`⚠️ scheduled_day constraint not available, falling back to basic upsert`);
      // Fallback: upsert without the scheduled_day constraint
      const fallbackRow = { ...upsertRow };
      delete fallbackRow.scheduled_day; // Remove the problematic field
      
      const { data, error } = await supabase
        .from('scheduled_posts')
        .upsert([fallbackRow])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
    throw e;
  }
}

async function updateContentQueueSupabase(supabase: any, contentId: number, scheduledTime: string) {
  const { data, error } = await supabase
    .from('content_queue')
    .update({
      scheduled_post_time: scheduledTime,
      content_status: 'scheduled',
      updated_at: new Date().toISOString()
    })
    .eq('id', contentId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// Scheduling configuration - Phase 5.12 standardized slots
const POSTS_PER_DAY = 6
const SLOT_TIMES_ET = ['08:00', '12:00', '15:00', '18:00', '21:00', '23:30'] // Eastern Time

/**
 * Normalize content types to match scheduled_posts table constraint
 * Maps various content types to the allowed constraint values: 'image' | 'text'
 */
function normalizeContentTypeForScheduling(contentType: string | null | undefined): string {
  if (!contentType) return 'text'
  
  const type = contentType.toLowerCase().trim()
  
  // Map video/gif types to image (since they are visual content)
  if (type === 'gif' || type === 'video' || type === 'webm' || type === 'mp4' || type === 'mov') {
    return 'image'
  }
  
  // Map link/url types to text
  if (type === 'link' || type === 'url') {
    return 'text'
  }
  
  // Keep image and text as-is
  if (type === 'image' || type === 'text') {
    return type
  }
  
  // Default fallback for unknown types
  return 'text'
}

// Enhanced Diversity Rules - "Make Diversity Real"
const MAX_PER_PLATFORM_PER_DAY = 2
const MIN_SAME_PLATFORM_SPACING = 2 // at least 2 slots apart
const PLATFORM_COOLDOWN_DAYS = 1    // avoid repeating yesterday's last platform as today's first
const TYPE_ALTERNATION_WEIGHT = 1.25 // prefer alternation, not hard rule
const UNDER_REPRESENTED_BOOST = 1.4  // boost platforms with 0 usage
const SPACING_PENALTY_ADJACENT = 0.2 // heavy penalty for adjacent same platform
const SPACING_PENALTY_NEAR = 0.6     // moderate penalty for within spacing window
const YESTERDAY_COOLDOWN_PENALTY = 0.5 // penalty for repeating yesterday's last platform

// Helper function to determine DST status for a given date
function isDaylightSavingTime(date: Date): boolean {
  const month = date.getMonth() + 1 // getMonth() is 0-based
  const day = date.getDate()
  
  // Quick DST check: DST is active from mid-March through early November
  if (month > 3 && month < 11) {
    return true
  } else if (month === 3) {
    // In March, DST starts on the second Sunday (roughly day 8-14)
    return day >= 8
  } else if (month === 11) {
    // In November, DST ends on the first Sunday (roughly day 1-7)
    return day <= 7
  }
  return false
}

// Timezone utility functions (Phase 5.12 compatibility)
const toET = (dateInput: Date | string): Date => {
  const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput
  // Check if DST is active: EDT (UTC-4) or EST (UTC-5)
  const offsetHours = isDaylightSavingTime(date) ? -4 : -5
  return addHours(date, offsetHours)
}

const toUTC = (dateET: Date): Date => {
  // Convert ET back to UTC - need to determine if the ET date is in DST
  const offsetHours = isDaylightSavingTime(dateET) ? 4 : 5
  return addHours(dateET, offsetHours)
}

/**
 * Group array elements by a key function
 */
function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item)
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(item)
    return groups
  }, {} as Record<string, T[]>)
}

/**
 * Get the next available approved content grouped by platform (PRODUCTION SCHEMA)
 */
async function getAvailableContent(): Promise<Record<string, ContentItem[]>> {
  try {
    // Use production-compatible field names and exclude already-scheduled content (prevents race conditions)
    const result = await db.query(`
      SELECT * FROM content_queue
      WHERE is_approved = TRUE
        AND is_posted = FALSE
        AND (scheduled_post_time IS NULL OR scheduled_post_time <= datetime('now'))
        AND NOT EXISTS (
          SELECT 1 FROM scheduled_posts
          WHERE scheduled_posts.content_id = content_queue.id
            AND scheduled_posts.status IN ('pending', 'posting')
        )
      ORDER BY confidence_score DESC, created_at ASC
    `)

    console.log(`📊 Found ${result.rows.length} eligible items for scheduling`)

    const content = result.rows.map(row => ({
      ...row,
      // Map production fields to expected interface
      status: row.content_status || 'approved',
      scheduled_for: row.scheduled_post_time,
      priority: row.confidence_score || 0.5
    })) as ContentItem[]

    return groupBy(content, (item) => item.source_platform)
  } catch (error) {
    console.error('Error fetching available content:', error)
    return {}
  }
}

/**
 * Get recently posted content to enforce platform diversity
 */
async function getRecentlyPostedPlatforms(lookbackDays: number = 1): Promise<string[]> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)
    
    const result = await db.query(`
      SELECT DISTINCT source_platform
      FROM content_queue
      WHERE is_posted = TRUE 
        AND updated_at >= ?
      ORDER BY updated_at DESC
    `, [cutoffDate.toISOString()])

    return result.rows.map((row: any) => row.source_platform)
  } catch (error) {
    console.error('Error fetching recently posted platforms:', error)
    return []
  }
}

/**
 * Select content with weighted platform diversity enforcement
 */
function selectDiverseContent(
  contentByPlatform: Record<string, ContentItem[]>, 
  recentPlatforms: string[],
  count: number
): ContentItem[] {
  const selected: ContentItem[] = []
  const availablePlatforms = Object.keys(contentByPlatform).filter(
    platform => contentByPlatform[platform].length > 0
  )

  if (availablePlatforms.length === 0) {
    return selected
  }

  console.log(`🎯 Implementing weighted platform balancing for ${count} posts across ${availablePlatforms.length} platforms`)

  // Initialize platform usage tracking
  const platformUsage = new Map<string, number>()
  availablePlatforms.forEach(platform => platformUsage.set(platform, 0))

  // Create a working copy of content to avoid mutation
  const workingContent = { ...contentByPlatform }
  Object.keys(workingContent).forEach(platform => {
    workingContent[platform] = [...workingContent[platform]]
  })

  // Platform daily cap (Phase 5.12 requirement)
  const PLATFORM_DAILY_CAP = 2

  // Diversity algorithm with strict caps and alternation
  let lastPlatform: string | null = null
  let lastType: string | null = null

  while (selected.length < count && Object.values(workingContent).some(arr => arr.length > 0)) {
    // Find platforms that haven't hit the daily cap
    const availableNow = availablePlatforms
      .filter(platform => workingContent[platform].length > 0)
      .filter(platform => (platformUsage.get(platform) || 0) < PLATFORM_DAILY_CAP)

    if (availableNow.length === 0) {
      // Relax cap if needed
      const anyAvailable = availablePlatforms.filter(platform => workingContent[platform].length > 0)
      if (anyAvailable.length === 0) break
      availableNow.push(...anyAvailable)
    }

    // Apply diversity constraints
    let candidates = availableNow

    // 1. Platform diversity (avoid consecutive same platform)
    if (lastPlatform) {
      const nonRepeat = candidates.filter(p => p !== lastPlatform)
      if (nonRepeat.length > 0) {
        candidates = nonRepeat
      }
    }

    // 2. Sort by usage (prefer underused platforms)
    candidates.sort((a, b) => {
      const usageA = platformUsage.get(a) || 0
      const usageB = platformUsage.get(b) || 0
      
      if (usageA !== usageB) {
        return usageA - usageB
      }
      
      // Prefer platforms not used recently
      const aIsRecent = recentPlatforms.includes(a)
      const bIsRecent = recentPlatforms.includes(b)
      if (aIsRecent !== bIsRecent) {
        return aIsRecent ? 1 : -1
      }
      
      return workingContent[b].length - workingContent[a].length
    })

    const nextPlatform = candidates[0]
    
    // Select content from this platform, preferring type alternation
    const platformContent = workingContent[nextPlatform]
    let candidate: ContentItem | undefined

    if (lastType && platformContent.length > 1) {
      // Try to find different content type
      const differentType = platformContent.find(c => c.content_type !== lastType)
      if (differentType) {
        candidate = differentType
        // Remove from array
        const index = platformContent.indexOf(differentType)
        platformContent.splice(index, 1)
      }
    }
    
    if (!candidate) {
      candidate = platformContent.shift() // Take first available
    }

    if (candidate) {
      selected.push(candidate)
      platformUsage.set(nextPlatform, (platformUsage.get(nextPlatform) || 0) + 1)
      lastPlatform = nextPlatform
      lastType = candidate.content_type
      
      console.log(`✅ Selected from ${nextPlatform}: "${candidate.content_text?.substring(0, 30)}..." (usage now: ${platformUsage.get(nextPlatform)})`)
    }
  }

  // Log final distribution
  const finalDistribution = Object.fromEntries(
    availablePlatforms.map(platform => [platform, platformUsage.get(platform) || 0])
  )
  console.log(`🎯 Final platform distribution:`, finalDistribution)

  return selected
}

// Generator options type
type GenMode = "refill-missing" | "create-or-reuse"
type GenerateOptions = { mode?: GenMode; forceRefill?: boolean }

const SLOT_ET_TIMES = ["08:00", "12:00", "15:00", "18:00", "21:00", "23:30"] as const

function toEasternISO(dateYYYYMMDD: string, hhmmET: string): string {
  const [hh, mm] = hhmmET.split(":").map(Number)
  
  // Create the ET time as if it were UTC first (this prevents double timezone conversion)
  const etAsUTC = parseISO(dateYYYYMMDD + `T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00.000Z`)
  
  // Apply the correct UTC offset to convert FROM ET TO UTC
  // EDT (DST active): ET + 4 hours = UTC
  // EST (standard time): ET + 5 hours = UTC
  const offsetHours = isDaylightSavingTime(etAsUTC) ? 4 : 5
  const utcTime = addHours(etAsUTC, offsetHours)
  
  return utcTime.toISOString()
}

/**
 * Get yesterday's last posted platform for cooldown enforcement
 */
async function getYesterdayLastPlatform(dateYYYYMMDD: string): Promise<string | null> {
  try {
    const yesterday = new Date(dateYYYYMMDD)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    
    const isSupabase = !!process.env.SUPABASE_URL && process.env.NODE_ENV === 'production'
    
    if (isSupabase) {
      const supabase = createSimpleClient()
      const { data } = await supabase
        .from('scheduled_posts')
        .select('platform')
        .eq('scheduled_day', yesterdayStr)
        .eq('scheduled_slot_index', 5) // Last slot of the day
        .maybeSingle()
      
      return data?.platform || null
    } else {
      const result = await db.query(`
        SELECT platform FROM scheduled_posts 
        WHERE DATE(scheduled_post_time) = ? AND scheduled_slot_index = 5
        LIMIT 1
      `, [yesterdayStr])
      
      return result.rows[0]?.platform || null
    }
  } catch (error) {
    console.warn('Failed to get yesterday\'s last platform:', error)
    return null
  }
}

/**
 * Enhanced diversity scoring for candidate selection
 */
function calculateDiversityScore(
  candidate: ContentItem,
  slotIndex: number,
  alreadyChosen: ContentItem[],
  yesterdayLastPlatform: string | null
): number {
  const platformUsage = new Map<string, number>()
  const typeUsage = new Map<string, number>()
  
  // Count existing usage for the day
  alreadyChosen.forEach(item => {
    platformUsage.set(item.source_platform, (platformUsage.get(item.source_platform) || 0) + 1)
    typeUsage.set(item.content_type || 'text', (typeUsage.get(item.content_type || 'text') || 0) + 1)
  })
  
  const platform = candidate.source_platform
  const contentType = candidate.content_type || 'text'
  const baseScore = candidate.confidence_score || 0.5
  let diversityMultiplier = 1.0
  
  // 1. Daily cap enforcement
  const platformCount = platformUsage.get(platform) || 0
  if (platformCount >= MAX_PER_PLATFORM_PER_DAY) {
    return 0 // Hard exclude if cap exceeded
  }
  
  // 2. Platform spacing penalties
  if (slotIndex > 0) {
    const lastPlatform = alreadyChosen[slotIndex - 1]?.source_platform
    if (lastPlatform === platform) {
      diversityMultiplier *= SPACING_PENALTY_ADJACENT // Adjacent same platform
    }
  }
  
  if (slotIndex > 1) {
    const prev2Platform = alreadyChosen[slotIndex - 2]?.source_platform
    if (prev2Platform === platform) {
      diversityMultiplier *= SPACING_PENALTY_NEAR // Within spacing window
    }
  }
  
  // 3. Yesterday cooldown penalty
  if (yesterdayLastPlatform === platform && slotIndex === 0) {
    diversityMultiplier *= YESTERDAY_COOLDOWN_PENALTY
  }
  
  // 4. Under-represented platform boost
  if (platformCount === 0) {
    diversityMultiplier *= UNDER_REPRESENTED_BOOST
  }
  
  // 5. Type alternation bonus
  if (slotIndex > 0) {
    const lastType = alreadyChosen[slotIndex - 1]?.content_type || 'text'
    if (lastType !== contentType) {
      diversityMultiplier *= TYPE_ALTERNATION_WEIGHT
    }
  }
  
  return baseScore * diversityMultiplier
}

/**
 * Progressive relaxation levels for content selection - Enhanced
 */
const relaxLevels = [
  { allowSameTypeTwice: false, allowConsecutivePlatform: false, allowExceedDailyCap: false, name: "strict" },
  { allowSameTypeTwice: true,  allowConsecutivePlatform: false, allowExceedDailyCap: false, name: "relax-type" },
  { allowSameTypeTwice: true,  allowConsecutivePlatform: true,  allowExceedDailyCap: false, name: "relax-consecutive" },
  { allowSameTypeTwice: true,  allowConsecutivePlatform: true,  allowExceedDailyCap: true,  name: "relax-cap" },
]

/**
 * Pick candidate with enhanced diversity scoring and progressive relaxation
 */
async function pickCandidateWithRelaxation(
  candidates: ContentItem[],
  alreadyChosen: ContentItem[],
  slotIndex: number,
  dateYYYYMMDD: string
): Promise<{ candidate: ContentItem | null; level: string; score?: number }> {
  // Get yesterday's last platform for cooldown enforcement
  const yesterdayLastPlatform = await getYesterdayLastPlatform(dateYYYYMMDD)
  
  // Calculate diversity scores for all candidates
  const scoredCandidates = candidates.map(candidate => ({
    ...candidate,
    diversityScore: calculateDiversityScore(candidate, slotIndex, alreadyChosen, yesterdayLastPlatform)
  })).filter(c => c.diversityScore > 0) // Exclude hard-blocked candidates
  
  if (scoredCandidates.length === 0) {
    return { candidate: null, level: "no-viable-candidates" }
  }
  
  // Try strict diversity-based selection first
  const strictCandidates = scoredCandidates.filter(c => c.diversityScore >= 0.3) // Minimum viable score
  
  if (strictCandidates.length > 0) {
    const best = strictCandidates.sort((a, b) => b.diversityScore - a.diversityScore)[0]
    return { 
      candidate: best, 
      level: "diversity-optimized",
      score: best.diversityScore
    }
  }
  
  // Fall back to progressive relaxation for edge cases
  const platformUsage = new Map<string, number>()
  const typeUsage = new Map<string, number>()
  
  alreadyChosen.forEach(item => {
    platformUsage.set(item.source_platform, (platformUsage.get(item.source_platform) || 0) + 1)
    typeUsage.set(item.content_type || 'text', (typeUsage.get(item.content_type || 'text') || 0) + 1)
  })
  
  const lastItem = alreadyChosen[alreadyChosen.length - 1]
  
  // Try each relaxation level
  for (const level of relaxLevels) {
    let eligibleCandidates = [...scoredCandidates]
    
    // Filter by platform cap
    if (!level.allowExceedDailyCap) {
      eligibleCandidates = eligibleCandidates.filter(c => 
        (platformUsage.get(c.source_platform) || 0) < MAX_PER_PLATFORM_PER_DAY
      )
    }
    
    // Filter by consecutive platform
    if (!level.allowConsecutivePlatform && lastItem) {
      eligibleCandidates = eligibleCandidates.filter(c => 
        c.source_platform !== lastItem.source_platform
      )
    }
    
    // Filter by type alternation
    if (!level.allowSameTypeTwice && lastItem) {
      eligibleCandidates = eligibleCandidates.filter(c => 
        (c.content_type || 'text') !== (lastItem.content_type || 'text')
      )
    }
    
    if (eligibleCandidates.length > 0) {
      // Sort by diversity score (enhanced priority)
      const candidate = eligibleCandidates.sort((a, b) => b.diversityScore - a.diversityScore)[0]
      
      return { 
        candidate, 
        level: `relaxed-${level.name}`,
        score: candidate.diversityScore
      }
    }
  }
  
  // Final fallback: any candidate with highest score
  if (scoredCandidates.length > 0) {
    const fallback = scoredCandidates.sort((a, b) => b.diversityScore - a.diversityScore)[0]
    return { 
      candidate: fallback, 
      level: "emergency-fallback",
      score: fallback.diversityScore
    }
  }
  
  return { candidate: null, level: "no-candidates" }
}

/**
 * Generate daily schedule and populate scheduled_posts table (Phase 5.12 - Hardened)
 */
export async function generateDailySchedule(dateYYYYMMDD: string, opts: GenerateOptions = {}): Promise<any> {
  const mode: GenMode = opts.mode ?? "create-or-reuse"
  const forceRefill = !!opts.forceRefill
  
  console.log(`🗓️ Generating deterministic daily schedule for ${dateYYYYMMDD} (mode: ${mode}, forceRefill: ${forceRefill})`)
  
  try {
    const targetDate = parseISO(dateYYYYMMDD + 'T12:00:00Z')
    
    // Detect environment: SQLite vs Supabase
    const isSupabase = !!process.env.SUPABASE_URL && process.env.NODE_ENV === 'production'
    console.log(`🔍 Environment: ${isSupabase ? 'Supabase' : 'SQLite'}`)
    
    let existingRows: any = { rows: [] }
    let candidates: ContentItem[] = []
    let supabaseClient: any = null
    
    if (isSupabase) {
      // Supabase path - use query builder
      supabaseClient = createSimpleClient()
      
      // 1) Load existing scheduled posts 
      const existingPosts = await getSupabaseScheduledPosts(supabaseClient, dateYYYYMMDD)
      existingRows = { rows: existingPosts }
      console.log(`📊 Found ${existingPosts.length} existing scheduled posts for ${dateYYYYMMDD}`)
      
      // 2) Get candidate content (exclude already scheduled)
      const alreadyScheduledIds = existingPosts
        .filter(row => row.content_id)
        .map(row => row.content_id)
      
      const candidateRows = await getSupabaseCandidates(supabaseClient, alreadyScheduledIds)
      candidates = candidateRows.map(row => ({
        ...row,
        status: row.content_status || 'approved',
        scheduled_for: row.scheduled_post_time,
        priority: row.confidence_score || 0.5
      })) as ContentItem[]
      
    } else {
      // SQLite path - use existing raw SQL (unchanged)
      existingRows = await db.query(`
        SELECT * FROM scheduled_posts 
        WHERE DATE(scheduled_post_time) = ?
        ORDER BY scheduled_slot_index
      `, [dateYYYYMMDD])
      
      console.log(`📊 Found ${existingRows.rows.length} existing scheduled posts for ${dateYYYYMMDD}`)
      
      const alreadyScheduledIds = existingRows.rows
        .filter(row => row.content_id)
        .map(row => row.content_id)
      
      // Also get all content_ids that are already scheduled anywhere (prevents race conditions)
      const allScheduledResult = await db.query(`
        SELECT content_id FROM scheduled_posts
        WHERE status IN ('pending', 'posting')
      `)

      const allScheduledIds = allScheduledResult.rows
        .filter(row => row.content_id)
        .map(row => row.content_id)

      // Combine with date-specific exclusions
      const combinedExcludeIds = [...new Set([...alreadyScheduledIds, ...allScheduledIds])]

      const excludeClause = combinedExcludeIds.length > 0
        ? `AND id NOT IN (${combinedExcludeIds.map(() => '?').join(',')})`
        : ''

      const candidatesResult = await db.query(`
        SELECT * FROM content_queue
        WHERE is_approved = TRUE
          AND is_posted = FALSE
          ${excludeClause}
        ORDER BY confidence_score DESC, created_at ASC
      `, combinedExcludeIds)
      
      candidates = candidatesResult.rows.map(row => ({
        ...row,
        status: row.content_status || 'approved',
        scheduled_for: row.scheduled_post_time,
        priority: row.confidence_score || 0.5
      })) as ContentItem[]
    }
    
    console.log(`📊 Found ${candidates.length} eligible candidate items`)
    
    // 3) For each slot 0..5, determine if we need to fill/refill
    const slotResults: any[] = []
    const alreadyChosen: ContentItem[] = []
    
    for (let slotIndex = 0; slotIndex < SLOT_ET_TIMES.length; slotIndex++) {
      const slotTimeET = SLOT_ET_TIMES[slotIndex]
      const existingRow = existingRows.rows.find(row => row.scheduled_slot_index === slotIndex)
      
      let shouldFill = false
      let reasoning = ''
      
      if (existingRow) {
        // Debug: log what we found
        console.log(`🔍 Slot ${slotIndex} existing row:`, {
          id: existingRow.id,
          content_id: existingRow.content_id,
          status: existingRow.status,
          scheduled_post_time: existingRow.scheduled_post_time,
          platform: existingRow.platform
        })

        // Check if row has content_id, scheduled_post_time, AND status='pending'
        if (existingRow.content_id && existingRow.scheduled_post_time && existingRow.status === 'pending') {
          console.log(`✅ Slot ${slotIndex} already filled with content_id ${existingRow.content_id} and status=pending`)
          // Add to already chosen for diversity calculation
          const existingContent: ContentItem = {
            id: existingRow.content_id,
            source_platform: existingRow.platform,
            content_type: existingRow.content_type,
            content_text: existingRow.title,
            confidence_score: 0.5,
            created_at: new Date().toISOString()
          } as ContentItem
          alreadyChosen.push(existingContent)
          slotResults.push({ slot: slotIndex, action: 'kept', content_id: existingRow.content_id })
          continue
        } else if (forceRefill) {
          shouldFill = true
          reasoning = 'refilling incomplete row (missing content_id, scheduled_post_time, or status=pending)'
        }
      } else {
        shouldFill = true
        reasoning = 'creating new row for empty slot'
      }
      
      if (shouldFill) {
        // Use enhanced diversity scoring to pick candidate
        const { candidate, level, score } = await pickCandidateWithRelaxation(
          candidates.filter(c => !alreadyChosen.some(chosen => chosen.id === c.id)),
          alreadyChosen,
          slotIndex,
          dateYYYYMMDD
        )
        
        if (!candidate) {
          console.log(`⚠️ No candidate found for slot ${slotIndex} - skipping write`)
          slotResults.push({ 
            slot: slotIndex, 
            action: 'skipped', 
            reason: 'no_candidates_available' 
          })
          continue
        }
        
        // Generate UTC time for this slot
        const slotUTC = toEasternISO(dateYYYYMMDD, slotTimeET)
        const finalReasoning = `${reasoning} (constraint level: ${level}, diversity score: ${score?.toFixed(3) || 'N/A'})`
        
        // Write to database (different paths for SQLite vs Supabase)
        if (isSupabase && supabaseClient) {
          // Supabase upsert
          const upsertRow = {
            scheduled_day: dateYYYYMMDD,
            scheduled_slot_index: slotIndex,
            scheduled_post_time: slotUTC,
            content_id: candidate.id,
            platform: candidate.source_platform,
            content_type: normalizeContentTypeForScheduling(candidate.content_type),
            source: candidate.original_author || null,
            title: candidate.content_text?.substring(0, 100) || null,
            reasoning: finalReasoning,
            status: 'pending'
          }
          
          await upsertScheduledPostSupabase(supabaseClient, upsertRow)
          await updateContentQueueSupabase(supabaseClient, candidate.id, slotUTC)
          
        } else {
          // SQLite path (unchanged)
          if (existingRow) {
            await db.query(`
              UPDATE scheduled_posts
              SET content_id = ?, platform = ?, content_type = ?, source = ?, title = ?,
                  scheduled_post_time = ?, reasoning = ?, status = ?, updated_at = datetime('now')
              WHERE id = ?
            `, [
              candidate.id,
              candidate.source_platform,
              normalizeContentTypeForScheduling(candidate.content_type),
              candidate.original_author || null,
              candidate.content_text?.substring(0, 100) || null,
              slotUTC,
              finalReasoning,
              'pending',
              existingRow.id
            ])
          } else {
            await db.query(`
              INSERT INTO scheduled_posts (
                content_id, platform, content_type, source, title,
                scheduled_post_time, scheduled_slot_index, reasoning, status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              candidate.id,
              candidate.source_platform,
              normalizeContentTypeForScheduling(candidate.content_type),
              candidate.original_author || null,
              candidate.content_text?.substring(0, 100) || null,
              slotUTC,
              slotIndex,
              finalReasoning,
              'pending'
            ])
          }
          
          await db.query(`
            UPDATE content_queue 
            SET scheduled_post_time = ?, content_status = ?, updated_at = datetime('now')
            WHERE id = ?
          `, [slotUTC, 'scheduled', candidate.id])
        }
        
        alreadyChosen.push(candidate)
        slotResults.push({ 
          slot: slotIndex, 
          action: existingRow ? 'updated' : 'created', 
          content_id: candidate.id,
          platform: candidate.source_platform,
          level 
        })
        
        console.log(`✅ Slot ${slotIndex} (${slotTimeET} ET): ${candidate.source_platform} - ${candidate.content_text?.substring(0, 30)}... (${level}, score: ${score?.toFixed(3) || 'N/A'})`)
      }
    }
    
    console.log(`🎉 Successfully processed schedule for ${dateYYYYMMDD}`)
    
    return {
      date: dateYYYYMMDD,
      filled: slotResults.filter(r => r.action !== 'kept' && r.action !== 'skipped').length,
      mode,
      forceRefill,
      slots: slotResults,
      debug: {
        environment: isSupabase ? 'supabase' : 'sqlite',
        candidates_found: candidates.length,
        existing_slots: existingRows.rows.length
      }
    }

  } catch (error) {
    console.error(`❌ Failed to generate schedule for ${dateYYYYMMDD}:`, error)
    throw error
  }
}

/**
 * Enhanced Day Filling with Aggressive Fallback
 * Ensures a single day reaches 6/6 slots using progressive strategies
 */
export async function ensureDayFilled(
  dateYYYYMMDD: string, 
  options: { aggressiveFallback?: boolean } = {}
): Promise<{
  before: number;
  count_added: number;
  after: number;
  platforms: Record<string, number>;
}> {
  const { aggressiveFallback = false } = options
  
  console.log(`🎯 Ensuring day ${dateYYYYMMDD} is filled (aggressive: ${aggressiveFallback})`)
  
  // Get current slot count
  const isSupabase = !!process.env.SUPABASE_URL && process.env.NODE_ENV === 'production'
  let beforeCount = 0
  
  if (isSupabase) {
    const supabase = createSimpleClient()
    const existing = await getSupabaseScheduledPosts(supabase, dateYYYYMMDD)
    beforeCount = existing.filter(row => row.content_id && row.scheduled_post_time).length
  } else {
    const result = await db.query(`
      SELECT COUNT(*) as count FROM scheduled_posts 
      WHERE DATE(scheduled_post_time) = ?
      AND content_id IS NOT NULL
      AND scheduled_post_time IS NOT NULL
    `, [dateYYYYMMDD])
    beforeCount = result.rows[0]?.count || 0
  }
  
  console.log(`📊 Current slots filled: ${beforeCount}/6`)
  
  if (beforeCount >= 6) {
    console.log(`✅ Day already complete`)
    return {
      before: beforeCount,
      count_added: 0,
      after: beforeCount,
      platforms: {}
    }
  }
  
  // Try normal strategy first
  console.log(`📝 Attempting normal strategy...`)
  let fillResult = await generateDailySchedule(dateYYYYMMDD, { 
    mode: "refill-missing", 
    forceRefill: true 
  })
  
  // Check if we need aggressive fallback
  let afterNormal = beforeCount + (fillResult.filled || 0)
  console.log(`📊 After normal strategy: ${afterNormal}/6`)
  
  if (afterNormal < 6 && aggressiveFallback) {
    console.log(`🚨 Activating aggressive fallback strategy...`)
    
    // Temporarily modify candidate selection to be more permissive
    const originalGetCandidates = getSupabaseCandidates
    
    // Override with aggressive candidate selection
    const aggressiveGetCandidates = async (supabase: any, excludeIds: number[] = [], limit = 400) => {
      const sel = `
        id, source_platform, content_type, content_text, original_author, created_at, confidence_score,
        is_posted, is_approved, content_status, scheduled_post_time
      `;
      
      let query = supabase
        .from('content_queue')
        .select(sel)
        .eq('is_approved', true)
        .or('is_posted.is.null,is_posted.eq.false')
        .gte('ingest_priority', -1) // Allow lower priority items
        .order('confidence_score', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(limit);
      
      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    }
    
    // Monkey patch for aggressive mode
    if (isSupabase) {
      Object.defineProperty(global, 'getSupabaseCandidates', {
        value: aggressiveGetCandidates,
        writable: true
      })
    }
    
    try {
      // Run aggressive fill
      fillResult = await generateDailySchedule(dateYYYYMMDD, { 
        mode: "refill-missing", 
        forceRefill: true 
      })
    } finally {
      // Restore original function
      if (isSupabase) {
        Object.defineProperty(global, 'getSupabaseCandidates', {
          value: originalGetCandidates,
          writable: true
        })
      }
    }
  }
  
  // Get final count and platform distribution
  let afterCount = 0
  const platforms: Record<string, number> = {}
  
  if (isSupabase) {
    const supabase = createSimpleClient()
    const finalPosts = await getSupabaseScheduledPosts(supabase, dateYYYYMMDD)
    afterCount = finalPosts.filter(row => row.content_id && row.scheduled_post_time).length
    
    finalPosts.forEach(post => {
      if (post.platform) {
        platforms[post.platform] = (platforms[post.platform] || 0) + 1
      }
    })
  } else {
    const countResult = await db.query(`
      SELECT COUNT(*) as count FROM scheduled_posts 
      WHERE DATE(scheduled_post_time) = ?
      AND content_id IS NOT NULL
      AND scheduled_post_time IS NOT NULL
    `, [dateYYYYMMDD])
    afterCount = countResult.rows[0]?.count || 0
    
    const platformResult = await db.query(`
      SELECT platform, COUNT(*) as count FROM scheduled_posts 
      WHERE DATE(scheduled_post_time) = ?
      AND content_id IS NOT NULL
      GROUP BY platform
    `, [dateYYYYMMDD])
    
    platformResult.rows.forEach((row: any) => {
      platforms[row.platform] = row.count
    })
  }
  
  const countAdded = afterCount - beforeCount
  
  console.log(`✅ Day filling complete: ${beforeCount} → ${afterCount} (+${countAdded})`)
  console.log(`🎯 Platform distribution: ${JSON.stringify(platforms)}`)
  
  return {
    before: beforeCount,
    count_added: countAdded,
    after: afterCount,
    platforms
  }
}

/**
 * Two-Day Orchestrator - Ensures both D and D+1 reach 6/6 slots
 */
export async function refillTwoDays(etDate: string): Promise<{
  date: string;
  today: ReturnType<typeof ensureDayFilled> extends Promise<infer T> ? T : never;
  tomorrow: ReturnType<typeof ensureDayFilled> extends Promise<infer T> ? T : never;
  summary: {
    total_before: number;
    total_after: number;
    total_added: number;
    days_complete: number;
    combined_platforms: Record<string, number>;
  };
}> {
  console.log(`🚀 Two-day refill orchestrator starting for ET date: ${etDate}`)
  
  // Calculate D and D+1 in ET
  const todayET = etDate
  const tomorrowDate = new Date(etDate + 'T12:00:00-04:00')
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowET = tomorrowDate.toISOString().split('T')[0]
  
  console.log(`📅 Processing: Today=${todayET}, Tomorrow=${tomorrowET}`)
  
  // Fill both days with aggressive fallback
  const todayResult = await ensureDayFilled(todayET, { aggressiveFallback: true })
  const tomorrowResult = await ensureDayFilled(tomorrowET, { aggressiveFallback: true })
  
  // Combine platform statistics
  const combinedPlatforms: Record<string, number> = {}
  Object.entries(todayResult.platforms).forEach(([platform, count]) => {
    combinedPlatforms[platform] = (combinedPlatforms[platform] || 0) + count
  })
  Object.entries(tomorrowResult.platforms).forEach(([platform, count]) => {
    combinedPlatforms[platform] = (combinedPlatforms[platform] || 0) + count
  })
  
  const summary = {
    total_before: todayResult.before + tomorrowResult.before,
    total_after: todayResult.after + tomorrowResult.after,
    total_added: todayResult.count_added + tomorrowResult.count_added,
    days_complete: (todayResult.after >= 6 ? 1 : 0) + (tomorrowResult.after >= 6 ? 1 : 0),
    combined_platforms: combinedPlatforms
  }
  
  console.log(`🎉 Two-day refill complete:`)
  console.log(`   📊 Total slots: ${summary.total_before} → ${summary.total_after} (+${summary.total_added})`)
  console.log(`   ✅ Complete days: ${summary.days_complete}/2`)
  console.log(`   🎯 Platform distribution: ${JSON.stringify(summary.combined_platforms)}`)
  
  return {
    date: etDate,
    today: todayResult,
    tomorrow: tomorrowResult,
    summary
  }
}

/**
 * Main scheduling function - schedules next batch of content (PRODUCTION COMPATIBLE)
 * Updated for Phase 5.12 to use generateDailySchedule
 */
export async function scheduleNextBatch(
  daysAhead: number = 7,
  postsPerDay: number = POSTS_PER_DAY
): Promise<ContentScheduleResult> {
  const result: ContentScheduleResult = {
    scheduled: [],
    skipped: [],
    errors: [],
    summary: {
      totalScheduled: 0,
      totalDays: 0,
      platformDistribution: {}
    }
  }

  try {
    console.log(`🗓️ Starting PRODUCTION content scheduling for next ${daysAhead} days...`)

    // Schedule content for each day using the new deterministic method
    for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + dayOffset)
      const dateISO = format(targetDate, 'yyyy-MM-dd')
      
      try {
        await generateDailySchedule(dateISO)
        result.summary.totalDays++
        
        // Count scheduled items for this day
        const scheduledCount = await db.query(`
          SELECT COUNT(*) as count FROM scheduled_posts 
          WHERE DATE(scheduled_post_time) = ?
        `, [dateISO])
        
        const count = scheduledCount.rows[0]?.count || 0
        result.summary.totalScheduled += count
        
      } catch (error) {
        result.errors.push(`Failed to schedule ${dateISO}: ${error.message}`)
      }
    }

    // Calculate platform distribution from scheduled_posts
    const distributionResult = await db.query(`
      SELECT platform, COUNT(*) as count
      FROM scheduled_posts 
      WHERE scheduled_post_time >= datetime('now')
      GROUP BY platform
    `)
    
    result.summary.platformDistribution = Object.fromEntries(
      distributionResult.rows.map((row: any) => [row.platform, row.count])
    )

    console.log(`🎉 PRODUCTION Scheduling completed:`)
    console.log(`   📈 Total scheduled: ${result.summary.totalScheduled}`)
    console.log(`   📅 Days scheduled: ${result.summary.totalDays}`)
    console.log(`   🎯 Platform distribution:`, result.summary.platformDistribution)

  } catch (error) {
    result.errors.push(`Scheduling failed: ${error.message}`)
    console.error('❌ Scheduling failed:', error)
  }

  return result
}