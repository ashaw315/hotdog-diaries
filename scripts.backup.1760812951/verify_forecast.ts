// scripts/verify_forecast.ts
// Usage:
//   npx tsx scripts/verify_forecast.ts --date 2025-10-09 --base https://hotdog-diaries.vercel.app
//
// Verifies:
//  - Supabase REST reachability & 'scheduled_posts' table existence
//  - Forecast health endpoint
//  - Forecast endpoint returns 6 slots for the date
//  - Diversity/summary sanity

type Args = {
  date: string
  base: string
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  let date = ''
  let base = 'https://hotdog-diaries.vercel.app'
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date') date = args[i + 1]
    if (args[i] === '--base') base = args[i + 1]
  }
  if (!date) {
    // Default to today's date in ET (rough fallback: use system date; UI accepts YYYY-MM-DD)
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = String(now.getUTCMonth() + 1).padStart(2, '0')
    const d = String(now.getUTCDate()).padStart(2, '0')
    date = `${y}-${m}-${d}`
  }
  return { date, base }
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(`Missing env: ${name}. Set it or run via Vercel env pull.`)
  }
  return v
}

async function supabaseHeadTable(supabaseUrl: string, serviceKey: string): Promise<{ ok: boolean; status: number; text: string }> {
  // Attempt a simple select; existence of table implies 200/206/204; 404 means missing
  const url = `${supabaseUrl}/rest/v1/scheduled_posts?select=content_id&limit=1`
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Accept-Profile': 'public',
      Prefer: 'count=exact',
    },
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, text }
}

async function hitJSON(url: string, label: string) {
  const res = await fetch(url, { headers: { 'cache-control': 'no-store' } })
  const bodyText = await res.text()
  let json: any = null
  try { json = JSON.parse(bodyText) } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, data: json, raw: bodyText, label }
}

function summarizePlatforms(slots: any[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const s of slots) {
    const p = s?.content?.platform
    if (!p) continue
    map[p] = (map[p] || 0) + 1
  }
  return map
}

(async () => {
  const { date, base } = parseArgs()
  console.log(`\n▶ Phase 5.12.x – Production Forecast Verification`)
  console.log(`   Target date: ${date}`)
  console.log(`   Base URL   : ${base}\n`)

  // 1) Ensure we have Supabase envs
  let SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL is required')
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')

  // Normalize trailing slash
  SUPABASE_URL = SUPABASE_URL.replace(/\/+$/, '')

  // 2) Verify 'scheduled_posts' exists via PostgREST
  process.stdout.write(`🔎 Checking Supabase table existence (scheduled_posts)… `)
  const head = await supabaseHeadTable(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!)
  if (!head.ok) {
    console.log(`FAIL (HTTP ${head.status})`)
    if (head.status === 404) {
      console.error(`  → Table 'public.scheduled_posts' missing in PostgREST schema cache or not created.`)
      console.error(`  → Run migration in Supabase SQL editor, then reload schema: select pg_notify('pgrst','reload schema');`)
    } else {
      console.error(`  → Response: ${head.text}`)
    }
    process.exit(1)
  }
  console.log(`OK (HTTP ${head.status})`)

  // 3) Forecast health endpoint
  const healthUrl = `${base}/api/admin/schedule/forecast/health`
  console.log(`🌐 GET ${healthUrl}`)
  const health = await hitJSON(healthUrl, 'forecast/health')
  if (!health.ok) {
    console.error(`  → FAIL (HTTP ${health.status}) Body: ${health.raw}`)
    process.exit(1)
  }
  console.log(`  ✓ Health OK: ${JSON.stringify(health.data)}`)

  // 4) Forecast endpoint – must return 6 slots
  const forecastUrl = `${base}/api/admin/schedule/forecast?date=${encodeURIComponent(date)}`
  console.log(`🌐 GET ${forecastUrl}`)
  const forecast = await hitJSON(forecastUrl, 'forecast')
  if (!forecast.ok) {
    console.error(`  → FAIL (HTTP ${forecast.status}) Body: ${forecast.raw}`)
    process.exit(1)
  }
  const slots = Array.isArray(forecast.data?.slots) ? forecast.data.slots : []
  console.log(`  ✓ Slots: ${slots.length}`)
  if (slots.length !== 6) {
    console.error(`  → Expected 6 slots, got ${slots.length}`)
    process.exit(1)
  }

  // 5) Diversity/summary sanity
  const platforms = summarizePlatforms(slots)
  console.log(`  ✓ Platform distribution: ${JSON.stringify(platforms)}`)
  console.log(`  ✓ Summary: ${JSON.stringify(forecast.data?.summary)}`)

  // 6) Daily API parity (optional but useful)
  const dailyUrl = `${base}/api/admin/schedule/daily?date=${encodeURIComponent(date)}`
  console.log(`🌐 GET ${dailyUrl}`)
  const daily = await hitJSON(dailyUrl, 'daily')
  if (!daily.ok) {
    console.error(`  → FAIL (HTTP ${daily.status}) Body: ${daily.raw}`)
    process.exit(1)
  }
  console.log(`  ✓ Daily OK: total_today=${daily.data?.summary?.total_today}`)

  // Final
  console.log(`\n✅ Verification PASS`)
  console.log(`   - scheduled_posts table reachable via PostgREST`)
  console.log(`   - forecast health endpoint OK`)
  console.log(`   - forecast returned 6 slots`)
  console.log(`   - daily endpoint OK\n`)
})().catch((e) => {
  console.error(`\n❌ Verification FAILED`)
  console.error(e?.stack || e?.message || String(e))
  process.exit(1)
})