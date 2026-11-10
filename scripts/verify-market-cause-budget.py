"""Isolated PostgreSQL budget/concurrency checks. Never invokes Supabase or real AI."""
import concurrent.futures,json,pathlib,subprocess,time,uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
NAME='joobi-cause-budget-'+uuid.uuid4().hex[:8]
checks=[]
def run(args,**kwargs):return subprocess.run(args,text=True,capture_output=True,timeout=120,**kwargs)
def sql(value,role=None,denied=False):
 r=run(['docker','exec','-i',NAME,'psql','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],input=(f'SET ROLE {role};' if role else '')+value)
 if denied:assert r.returncode!=0 and 'permission denied' in r.stderr;return
 assert r.returncode==0,r.stderr
 return r.stdout.strip()
def reserve(key,cost=100):return json.loads(sql(f"select public.reserve_market_cause_budget('{key}',{cost});",'service_role'))
def check(label,ok):assert ok,label;checks.append(label)
def main():
 r=run(['docker','run','--detach','--rm','--name',NAME,'--network','none','--memory','512m','--cpus','1.5','--tmpfs','/var/lib/postgresql/data:rw,nosuid,size=256m','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17-alpine']);assert r.returncode==0,r.stderr
 try:
  for _ in range(100):
   logs=run(['docker','logs',NAME]);ready='init process complete; ready for start up' in logs.stdout+logs.stderr
   if ready and run(['docker','exec',NAME,'pg_isready','-U','postgres']).returncode==0:break
   time.sleep(.2)
  else:raise RuntimeError('database not ready')
  sql('CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;')
  sql((ROOT/'supabase/proposals/market_cause_budget_v1.sql').read_text())
  check('disabled by default',reserve('disabled')['status']=='disabled')
  for role in ['anon','authenticated']:
   sql("select public.reserve_market_cause_budget('no',100);",role,True)
   sql('select * from market_cause_private.budget_reservations;',role,True)
  checks.append('anonymous and user roles cannot reserve or read')
  sql('UPDATE market_cause_private.budget_control SET enabled=true,daily_limit=500,monthly_limit=1000;')
  with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:results=list(pool.map(lambda i:reserve(f'parallel-{i}'),range(12)))
  granted=[(i,r) for i,r in enumerate(results) if r['status']=='reserved']
  check('12 concurrent calls respect five reservation ceiling',len(granted)==5)
  check('reserved not just settled spend counts toward limit',reserve('later')['status']=='limit_reached')
  i,r=granted[0];key=f'parallel-{i}';token=r['token']
  check('duplicate request never returns authorization',reserve(key)=={'status':'already_reserved'})
  check('wrong fencing token cannot settle',sql(f"select public.settle_market_cause_budget('{key}','{uuid.uuid4()}',50);",'service_role')=='f')
  check('settlement releases only known excess reservation',sql(f"select public.settle_market_cause_budget('{key}','{token}',50);",'service_role')=='t')
  check('settlement is idempotent',sql(f"select public.settle_market_cause_budget('{key}','{token}',50);",'service_role')=='t')
  check('cannot revise settled spend by replay',sql(f"select public.settle_market_cause_budget('{key}','{token}',0);",'service_role')=='f')
  check('released headroom can be used once',reserve('headroom',50)['status']=='reserved')
  # Observed cost greater than estimate is retained, never silently dropped.
  i,r=granted[1];check('unexpected cost still recorded',sql(f"select public.settle_market_cause_budget('parallel-{i}','{r['token']}',200);",'service_role')=='t')
  check('unexpected cost disables further calls',reserve('after-overrun')['status']=='disabled')
  check('uncertain reservations remain held',int(sql("select count(*) from market_cause_private.budget_reservations where state='reserved';"))==4)
  # Monthly budget and call-count boundaries independently constrain the feature.
  sql('UPDATE market_cause_private.budget_control SET enabled=true,daily_limit=5000,monthly_limit=600;')
  check('monthly ceiling independently applies',reserve('monthly',100)['status']=='limit_reached')
  sql('UPDATE market_cause_private.budget_control SET monthly_limit=5000,daily_calls=6;')
  check('daily call count includes settled calls',reserve('calls',1)['status']=='limit_reached')
  sql((ROOT/'supabase/proposals/market_cause_jobs_v1.sql').read_text())
  owner=str(uuid.uuid4());other=str(uuid.uuid4());h='a'*64
  def claim(key,worker=owner,event='event'):
   return json.loads(sql(f"select public.claim_market_cause_job('{key}','{event}','{h}','{worker}');",'service_role'))
  def publish(key,fence,revision=0,worker=owner):
   payload=json.dumps({'disposition':'facts_only','claims':[]})
   return json.loads(sql(f"select public.publish_market_cause_shadow('{key}','{h}','{worker}',{fence},{revision},'{payload}');",'service_role'))
  check('shadow worker disabled by default',claim('job')['status']=='disabled')
  sql('UPDATE market_cause_private.worker_control SET enabled=true;')
  check('worker health reads both controls without granting table access',sql('select public.market_cause_worker_enabled();','service_role')=='t')
  with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:jobs=list(pool.map(lambda _:claim('job'),range(10)))
  check('concurrent identical jobs claim once',sum(j['status']=='claimed' for j in jobs)==1)
  first=next(j for j in jobs if j['status']=='claimed')
  sql("UPDATE market_cause_private.jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE job_key='job';")
  second=claim('job',other)
  check('expired job increments fence',second['fence']==first['fence']+1)
  check('late worker cannot publish',publish('job',first['fence'])['status']=='stale_worker')
  check('new owner can store shadow version',publish('job',second['fence'],worker=other)['status']=='stored')
  check('completed job cannot rerun',claim('job')['status']=='finished')
  stale=claim('old-input');check('old expected revision cannot overwrite',publish('old-input',stale['fence'])['status']=='revision_conflict')
  current=claim('new-input');check('CAS advances version',publish('new-input',current['fence'],1)['revision']==2)
  result=json.loads(sql("select public.read_market_cause_shadow('event');",'service_role'))
  check('service can read shadow result',result['revision']==2)
  check('immutable versions remain for review',sql("select count(*) from market_cause_private.shadow_versions;")=='2')
  for role in ['anon','authenticated']:
   sql('select public.market_cause_worker_enabled();',role,True)
   sql("select public.read_market_cause_shadow('event');",role,True)
   sql(f"select public.claim_market_cause_job('no','event','{h}','{owner}');",role,True)
  checks.append('browser roles cannot claim or read shadow reports')
  out=ROOT/'artifacts/market-cause-automation-20261031';out.mkdir(parents=True,exist_ok=True)
  (out/'budget-db.json').write_text(json.dumps({'checks':checks,'productionChanged':False,'database':'disposable PostgreSQL17'},indent=2)+'\n')
  print(len(checks),'isolated budget checks passed')
 finally:run(['docker','rm','-f',NAME])
if __name__=='__main__':main()
