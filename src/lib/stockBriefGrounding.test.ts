import {it,expect,vi,beforeEach} from 'vitest';
const generate=vi.hoisted(()=>vi.fn());
vi.mock('@google/genai',()=>({GoogleGenAI:class {models={generateContent:generate}}}));
vi.mock('./aiCostLedger',()=>({recordAiCost:vi.fn()}));
import {groundStockBrief} from './stockBriefGrounding';
beforeEach(()=>{process.env.GEMINI_API_KEY='test';generate.mockReset();});
it('rejects prose without actual search and citation metadata',async()=>{
 generate.mockResolvedValue({text:'검색한 것처럼 작성한 원인 설명입니다.'});
 expect(await groundStockBrief('MU','마이크론','2026-10-16','반도체')).toBeNull();
});
it('accepts only supported HTTPS source chunks',async()=>{
 generate.mockResolvedValue({text:'반도체 산업의 투자 지출에 대한 우려가 보도됐어요. 종목 자체의 원인으로 확정할 수는 없어요.\n다음 확인: 다음 실적 발표에서 투자 전망을 확인해요.',candidates:[{groundingMetadata:{webSearchQueries:['dated query'],groundingSupports:[{groundingChunkIndices:[0]}],groundingChunks:[{web:{uri:'https://example.com/report',title:'보도'}},{web:{uri:'https://unrelated.example',title:'무관'}}]}}]});
 const result=await groundStockBrief('MU','마이크론','2026-10-16','반도체');
 expect(result?.sources).toHaveLength(1);expect(result?.watch).toContain('실적');
});
it('rejects an unknown result even if search ran',async()=>{
 generate.mockResolvedValue({text:'UNKNOWN',candidates:[{groundingMetadata:{webSearchQueries:['query'],groundingSupports:[{}]}}]});
 expect(await groundStockBrief('MU','마이크론','2026-10-16','반도체')).toBeNull();
});
