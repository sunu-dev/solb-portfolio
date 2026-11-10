/** Provision the existing production cron bearer in Vault without logging it.
 * Run from the linked repo with CRON_SECRET loaded from its production env file.
 * This does not enable jobs; deploy routes before applying the schedule SQL.
 */
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const secret = process.env.CRON_SECRET;
if (!secret) throw new Error('A configured production CRON_SECRET is required');
const directory = await mkdtemp(join(tmpdir(), 'joobi-watch-vault-'));
const file = join(directory, 'configure.sql');
try {
  const value = "'" + secret.replaceAll("'", "''") + "'";
  await writeFile(file, `do $configure$
declare secret_id uuid;
begin
  select id into secret_id from vault.secrets where name = 'joobi_market_watch_cron_secret';
  if secret_id is null then
    perform vault.create_secret(${value}, 'joobi_market_watch_cron_secret');
  else
    perform vault.update_secret(secret_id, ${value});
  end if;
end;
$configure$;
`, { mode: 0o600 });
  const result = spawnSync('supabase', ['db', 'query', '--linked', '--file', file, '--output', 'json'], { encoding: 'utf8' });
  if (result.status !== 0) {
    // The CLI's failure output may contain SQL context. Never print that context.
    throw new Error('Could not configure the market watch Vault secret');
  }
  console.log('Market watch Vault secret configured');
} finally {
  await rm(directory, { recursive: true, force: true });
}
