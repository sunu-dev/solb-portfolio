/** Bounded read-only audit on this computer. No remediation or outbound notifications. */
import { execFile } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

const args = process.argv.slice(2);
const arg = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
if (args.includes('--help')) {
  console.log('node scripts/watch-io-window.mjs --output-dir <new-dir> --baseline <snapshot.json> [--duration-seconds 86400] [--interval-seconds 300]');
  process.exit(0);
}
const outputDir = arg('--output-dir'); const baselineFile = arg('--baseline');
if (!outputDir || !baselineFile) throw new Error('--output-dir and --baseline are required');
const seconds = Number(arg('--duration-seconds') || 86400);
const interval = Number(arg('--interval-seconds') || 300);
if (!Number.isInteger(seconds) || seconds < 5 || seconds > 86400 || !Number.isInteger(interval) || interval < 1 || interval > 3600) {
  throw new Error('Duration must be 5..86400 seconds; interval must be 1..3600 seconds');
}
const dir = resolve(outputDir); const baseline = resolve(baselineFile);
await readFile(baseline); // Fail before starting when the comparison evidence is absent.
await mkdir(dir, { recursive: true, mode: 0o700 });
const started = Date.now(); const deadline = started + seconds * 1000;
const run = { pid: process.pid, started_at: new Date(started).toISOString(), planned_end: new Date(deadline).toISOString(),
  interval_seconds: interval, duration_seconds: seconds, baseline };
await writeFile(join(dir, 'run.json'), `${JSON.stringify(run, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
const log = value => appendFile(join(dir, 'observations.jsonl'), `${JSON.stringify(value)}\n`, { mode: 0o600 });
const execute = promisify(execFile);
const captureScript = fileURLToPath(new URL('./capture-io-snapshot.mjs', import.meta.url));
const health = []; const snapshots = [];
async function capture() {
  const path = join(dir, `io-${String(snapshots.length).padStart(3, '0')}.json`);
  try {
    await execute(process.execPath, [captureScript, '--output', path, '--baseline', baseline], { timeout: 60000 });
    const data = JSON.parse(await readFile(path, 'utf8'));
    const item = { type: 'io', checked_at: data.captured_at, path,
      ok: data.metrics?.status === 200 && data.comparison?.disk_counters_comparable === true,
      metrics_status: data.metrics?.status, counters_comparable: data.comparison?.counters_comparable };
    snapshots.push(item); await log(item);
  } catch (error) {
    const item = { type: 'io', checked_at: new Date().toISOString(), path, ok: false, code: error.code ?? 'unknown' };
    snapshots.push(item); await log(item);
  }
}
let nextHealth = started; let nextSnapshot = started;
while (true) {
  await delay(Math.max(0, nextHealth - Date.now()));
  const start = Date.now(); let item;
  try {
    const response = await fetch('https://joobi.kr/api/config', { redirect: 'error', signal: AbortSignal.timeout(12000) });
    const body = response.ok ? await response.json() : null;
    item = { type: 'health', checked_at: new Date(start).toISOString(), status: response.status,
      ok: response.status === 200 && Boolean(body?.config && typeof body.config === 'object'), ms: Date.now() - start };
  } catch (error) {
    item = { type: 'health', checked_at: new Date(start).toISOString(), ok: false, error: error.name, ms: Date.now() - start };
  }
  health.push(item); await log(item);
  if (start >= nextSnapshot) { await capture(); nextSnapshot = start + 3600000; }
  if (Date.now() >= deadline) break;
  nextHealth = Math.min(deadline, Math.max(nextHealth + interval * 1000, Date.now()));
}
await capture();
const longestGap = health.reduce((max, row, i) => i ? Math.max(max,
  (Date.parse(row.checked_at) - Date.parse(health[i - 1].checked_at)) / 1000) : max, 0);
const samplingComplete = Date.now() >= deadline && longestGap <= Math.max(60, interval * 1.5)
  && health.length >= Math.max(1, Math.floor(seconds / interval));
const summary = { ...run, finished_at: new Date().toISOString(), full_day_elapsed: seconds === 86400 && Date.now() >= deadline,
  sampling_complete: samplingComplete, health_checks: health.length, unhealthy_checks: health.filter(row => !row.ok).length,
  longest_gap_seconds: longestGap, io_snapshots: snapshots.length, failed_snapshots: snapshots.filter(row => !row.ok).length,
  passed_sampled_window: samplingComplete && health.every(row => row.ok) && snapshots.every(row => row.ok),
  limitation: 'Periodic samples, not continuous uptime proof. Sleep, disconnection or shutdown may leave gaps.' };
await writeFile(join(dir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify(summary));
process.exitCode = summary.passed_sampled_window ? 0 : 1;
