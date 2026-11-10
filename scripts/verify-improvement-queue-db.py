"""Quality handoff checks in disposable PostgreSQL only."""
import importlib.util,json,pathlib,uuid,time,concurrent.futures
path=pathlib.Path(__file__).with_name('verify-market-cause-budget.py')
spec=importlib.util.spec_from_file_location('base',path);b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
b.NAME='joobi-improvement-queue-test'
sql,check,run=b.sql,b.check,b.run
q=lambda v:"'"+str(v).replace("'","''")+"'"
j=lambda v:q(json.dumps(v))+'::jsonb'
def main():
 r=run(['docker','run','--detach','--rm','--name',b.NAME,'--network','none','--memory','512m','--cpus','1.5','--tmpfs','/var/lib/postgresql/data:rw,nosuid,size=256m','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']);assert r.returncode==0,r.stderr
 try:
  for _ in range(100):
   logs=run(['docker','logs',b.NAME]);ready='init process complete; ready for start up' in logs.stdout+logs.stderr
   if ready and run(['docker','exec',b.NAME,'pg_isready','-U','postgres']).returncode==0:break
   time.sleep(.2)
  sql('CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;')
  for name in ['20261101_company_business_engine.sql','20261101_company_business_improvement.sql']:sql((b.ROOT/'supabase/migrations'/name).read_text())
  sql(f"select public.seed_company_business({j([{'symbol':'AAA','priority':0},{'symbol':'CARG','priority':2}])});",'service_role')
  request=f"select public.request_company_business_repairs({q('a'*64)},{j(['CARG','UNKNOWN'])});"
  for role in ['anon','authenticated']:sql(request,role,True)
  invalid=run(['docker','exec','-i',b.NAME,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-tAc',f"SET ROLE service_role;select public.request_company_business_repairs({q('a'*64)},{j(['CARG','CARG'])});"])
  check('duplicate symbols rejected',invalid.returncode!=0 and 'invalid quality request' in invalid.stderr)
  with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(lambda _:json.loads(sql(request,'service_role')),range(4)))
  check('one quality handoff despite concurrent repeats',sum(r[0]['status']=='queued' for r in results)==1)
  check('unknown issuers never inserted by a finding',all(r[1]['status']=='not-covered' for r in results))
  check('handoff does not spend or enable publication',sql('select (select count(*) from company_business_private.days)=0 and not publication_enabled and not worker_enabled from company_business_private.control;')=='t')
  check('no repeated queue writes',sql("select count(*) from company_business_private.audit where symbol='CARG';")=='1')
  sql("update company_business_private.control set worker_enabled=true,model_until=clock_timestamp()+interval '1 day';")
  owner=str(uuid.uuid4())
  def claim():return json.loads(sql(f"select public.claim_company_business({q(owner)},'US');",'service_role') or 'null')
  first=claim();check('observed company gap is selected before unrelated inventory',first['symbol']=='CARG')
  check('handoff retains global single worker',claim() is None)
  sql("update company_business_private.jobs set owner=null,lease_until=null,next_attempt_at=clock_timestamp()+interval '1 day',state='blocked',attempts=2,reason='business_model_blocked_limit_reached' where symbol='CARG';")
  sql(f"select public.request_company_business_repairs({q('b'*64)},{j(['CARG'])});",'service_role')
  check('new finding cannot reset retry backoff or attempts',sql("select attempts=2 and next_attempt_at>clock_timestamp()+interval '23 hours' and reason='business_model_blocked_limit_reached' from company_business_private.jobs where symbol='CARG';")=='t')
  check('other eligible work continues',claim()['symbol']=='AAA')
  sql("update company_business_private.jobs set owner=null,lease_until=null,next_attempt_at=clock_timestamp()-interval '1 second';")
  check('original daily limit still applies',claim() is None)
  out=b.ROOT/'artifacts/improvement-engine-20261101';out.mkdir(exist_ok=True);(out/'database-checks.json').write_text(json.dumps({'checks':b.checks,'productionChanged':False},indent=2));print(len(b.checks),'isolated database checks passed')
 finally:run(['docker','rm','-f',b.NAME])
if __name__=='__main__':main()
