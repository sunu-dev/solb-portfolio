/** Additive migration only; no customer rows, question text or secrets in output. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const action = process.argv[2] || 'verify';
if (!['apply', 'verify'].includes(action)) throw new Error('Unsupported operation');
const project = 'ytowigkzunbrhyucbsqu';
let token = process.env.SUPABASE_ACCESS_TOKEN || '';
if (!token) for (const account of ['supabase', 'access-token']) {
  try { token = execFileSync('security', ['find-generic-password', '-s', 'Supabase CLI', '-a', account, '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); if (token) break; } catch {}
}
if (!/^sbp_(?:oauth_|v0_)?[a-f0-9]{40}$/.test(token)) throw new Error('Existing CLI authentication unavailable');
async function query(sql, readOnly) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql, read_only: readOnly }), signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Database management HTTP ${response.status}`);
  return response.json();
}
(async () => {
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261104000100_personal_dictionary.sql'), 'utf8');
  if (action === 'apply') await query(migration, false);
  const result = await query(`SELECT c.relrowsecurity AS rls, (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='personal_dictionary') AS policies, has_table_privilege('anon','public.personal_dictionary','SELECT') AS anon_read, has_table_privilege('authenticated','public.personal_dictionary','SELECT,INSERT,UPDATE,DELETE') AS authenticated_access FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname='personal_dictionary';`, true);
  if (!result[0]?.rls || result[0].anon_read || !result[0].authenticated_access || Number(result[0].policies) !== 1) throw new Error('Dictionary protection verification failed');
  const summary = { operation: action, migrationSha256: crypto.createHash('sha256').update(migration).digest('hex'), protection: result[0] };
  fs.mkdirSync(path.join(root, 'artifacts/personal-learning-20261104'), { recursive: true });
  fs.writeFileSync(path.join(root, 'artifacts/personal-learning-20261104/database-verification.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
