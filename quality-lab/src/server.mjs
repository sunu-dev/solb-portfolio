import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { RUBRIC, ENGINE_VERSION, compareRuns } from './engine.mjs';
import { DATA, listRuns, readRun, writeJson } from './store.mjs';
import { capture } from './capture.mjs';
import { listContextCandidates } from './context-packet.mjs';
import { listImprovements } from './improvement.mjs';

const UI=fileURLToPath(new URL('../ui',import.meta.url));
export async function startServer({port=4318,captureFn=capture}={}) {
  const token=randomBytes(24).toString('hex');
  let job=null,controller,schedule={enabled:false,runId:null,nextAt:null};
  try {schedule=JSON.parse(await fs.readFile(path.join(DATA,'schedule.json'),'utf8'));}catch{}
  const launch=async runId=> {
    if(job?.status==='running') throw Error('이미 검사 중이에요.');
    const base=await readRun(runId);
    job={status:'running',completed:0,total:base.cases.length,startedAt:new Date().toISOString()};
    controller=new AbortController();
    const active=job,signal=controller.signal;
    captureFn({target:base.target,selection:base.cases.map(r=>({symbol:r.symbol,name:r.name,market:r.market})),onProgress:p=>Object.assign(active,p),signal})
      .then(run=>{active.status=signal.aborted?'cancelled':'completed';active.runId=run.id;})
      .catch(e=>{active.status=signal.aborted?'cancelled':'failed';active.message=signal.aborted?'검사를 중지했어요.':String(e.message).slice(0,250);});
  };
  const timer=setInterval(async()=>{
    if(!schedule.enabled||job?.status==='running'||Date.now()<Date.parse(schedule.nextAt))return;
    // Advance before launch: a failed job is not retried in a hot loop.
    schedule.nextAt=new Date(Date.now()+86400000).toISOString();
    try {await writeJson(path.join(DATA,'schedule.json'),schedule);await launch(schedule.runId);}
    catch(e){job={status:'failed',message:String(e.message).slice(0,250)};}
  },30000);timer.unref();
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
    const answer=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
    const actualPort=server.address()?.port;
    if(![`127.0.0.1:${actualPort}`,`localhost:${actualPort}`].includes(req.headers.host))return answer(403,{error:'허용되지 않은 호스트예요.'});
    const origin=`http://${req.headers.host}`;
    const u=new URL(req.url,origin);
    try {
      if(req.method==='POST') {
        if(req.headers.origin!==origin||req.headers['x-lab-session']!==token||req.headers['content-type']!=='application/json')return answer(403,{error:'작업실에서 다시 시도해주세요.'});
        let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>4096)return answer(413,{error:'요청이 너무 커요.'});}
        const input=JSON.parse(body||'{}');
        if(u.pathname==='/api/scan') {await launch(input.runId);return answer(202,{job});}
        if(u.pathname==='/api/cancel') {controller?.abort();return answer(202,{job});}
        if(u.pathname==='/api/schedule') {
          if(typeof input.enabled!=='boolean')throw Error('설정을 확인해주세요.');
          if(input.enabled)await readRun(input.runId);
          schedule={enabled:input.enabled,runId:input.runId,nextAt:input.enabled?new Date(Date.now()+86400000).toISOString():null};
          await writeJson(path.join(DATA,'schedule.json'),schedule);return answer(200,{schedule});
        }
        return answer(404,{error:'없는 동작이에요.'});
      }
      if(req.method!=='GET')return answer(405,{error:'지원하지 않는 요청이에요.'});
      if(u.pathname==='/api/state') {
        const runs=await listRuns();
        return answer(200,{token,engineVersion:ENGINE_VERSION,rubric:RUBRIC,job,schedule,runs:runs.map(r=>({id:r.id,label:r.label,createdAt:r.createdAt,count:r.cases.length,assessed:r.cases.filter(c=>c.assessment).length}))});
      }
      if(u.pathname==='/api/run')return answer(200,await readRun(u.searchParams.get('id')));
      if(u.pathname==='/api/context-candidates')return answer(200,{candidates:await listContextCandidates()});
      if(u.pathname==='/api/improvements')return answer(200,{tasks:await listImprovements()});
      if(u.pathname==='/api/compare')return answer(200,compareRuns(await readRun(u.searchParams.get('before')),await readRun(u.searchParams.get('after'))));
      const file = /^\/images\/[a-f0-9]{64}\.png$/.test(u.pathname)
        ? path.join(DATA,u.pathname.slice(1))
        : ({'/':'index.html','/app.js':'app.js','/style.css':'style.css'})[u.pathname] ? path.join(UI,({'/':'index.html','/app.js':'app.js','/style.css':'style.css'})[u.pathname]) : null;
      if(!file)return answer(404,{error:'페이지가 없어요.'});
      const content=await fs.readFile(file);
      res.writeHead(200,{'Content-Type':file.endsWith('.png')?'image/png':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8'});res.end(content);
    }catch(e){answer(400,{error:String(e.message).slice(0,250)});}
  });
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  server.on('close',()=>{clearInterval(timer);controller?.abort();});
  return server;
}
