/** Read-only, one-shot production evidence. Does not schedule work or send notifications. */
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
if (args.includes('--help')) {
  console.log('node scripts/capture-io-snapshot.mjs --output <new.json> [--baseline <earlier.json>] [--project-ref <ref>]');
  process.exit(0);
}
const output = flag('--output');
const baseline = flag('--baseline');
if (!output) throw new Error('Usage: node scripts/capture-io-snapshot.mjs --output <new.json> [--baseline <earlier.json>]');
const ref = flag('--project-ref') || (await readFile(new URL('../supabase/.temp/project-ref', import.meta.url), 'utf8')).trim();
if (!/^[a-z0-9]{20}$/.test(ref)) throw new Error('Invalid project reference');
let token = process.env.SUPABASE_ACCESS_TOKEN || '';
if (!token && process.platform === 'darwin') {
  for (const account of ['supabase', 'access-token']) {
    try {
      token = execFileSync('security', ['find-generic-password', '-s', 'Supabase CLI', '-a', account, '-w'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 }).trim();
      if (token) break;
    } catch { /* Only the two documented CLI account names are consulted. */ }
  }
}
if (!/^sbp_(?:oauth_|v0_)?[a-f0-9]{40}$/.test(token)) throw new Error('Supabase CLI login or SUPABASE_ACCESS_TOKEN required');
const base = `https://api.supabase.com/v1/projects/${ref}`;
async function request(url, payload, asText = false) {
  const managed = url.startsWith(`${base}/`);
  const response = await fetch(url, { method: payload ? 'POST' : 'GET',
    headers: { ...(managed ? { Authorization: `Bearer ${token}` } : {}), ...(payload ? { 'Content-Type': 'application/json' } : {}) },
    body: payload ? JSON.stringify(payload) : undefined, signal: AbortSignal.timeout(20000) });
  if (!response.ok) return { status: response.status };
  return { status: response.status, data: asText ? await response.text() : await response.json() };
}
function diskCounters(text) {
  const counters = Object.create(null), memory = Object.create(null); let bootTime;
  for (const line of text.split('\n')) {
    const ram=line.match(/^(node_memory_(?:MemTotal|MemAvailable|SwapTotal|SwapFree)_bytes|node_vmstat_pswpin|node_vmstat_pswpout)(?:\{[^}]*\})?\s+([\d.eE+-]+)/);
    if(ram&&Number.isFinite(Number(ram[2])))memory[ram[1]]=Number(ram[2]);
    const match = line.match(/^(node_boot_time_seconds|node_disk_reads_completed_total|node_disk_writes_completed_total|node_disk_read_bytes_total|node_disk_written_bytes_total|node_disk_io_time_seconds_total)(?:\{([^}]*)\})?\s+([\d.eE+-]+)(?:\s|$)/);
    if (!match || !Number.isFinite(Number(match[3]))) continue;
    if (match[1] === 'node_boot_time_seconds') { bootTime = Number(match[3]); continue; }
    const device = match[2]?.match(/\bdevice="([a-zA-Z0-9_.-]+)"/)?.[1];
    if (device) {
      const key = `${device}/${match[1]}`;
      counters[key] = Number(match[3]);
    }
  }
  return { boot_time: bootTime, counters, memory };
}
const query = `select pg_postmaster_start_time() as postmaster_started_at,
 (select row_to_json(d) from (select stats_reset,blks_read,blks_hit,tup_inserted,tup_updated,tup_deleted,temp_bytes
   from pg_catalog.pg_stat_database where datname=current_database()) d) as database,
 (select row_to_json(w) from (select stats_reset,wal_records,wal_fpi,wal_bytes from pg_catalog.pg_stat_wal) w) as wal,
 (select json_agg(t) from (select schemaname,relname,n_tup_ins,n_tup_upd,n_tup_del,n_dead_tup,autovacuum_count,seq_scan,seq_tup_read,idx_scan
   from pg_catalog.pg_stat_user_tables where schemaname in ('public','company_business_private','market_cause_private') order by schemaname,relname) t) as tables`;
const safe = async task => { try { return await task(); } catch (error) { return { error: error.name }; } };
const [sql, health, config, rawMetrics] = await Promise.all([
  safe(() => request(`${base}/database/query`, { query, read_only: true })),
  safe(() => request(`${base}/health?services=db,auth,rest`)),
  safe(() => request('https://joobi.kr/api/config')),
  safe(() => request(`${base}/analytics/endpoints/metrics`, undefined, true)),
]);
const metrics = { status: rawMetrics.status, error: rawMetrics.error,
  ...(typeof rawMetrics.data === 'string' ? diskCounters(rawMetrics.data) : {}) };
const snapshot = { captured_at: new Date().toISOString(), project: ref, sql, health,
  config: { status: config.status, error: config.error }, metrics };
if (baseline) {
  const earlier = JSON.parse(await readFile(baseline, 'utf8'));
  const before = earlier.sql?.data?.[0]; const after = sql.data?.[0];
  const comparable = earlier.project === ref && before && after
    && before.postmaster_started_at === after.postmaster_started_at
    && before.wal.stats_reset === after.wal.stats_reset
    && before.database.stats_reset === after.database.stats_reset;
  const delta = (a, b) => a !== null && b !== null && Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Number(b) >= Number(a) ? Number(b) - Number(a) : null;
  const elapsedHours = (Date.parse(snapshot.captured_at) - Date.parse(earlier.captured_at)) / 3600000;
  snapshot.comparison = { elapsed_hours: elapsedHours, full_day_elapsed: elapsedHours >= 24,
    counters_comparable: Boolean(comparable),
    ...(comparable ? { wal_bytes: delta(before.wal.wal_bytes, after.wal.wal_bytes),
      tables: after.tables.map(table => { const old = before.tables.find(row => row.relname === table.relname&&(row.schemaname||'public')===(table.schemaname||'public')); return {
        table: `${table.schemaname||'public'}.${table.relname}`, updated: old ? delta(old.n_tup_upd, table.n_tup_upd) : null,
        inserted: old ? delta(old.n_tup_ins, table.n_tup_ins) : null, deleted: old ? delta(old.n_tup_del, table.n_tup_del) : null,
      }; }) } : { reason: 'Different project, unavailable database, or statistics restarted; do not infer a reduction.' }) };
  const priorMetrics = earlier.metrics;
  // A host reboot also restarts PostgreSQL. Some Supabase metric exporters omit
  // node_boot_time_seconds; the unchanged postmaster epoch is a conservative
  // fallback, while any decreasing individual counter is still rejected.
  const epochBasis = metrics.boot_time && priorMetrics?.boot_time ? 'host_boot_time' : 'postgres_start';
  const sameHost = comparable && metrics.status === 200 && priorMetrics?.status === 200
    && (epochBasis === 'postgres_start' || metrics.boot_time === priorMetrics.boot_time);
  snapshot.comparison.disk_counters_comparable = Boolean(sameHost && elapsedHours > 0);
  snapshot.comparison.disk_epoch_basis = epochBasis;
  if (sameHost && elapsedHours > 0) {
    // Keep devices separate: summing parent devices and partitions can double count.
    snapshot.comparison.disk_rates = Object.entries(metrics.counters).flatMap(([name, value]) => {
      const increase = delta(priorMetrics.counters?.[name], value);
      return increase === null ? [] : [{ counter: name, increase, per_second: increase / (elapsedHours * 3600) }];
    });
  }
}
await mkdir(dirname(resolve(output)), { recursive: true });
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ output: resolve(output), captured_at: snapshot.captured_at,
  sql_status: sql.status, health_status: health.status, config_status: config.status,
  comparison: snapshot.comparison ? { elapsed_hours: snapshot.comparison.elapsed_hours, counters_comparable: snapshot.comparison.counters_comparable } : undefined }));
process.exitCode = sql.status === 201 && config.status === 200 && health.data?.every(service => service.healthy) ? 0 : 1;
