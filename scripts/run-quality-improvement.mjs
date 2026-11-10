/** Privileged operational bridge, kept outside the read-only quality-lab server.
 * Observation is default. Execution still needs fresh health/IO/quota evidence.
 * No approval, publication, budget reset or code deployment is available here. */
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {readRun,DATA} from '../quality-lab/src/store.mjs';
import {recordRepairReceipt,recordBusinessProgress} from '../quality-lab/src/improvement.mjs';
import {runAutomationCycle} from '../quality-lab/src/automation.mjs';
import {capture} from '../quality-lab/src/capture.mjs';
import {verifyWorkerRelease} from '../quality-lab/src/worker-release.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),execute=promisify(execFile);
const [runId,snapshotFile,policyFile,mode]=process.argv.slice(2);
if(!runId||!snapshotFile||!policyFile||mode&&!['--execute'].includes(mode))throw Error('Usage: node scripts/run-quality-improvement.mjs RUN_ID SNAPSHOT POLICY [--execute]');
const run=await readRun(runId),snapshot=JSON.parse(await fs.readFile(snapshotFile,'utf8')),policy=JSON.parse(await fs.readFile(policyFile,'utf8'));
const stateRoot=path.join(DATA,'automation');await fs.mkdir(stateRoot,{recursive:true});
const command=async(action,...args)=>{
  // Secrets remain in the child environment; never interpolate shell commands.
  const release=await verifyWorkerRelease(policy.workerRelease,root);
  const r=await execute(process.execPath,[path.join(release,'scripts/company-business-engine.cjs'),action,...args],{cwd:release,timeout:270000,maxBuffer:1024*1024});
  return JSON.parse(r.stdout.trim());
};
async function manifestFile(m){const file=path.join(stateRoot,m.id+'.json');
  try{await fs.writeFile(file,JSON.stringify(m),{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;const old=JSON.parse(await fs.readFile(file,'utf8'));if(old.id!==m.id)throw Error('manifest_conflict');}return file;}
const ports={
  healthy:async()=>{try{const r=await fetch('https://joobi.kr/api/config',{redirect:'error',signal:AbortSignal.timeout(6000)});if(r.status!==200)return false;const body=await r.json();return !!body.config&&typeof body.config==='object';}catch{return false;}},
  dispatch:async m=>{const r=await command('dispatch-plan',await manifestFile(m));const receipt=JSON.parse(await fs.readFile(r.file,'utf8'));await recordRepairReceipt(m,receipt);},
  progress:async m=>{const r=await command('progress-plan',await manifestFile(m));const receipt=JSON.parse(await fs.readFile(r.file,'utf8'));await recordBusinessProgress(m,receipt);return receipt;},
  run:symbol=>command('run',symbol),
  capture:base=>capture({target:base.target,selection:base.cases.map(c=>({symbol:c.symbol,name:c.name,market:c.market}))}),
};
try{
 const result=await runAutomationCycle({run,snapshot,policy,root:stateRoot,ports,execute:mode==='--execute'});
 const file=path.join(stateRoot,`observation-${Date.now()}.json`);await fs.writeFile(file,JSON.stringify(result,null,2),{flag:'wx'});
 console.log(JSON.stringify({file,...result}));
 if(mode==='--execute'&&!result.gate.allowed)process.exitCode=2;
}catch(error){console.error(error.message==='automation_already_running'?error.message:'automation_stopped_inspect_local_evidence');process.exitCode=1;}
