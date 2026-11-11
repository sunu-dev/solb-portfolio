import { expect, it, vi } from 'vitest';
import { joobiProgressResponse } from '@/lib/joobiProgress';
import { readJoobiResponse } from '@/lib/joobiRequest';
it('delivers real stages before the final answer and preserves final error status', async () => {
 const progress=vi.fn();
 const response=joobiProgressResponse(async emit=>{emit('sources');emit('articles'); return Response.json({success:false,error:'만료'}, {status:401});});
 const data=await readJoobiResponse(response,progress);
 expect(progress.mock.calls.map(c=>c[0])).toEqual(['sources','articles']);
 expect(data).toMatchObject({httpStatus:401,success:false,error:'만료'});
});
it('handles fragmented Korean UTF-8 and rejects a stream with no final response', async()=>{
 const bytes=new TextEncoder().encode(JSON.stringify({type:'result',status:200,body:{success:true,report:{currentStatus:'마이크론 설명'}}})+'\n');
 const response=new Response(new ReadableStream({start(c){for(const b of bytes)c.enqueue(new Uint8Array([b]));c.close();}}),{headers:{'Content-Type':'application/x-ndjson'}});
 expect((await readJoobiResponse(response)).report.currentStatus).toBe('마이크론 설명');
 await expect(readJoobiResponse(new Response('',{headers:{'Content-Type':'application/x-ndjson'}}))).rejects.toThrow('format');
});
it('delivers a confirmed price preview before the answer and ignores a malformed one', async () => {
 const preview=vi.fn();
 const valid={day:'2026-11-10',baselineDay:'2026-11-03',sessionState:'closed' as const,prices:[{symbol:'005930.KS',label:'삼성전자',changePercent:-9.38},{symbol:'^KS11',label:'코스피 시장',changePercent:-7.82}]};
 const response=joobiProgressResponse(async(_stage,emit)=>{emit(valid); return Response.json({success:true,report:{currentStatus:'설명'}});});
 const data=await readJoobiResponse(response,undefined,preview);
 expect(preview).toHaveBeenCalledTimes(1); expect(preview.mock.calls[0][0]).toEqual(valid);
 expect(data.report.currentStatus).toBe('설명');
 const lines=[{type:'preview',preview:{...valid,day:'어제'}},{type:'preview',preview:{...valid,prices:[]}},{type:'preview',preview:{...valid,prices:[{symbol:'MU',label:'마이크론',changePercent:'많이'}]}},
  {type:'preview',preview:{...valid,prices:[valid.prices[0],valid.prices[0]]}},{type:'result',status:200,body:{success:true}}].map(line=>JSON.stringify(line)).join('\n')+'\n';
 const ignored=vi.fn();
 await readJoobiResponse(new Response(lines,{headers:{'Content-Type':'application/x-ndjson'}}),undefined,ignored);
 expect(ignored).not.toHaveBeenCalled();
});
