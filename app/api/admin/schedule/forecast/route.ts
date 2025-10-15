import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSimpleClient } from '@/utils/supabase/server'
import { parseISO, format, setHours, setMinutes, setSeconds, addHours, startOfDay, endOfDay } from 'date-fns'
import { generateDailySchedule } from '@/lib/jobs/schedule-content-production'

// Phase 5.12 - True Feed Forecast Integration
// Constants matching the standardized slots
const TZ = 'America/New_York'
const SLOT_LABELS = ['08:00', '12:00', '15:00', '18:00', '21:00', '23:30'] // ET

// Type definitions for Phase 5.12
interface ForecastItem {
  id: string
  platform: string
  content_type: 'image' | 'video' | 'text' | 'link'
  source?: string
  title?: string
  url?: string
  confidence: number
}

interface ForecastSlot {
  slot_index: number
  time_local: string
  iso: string
  status: 'posted' | 'upcoming' | 'missed'
  content: ForecastItem | null
  scheduled_post_time?: string
  actual_posted_at?: string | null
  reasoning: string
}

interface ForecastResponse {
  date: string
  timezone: 'America/New_York'
  slots: ForecastSlot[]
  summary: {
    total: number
    posted: number
    upcoming: number
    missed: number
    platforms: Record<string, number>
    content_types: Record<string, number>
    diversity_score: number
  }
}

// Timezone utility functions (Phase 5.12 compatibility)
const toET = (dateInput: Date | string): Date => {
  const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput
  // Temporary fallback: Eastern Time is UTC-4 (EDT)
  return addHours(date, -4)
}

const toUTC = (dateET: Date): Date => {
  // Convert ET back to UTC
  return addHours(dateET, 4)
}

function dayUtcRange(dateStr: string) {
  // ET start/end -> UTC
  const etStart = parseISO(dateStr + 'T00:00:00')
  const etEnd = parseISO(dateStr + 'T23:59:59.999')
  
  const utcStart = toUTC(etStart)
  const utcEnd = toUTC(etEnd)
  
  return {
    startUtc: utcStart.toISOString(),
    endUtc: utcEnd.toISOString(),
  }
}

function slotIsoUtc(dateStr: string, etHHmm: string) {
  // Compose ET time on date, convert to UTC ISO
  const [hh, mm] = etHHmm.split(':').map(Number)
  const etDate = parseISO(dateStr + 'T00:00:00')
  const etSlot = setSeconds(setMinutes(setHours(etDate, hh), mm), 0)
  const utcSlot = toUTC(etSlot)
  return utcSlot.toISOString()
}

function statusForSlot(utcIso: string, postedAtUtc: string | null) {
  const nowUtc = new Date().toISOString()
  if (postedAtUtc) return 'posted'
  return utcIso <= nowUtc ? 'missed' : 'upcoming'
}

// Database-agnostic query functions with graceful fallback for scheduled_day
async function readSchedule(startUtc: string, endUtc: string, dateYYYYMMDD?: string) {
  const isVercel = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) && process.env.NODE_ENV === 'production'
  const isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !process.env.DATABASE_URL?.includes('postgres')
  
  if (isSqlite) {
    await db.connect()
    try {
      const rows = await db.query(`
        SELECT 
          content_id, platform, content_type, source, title, 
          scheduled_post_time, scheduled_slot_index, actual_posted_at, reasoning
        FROM scheduled_posts
        WHERE scheduled_post_time BETWEEN ? AND ?
        ORDER BY scheduled_post_time ASC
      `, [startUtc, endUtc])
      return rows.rows || []
    } finally {
      await db.disconnect()
    }
  } else {
    // Supabase with graceful fallback for scheduled_day column
    const supabase = createSimpleClient()
    
    // First attempt: use scheduled_day if available and date provided
    if (dateYYYYMMDD) {
      try {
        const { data, error, status } = await supabase
          .from('scheduled_posts')
          .select('content_id, platform, content_type, source, title, scheduled_post_time, scheduled_slot_index, actual_posted_at, reasoning')
          .eq('scheduled_day', dateYYYYMMDD)
          .order('scheduled_slot_index', { ascending: true })

        if (error && status !== 406) throw error;
        if (data) return data;
      } catch (e: any) {
        const msg = (e?.message || '').toLowerCase();
        const missingCol = msg.includes('column') && msg.includes('scheduled_day') && msg.includes('does not exist');
        if (!missingCol) throw e;
        
        console.log(`⚠️ scheduled_day column missing in forecast, falling back to UTC time range filter`);
      }
    }
    
    // Fallback: range filter on scheduled_post_time
    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('content_id, platform, content_type, source, title, scheduled_post_time, scheduled_slot_index, actual_posted_at, reasoning')
      .gte('scheduled_post_time', startUtc)
      .lte('scheduled_post_time', endUtc)
      .order('scheduled_post_time', { ascending: true })
    
    if (error) throw error
    return data || []
  }
}

async function readPostedMap(startUtc: string, endUtc: string): Promise<Map<string, string>> {
  const isVercel = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) && process.env.NODE_ENV === 'production'
  const isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !process.env.DATABASE_URL?.includes('postgres')

  if (isSqlite) {
    await db.connect()
    try {
      const rows = await db.query(`
        SELECT content_queue_id as content_id, posted_at
        FROM posted_content
        WHERE posted_at BETWEEN ? AND ?
      `, [startUtc, endUtc])
      return new Map(rows.rows.map((r: any) => [String(r.content_id), r.posted_at]))
    } finally {
      await db.disconnect()
    }
  } else {
    // Supabase
    const supabase = createSimpleClient()
    const { data, error } = await supabase
      .from('posted_content')
      .select('content_queue_id, posted_at')
      .gte('posted_at', startUtc)
      .lte('posted_at', endUtc)
    
    if (error) throw error
    return new Map((data || []).map((r: any) => [String(r.content_queue_id), r.posted_at]))
  }
}

function findNearestWithin(schedule: any[], targetUtcIso: string, tolMs: number) {
  const t = new Date(targetUtcIso).getTime()
  let best: any = null
  let bestDelta = Number.POSITIVE_INFINITY
  for (const s of schedule) {
    const ts = new Date(s.scheduled_post_time).getTime()
    const d = Math.abs(ts - t)
    if (d < bestDelta && d <= tolMs) {
      best = s
      bestDelta = d
    }
  }
  return best
}

// Helper to pick title from content_queue or scheduled_posts
function pickTitle(qRow: any, spRow: any): string | null {
  if (qRow?.content_text) {
    // Trim to ~140 chars for readability
    const text = String(qRow.content_text).trim()
    return text.length > 140 ? text.substring(0, 137) + '...' : text
  }
  return spRow?.title || null
}

// Helper to normalize content from either source
function normalizeContent(spRow: any, qRow?: any): ForecastItem {
  return {
    id: String(qRow?.id ?? spRow.content_id ?? ''),
    platform: qRow?.source_platform ?? spRow.platform ?? null,
    content_type: qRow?.content_type ?? spRow.content_type ?? null,
    source: qRow?.original_author ?? spRow.source ?? null,
    title: pickTitle(qRow, spRow),
    url: qRow?.original_url ?? spRow.url ?? null,
    confidence: qRow?.confidence_score ?? spRow.confidence ?? null,
  }
}

// Enrich content with full details from content_queue
async function enrichContentDetails(scheduled: any[]) {
  const isVercel = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) && process.env.NODE_ENV === 'production'
  const isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !process.env.DATABASE_URL?.includes('postgres')

  // Get unique content_ids that need enrichment - cast to numbers and filter out invalid ones
  const ids = [...new Set(
    scheduled
      .filter(s => s.content_id)
      .map(s => Number(s.content_id))
      .filter(Boolean)
  )]

  if (ids.length === 0) return new Map()

  if (isSqlite) {
    await db.connect()
    try {
      const placeholders = ids.map(() => '?').join(',')
      const rows = await db.query(`
        SELECT id, source_platform, content_type, original_author, content_text, original_url, confidence_score
        FROM content_queue
        WHERE id IN (${placeholders})
      `, ids)
      
      return new Map(rows.rows.map(row => [Number(row.id), row]))
    } finally {
      await db.disconnect()
    }
  } else {
    // Supabase - use number[] for .in() and defensive guard against empty array
    const supabase = createSimpleClient()
    const { data: queueRows, error } = await supabase
      .from('content_queue')
      .select('id, source_platform, content_type, original_author, content_text, original_url, confidence_score')
      .in('id', ids.length ? ids : [-1]) // avoid empty .in()

    if (error) {
      console.warn('Failed to enrich content details:', error)
      return new Map()
    }

    // Map by number id for consistent lookup
    return new Map((queueRows || []).map(row => [Number(row.id), row]))
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || format(toET(new Date()), 'yyyy-MM-dd')
    
    console.log(`🔮 Phase 5.12 Forecast for ${date} - Reading from real schedule`)

    // Time window for queries
    const { startUtc, endUtc } = dayUtcRange(date)
    const slotUtcIsos = SLOT_LABELS.map(t => slotIsoUtc(date, t))

    // 1) Try reading real schedule (scheduled_posts)
    let scheduled: any[] = []
    try {
      scheduled = await readSchedule(startUtc, endUtc, date)
      console.log(`📊 Found ${scheduled.length} scheduled items in database`)
    } catch (e: any) {
      const msg = String(e?.message || e)
      if (msg.includes("Could not find the table 'public.scheduled_posts'")) {
        return NextResponse.json({
          error: "scheduled_posts table missing in Supabase — run migration 20251009_create_scheduled_posts.sql",
          hint: "Create table in Supabase SQL editor, then refresh. A pg_notify('pgrst','reload schema') is included in the migration.",
        }, { status: 503, headers: { 'cache-control': 'no-store' } })
      }
      throw e
    }

    // 2) If empty, call real generator (same code the action uses), then re-read
    if (!scheduled.length) {
      console.log(`📅 No schedule found for ${date}, generating...`)
      try {
        await generateDailySchedule(date)
        scheduled = await readSchedule(startUtc, endUtc, date)
        console.log(`✅ Generated and found ${scheduled.length} scheduled items`)
      } catch (err) {
        console.warn('Forecast: generator failed or not present', err)
        // Continue with empty schedule - will show missed/upcoming slots
      }
    }

    // 3) Join with posted_content by content_id to mark posted
    const postedMap = await readPostedMap(startUtc, endUtc)
    console.log(`📋 Found ${postedMap.size} posted items for this date range`)

    // 3.5) Enrich scheduled posts with full content details from content_queue
    const queueDataById = await enrichContentDetails(scheduled)
    console.log(`🔗 Enriched ${queueDataById.size} content items with full details`)

    // 4) Build exact 6 slots result from real schedule
    const slots: ForecastSlot[] = SLOT_LABELS.map((label, idx) => {
      const targetUtc = slotUtcIsos[idx]
      
      // Prefer an entry whose scheduled_slot_index == idx
      let entry = scheduled.find(s => s.scheduled_slot_index === idx)
      if (!entry) {
        // Else match by exact/nearest UTC time within +/- 50m
        const fiftyMinMs = 50 * 60 * 1000
        entry = findNearestWithin(scheduled, targetUtc, fiftyMinMs)
      }

      if (!entry) {
        // No scheduled item for this slot → status = missed/upcoming based on time
        const status = statusForSlot(targetUtc, null)
        return {
          slot_index: idx,
          time_local: label,
          iso: targetUtc,
          status,
          content: null,
          reasoning: status === 'missed'
            ? 'no schedule materialized for this slot by runtime'
            : 'awaiting schedule materialization',
        }
      }

      const postedAt = postedMap.get(String(entry.content_id)) || null
      const status = statusForSlot(targetUtc, postedAt ?? entry.actual_posted_at ?? null)

      // Use normalization helper to combine queue and scheduled data
      const queueRow = entry.content_id ? queueDataById.get(Number(entry.content_id)) : null
      const content: ForecastItem = normalizeContent(entry, queueRow)

      return {
        slot_index: idx,
        time_local: label,
        iso: targetUtc,
        status, // posted | upcoming | missed
        content,
        scheduled_post_time: entry.scheduled_post_time, // UTC
        actual_posted_at: postedAt ?? entry.actual_posted_at ?? null,
        reasoning: entry.reasoning ?? 'selected by daily scheduler job',
      }
    })

    // 5) Summary + diversity for the **actual** set
    const platforms = new Map<string, number>()
    const types = new Map<string, number>()
    for (const s of slots) {
      if (!s.content) continue
      platforms.set(s.content.platform, (platforms.get(s.content.platform) || 0) + 1)
      types.set(s.content.content_type, (types.get(s.content.content_type) || 0) + 1)
    }
    
    const platformScore = Math.min(platforms.size / 5 * 50, 50)
    const typeScore = Math.min(types.size / 4 * 50, 50)
    const diversity_score = Math.round(platformScore + typeScore)

    const summary = {
      total: slots.length,
      posted: slots.filter(s => s.status === 'posted').length,
      upcoming: slots.filter(s => s.status === 'upcoming').length,
      missed: slots.filter(s => s.status === 'missed').length,
      platforms: Object.fromEntries(platforms),
      content_types: Object.fromEntries(types),
      diversity_score,
    }

    const response: ForecastResponse = {
      date,
      timezone: TZ,
      slots,
      summary
    }

    console.log(`🔮 Phase 5.12 Forecast complete:`, {
      date,
      slots: slots.length,
      posted: summary.posted,
      upcoming: summary.upcoming,
      missed: summary.missed,
      diversity: diversity_score
    })

    return NextResponse.json(response, { 
      headers: { 
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      } 
    })
    
  } catch (err: any) {
    console.error('Phase 5.12 forecast endpoint failed', err)
    return NextResponse.json({ error: err?.message || 'forecast failed' }, { status: 500 })
  }
}