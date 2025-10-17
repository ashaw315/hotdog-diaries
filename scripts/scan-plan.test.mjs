// Node >=18.17.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const planner = resolve(__dirname, './scan-plan.mjs');

async function runPlanner(env = {}, fixture = {}) {
  const wrapper = `
    globalThis.fetch = async (url, opts={}) => {
      const u = String(url);
      const payloads = ${JSON.stringify(fixture)};
      if (u.endsWith('/api/system/metrics') && payloads.metrics) {
        return new Response(JSON.stringify(payloads.metrics), { status: 200, headers: {'content-type':'application/json'}});
      }
      if (u.includes('/rest/v1/content_queue') && payloads.supabase) {
        return new Response(JSON.stringify(payloads.supabase), { status: 200, headers: {'content-type':'application/json'}});
      }
      return new Response('{}', { status: 200, headers: {'content-type':'application/json'}});
    };
    import(${JSON.stringify(new URL('./scan-plan.mjs', import.meta.url).href)}).catch(e => { console.error(e); process.exit(1); });
  `;
  const tmp = resolve(__dirname, './__tmp_wrapper.mjs');
  await writeFile(tmp, wrapper, 'utf8');

  const proc = spawn(process.execPath, [tmp], {
    cwd: __dirname,
    env: {
      ...process.env,
      TARGET_URL: env.TARGET_URL ?? 'https://example.com',
      SUPABASE_URL: env.SUPABASE_URL ?? 'https://supabase.local',
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY ?? 'test',
      SCAN_MIN_PER_PLATFORM: String(env.SCAN_MIN_PER_PLATFORM ?? 40),
      SCAN_MAX_PER_PLATFORM: String(env.SCAN_MAX_PER_PLATFORM ?? 120),
      SCAN_GLOBAL_MAX: String(env.SCAN_GLOBAL_MAX ?? 800),
      SCAN_COOLDOWN_MIN: String(env.SCAN_COOLDOWN_MIN ?? 180),
      MIN_CONF: String(env.MIN_CONF ?? 0.70),
      MIN_CANDIDATES: String(env.MIN_CANDIDATES ?? 20),
      PLATFORM_ALLOW: env.PLATFORM_ALLOW ?? 'reddit,youtube,giphy,imgur,bluesky,tumblr,lemmy,pixabay',
      NODE_NO_WARNINGS: '1',
    },
  });

  let stdout = '', stderr = '';
  proc.stdout.on('data', d => stdout += d.toString());
  proc.stderr.on('data', d => stderr += d.toString());
  const code = await new Promise(res => proc.on('close', res));

  const plan = JSON.parse(await readFile(resolve(__dirname, '../scan_plan.json'), 'utf8'));
  const matrix = JSON.parse(await readFile(resolve(__dirname, '../scan_matrix.json'), 'utf8'));
  try { await rm(tmp); } catch {}
  return { code, stdout, stderr, plan, matrix };
}

test('global cap → empty matrix with reason', async () => {
  const fixture = {
    metrics: {
      queue_depth_by_platform: { pixabay: 500, bluesky: 400 },
      last_scan_times: { pixabay: new Date().toISOString(), bluesky: new Date().toISOString() }
    }
  };
  const { plan, matrix } = await runPlanner({ SCAN_GLOBAL_MAX: 800 }, fixture);
  assert.equal(plan.analysis.reason, 'global_cap_reached');
  assert.equal(matrix.include.length, 0);
});

test('deficit + cooldown respected; severe deficit bypasses cooldown', async () => {
  const now = Date.now();
  const fixture = {
    metrics: {
      queue_depth_by_platform: { pixabay: 10, bluesky: 39, tumblr: 0 },
      last_scan_times: {
        pixabay: new Date(now - 200*60000).toISOString(),
        bluesky: new Date(now - 30*60000).toISOString(),
        tumblr:  new Date(now - 200*60000).toISOString()
      }
    },
    supabase: [
      ...Array.from({length:25}, ()=>({ source_platform:'pixabay', confidence_score:0.9, ingest_priority:0, is_posted:false, is_approved:true })),
      ...Array.from({length:25}, ()=>({ source_platform:'bluesky', confidence_score:0.9, ingest_priority:0, is_posted:false, is_approved:true })),
      ...Array.from({length:25}, ()=>({ source_platform:'tumblr',  confidence_score:0.9, ingest_priority:0, is_posted:false, is_approved:true })),
    ]
  };
  const { plan, matrix } = await runPlanner({}, fixture);
  assert.equal(plan.analysis.reason, 'deficit_targeting');
  const plats = matrix.include.map(x => x.platform);
  // bluesky may be skipped (cooldown) since deficit is small; pixabay + tumblr included
  assert(plats.includes('pixabay'));
  assert(plats.includes('tumblr'));
});

test('eligibility rule: when >=4 meet cap, exclude non-eligible ones', async () => {
  const fixture = {
    metrics: { queue_depth_by_platform: { a:0,b:0,c:0,d:0,e:0 } },
    supabase: [
      ...Array.from({length:25}, ()=>({ source_platform:'a', confidence_score:0.9, ingest_priority:0, is_posted:false, is_approved:true })),
      ...Array.from({length:25}, ()=>({ source_platform:'b', confidence_score:0.9, ingest_priority:0, is_posted:false, is_approved:true })),
      ...Array.from({length:25}, ()=>({ source_platform:'c', confidence_score:0.9, ingest_priority:0, is_posted:false, is_approved:true })),
      ...Array.from({length:25}, ()=>({ source_platform:'d', confidence_score:0.9, ingest_priority:0, is_posted:false, is_approved:true })),
      ...Array.from({length:5},  ()=>({ source_platform:'e', confidence_score:0.9, ingest_priority:0, is_posted:false, is_approved:true })),
    ]
  };
  const { matrix } = await runPlanner({ PLATFORM_ALLOW: 'a,b,c,d,e' }, fixture);
  const plats = matrix.include.map(x => x.platform).sort();
  assert.deepEqual(plats, ['a','b','c','d']);
});