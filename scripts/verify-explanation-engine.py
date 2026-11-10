"""Verify a selected extension over the currently deployed private pilot."""
import hashlib,json,pathlib,shutil,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE=pathlib.Path('/private/tmp/joobi-market-cause-expansion-release-20261031')
STAGE=pathlib.Path('/private/tmp/joobi-explanation-engine-verify-20261031')
OUT=ROOT/'artifacts/market-explanation-engine-20261031'
def main():
 OUT.mkdir(parents=True,exist_ok=True)
 prior=json.loads((ROOT/'artifacts/market-cause-expansion-20261031/final-release.json').read_text())
 for n,h in prior['sourceHashes'].items():assert hashlib.sha256((BASE/n).read_bytes()).hexdigest()==h,n
 assert hashlib.sha256((BASE/'vercel.json').read_bytes()).hexdigest()==prior['configHash']
 if not STAGE.exists():
  shutil.copytree(BASE,STAGE,ignore=shutil.ignore_patterns('node_modules','.next','.vercel','.env*','.git','artifacts','*.log','*.tsbuildinfo'))
  (STAGE/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
 assert not (STAGE/'.vercel').exists() and not list(STAGE.glob('.env*'))
 # Verify a clean production-generated graph, not artifacts from a prior dev server.
 if (STAGE/'.next').exists():shutil.rmtree(STAGE/'.next')
 (STAGE/'tsconfig.tsbuildinfo').unlink(missing_ok=True)
 files=['src/lib/marketFlowEngine.ts','src/components/market/MarketFlowBriefing.tsx','src/components/market/MarketFlowBriefing.module.css','src/lib/marketWatch.ts','src/app/api/market-watch/route.ts','src/components/market/MarketWatch.tsx',
  'src/components/market/OfficialPolicyBriefing.tsx','src/components/market/OfficialPolicyBriefing.module.css']
 files += [str(p.relative_to(ROOT)) for p in (ROOT/'src/lib/marketCause').rglob('*.ts')]
 files += [str(p.relative_to(ROOT)) for p in (ROOT/'src/__tests__').glob('marketCause*.test.ts')]
 files += [f'src/app/api/cron/{name}/route.ts' for name in ['market-cause-shadow','market-policy','market-cause-recovery','market-cause-observe']]
 for name in files:
  dest=STAGE/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/name,dest)
 config=json.loads((BASE/'vercel.json').read_text())
 (STAGE/'vercel.json').write_text(json.dumps(config,indent=2)+'\n')
 cmds=[['node','node_modules/next/dist/bin/next','typegen'],['npm','run','verify'],
  ['node','node_modules/eslint/bin/eslint.js',*[n for n in files if not n.endswith('.css')]]]
 for i,cmd in enumerate(cmds):
  with (OUT/f'verify-{i}.log').open('w') as f:r=subprocess.run(cmd,cwd=STAGE,stdout=f,stderr=subprocess.STDOUT,timeout=240)
  assert r.returncode==0,f'verify-{i}.log failed'
 for n in files:assert (ROOT/n).read_bytes()==(STAGE/n).read_bytes(),f'changed during verification: {n}'
 (OUT/'stage-result.json').write_text(json.dumps({'baseline':prior['deploymentId'],'sourceHashes':{n:hashlib.sha256((STAGE/n).read_bytes()).hexdigest() for n in files},'configHash':hashlib.sha256((STAGE/'vercel.json').read_bytes()).hexdigest(),'checks':['typegen','full verify','selected ESLint']},indent=2)+'\n')
 print('Verified isolated explanation engine')
if __name__=='__main__':main()
