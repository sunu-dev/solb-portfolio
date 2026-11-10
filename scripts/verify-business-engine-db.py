"""Disposable PostgreSQL tests for company business queue/publication. No production access."""
import importlib.util,json,pathlib,uuid,time,concurrent.futures
path=pathlib.Path(__file__).with_name('verify-market-cause-budget.py');spec=importlib.util.spec_from_file_location('base',path);b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
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
  else:raise RuntimeError('database not ready')
  sql('CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;')
  sql((b.ROOT/'supabase/migrations/20261101_company_business_engine.sql').read_text())
  owner=str(uuid.uuid4());other=str(uuid.uuid4());h='a'*64;dh='b'*64
  seed=[{'symbol':'TEST','priority':0},{'symbol':'123456.KS','priority':0},{'symbol':'OTHER','priority':1},{'symbol':'0001A0.KQ','priority':0}]
  def claim(o=owner,symbol='TEST',market='US'):return json.loads(sql(f'select public.claim_company_business({q(o)},{q(market)},{q(symbol)});','service_role') or 'null')
  check('worker disabled by default',claim() is None)
  check('inventory inserted once',sql(f'select public.seed_company_business({j(seed)});','service_role')=='4')
  check('repeated inventory seed performs no updates',sql(f'select public.seed_company_business({j(seed)});','service_role')=='0')
  for role in ['anon','authenticated']:
   sql('select public.company_business_status();',role,True)
   sql(f'select public.seed_company_business({j(seed)});',role,True)
   sql("select public.read_company_business('TEST');",role,True)
   sql('select * from company_business_private.jobs;',role,True)
  check('browser roles cannot read or enqueue private work',True)
  sql("update company_business_private.control set worker_enabled=true,daily_jobs=10,model_until=clock_timestamp()+interval '1 day';")
  with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:results=list(pool.map(lambda _:claim(),range(8)))
  check('concurrent worker claims only one job',sum(r is not None for r in results)==1)
  first=next(r for r in results if r);check('global source concurrency is bounded',claim(other,'OTHER') is None)
  sql("update company_business_private.jobs set lease_until=clock_timestamp()-interval '1 second',next_attempt_at=clock_timestamp()-interval '1 second' where symbol='TEST';")
  second=claim(other);check('expired worker gets fenced',second['fence']==first['fence']+1)
  current=sql('select clock_timestamp()::text;');snapshot={'evidence':{'retrievedAt':current,'publishedAt':current},'draft':{'symbol':'TEST','evidenceHash':h},'review':{'draftHash':dh,'evidenceHash':h,'identityMatches':True,'noUnsupportedClaims':True}}
  def save(o,f,state='approval_pending',source=h,drafth=dh,snap=snapshot,reason='editorial_review_required'):
   return sql(f'select public.checkpoint_company_business(\'TEST\',{q(o)},{f},{j(snap)},{q(state)},{q(reason)},{q(source)},{q(drafth)});','service_role')=='t'
  check('stale worker cannot overwrite',not save(owner,first['fence']))
  check('current worker checkpoints review',save(other,second['fence']))
  sql('update company_business_private.control set publication_enabled=true;')
  status=json.loads(sql('select public.company_business_status();','service_role'))
  check('source and review counts do not count as publication',status['coverage']=={'sourceCollected':1,'drafted':1,'modelReviewed':1,'editoriallyApproved':0,'publishedFresh':0})
  check('model-reviewed drafts are not public',sql("select public.read_company_business('TEST');",'service_role')=='')
  approval={'kind':'editorial','identityChecked':True,'claimsChecked':True,'beginnerChecked':True,'note':'Checked issuer identity, every claim and source context independently.'}
  def approve(source=h):return sql(f'select public.approve_company_business(\'TEST\',{q(source)},{q(dh)},{j(approval)});','service_role')=='t'
  check('approval rejects wrong source fingerprint',not approve('c'*64))
  check('explicit bound editorial approval accepted',approve())
  check('approved snapshot can be read',json.loads(sql("select public.read_company_business('TEST');",'service_role'))['approval']['draftHash']==dh)
  sql('update company_business_private.control set publication_enabled=false;')
  check('publication kill switch reports zero published coverage',json.loads(sql('select public.company_business_status();','service_role'))['coverage']['publishedFresh']==0)
  check('publication kill switch withholds prior publication without reviving legacy content',json.loads(sql("select public.read_company_business('TEST');",'service_role'))=={'withheld':True})
  sql("update company_business_private.control set publication_enabled=true;update company_business_private.jobs set next_attempt_at=clock_timestamp()-interval '1 second' where symbol='TEST';")
  third=claim();changed={'evidence':snapshot['evidence'],'draft':None,'review':None}
  # Store a new evidence revision before spending on draft generation.
  changed_sql=f"select public.checkpoint_company_business('TEST',{q(owner)},{third['fence']},{j(changed)},'collecting','source_checked',{q('c'*64)},NULL);"
  check('new source checkpoint stored',sql(changed_sql,'service_role')=='t')
  check('source changes revoke approval immediately',json.loads(sql("select public.read_company_business('TEST');",'service_role'))=={'withheld':True})
  check('old approval cannot be replayed',not approve())
  sql("update company_business_private.jobs set attempts=2,lease_until=NULL,owner=NULL,next_attempt_at=clock_timestamp()-interval '1 second' where symbol='TEST';")
  retry=claim()
  sql(f"select public.checkpoint_company_business('TEST',{q(owner)},{retry['fence']},{j(changed)},'blocked','network_timeout',{q('c'*64)},NULL);",'service_role')
  check('repeated failures stop daily paid retry loops',sql("select next_attempt_at>clock_timestamp()+interval '29 days' from company_business_private.jobs where symbol='TEST';")=='t')
  sql("update company_business_private.jobs set attempts=2,next_attempt_at=clock_timestamp()-interval '1 second' where symbol='TEST';")
  retry=claim()
  sql(f"select public.checkpoint_company_business('TEST',{q(owner)},{retry['fence']},{j(changed)},'blocked','business_model_blocked_limit_reached',{q('c'*64)},NULL);",'service_role')
  check('budget holds resume on next UTC day without exhausting retry allowance',sql("select attempts=2 and (next_attempt_at AT TIME ZONE 'UTC')::date=(clock_timestamp() AT TIME ZONE 'UTC')::date+1 from company_business_private.jobs where symbol='TEST';")=='t')
  sql("update company_business_private.jobs set lease_until=NULL,owner=NULL where symbol='TEST';update company_business_private.control set daily_jobs=1;")
  check('day limit blocks further attempts',claim(symbol='OTHER') is None)
  sql("update company_business_private.control set daily_jobs=10;")
  check('US collector does not claim unconfigured domestic work',claim(symbol='123456.KS',market='US') is None)
  check('US collector does not misroute alphanumeric Korean codes',claim(symbol='0001A0.KQ',market='US') is None)
  check('KR collector can claim alphanumeric Korean codes',claim(symbol='0001A0.KQ',market='KR')['symbol']=='0001A0.KQ')
  check('domestic work remains in inventory',sql("select count(*) from company_business_private.jobs where symbol='123456.KS';")=='1')
  out=b.ROOT/'artifacts/company-business-engine-20261101';out.mkdir(exist_ok=True);(out/'database-checks.json').write_text(json.dumps({'checks':b.checks,'productionChanged':False},indent=2));print(len(b.checks),'isolated database checks passed')
 finally:run(['docker','rm','-f',b.NAME])
if __name__=='__main__':main()
