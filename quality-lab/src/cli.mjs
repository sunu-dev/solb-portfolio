import fs from 'node:fs/promises';
import { importReviewDirectory, readRun, attachAssessments, listRuns, saveRun } from './store.mjs';
import { compareRuns, buildRun } from './engine.mjs';
import { capture } from './capture.mjs';
import { startServer } from './server.mjs';
import { exportContextPreview } from './context-packet.mjs';
import { reconcileImprovements, repairManifest, recordRepairReceipt, recordBusinessProgress } from './improvement.mjs';

const [command,...args]=process.argv.slice(2);
try {
  if(command==='serve') {const s=await startServer({port:Number(process.env.PORT||4318)});console.log(`주비 개선 작업실 http://127.0.0.1:${s.address().port}`);}
  else if(command==='import') {const r=await importReviewDirectory(args[0],args[1]);console.log(JSON.stringify({id:r.id,cases:r.cases.length,backlog:r.backlog.length}));}
  else if(command==='review') {const r=await attachAssessments(args[0],JSON.parse(await fs.readFile(args[1],'utf8')));console.log(JSON.stringify({id:r.id,parentId:r.parentId,assessed:r.cases.filter(c=>c.assessment).length}));}
  else if(command==='compare') console.log(JSON.stringify(compareRuns(await readRun(args[0]),await readRun(args[1])),null,2));
  else if(command==='capture') {const base=await readRun(args[0]);const r=await capture({target:args[1]||base.target,selection:base.cases.map(c=>({symbol:c.symbol,name:c.name,market:c.market})),onProgress:p=>console.log(JSON.stringify(p))});console.log(r.id);}
  else if(command==='evaluate') console.log(JSON.stringify((await listRuns()).map(r=>({id:r.id,cases:r.cases.length,openIssues:r.backlog.length})),null,2));
  else if(command==='plan') {
    const run=await readRun(args[0]);const result=await reconcileImprovements(run);
    const manifest=repairManifest(run);
    if(args[1])await fs.writeFile(args[1],JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({...result,requestId:manifest.id,companyRequests:manifest.requests.length}));
  }
  else if(command==='receipt') {await recordRepairReceipt(JSON.parse(await fs.readFile(args[0],'utf8')),JSON.parse(await fs.readFile(args[1],'utf8')));console.log('handoff_recorded');}
  else if(command==='progress') {await recordBusinessProgress(JSON.parse(await fs.readFile(args[0],'utf8')),JSON.parse(await fs.readFile(args[1],'utf8')));console.log('progress_recorded');}
  else if(command==='export-preview') console.log(JSON.stringify(await exportContextPreview(args[0],args[1],args[2]),null,2));
  else if(command==='recheck') {
    const original=await readRun(args[0]);
    if(original.annotation?.invalidated)throw Error('invalidated_capture_cannot_be_rechecked');
    const rows=original.cases.map(row=>{const next={...row};delete next.assessment;return next;});
    const next=await saveRun(buildRun(rows,{label:'같은 화면 · 평가 규칙 재검사',source:'recheck',parentId:original.id,target:original.target,captureVersion:original.captureVersion,viewport:original.viewport}));
    console.log(JSON.stringify({id:next.id,parentId:next.parentId,engineVersion:next.engineVersion,cases:next.cases.length}));
  }
  else throw Error('명령: serve | import DIR SELECTION | review RUN FILE | compare BEFORE AFTER | capture RUN [TARGET] | evaluate | plan RUN [MANIFEST] | receipt MANIFEST RECEIPT | progress MANIFEST RECEIPT | recheck RUN | export-preview DRAFT SOURCE OUTPUT');
}catch(e){console.error(e.message);process.exitCode=1;}
