import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { normalizeReview, buildRun, validateAssessment, digest } from './engine.mjs';

export const DATA = path.resolve(process.env.JOOBI_LAB_DATA || fileURLToPath(new URL('../data',import.meta.url)));
export const validId = id => /^[a-f0-9]{20}$/.test(id);
export async function init() {
  for(const dir of ['runs','images','captures','annotations']) await fs.mkdir(path.join(DATA,dir),{recursive:true});
}
export async function writeJson(file,value,{exclusive=false}={}) {
  await fs.mkdir(path.dirname(file),{recursive:true});
  const tmp=file+'.'+randomUUID()+'.tmp';
  await fs.writeFile(tmp,JSON.stringify(value,null,2));
  try { if(exclusive) await fs.link(tmp,file); else await fs.rename(tmp,file); }
  finally { await fs.unlink(tmp).catch(()=>{}); }
}
export async function saveRun(run) {
  await init();
  if(!validId(run.id)) throw Error('invalid_run_id');
  await writeJson(path.join(DATA,'runs',run.id+'.json'),run,{exclusive:true});
  return run;
}
export async function readRun(id) {
  if(!validId(id)) throw Error('invalid_run_id');
  const run=JSON.parse(await fs.readFile(path.join(DATA,'runs',id+'.json'),'utf8'));
  try {run.annotation=JSON.parse(await fs.readFile(path.join(DATA,'annotations',id+'.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  return run;
}
export async function invalidateRun(id,reason) {
  await readRun(id);await init();
  if(typeof reason!=='string'||!reason.trim())throw Error('reason_required');
  await writeJson(path.join(DATA,'annotations',id+'.json'),{invalidated:true,reason,at:new Date().toISOString()},{exclusive:true});
}
export async function listRuns() {
  await init();
  const files=(await fs.readdir(path.join(DATA,'runs'))).filter(f=>/^[a-f0-9]{20}\.json$/.test(f));
  return (await Promise.all(files.map(f=>readRun(f.slice(0,-5))))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export async function storeImage(file,allowedRoot) {
  const real=await fs.realpath(file),root=await fs.realpath(allowedRoot);
  if(!real.startsWith(root+path.sep)) throw Error('image_outside_capture');
  const stat=await fs.stat(real); if(stat.size>10_000_000) throw Error('image_too_large');
  const image=await fs.readFile(real);
  if(!image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error('not_png');
  const key=createHash('sha256').update(image).digest('hex')+'.png';
  await fs.writeFile(path.join(DATA,'images',key),image,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});
  return key;
}
export async function importReviewDirectory(dir,selectionFile) {
  await init();
  const selection=JSON.parse(await fs.readFile(selectionFile,'utf8'));
  if(!selection.selected?.length||selection.selected.length>30) throw Error('invalid_selection');
  const rows=[];
  for(const item of selection.selected) {
    const folder=path.join(dir,String(item.order).padStart(2,'0')+'-'+item.symbol);
    let raw;
    try { raw=JSON.parse(await fs.readFile(path.join(folder,'review.json'),'utf8')); }
    catch(e) { if(e.code!=='ENOENT') throw e; raw={...item,checkedAt:new Date().toISOString(),failure:'미수집: 선택된 표본에 결과 없음',sections:{}}; }
    if(raw.symbol!==item.symbol) throw Error('sample_identity_mismatch');
    const row=normalizeReview(raw);
    row.screenshots=[];
    for(const image of raw.screenshots??[]) row.screenshots.push(await storeImage(image,folder));
    rows.push(row);
  }
  return saveRun(buildRun(rows,{label:'운영 화면 기준선',source:'import',target:'https://joobi.kr',sampling:selection}));
}
export async function attachAssessments(runId,assessments) {
  const original=await readRun(runId);
  if(original.annotation?.invalidated) throw Error('invalidated_capture_cannot_be_scored');
  const run=structuredClone(original);
  for(const item of assessments) {
    const row=run.cases.find(r=>r.symbol===item.symbol);
    if(!row)throw Error('unknown_review_case');
    row.assessment=validateAssessment(row,item);
  }
  run.parentId=original.id;
  run.createdAt=new Date().toISOString();
  run.id=digest([run.createdAt,run.parentId,assessments]).slice(0,20);
  run.label='운영 화면 기준선 · 화면 평가';
  return saveRun(run);
}
