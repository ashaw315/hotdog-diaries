// POST /api/admin/schedule/forecast/reconcile?date=YYYY-MM-DD
import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from '@/lib/db'
import { createSimpleClient } from '@/utils/supabase/server'
import { parseISO, setHours, setMinutes, setSeconds, addHours } from 'date-fns'

const Params = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

// Standard ET slot times matching forecast
const SLOT_TIMES_ET = ['08:00', '12:00', '15:00', '18:00', '21:00', '23:30'] as const

function isAuthorized(req: Request): boolean {
  const configured = process.env.AUTH_TOKEN
  if (!configured) return false
  const raw = req.headers.get("x-admin-token") || req.headers.get("authorization") || ""
  const token = raw.replace(/^Bearer\s+/i, "").trim()
  return token && token === configured
}

// Convert ET time string to UTC ISO for given date
function slotTimeToUTC(dateYYYYMMDD: string, etTimeHHMM: string): string {
  const [hh, mm] = etTimeHHMM.split(':').map(Number)
  const etDate = parseISO(dateYYYYMMDD + 'T00:00:00')
  const etSlot = setSeconds(setMinutes(setHours(etDate, hh), mm), 0)
  // Convert ET to UTC (EST = UTC-5, EDT = UTC-4, using EST for simplicity)
  const utcSlot = addHours(etSlot, 5)
  return utcSlot.toISOString()
}

// Find nearest slot index for a given UTC timestamp
function findNearestSlotIndex(utcTimestamp: string, dateYYYYMMDD: string): number {
  const postTime = new Date(utcTimestamp).getTime()
  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY
  
  SLOT_TIMES_ET.forEach((slotTime, index) => {
    const slotUtc = slotTimeToUTC(dateYYYYMMDD, slotTime)
    const slotMs = new Date(slotUtc).getTime()
    const distance = Math.abs(postTime - slotMs)
    
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  })
  
  return bestIndex
}

// ET day range to UTC window
function getUtcWindowForEtDate(dateStrET: string): [string, string] {
  const et = new Date(`${dateStrET}T00:00:00-05:00`) // EST fallback
  const start = new Date(et)
  const end = new Date(et)
  end.setDate(end.getDate() + 1)
  return [start.toISOString(), end.toISOString()]
}

// Read actual posted content for the ET date
async function readPostedReality(dateYYYYMMDD: string) {
  const [startUtc, endUtc] = getUtcWindowForEtDate(dateYYYYMMDD)
  const isVercel = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) && process.env.NODE_ENV === 'production'
  const isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !process.env.DATABASE_URL?.includes('postgres')

  if (isSqlite) {
    await db.connect()
    try {
      const rows = await db.query(`
        SELECT 
          pc.content_queue_id as content_id,
          pc.posted_at,
          cq.source_platform as platform,
          cq.content_type,
          cq.content_text as title,
          cq.original_author as source
        FROM posted_content pc
        LEFT JOIN content_queue cq ON pc.content_queue_id = cq.id
        WHERE pc.posted_at BETWEEN ? AND ?
        ORDER BY pc.posted_at ASC
      `, [startUtc, endUtc])
      return rows.rows || []
    } finally {
      await db.disconnect()
    }
  } else {
    // Supabase
    const supabase = createSimpleClient()
    const { data, error } = await supabase
      .from('posted_content')
      .select(`
        content_queue_id,
        posted_at,
        content_queue:content_queue_id (
          source_platform,
          content_type,
          content_text,
          original_author
        )
      `)
      .gte('posted_at', startUtc)
      .lte('posted_at', endUtc)
      .order('posted_at', { ascending: true })

    if (error) throw error
    
    // Transform Supabase nested result to flat structure
    return (data || []).map(row => ({
      content_id: row.content_queue_id,
      posted_at: row.posted_at,
      platform: row.content_queue?.source_platform || 'unknown',
      content_type: row.content_queue?.content_type || 'text',
      title: row.content_queue?.content_text || 'No title',
      source: row.content_queue?.original_author || null
    }))
  }
}

// Upsert into scheduled_posts with preservation logic
async function upsertWithPreservation(
  dateYYYYMMDD: string,
  slotIndex: number,
  realPost: any
) {
  const scheduledPostTime = slotTimeToUTC(dateYYYYMMDD, SLOT_TIMES_ET[slotIndex])
  const isVercel = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) && process.env.NODE_ENV === 'production'
  const isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !process.env.DATABASE_URL?.includes('postgres')

  if (isSqlite) {
    await db.connect()
    try {
      // Check if slot already has content
      const existing = await db.query(`
        SELECT id, content_id FROM scheduled_posts 
        WHERE DATE(scheduled_post_time) = ? AND scheduled_slot_index = ?
      `, [dateYYYYMMDD, slotIndex])

      if (existing.rows.length > 0 && existing.rows[0].content_id) {
        // Preserve existing content, just update actual_posted_at
        await db.query(`
          UPDATE scheduled_posts 
          SET actual_posted_at = ?, updated_at = datetime('now')
          WHERE id = ?
        `, [realPost.posted_at, existing.rows[0].id])
        return { action: 'preserved', existing_content_id: existing.rows[0].content_id }
      } else {
        // Insert/update with real post data
        if (existing.rows.length > 0) {
          await db.query(`
            UPDATE scheduled_posts 
            SET content_id = ?, platform = ?, content_type = ?, source = ?, title = ?,
                actual_posted_at = ?, updated_at = datetime('now')
            WHERE id = ?
          `, [
            realPost.content_id,
            realPost.platform,
            realPost.content_type,
            realPost.source,
            realPost.title?.substring(0, 100),
            realPost.posted_at,
            existing.rows[0].id
          ])
        } else {
          await db.query(`
            INSERT INTO scheduled_posts (
              scheduled_day, scheduled_slot_index, scheduled_post_time,
              content_id, platform, content_type, source, title,
              actual_posted_at, reasoning
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            dateYYYYMMDD,
            slotIndex,
            scheduledPostTime,
            realPost.content_id,
            realPost.platform,
            realPost.content_type,
            realPost.source,
            realPost.title?.substring(0, 100),
            realPost.posted_at,
            'reconciled from actual posted content'
          ])
        }
        return { action: 'mapped', content_id: realPost.content_id }
      }
    } finally {
      await db.disconnect()
    }
  } else {
    // Supabase
    const supabase = createSimpleClient()
    
    // Check existing with graceful fallback for scheduled_day
    let existing = null
    try {
      const { data } = await supabase
        .from('scheduled_posts')
        .select('id, content_id')
        .eq('scheduled_day', dateYYYYMMDD)
        .eq('scheduled_slot_index', slotIndex)
        .maybeSingle()
      existing = data
    } catch (e: any) {
      // Fallback to time range if scheduled_day column missing
      const { data } = await supabase
        .from('scheduled_posts')
        .select('id, content_id')
        .gte('scheduled_post_time', scheduledPostTime)
        .lt('scheduled_post_time', new Date(new Date(scheduledPostTime).getTime() + 60000).toISOString())
        .eq('scheduled_slot_index', slotIndex)
        .maybeSingle()
      existing = data
    }

    if (existing?.content_id) {
      // Preserve existing content, just update actual_posted_at
      await supabase
        .from('scheduled_posts')
        .update({ 
          actual_posted_at: realPost.posted_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
      return { action: 'preserved', existing_content_id: existing.content_id }
    } else {
      // Upsert with real post data
      const upsertRow = {
        scheduled_day: dateYYYYMMDD,
        scheduled_slot_index: slotIndex,
        scheduled_post_time: scheduledPostTime,
        content_id: realPost.content_id,
        platform: realPost.platform,
        content_type: realPost.content_type,
        source: realPost.source,
        title: realPost.title?.substring(0, 100),
        actual_posted_at: realPost.posted_at,
        reasoning: 'reconciled from actual posted content',
        updated_at: new Date().toISOString()
      }

      try {
        await supabase
          .from('scheduled_posts')
          .upsert([upsertRow], { onConflict: 'scheduled_day,scheduled_slot_index' })
      } catch (e: any) {
        // Fallback without scheduled_day constraint if column missing
        const fallbackRow = { ...upsertRow }
        delete fallbackRow.scheduled_day
        await supabase
          .from('scheduled_posts')
          .upsert([fallbackRow])
      }
      
      return { action: 'mapped', content_id: realPost.content_id }
    }
  }
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const date = url.searchParams.get("date") ?? ""
  
  const parsed = Params.safeParse({ date })
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid date (expected YYYY-MM-DD)" }, { status: 400 })
  }

  try {
    console.log(`🔄 Reconciling posted content with schedule for ${parsed.data.date}`)

    // 1) Read actual posted content for this ET date
    const realPosts = await readPostedReality(parsed.data.date)
    console.log(`📊 Found ${realPosts.length} actual posts for ${parsed.data.date}`)

    let mapped = 0
    let skipped = 0

    // 2) Map each real post to nearest slot and upsert
    for (const realPost of realPosts) {
      try {
        const nearestSlot = findNearestSlotIndex(realPost.posted_at, parsed.data.date)
        const result = await upsertWithPreservation(parsed.data.date, nearestSlot, realPost)
        
        if (result.action === 'mapped') {
          mapped++
          console.log(`✅ Mapped content_id ${realPost.content_id} to slot ${nearestSlot} (${SLOT_TIMES_ET[nearestSlot]} ET)`)
        } else if (result.action === 'preserved') {
          skipped++
          console.log(`⏭️ Preserved existing content in slot ${nearestSlot}, updated actual_posted_at`)
        }
      } catch (error) {
        console.error(`❌ Failed to process post ${realPost.content_id}:`, error)
        skipped++
      }
    }

    console.log(`🎉 Reconciliation complete: mapped ${mapped}, skipped ${skipped}`)

    return NextResponse.json({
      ok: true,
      date: parsed.data.date,
      mapped,
      skipped,
      total_found: realPosts.length
    }, { headers: { "cache-control": "no-store" } })

  } catch (e: any) {
    console.error(`❌ Reconciliation failed for ${parsed.data.date}:`, e)
    return NextResponse.json({
      ok: false,
      error: e?.message ?? "reconciliation failed",
      date: parsed.data.date
    }, { status: 500, headers: { "cache-control": "no-store" } })
  }
}