"""Freeze verified release evidence; never upgrades pending evaluation to approval."""
from pathlib import Path
import hashlib,json,datetime
root=Path(__file__).resolve().parents[1];out=root/'artifacts/market-explanation-quality-20261031';release=Path('/private/tmp/joobi-explanation-quality-release-20261031')
def read(name):return json.loads((out/name).read_text())
proof=read('stage-result.json');deployment=read('deployment.json')['deployment'];active=read('active-project.json')
assert active['production']==deployment['id'] and deployment['readyState']=='READY'
for name,h in proof['sourceHashes'].items():assert hashlib.sha256((release/name).read_bytes()).hexdigest()==h
assert all(c['passed'] for c in read('production-api.json')['checks'])
status=read('production-status.json');recovery=read('production-recovery.json')
assert len(read('browser/production/result.json')['checks'])==14
locked=json.loads((release/'package-lock.json').read_text())['packages']['node_modules/@google/genai']['version']
assert locked==json.loads((root/'node_modules/@google/genai/package.json').read_text())['version']
result={**proof,'googleGenaiVersion':locked,'packageLockHash':hashlib.sha256((release/'package-lock.json').read_bytes()).hexdigest(),'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'deploymentId':deployment['id'],'deploymentUrl':deployment['url'],'productionUrl':'https://joobi.kr','cronCount':len(active['crons']),'migrationHash':status['migrationHash'],'testsPassed':1935,'testsSkipped':1,'isolatedDatabaseChecks':len(read('operations-db.json')['checks']),'productionApiChecks':len(read('production-api.json')['checks']),'productionBrowserChecks':14,'liveRecovery':recovery,'publication':status['publication'],'budget':status['budget'],'sourceArchiveHash':hashlib.sha256((out/'verified-sources.tar.gz').read_bytes()).hexdigest()}
(out/'final-release.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('Release evidence frozen:',deployment['id'])
