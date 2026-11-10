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
