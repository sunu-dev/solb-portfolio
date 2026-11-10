"""Isolate market-flow changes over verified production; never deploy this script's output automatically."""
import hashlib,json,pathlib,shutil,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE=pathlib.Path('/private/tmp/joobi-security-prep-20261029')
STAGE=pathlib.Path('/private/tmp/joobi-market-flow-engine-20261031')
OUT=ROOT/'artifacts/market-flow-engine-20261031'
FILES=['src/__tests__/marketWatchCollector.test.ts','src/config/marketWatch.ts','src/lib/marketWatch.ts','src/lib/marketWatchStore.ts','src/lib/marketWatchCollector.ts',
 'src/lib/marketFlowEngine.ts','src/lib/marketFlowEvidence.ts','src/components/market/MarketFlowBriefing.tsx',
 'src/components/market/MarketFlowBriefing.module.css','src/components/market/MarketWatch.tsx','src/__tests__/marketFlowEngine.test.ts']
def main():
 OUT.mkdir(exist_ok=True,parents=True)
 for name,expected in json.loads((ROOT/'artifacts/portfolio-vault-20261029/sha256.json').read_text()).items():
  assert hashlib.sha256((BASE/name).read_bytes()).hexdigest()==expected, name
 if not STAGE.exists():
  shutil.copytree(BASE,STAGE,ignore=shutil.ignore_patterns('node_modules','.next','.vercel','.git','.env*','artifacts','*.log','*.tsbuildinfo'))
  (STAGE/'node_modules').symlink_to(ROOT/'node_modules',target_is_directory=True)
 assert not (STAGE/'.vercel').exists() and not list(STAGE.glob('.env*'))
 for name in FILES:
  dest=STAGE/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/name,dest)
 commands=[['node','node_modules/next/dist/bin/next','typegen'],['npm','run','verify'],
 ['node','node_modules/eslint/bin/eslint.js',*[name for name in FILES if not name.endswith('.css')]]]
 for i,cmd in enumerate(commands):
  with (OUT/f'stage-{i}.log').open('w') as f:r=subprocess.run(cmd,cwd=STAGE,stdout=f,stderr=subprocess.STDOUT,timeout=240)
  assert r.returncode==0,f'stage-{i}.log failed'
 (OUT/'stage-result.json').write_text(json.dumps({'baseline':'dpl_DGLY9ZFRJazhUuwd9nQYfmfVCTsT','stage':str(STAGE),
 'sourceHashes':{n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in FILES},'environmentCopied':False,
 'productionChanged':False,'checks':['typegen','full verify','selected ESLint']},indent=2)+'\n')
 print('Market flow isolated verification passed.')
if __name__=='__main__':main()
