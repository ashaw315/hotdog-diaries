import fs from 'node:fs/promises';
import process from 'node:process';

const env = (k, d=undefined) => process.env[k] ?? d;
const TARGET_URL = env('TARGET_URL');
const SUPABASE_URL = env('SUPABASE_URL');
const SB_KEY = env('SUPABASE_SERVICE_ROLE_KEY');

const SCAN_MIN_PER_PLATFORM = +env('SCAN_MIN_PER_PLATFORM', 40);
const SCAN_MAX_PER_PLATFORM = +env('SCAN_MAX_PER_PLATFORM', 120);
const SCAN_GLOBAL_MAX = +env('SCAN_GLOBAL_MAX', 800);
const SCAN_COOLDOWN_MIN = +env('SCAN_COOLDOWN_MIN', 180);
const MIN_CONF = +env('MIN_CONF', 0.70);
const MIN_CANDIDATES = +env('MIN_CANDIDATES', 20);

const PLATFORM_ALLOW = new Set((env('PLATFORM_ALLOW','').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)));

async function fetchJson(url, opts={}) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return await r.json();
}

/**
 * Try system metrics first (cheap/no auth). Fallback to Supabase REST group-by if needed.
 */
async function getQueueDepthByPlatform() {
  try {
    const m = await fetchJson(`${TARGET_URL}/api/system/metrics`, {cache:'no-store'});
    if (m?.queue_depth_by_platform) return m.queue_depth_by_platform;
  } catch (e) {
    // fall through
  }
  // Supabase REST fallback — count approved, unposted, ingest_priority >= 0 grouped by source_platform
  const url = `${SUPABASE_URL}/rest/v1/content_queue?select=source_platform&is_approved=eq.true&ingest_priority=gte.0&or=(is_posted.is.null,is_posted.eq.false)`;
  const rows = await fetchJson(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }});
  const agg = {};
  for (const r of rows) {
    const p = String(r.source_platform ?? '').toLowerCase();
    if (!p) continue;
    agg[p] = (agg[p] ?? 0) + 1;
  }
  return agg;
}

/**
 * Optionally use last_scan_times from metrics to enforce cooldown.
 */
async function getLastScanTimes() {
  try {
    const m = await fetchJson(`${TARGET_URL}/api/system/metrics`, {cache:'no-store'});
    return m?.last_scan_times ?? {};
  } catch {
    return {};
  }
}

/**
 * Availability-aware eligibility check: count high-confidence approved pool by platform.
 */
async function getEligibilitySnapshot() {
  const url = `${SUPABASE_URL}/rest/v1/content_queue?select=source_platform,confidence_score,ingest_priority,is_posted,is_approved&is_approved=eq.true&ingest_priority=gte.0&or=(is_posted.is.null,is_posted.eq.false)`;
  const rows = await fetchJson(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }});
  const groups = {};
  for (const r of rows) {
    const plat = String(r.source_platform ?? '').toLowerCase();
    if (!plat) continue;
    groups[plat] = groups[plat] ?? { total:0, elig:0 };
    groups[plat].total++;
    const conf = +((r.confidence_score ?? 0));
    if (conf >= MIN_CONF) groups[plat].elig++;
  }
  const snap = Object.entries(groups).map(([platform,{total,elig}])=>({
    platform, total, eligible: elig, meets_cap: elig >= MIN_CANDIDATES
  }));
  return snap;
}

function minutesSince(tsIso) {
  try {
    const dt = new Date(tsIso).getTime();
    if (!Number.isFinite(dt)) return Infinity;
    return (Date.now() - dt) / 60000;
  } catch { return Infinity; }
}

function computePlan(depths, lastScan, eligibility) {
  // Filter to allowed platforms only
  const platforms = Object.fromEntries(
    Object.entries(depths).filter(([p]) => PLATFORM_ALLOW.size ? PLATFORM_ALLOW.has(p) : true)
  );

  const total = Object.values(platforms).reduce((a,b)=>a+b,0);
  const meets = Object.fromEntries(eligibility.map(e=>[e.platform, e.meets_cap]));
  const nowEligibleCount = eligibility.filter(e => e.meets_cap).length;

  const plan = [];
  if (total >= SCAN_GLOBAL_MAX) {
    return { reason: 'global_cap_reached', total, plan: [] };
  }

  for (const [platform, depth] of Object.entries(platforms)) {
    // Skip if above max cap
    if (depth >= SCAN_MAX_PER_PLATFORM) continue;

    // Cooldown: if last scan is too recent, skip (unless platform is in severe deficit)
    const mins = minutesSince(lastScan?.[platform]);
    const severeDeficit = depth < Math.min(10, SCAN_MIN_PER_PLATFORM / 4);
    if (!severeDeficit && Number.isFinite(mins) && mins < SCAN_COOLDOWN_MIN) continue;

    // If platform does not meet eligibility cap and we have >=4 eligible platforms overall,
    // de-prioritize this one (skip for now to preserve quality/diversity)
    if (!meets[platform] && nowEligibleCount >= 4) continue;

    // Desired fill toward min
    const need = Math.max(0, SCAN_MIN_PER_PLATFORM - depth);

    if (need > 0) {
      // Bound desired by remaining global budget so we don't explode total size
      const headroom = Math.max(0, SCAN_GLOBAL_MAX - total);
      const desired = Math.max(0, Math.min(need, Math.max(10, Math.floor(headroom * 0.25))));
      if (desired > 0) plan.push({ platform, desired });
    }
  }

  // Sort plan by largest deficit first
  plan.sort((a,b)=>b.desired - a.desired);

  return { reason: 'deficit_targeting', total, plan };
}

async function main() {
  const depths = await getQueueDepthByPlatform();
  const lastScan = await getLastScanTimes();
  const eligibility = await getEligibilitySnapshot();

  const analysis = computePlan(depths, lastScan, eligibility);

  const out = {
    thresholds: {
      SCAN_MIN_PER_PLATFORM, SCAN_MAX_PER_PLATFORM, SCAN_GLOBAL_MAX,
      SCAN_COOLDOWN_MIN, MIN_CONF, MIN_CANDIDATES
    },
    depths, lastScan, eligibility, analysis
  };

  await fs.writeFile('scan_plan.json', JSON.stringify(out, null, 2), 'utf8');

  // For GitHub Actions dynamic matrix
  const matrix = out.analysis.plan.map(p => ({ platform: p.platform, desired: p.desired }));
  const gha = { include: matrix };
  await fs.writeFile('scan_matrix.json', JSON.stringify(gha), 'utf8');

  // Print a compact summary
  console.log('PLAN:', JSON.stringify({ reason: out.analysis.reason, matrix: gha }, null, 2));
}

main().catch(err => {
  console.error('scan-plan error:', err?.message);
  process.exit(1);
});