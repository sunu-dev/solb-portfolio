// Read-only diagnostic. Never prints credentials or response bodies.
// Run once, then again after a known local quiet interval; other clients/cron
// may still use the database, so this does not establish database idleness.
import { createRequire } from 'node:module';
import { writeFile, mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!base || !key) throw Error('Supabase public environment missing');
const label = process.argv[2] || 'initial';
if (!/^[a-z0-9-]+$/.test(label)) throw Error('Invalid label');
const targets = [
  ['auth-health', `${base}/auth/v1/health`],
  ['portfolios-anonymous', `${base}/rest/v1/user_portfolios?select=user_id&limit=1`],
  ['consents-anonymous', `${base}/rest/v1/user_consents?select=user_id&limit=1`],
  ['production-config', 'https://joobi.kr/api/config'],
];
async function measure([name, url], mode, round) {
  const start = performance.now();
  const at = new Date().toISOString();
  try {
    const isDirect = name !== 'production-config';
    const response = await fetch(url + (isDirect ? '' : `?latency_probe=${Date.now()}`), {
      headers: isDirect ? { apikey: key, Authorization: `Bearer ${key}` } : { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(12000),
    });
    await response.arrayBuffer();
    return { name, mode, round, at, status: response.status, ms: Math.round(performance.now() - start), upstreamMs: response.headers.get('x-envoy-upstream-service-time'), cache: response.headers.get('x-vercel-cache') };
  } catch (error) { return { name, mode, round, at, error: error.name, ms: Math.round(performance.now() - start) }; }
}
const report = { label, startedAt: new Date().toISOString(), limitations: 'Anonymous RLS reads are not authenticated account reads. Local quiet is not database idle. Four concurrent reads are a small sample, not a load test.', samples: [] };
// Alternate order to avoid always confounding concurrency with warm-up.
for (let round = 0; round < 4; round++) {
  for (const mode of round % 2 ? ['parallel', 'serial'] : ['serial', 'parallel']) {
    const samples = mode === 'parallel'
      ? await Promise.all(targets.map(target => measure(target, mode, round)))
      : await (async () => { const rows = []; for (const target of targets) rows.push(await measure(target, mode, round)); return rows; })();
    report.samples.push(...samples);
    console.log(JSON.stringify(samples));
  }
}
report.finishedAt = new Date().toISOString();
await mkdir('artifacts/db-latency-20261113', { recursive: true });
await writeFile(`artifacts/db-latency-20261113/${label}.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
