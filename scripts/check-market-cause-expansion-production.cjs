const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync, chmodSync } = require('node:fs');
const { parseEnv } = require('node:util');
const deployment = process.argv[2], mode = process.argv[3];
if (!/^https:\/\/(?:solb-portfolio-[a-z0-9]+-sunudevelop-1252s-projects\.vercel\.app|joobi\.kr)$/.test(deployment) || !['collect', 'public', 'recover', 'observe'].includes(mode)) throw Error('Invalid test target');
const cwd = '/private/tmp/joobi-market-cause-expansion-release-20261031';
chmodSync(cwd + '/.env.production.local', 0o600);
const env = parseEnv(readFileSync(cwd + '/.env.production.local', 'utf8'));
if (!env.CRON_SECRET) throw Error('Production cron configuration missing');
const checks = [];
const output = `artifacts/market-cause-expansion-20261031/production-${mode}.json`;
function save() { writeFileSync(output, JSON.stringify({ checkedAt: new Date().toISOString(), deployment, mode, checks }, null, 2)); }
function get(path, auth = false) {
  const args = ['--offline', '--yes', 'vercel@65.7.0', 'curl', path, '--deployment', deployment, '--', '--silent', '--show-error', '--max-time', '295', '--write-out', '\n%{http_code}'];
  if (auth) args.push('--header', 'Authorization: Bearer ' + env.CRON_SECRET);
  let raw;
  try { raw = execFileSync('npx', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4_000_000, timeout: 310000 }); }
  catch { throw Error('Bounded deployment request failed; credentials and raw logs omitted'); }
  const cut = raw.lastIndexOf('\n'), status = Number(raw.slice(cut + 1));
  let data; try { data = JSON.parse(raw.slice(0, cut)); } catch {}
  return { status, data };
}
function expect(name, response, status, predicate = () => true, record = true) {
  const passed = response.status === status && predicate(response.data);
  checks.push({ name, status: response.status, passed, ...(record ? { result: response.data } : {}) }); save();
  if (!passed) throw Error(name + ' failed, HTTP ' + response.status);
}
try {
  for (const path of ['/api/cron/market-policy?authority=fed', '/api/cron/market-cause-recovery', '/api/cron/market-cause-observe']) expect('anonymous denied ' + path, get(path), 401, undefined, false);
  if (mode === 'collect') {
    expect('invalid source denied', get('/api/cron/market-policy?authority=unregistered', true), 400);
    for (const authority of ['fed', 'bok']) {
      const r = get('/api/cron/market-policy?authority=' + authority, true);
      expect('official ' + authority + ' collection', r, 200, d => d.status === 'finished' || d.status === 'stored' && d.sourceStatus === 'verified' && d.modelCalls === 0);
      expect('duplicate ' + authority + ' skips source IO', get('/api/cron/market-policy?authority=' + authority, true), 200, d => d.status === 'finished');
    }
    expect('publication still gated', get('/api/market-watch'), 200, d => d.officialPolicies?.cards.length === 0, false);
  }
  if (mode === 'public') {
    const r = get('/api/market-watch');
    expect('official public facts and conditional path', r, 200, d => d.officialPolicies?.cards.length === 2 && d.officialPolicies.cards.every(c => c.path.length === 3 && c.condition.includes('원인으로 확인한 내용은 아니에요')) && !JSON.stringify(d).includes('shadow_supported'), false);
    checks.push({ name: 'public projection', cards: r.data.officialPolicies.cards }); save();
  }
  if (mode === 'observe') {
    expect('real observation stored', get('/api/cron/market-cause-observe', true), 200, d => ['recorded', 'existing'].includes(d.status));
    expect('duplicate observation does not write', get('/api/cron/market-cause-observe', true), 200, d => d.status === 'existing');
  }
  if (mode === 'recover') {
    const response = get('/api/cron/market-cause-recovery', true);
    // External model failure/budget holds are observations, not a fake green test.
    checks.push({ name: 'bounded recovery result', ...response }); save();
    if (![200, 503].includes(response.status)) throw Error('Recovery boundary failed');
  }
  console.log(JSON.stringify({ mode, deployment, checks: checks.length, statuses: checks.map(c => ({ name: c.name, status: c.status, passed: c.passed })) }));
} catch (e) { save(); console.error(e.message); process.exitCode = 1; }
