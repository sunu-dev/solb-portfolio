"""Disposable local PostgreSQL: synthetic users only, no host ports or volumes."""
import json
import pathlib
import subprocess
import time
import uuid
ROOT = pathlib.Path(__file__).resolve().parents[1]
NAME = 'joobi-dictionary-test-' + uuid.uuid4().hex[:10]
A = '11111111-1111-4111-8111-111111111111'
B = '22222222-2222-4222-8222-222222222222'
def run(args, **kwargs):
    return subprocess.run(args, text=True, capture_output=True, timeout=90, **kwargs)
def sql(query, owner=None, role=None, fail=None):
    prefix = f'SET ROLE {role};' if role else ''
    if owner: prefix += f"SET request.jwt.claim.sub = '{owner}';"
    result = run(['docker','exec','-i',NAME,'psql','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'], input=prefix+query)
    if fail:
        assert result.returncode and fail in result.stderr, result.stderr
        return ''
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()
def entry(id):
    return json.dumps({'id':id,'title':'ETF','note':'synthetic','savedAt':'2026-11-04T00:00:00Z','familiarity':'new'})
def main():
    result = run(['docker','run','--detach','--rm','--name',NAME,'--network','none','--memory','256m','--tmpfs','/var/lib/postgresql/data:rw,nosuid,size=128m','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine'])
    assert result.returncode == 0, result.stderr
    checks = []
    try:
        for _ in range(100):
            logs = run(['docker','logs',NAME])
            if 'init process complete' in logs.stdout+logs.stderr and run(['docker','exec',NAME,'pg_isready','-U','postgres']).returncode == 0: break
            time.sleep(.2)
        sql('''CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
        CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key);
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
        GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;''')
        migration=(ROOT/'supabase/migrations/20261104000100_personal_dictionary.sql').read_text()
        sql(migration); sql(migration)
        sql(f"INSERT INTO auth.users VALUES ('{A}'),('{B}');")
        sql(f"INSERT INTO personal_dictionary(user_id,id,entry) VALUES ('{A}','term:etf','{entry('term:etf')}');", A, 'authenticated')
        assert sql('SELECT count(*) FROM personal_dictionary;', A, 'authenticated') == '1'
        assert sql('SELECT count(*) FROM personal_dictionary;', B, 'authenticated') == '0'
        sql('SELECT count(*) FROM personal_dictionary;', role='anon', fail='42501')
        sql(f"INSERT INTO personal_dictionary(user_id,id,entry) VALUES ('{A}','term:stock','{entry('term:stock')}');", B, 'authenticated', fail='42501')
        checks.append('owner read/write and anonymous isolation')
        assert sql("UPDATE personal_dictionary SET entry=jsonb_set(entry,'{note}','\"new note\"') WHERE id='term:etf' AND revision=1 RETURNING revision;", A, 'authenticated') == '2'
        assert sql("UPDATE personal_dictionary SET entry=jsonb_set(entry,'{note}','\"stale\"') WHERE id='term:etf' AND revision=1 RETURNING revision;", A, 'authenticated') == ''
        assert sql("DELETE FROM personal_dictionary WHERE id='term:etf' AND revision=1 RETURNING id;", A, 'authenticated') == ''
        checks.append('stale updates/deletes cannot replace a newer note')
        sql(f"INSERT INTO personal_dictionary(user_id,id,entry) VALUES ('{A}','bad','{{}}');", A, 'authenticated', fail='23514')
        checks.append('bounded required storage shape')
        sql(f"INSERT INTO personal_dictionary(user_id,id,entry) SELECT '{A}', 'custom:'||i, jsonb_build_object('id','custom:'||i,'title','test','note','','savedAt','2026-11-04T00:00:00Z','familiarity','new') FROM generate_series(1,299) i;", A, 'authenticated')
        sql(f"INSERT INTO personal_dictionary(user_id,id,entry) VALUES ('{A}','extra','{entry('extra')}');", A, 'authenticated', fail='23514')
        assert sql('SELECT count(*) FROM personal_dictionary;', A, 'authenticated') == '300'
        checks.append('300 terms per owner enforced in the database')
        sql(f"DELETE FROM auth.users WHERE id='{A}';")
        assert sql('SELECT count(*) FROM personal_dictionary;') == '0'
        checks.append('account deletion removes dictionary entries')
        print(json.dumps({'passed':checks},ensure_ascii=False))
    finally:
        run(['docker','stop',NAME])
if __name__ == '__main__': main()
