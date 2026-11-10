/** Pinned existing-project ops. No user-table access or credential output. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import health from './market-cause-health.cjs';
const project = 'ytowigkzunbrhyucbsqu';
const action = process.argv[2] ?? 'status';
if (!['apply', 'retry-days', 'verify', 'status', 'official-on', 'official-off'].includes(action)) throw new Error('Unsupported operation');
let token = process.env.SUPABASE_ACCESS_TOKEN ?? '';
if (!token && process.platform === 'darwin') for (const account of ['supabase', 'access-token']) {
  try { token = execFileSync('security', ['find-generic-password', '-s', 'Supabase CLI', '-a', account, '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); if (token) break; } catch {}
}
if (!/^sbp_(?:oauth_|v0_)?[a-f0-9]{40}$/.test(token)) throw new Error('Existing CLI authentication unavailable');
async function query(sql, readOnly = true) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql, read_only: readOnly }), signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('Management HTTP ' + r.status); return r.json();
}
const exists = await query("select to_regclass('market_cause_private.publication_control') is not null as installed");
let migrationHash;
if (action === 'apply') {
  if (exists[0].installed) throw new Error('Extension already installed; inspect before migration');
  const content = readFileSync('supabase/migrations/20261031_market_cause_operations.sql', 'utf8');
  migrationHash = createHash('sha256').update(content).digest('hex'); await query(content, false);
} else if (!exists[0].installed) throw new Error('Extension not installed');
if (action === 'retry-days') {
  const content = readFileSync('supabase/migrations/20261031_market_cause_retry_days.sql', 'utf8');
  migrationHash = createHash('sha256').update(content).digest('hex'); await query(content, false);
}
if (action === 'official-on' || action === 'official-off') {
  await query(`UPDATE market_cause_private.publication_control SET official_facts=${action === 'official-on' ? 'true' : 'false'} WHERE id=true`, false);
}
let schemaVerification;
if (action === 'verify') {
  const files = ['supabase/migrations/20261031_market_cause_operations.sql', 'supabase/migrations/20261031_market_cause_retry_days.sql'];
  const expected = new Map();
  for (const file of files) for (const match of readFileSync(file, 'utf8').matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\([^]*?AS \$\$([^]*?)\$\$;/g)) expected.set(match[1], match[2].trim());
  const functions = await query(`select p.proname,p.prosrc,has_function_privilege('anon',p.oid,'EXECUTE') as anon,
   has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated,has_function_privilege('service_role',p.oid,'EXECUTE') as service
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (${[...expected.keys()].map(n => "'" + n + "'").join(',')})`);
  if (functions.length !== expected.size || functions.some(f => f.prosrc.trim() !== expected.get(f.proname) || f.anon || f.authenticated || !f.service)) throw new Error('Installed function or role grant differs from verified migration');
  schemaVerification = { functions: functions.map(f => ({ name: f.proname, matched: true, anon: f.anon, authenticated: f.authenticated, service: f.service })),
    migrationHashes: Object.fromEntries(files.map(f => [f, createHash('sha256').update(readFileSync(f)).digest('hex')])) };
}
const result = await query(`select
 (select row_to_json(c) from market_cause_private.publication_control c) as publication,
 (select json_agg(x) from (select h.event_key,h.revision,v.created_at,
 v.payload->'snapshot'->'decision'->'reasonCodes' as reasons,v.payload->'snapshot'->'attempts' as attempts,
 v.payload->'snapshot'->'official'->>'status' as official_status,
 v.payload->'snapshot'->'official'->'release'->>'publishedAt' as publication_date
 from market_cause_private.shadow_heads h join market_cause_private.shadow_versions v on v.id=h.result_id order by v.created_at desc limit 20) x) as heads,
 (select json_agg(x) from (select event_key,attempts,next_attempt_at from market_cause_private.jobs where status='failed' and attempts<2 and next_attempt_at<=clock_timestamp() and created_at>clock_timestamp()-interval '48 hours' order by event_key limit 8) x) as due,
 (select json_agg(x) from (select day,observed_at,report from market_cause_private.daily_observations order by day desc limit 14) x) as observations,
 (select json_agg(x) from (select period_kind,period_start,calls,spent,reserved from market_cause_private.budget_periods order by period_start desc limit 4) x) as budget`);
const observationHealth = (result[0]?.observations ?? []).map(row => ({ day: row.day, ...health.pilotHealth(row.report) }));
const out = { checkedAt: new Date().toISOString(), project, action, migrationHash, schemaVerification, result, observationHealth };
mkdirSync('artifacts/market-cause-expansion-20261031', { recursive: true });
writeFileSync(`artifacts/market-cause-expansion-20261031/production-${action}.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out));
