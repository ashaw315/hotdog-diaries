#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

console.log('🚀 Running planner stress test...');

// Generate 50 platforms with various queue depths
const platforms = {};
for (let i = 0; i < 50; i++) {
  platforms[`platform${i}`] = Math.floor(Math.random() * 200);
}

const wrapper = `
globalThis.fetch = async (url) => {
  if (url.includes('/api/system/metrics')) {
    return new Response(JSON.stringify({
      queue_depth_by_platform: ${JSON.stringify(platforms)},
      last_scan_times: {}
    }), { status: 200, headers: {'content-type':'application/json'}});
  }
  // Generate large supabase response
  const rows = Array.from({length: 1000}, (_, i) => ({
    source_platform: \`platform\${i % 50}\`,
    confidence_score: Math.random(),
    ingest_priority: 0,
    is_posted: false,
    is_approved: true
  }));
  return new Response(JSON.stringify(rows), { status: 200, headers: {'content-type':'application/json'}});
};
import('./scripts/scan-plan.mjs').catch(e => { console.error(e); process.exit(1); });
`;

await writeFile('__tmp_stress_test.mjs', wrapper);

const start = Date.now();
const proc = spawn('node', ['__tmp_stress_test.mjs'], {
  env: {
    ...process.env,
    TARGET_URL: 'https://example.com',
    SUPABASE_URL: 'https://supabase.local',
    SUPABASE_SERVICE_ROLE_KEY: 'test',
    PLATFORM_ALLOW: Object.keys(platforms).join(',')
  }
});

const code = await new Promise(res => proc.on('close', res));
const duration = Date.now() - start;

if (code === 0 && duration < 5000) {
  console.log(`✅ Stress test: PASSED (completed in ${duration}ms)`);
  process.exit(0);
} else {
  console.log(`❌ Stress test: FAILED (exit code: ${code}, duration: ${duration}ms)`);
  process.exit(1);
}
