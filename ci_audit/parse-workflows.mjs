import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const WF_DIR = path.join(ROOT, '.github', 'workflows');

const glob = async (dir) => {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      .map(f => path.join(dir, f));
  } catch { return []; }
};

const clean = (v) => (v === undefined || v === null) ? undefined : v;

const extract = (doc) => {
  const name = doc.name ?? '';
  const on = doc.on ?? {};
  const concurrency = clean(doc.concurrency);
  const permissions = clean(doc.permissions);
  const jobs = Object.entries(doc.jobs ?? {}).map(([jobName, job]) => {
    const runsOn = job['runs-on'];
    const timeout = job['timeout-minutes'];
    const strategy = job.strategy;
    const needs = job.needs;
    const env = job.env;
    const jobPerms = job.permissions;
    const steps = (job.steps ?? []).map(s => ({
      name: s.name ?? '',
      uses: s.uses ?? '',
      run: typeof s.run === 'string' ? s.run.slice(0, 2000) : undefined
    }));
    // rough secret usage scan
    const secretRefs = JSON.stringify({env, steps}).match(/\{\{\s*(secrets|vars)\.[^}]+\s*\}\}/g) || [];
    return {
      jobName, runsOn, timeout, strategy, needs, env,
      permissions: jobPerms,
      steps,
      secretRefs: [...new Set(secretRefs)]
    };
  });
  return { name, on, concurrency, permissions, jobs };
};

const files = await glob(WF_DIR);
const results = [];
for (const f of files) {
  try {
    const txt = await fs.readFile(f, 'utf8');
    const doc = yaml.load(txt);
    const meta = extract(doc ?? {});
    results.push({ file: path.relative(ROOT, f), ...meta });
  } catch (e) {
    results.push({ file: path.relative(ROOT, f), parseError: String(e) });
  }
}
await fs.writeFile('ci_audit/workflows.json', JSON.stringify(results, null, 2));
console.log(`Parsed ${results.length} workflow files`);
