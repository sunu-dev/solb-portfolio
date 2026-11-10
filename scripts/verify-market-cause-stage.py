"""Isolate automated explanation foundations over the current production source. No deploy."""
import hashlib,json,pathlib,shutil,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE=pathlib.Path('/private/tmp/joobi-market-flow-release-20261031')
STAGE=pathlib.Path('/private/tmp/joobi-market-cause-automation-20261031')
OUT=ROOT/'artifacts/market-cause-automation-20261031'
def main():
 OUT.mkdir(parents=True,exist_ok=True)
 # This deployed baseline must retain exactly the market-flow files already reviewed.
 for name,expected in json.loads((ROOT/'artifacts/market-flow-engine-20261031/stage-result.json').read_text())['sourceHashes'].items():
  assert hashlib.sha256((BASE/name).read_bytes()).hexdigest()==expected,name
 if not STAGE.exists():
  shutil.copytree(BASE,STAGE,ignore=shutil.ignore_patterns('node_modules','.next','.vercel','.env*','.git','artifacts','*.log','*.tsbuildinfo'))
  (STAGE/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
 assert not (STAGE/'.vercel').exists() and not list(STAGE.glob('.env*'))
 files=['src/app/api/cron/market-cause-shadow/route.ts']+[str(p.relative_to(ROOT)) for p in (ROOT/'src/lib/marketCause').rglob('*.ts')]+[str(p.relative_to(ROOT)) for p in (ROOT/'src/__tests__').glob('marketCause*.test.ts')]
 for name in files:
  dest=STAGE/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/name,dest)
 config=json.loads((BASE/'vercel.json').read_text())
 for i,symbol in enumerate(['INTC','NVDA','AMD','AMZN','GOOGL','MSFT','META','AAPL']):
  config['crons'].append({'path':f'/api/cron/market-cause-shadow?symbol={symbol}','schedule':f'0 {(22+i)%24} * * '+('1-5' if i<2 else '2-6')})
 (STAGE/'vercel.json').write_text(json.dumps(config,indent=2)+'\n')
 commands=[['node','node_modules/next/dist/bin/next','typegen'],['npm','run','verify'],['node','node_modules/eslint/bin/eslint.js',*files]]
 for i,cmd in enumerate(commands):
  with (OUT/f'stage-{i}.log').open('w') as f:r=subprocess.run(cmd,cwd=STAGE,stdout=f,stderr=subprocess.STDOUT,timeout=240)
  assert r.returncode==0,f'stage-{i}.log failed'
 for name in files:assert (ROOT/name).read_bytes()==(STAGE/name).read_bytes(),f'source changed during verification: {name}'
 (OUT/'stage-result.json').write_text(json.dumps({'baseline':'dpl_22pBebmk7Rw9oPcRrathUHZCuKsJ','sourceHashes':{n:hashlib.sha256((STAGE/n).read_bytes()).hexdigest() for n in files},'configHash':hashlib.sha256((STAGE/'vercel.json').read_bytes()).hexdigest(),'productionChanged':False,'checks':['typegen','full verify','selected ESLint']},indent=2)+'\n')
 print('Isolated market cause verification passed')
if __name__=='__main__':main()
