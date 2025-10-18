import fs from 'node:fs/promises';

const wfs = JSON.parse(await fs.readFile('ci_audit/workflows.json','utf8'));
const runsData = JSON.parse(await fs.readFile('ci_audit/runs.json','utf8'));
const runsList = Array.isArray(runsData) ? runsData : [runsData];

const runsByPath = {};
for (const r of runsList) {
  runsByPath[r.path] = r;
}

function pct(n, d){ return d ? Math.round((n/d)*100) : 0; }
function avg(arr){ if(!arr.length) return 0; return Math.round(arr.reduce((a,b)=>a+(b||0),0)/arr.length); }

const summary = [];
let failingCount=0;

for (const wf of wfs) {
  const r = runsByPath[wf.file?.replace('.github/workflows/','') ? wf.file : (wf.file || '')] || runsByPath[wf.file] || null;
  const runs = r?.runs ?? [];
  const total = runs.length;
  const successes = runs.filter(x=>x.conclusion==='success').length;
  const failures  = runs.filter(x=>x.conclusion==='failure').length;
  const cancels   = runs.filter(x=>x.conclusion==='cancelled').length;
  const timeouts  = runs.filter(x=>x.conclusion==='timed_out').length;
  const avgDur = avg(runs.map(x=>x.duration_s).filter(Boolean));

  // flaky heuristic: both success and failure in last 5 runs
  const flaky = (successes>0 && failures>0);

  // Permissions minimality heuristic
  const perms = wf.permissions ?? {};
  const minimalPerms = perms && Object.keys(perms).length>0
    ? Object.values(perms).every(v => ['read','none'].includes(String(v)))
    : true; // treat missing as default to repo policy

  const timeoutsMissing = (wf.jobs || []).some(j => j.timeout === undefined);
  const concurrencyMissing = wf.concurrency === undefined;

  const usesCache = (wf.jobs || []).some(j => (j.steps||[]).some(s => String(s.uses||'').match(/cache@|setup-node@|actions\/cache@/)));

  const artifacts = (wf.jobs || []).some(j => (j.steps||[]).some(s => String(s.uses||'').match(/upload-artifact@/)));

  const secretsRefs = [...new Set((wf.jobs||[]).flatMap(j => j.secretRefs || []))];

  const status = failures>0 ? 'failing'
               : (successes>0 ? 'passing' : (total===0 ? 'no-runs' : 'unknown'));

  if (status==='failing') failingCount++;

  summary.push({
    file: wf.file,
    name: wf.name || wf.file,
    triggers: wf.on,
    permissions: wf.permissions,
    concurrency: wf.concurrency,
    jobs: (wf.jobs||[]).map(j=>({
      jobName: j.jobName, runsOn: j.runsOn, timeout: j.timeout, hasCache: (j.steps||[]).some(s => String(s.uses||'').includes('actions/cache')),
    })),
    stats: {
      recent_total: total,
      success: successes,
      failure: failures,
      cancelled: cancels,
      timed_out: timeouts,
      pass_rate_pct: pct(successes,total),
      avg_duration_s: avgDur,
      flaky
    },
    flags: {
      minimal_permissions: minimalPerms,
      missing_timeouts: timeoutsMissing,
      missing_concurrency: concurrencyMissing,
      uses_cache: usesCache,
      uploads_artifacts: artifacts,
      references_secrets: secretsRefs
    },
    latest_url: runs[0]?.html_url || null
  });
}

await fs.writeFile('ci_audit/summary.json', JSON.stringify({ failingCount, items: summary }, null, 2));
console.log(JSON.stringify({ failingCount }, null, 2));
