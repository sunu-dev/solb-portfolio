import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compileContext, exportContextPreview, hash, sourceText } from '../src/context-packet.mjs';

// Synthetic source; public-company facts are separately reviewed against the actual filing.
const html='<h1>Example Inc. TEST</h1><p>October 28, 2026 October 30, 2026</p><p>The company terminated the Common Stock Purchase Agreement with Example Capital LLC.</p><p>The agreement allowed sales of newly issued shares up to a limit.</p><p>The company plans to pursue alternative financing arrangements.</p>';
const draft=()=>({schemaVersion:1,id:'test-event',status:'candidate',symbol:'TEST',issuerId:'123',issuerName:'Example Inc.',
  source:{url:'https://www.sec.gov/Archives/edgar/data/123/000123/filing.htm',documentId:'000123',label:'SEC 8-K',publishedAt:'2026-10-30',checkedAt:'2026-11-01'},
  event:{kind:'equity-financing',phase:'terminated',effectiveDate:'2026-10-28',counterparty:'Example Capital LLC'},
  title:'어떤 계약인가요?',summary:'검토할 설명',summaryFacts:['a'],watch:'다음 공시 확인',watchFacts:['c'],validUntil:'2026-11-06',
  facts:[{id:'a',quote:'The company terminated the Common Stock Purchase Agreement with Example Capital LLC.'},{id:'b',quote:'The agreement allowed sales of newly issued shares up to a limit.'},{id:'c',quote:'The company plans to pursue alternative financing arrangements.'}],
  questions:[{id:'what',title:'무슨 뜻인가요?',answer:'검토할 답변',sourceFacts:['a','b']}]});
const now=Date.parse('2026-11-01T07:00:00Z');
test('exports evidence locations and hashes but never claims semantic approval',()=>{
  const r=compileContext(draft(),html,{now});
  assert.equal(r.checks.semanticReview,'pending');assert.equal(r.checks.publication,'blocked');
  assert.equal(r.packet.source.contentHash,hash(html));assert.ok(r.facts.every(f=>f.offset>=0));
  assert.equal(r.packet.status,'candidate');assert.equal(r.packet.facts,undefined);
  const {version,...body}=r.packet;assert.equal(version,hash(body));
});
test('rejects wrong company, stage, source, facts, dates and duplicate questions',()=>{
  for(const mutate of [d=>d.symbol='OTHER',d=>d.issuerName='Another Inc.',d=>d.source.url='https://example.com/filing',d=>d.issuerId='9',d=>d.event.phase='signed',d=>d.facts[0].quote='A claim that is absent from this document.',d=>d.questions[0].sourceFacts=['absent'],d=>d.validUntil='2026-10-31',d=>d.validUntil='2027-01-01',d=>d.source.checkedAt='2027-01-01',d=>d.questions.push({...d.questions[0]}),d=>d.status='approved']){
    const d=draft();mutate(d);assert.throws(()=>compileContext(d,html,{now}));
  }
});
test('ignores scripts and comments as evidence; never executes document content',()=>{
  assert.equal(sourceText('A<script>secret claim</script><!-- hidden --><style>body{}</style>B&nbsp;&#38;'),'A B &');
  const d=draft();d.facts[0].quote='A claim hidden in scripts should not pass.';
  assert.throws(()=>compileContext(d,html+'<script>'+d.facts[0].quote+'</script>',{now}));
});
test('keeps immutable artifacts and last good preview when a later draft fails',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'joobi-context-test-'));
  try{
    const df=path.join(dir,'draft.json'),sf=path.join(dir,'source.html'),out=path.join(dir,'stock-context-preview.json');
    await fs.writeFile(df,JSON.stringify(draft()));await fs.writeFile(sf,html);
    const options={dataRoot:dir,now};
    const first=await exportContextPreview(df,sf,out,options),before=await fs.readFile(out,'utf8');
    assert.equal((await exportContextPreview(df,sf,out,options)).version,first.version);
    await fs.writeFile(sf,'unrelated');await assert.rejects(exportContextPreview(df,sf,out,options));
    assert.equal(await fs.readFile(out,'utf8'),before);
    assert.equal((await fs.readdir(path.join(dir,'contexts'))).length,1);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
