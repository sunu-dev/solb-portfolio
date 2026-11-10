// Isolated PostgreSQL semantics check. Install @electric-sql/pglite in a temporary
// directory and pass its module path as argv[2]; no production DB or HTTP is used.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.argv[2] || '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values ('00000000-0000-0000-0000-000000000001');
    create schema vault; create table vault.decrypted_secrets(name text, decrypted_secret text);
    insert into vault.decrypted_secrets values ('joobi_market_watch_cron_secret', 'test-only');
    create schema net; create table net.calls(id bigserial);
    create function net.http_get(url text, headers jsonb, timeout_milliseconds integer)
      returns bigint language sql as 'insert into net.calls default values returning id';
  `);
  await db.exec(await readFile('supabase/migrations/20261022000200_digest_delivery.sql', 'utf8'));
  const migration = await readFile('supabase/migrations/20261023000100_digest_idle_io.sql', 'utf8');
  await db.exec(migration);
  await db.exec(migration); // safe to re-apply
  assert.equal((await db.query('select public.enqueue_digest_retry() as id')).rows[0].id, null);
  assert.equal((await db.query('select count(*)::int as n from net.calls')).rows[0].n, 0);
  let checked = 0;
  for (const status of ['pending', 'retryable', 'sending', 'sent', 'failed', 'cancelled']) {
    for (const channel of ['email', 'push']) for (const attempts of [0, 1, 2, 3]) {
      for (const next of [-60, 3600]) for (const deadline of [-60, 3600]) {
        for (const lease of [null, -60, 3600]) for (const reported of [false, true]) {
          await db.exec('begin');
          await db.query(`insert into public.digest_deliveries
            (user_id, notification_type, sent_date, channel, payload, status, attempts,
             next_attempt_at, deadline_at, lease_until, failure_reported_at)
            values ('00000000-0000-0000-0000-000000000001', 'morning_brief', current_date,
              $1, '{}'::jsonb, $2, $3, now() + $4 * interval '1 second',
              now() + $5 * interval '1 second', now() + $6 * interval '1 second',
              case when $7 then now() else null end)`,
          [channel, status, attempts, next, deadline, lease, reported]);
          const queued = (await db.query('select public.enqueue_digest_retry() as id')).rows[0].id !== null;
          const claimed = await db.query("select id from public.claim_digest_deliveries('00000000-0000-0000-0000-000000000002')");
          const failures = (await db.query('select public.claim_digest_failure_report() as n')).rows[0].n;
          const after = (await db.query('select status from public.digest_deliveries')).rows[0].status;
          assert.equal(queued, claimed.rows.length > 0 || failures > 0 || after !== status,
            JSON.stringify({ status, channel, attempts, next, deadline, lease, reported }));
          await db.exec('rollback');
          checked++;
        }
      }
    }
  }
  console.log(JSON.stringify({ checked, emptyQueueHttpCalls: 0, migrationReapply: 'passed', result: 'passed' }));
} finally { await db.close(); }
