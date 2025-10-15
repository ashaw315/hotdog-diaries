// POST /api/admin/schedule/forecast/refill?date=YYYY-MM-DD
import { NextResponse } from "next/server"
import { z } from "zod"
// IMPORTANT: use the same generator as prod forecast
import { generateDailySchedule } from "@/lib/jobs/schedule-content-production"

const Params = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

function isAuthorized(req: Request): boolean {
  const configured = process.env.AUTH_TOKEN
  if (!configured) return false
  const raw = req.headers.get("x-admin-token") || req.headers.get("authorization") || ""
  const token = raw.replace(/^Bearer\s+/i, "").trim()
  return token && token === configured
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const date = url.searchParams.get("date") ?? ""
  const debug = url.searchParams.get("debug") === "1"
  
  const parsed = Params.safeParse({ date })
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid date (expected YYYY-MM-DD)" }, { status: 400 })
  }

  try {
    console.log(`🔧 Refill endpoint called for ${parsed.data.date} (debug: ${debug})`)
    
    // Fill ONLY empty or placeholder slots. Never overwrite posted slots.
    // The generator will be updated to guarantee non-empty rows when filling.
    const result = await generateDailySchedule(parsed.data.date, {
      mode: "refill-missing",
      forceRefill: true,
      // do NOT delete any row; only fill where content_id/scheduled_post_time missing
      // (generator will enforce this)
    })

    // Extract debug information from the result
    const debugInfo = {
      picked: result.slots?.filter(s => s.action === 'created' || s.action === 'updated').length || 0,
      written: result.filled || 0,
      skipped: result.slots?.filter(s => s.action === 'skipped').length || 0,
      constraints: result.slots?.map(s => s.level).filter(Boolean) || [],
      environment: result.debug?.environment || 'unknown',
      candidates_found: result.debug?.candidates_found || 0,
      existing_slots: result.debug?.existing_slots || 0
    }

    const response = {
      ok: true,
      date: parsed.data.date,
      filled: result.filled,
      slots: result.slots
    }

    // Add debug info if requested
    if (debug) {
      response.debug = debugInfo
    }

    console.log(`✅ Refill completed for ${parsed.data.date}: ${result.filled} slots filled`)
    if (debug) {
      console.log(`🔍 Debug info:`, debugInfo)
    }

    return NextResponse.json(response, { 
      headers: { "cache-control": "no-store" } 
    })
    
  } catch (e: any) {
    console.error(`❌ Refill failed for ${parsed.data.date}:`, e)
    
    // Enhanced error handling with Postgres pattern detection
    let errorMessage = e?.message ?? "refill failed"
    let friendlyHint = null
    
    // Detect known Postgres/Supabase error patterns
    if (errorMessage.includes("syntax error at or near") && errorMessage.includes("ORDER")) {
      friendlyHint = "Raw SQL ORDER BY detected - ensure all queries use Supabase query builder instead of raw SQL"
      console.log(`💡 Detected raw SQL ORDER BY issue - switching to query builder should fix this`)
    } else if (errorMessage.includes("relation") && errorMessage.includes("does not exist")) {
      friendlyHint = "Database table missing - ensure scheduled_posts table exists and is properly migrated"
    } else if (errorMessage.includes("permission denied")) {
      friendlyHint = "Database permission issue - check Supabase RLS policies and service role permissions"
    } else if (errorMessage.includes("duplicate key")) {
      friendlyHint = "Duplicate constraint violation - this may be expected during concurrent refills"
    }

    const errorResponse = {
      ok: false,
      error: errorMessage,
      date: parsed.data.date
    }

    // Add debug info and friendly hint if available
    if (debug) {
      errorResponse.debug = {
        original_error: e?.stack || e?.message,
        error_type: e?.constructor?.name || 'Unknown',
        postgres_error: e?.code || null,
        timestamp: new Date().toISOString()
      }
    }

    if (friendlyHint) {
      errorResponse.hint = friendlyHint
    }

    return NextResponse.json(errorResponse, { 
      status: 500, 
      headers: { "cache-control": "no-store" } 
    })
  }
}