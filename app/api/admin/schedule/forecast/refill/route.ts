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
  const parsed = Params.safeParse({ date })
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid date (expected YYYY-MM-DD)" }, { status: 400 })
  }

  try {
    // Fill ONLY empty or placeholder slots. Never overwrite posted slots.
    // The generator will be updated to guarantee non-empty rows when filling.
    const result = await generateDailySchedule(parsed.data.date, {
      mode: "refill-missing",
      forceRefill: true,
      // do NOT delete any row; only fill where content_id/scheduled_post_time missing
      // (generator will enforce this)
    })

    return NextResponse.json(
      { ok: true, date: parsed.data.date, ...result },
      { headers: { "cache-control": "no-store" } }
    )
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "refill failed" },
      { status: 500, headers: { "cache-control": "no-store" } }
    )
  }
}