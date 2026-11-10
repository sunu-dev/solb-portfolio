"""Disposable PostgreSQL only. No ports, external network, volumes, or real users.

Requires Docker and postgres:17-alpine (pulled on first run). The production
migration is deliberately a proposal; this script never invokes Supabase CLI.
"""
import concurrent.futures
import base64
import json
import pathlib
import subprocess
import time
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/portfolio-vault-rollout-20261029'
NAME = 'joobi-vault-test-' + uuid.uuid4().hex[:10]
A = '11111111-1111-4111-8111-111111111111'
B = '22222222-2222-4222-8222-222222222222'
C = '33333333-3333-4333-8333-333333333333'
checks = []


def run(args, **kwargs):
    return subprocess.run(args, text=True, capture_output=True, timeout=120, **kwargs)


def sql(source, role=None, user=None, failure=None):
    prefix = f'SET ROLE {role};' if role else ''
    if user:
        prefix += f"SET request.jwt.claim.sub = '{user}';"
    result = run(['docker', 'exec', '-i', NAME, 'psql', '-U', 'postgres', '-d', 'postgres',
                  '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate'], input=prefix + source)
    if failure:
        assert result.returncode and failure in result.stderr, (failure, result.stderr)
        return None
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def quoted(value):
    if value is None:
        return 'null'
    text = value if isinstance(value, str) else json.dumps(value)
    return "'" + text.replace("'", "''") + "'"


def rpc(name, args, user=A, role='authenticated', failure=None):
    result = sql(f"SELECT public.{name}({','.join(quoted(arg) for arg in args)});", role, user, failure)
    return json.loads(result) if result else None


def check(name, condition):
    assert condition, name
    checks.append(name)


def legacy(user, stocks, expected=None, failure=None):
    args = [user, stocks, [], [], expected]
    result = sql(f"SELECT row_to_json(r) FROM public.save_user_portfolio_if_current_v2({','.join(quoted(v) for v in args)}) r;",
                 'authenticated', user, failure)
    return json.loads(result) if result else None


def b64(size, byte=0):
    return base64.urlsafe_b64encode(bytes([byte]) * size).decode().rstrip('=')


def main():
    OUT.mkdir(exist_ok=True, parents=True)
    created = run(['docker', 'run', '--detach', '--rm', '--name', NAME, '--network', 'none',
                   '--memory', '512m', '--cpus', '1.5', '--tmpfs', '/var/lib/postgresql/data:rw,nosuid,size=256m',
                   '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine'])
    assert created.returncode == 0, created.stderr
    try:
        ready = False
        for _ in range(100):
            logs = run(['docker', 'logs', NAME])
            initialized = 'init process complete; ready for start up' in (logs.stdout + logs.stderr)
            if initialized and run(['docker', 'exec', NAME, 'pg_isready', '-U', 'postgres']).returncode == 0:
                ready = True
                break
            time.sleep(.2)
        assert ready, 'isolated PostgreSQL did not finish initialization'
        sql('''
          CREATE ROLE anon NOLOGIN;
          CREATE ROLE authenticated NOLOGIN;
          CREATE ROLE service_role NOLOGIN BYPASSRLS;
          CREATE SCHEMA auth;
          CREATE TABLE auth.users(id uuid primary key);
          CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
            $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
          GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
        ''')
        for path in [
            'supabase/migrations/20260728000100_portfolio_import_history.sql',
            'supabase/migrations/20260728000200_portfolio_revision_guard.sql',
            'supabase/migrations/20260728000300_portfolio_sync_identity_guard.sql',
        ]:
            sql((ROOT / path).read_text())
        sql('GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_portfolios TO service_role;')
        sql((ROOT / 'supabase/proposals/portfolio_vault_v1.sql').read_text())
        sql(f"INSERT INTO auth.users VALUES ('{A}'),('{B}'),('{C}');")
        plaintext = {'investing': [{'symbol': 'SYNTHETIC_PRIVATE', 'shares': 2, 'avgCost': 123}], 'watching': [], 'sold': []}
        old = legacy(A, plaintext)
        check('legacy RPC still usable before enrollment', old['save_status'] == 'ok')
        legacy(B, plaintext)
        record = {'format': 'joobi-portfolio-a256gcm-v1', 'keyId': b64(16), 'iv': b64(12), 'ciphertext': b64(32)}
        key = {'format': 'joobi-portfolio-hkdf-a256kw-v1', 'keyId': b64(16), 'salt': b64(32), 'wrappedKey': b64(40)}
        descriptor = {'format': 'joobi-webauthn-prf-v1', 'credentialId': b64(32), 'input': b64(32, 1)}
        init_args = [A, old['saved_updated_at'], record, key, descriptor]
        check('rollout defaults closed', rpc('initialize_portfolio_vault_v1', init_args) == {'status': 'disabled'})
        check('disabled rollout preserves legacy contents', 'SYNTHETIC_PRIVATE' in sql(f"SELECT stocks FROM public.user_portfolios WHERE user_id='{A}';"))
        check('legacy detection does not return investment contents', rpc('read_portfolio_vault_v1', [A]) == {'status': 'legacy'})
        check('new account explicitly empty', rpc('read_portfolio_vault_v1', [C], user=C) == {'status': 'empty'})
        for role in ['anon', 'service_role']:
            rpc('read_portfolio_vault_v1', [A], role=role, failure='42501')
            check(role + ' cannot call vault RPC', True)
        rpc('read_portfolio_vault_v1', [A], user=B, failure='42501')
        rpc('initialize_portfolio_vault_v1', init_args, user=B, failure='42501')
        rpc('save_portfolio_vault_v1', [A, 1, record], user=B, failure='42501')
        check('every RPC rejects another account even with known ID', True)
        for role in ['authenticated', 'service_role']:
            sql('SELECT * FROM joobi_vault_private.rollout;', role, A, failure='42501')
            sql(f"INSERT INTO joobi_vault_private.rollout VALUES ('{A}', true);", role, A, failure='42501')
        check('app/service credentials cannot approve rollout', True)
        sql(f"INSERT INTO joobi_vault_private.rollout VALUES ('{A}',true),('{C}',true);")
        check('stale legacy snapshot cannot be migrated', rpc('initialize_portfolio_vault_v1',
              [A, '2020-01-01T00:00:00Z', record, key, descriptor]) == {'status': 'conflict'})
        invalid_records = [None, [], {**record, 'note': 'SYNTHETIC_PRIVATE'}, {**record, 'ciphertext': 'bad='},
                           {**record, 'keyId': 1111111111111111111111}, {**record, 'iv': b64(11)}]
        for invalid in invalid_records:
            rpc('initialize_portfolio_vault_v1', [A, old['saved_updated_at'], invalid, key, descriptor], failure='22023')
        rpc('initialize_portfolio_vault_v1', [A, old['saved_updated_at'], record, {**key, 'keyId': b64(16, 1)}, descriptor], failure='22023')
        rpc('initialize_portfolio_vault_v1', [A, old['saved_updated_at'], record, key, {**descriptor, 'secret': 'bad'}], failure='22023')
        check('malformed/mismatched/extra-field envelopes rejected', True)
        check('failed migration preserves original snapshot', sql(f"SELECT stocks={quoted(plaintext)}::jsonb AND updated_at={quoted(old['saved_updated_at'])}::timestamptz FROM public.user_portfolios WHERE user_id='{A}';") == 't')
        sql(f"UPDATE public.user_portfolios SET settings='{{\"note\":\"SYNTHETIC_PRIVATE_SETTING\"}}' WHERE user_id='{A}';")
        check('nonempty legacy settings block migration without deletion', rpc('initialize_portfolio_vault_v1', init_args) == {'status': 'conflict'}
              and 'SYNTHETIC_PRIVATE_SETTING' in sql(f"SELECT settings FROM public.user_portfolios WHERE user_id='{A}';"))
        sql(f"UPDATE public.user_portfolios SET settings='{{}}' WHERE user_id='{A}';")
        check('atomic migration succeeds on exact legacy revision', rpc('initialize_portfolio_vault_v1', init_args) == {'status': 'ok', 'revision': 1})
        sql(f"UPDATE public.user_portfolios SET settings='{{\"note\":\"SYNTHETIC_PRIVATE_SETTING\"}}' WHERE user_id='{A}';", failure='23514')
        check('sealed row rejects plaintext settings even from owner role', True)
        stored = rpc('read_portfolio_vault_v1', [A])
        check('encrypted read contains only expected metadata/envelopes', stored == {
            'status': 'sealed', 'revision': 1, 'record': record, 'protectedKey': key, 'descriptor': descriptor})
        private_row = sql(f"SELECT row_to_json(r) FROM public.user_portfolios r WHERE user_id='{A}';")
        check('active legacy columns cleared in the same transaction', 'SYNTHETIC_PRIVATE' not in private_row
              and json.loads(private_row)['stocks'] == {'investing': [], 'watching': [], 'sold': []}
              and json.loads(private_row)['daily_snapshots'] == [] and json.loads(private_row)['portfolio_history'] == [])
        check('repeat initialization never resets encrypted contents', rpc('initialize_portfolio_vault_v1', init_args) == {'status': 'conflict'})
        sealed_timestamp = json.loads(private_row)['updated_at']
        check('old stale CAS request returns conflict', legacy(A, plaintext, old['saved_updated_at'])['save_status'] == 'conflict')
        legacy(A, plaintext, sealed_timestamp, failure='42501')
        sql(f"SELECT * FROM public.save_user_portfolio_if_current({quoted(plaintext)},'[]','[]',{quoted(sealed_timestamp)});",
            'authenticated', A, failure='42501')
        for source in [
            f"UPDATE public.user_portfolios SET stocks={quoted(plaintext)} WHERE user_id='{A}';",
            f"INSERT INTO public.user_portfolios(user_id, stocks) VALUES ('{A}',{quoted(plaintext)}) ON CONFLICT(user_id) DO UPDATE SET stocks=excluded.stocks;",
            f"UPDATE public.user_portfolios SET storage_format='plain-v1' WHERE user_id='{A}';",
            f"DELETE FROM public.user_portfolios WHERE user_id='{A}';",
        ]:
            sql(source, 'authenticated', A, failure='42501')
        check('old RPC/upsert/direct update/delete cannot replace a sealed account', True)
        sql(f"UPDATE public.user_portfolios SET stocks={quoted(plaintext)} WHERE user_id='{A}';", 'service_role', failure='42501')
        check('service-role legacy writer is blocked too', True)
        check('RLS filters another user direct select', sql(f"SELECT count(*) FROM public.user_portfolios WHERE user_id='{A}';", 'authenticated', B) == '0')
        sql('SELECT * FROM public.user_portfolios;', 'anon', failure='42501')
        check('anonymous table access denied', True)
        rpc('save_portfolio_vault_v1', [A, 0, record], failure='22023')
        rpc('save_portfolio_vault_v1', [A, 9007199254740991, record], failure='22023')
        check('invalid/unsafe revisions rejected', True)
        check('same key required on normal saves', rpc('save_portfolio_vault_v1', [A, 1, {**record, 'keyId': b64(16, 1)}]) == {'status': 'conflict'})
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: rpc('save_portfolio_vault_v1', [A, 1, record]), range(2)))
        check('concurrent two-device CAS has exactly one winner', sorted(r['status'] for r in results) == ['conflict', 'ok'])
        check('concurrent winner advances exactly once', rpc('read_portfolio_vault_v1', [A])['revision'] == 2)
        check('stale retry cannot overwrite newest record', rpc('save_portfolio_vault_v1', [A, 1, record]) == {'status': 'conflict'})
        sql(f"UPDATE joobi_vault_private.rollout SET enabled=false WHERE user_id='{A}';")
        check('kill switch blocks writes', rpc('save_portfolio_vault_v1', [A, 2, record]) == {'status': 'disabled'})
        check('kill switch preserves recovery reads', rpc('read_portfolio_vault_v1', [A])['revision'] == 2)
        check('new account initialization does not require a legacy row', rpc('initialize_portfolio_vault_v1', [C, None, record, key, descriptor], user=C) == {'status': 'ok', 'revision': 1})
        # Account removal keeps the existing server-authorized cascade path.
        sql(f"DELETE FROM auth.users WHERE id='{C}';")
        check('account deletion removes portfolio and rollout row', sql(f"SELECT (SELECT count(*) FROM public.user_portfolios WHERE user_id='{C}') + (SELECT count(*) FROM joobi_vault_private.rollout WHERE user_id='{C}');") == '0')
        report = {'postgres': sql('SELECT version();'), 'syntheticOnly': True, 'productionChanged': False,
                  'checks': checks, 'count': len(checks),
                  'limitations': ['Isolated PostgreSQL role/RPC tests; real Supabase configuration and PostgREST not yet tested',
                                  'Schema fixtures do not establish cryptographic authenticity; native-crypto tests cover that separately',
                                  'Existing backups/notification queues/local browser plaintext are not migrated by this proposal']}
        (OUT / 'database-result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({'passed': len(checks), 'productionChanged': False}))
    finally:
        stopped = run(['docker', 'stop', '--time', '2', NAME])
        assert stopped.returncode == 0, stopped.stderr


if __name__ == '__main__':
    main()
