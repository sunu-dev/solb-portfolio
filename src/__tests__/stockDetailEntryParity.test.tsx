import {afterEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const renderState = vi.hoisted(() => ({ loading: false }));
// Exercise the settled screen, without running network effects during server rendering.
vi.mock('react',async()=>{
 const real=await vi.importActual<typeof import('react')>('react');
 return {...real,useEffectEvent:(fn:unknown)=>fn,useState:(initial:unknown)=>real.useState(initial===true?renderState.loading:initial)};
});
vi.mock('@/lib/supabase',()=>({supabase:{auth:{getSession:vi.fn(),onAuthStateChange:vi.fn()}}}));
vi.mock('@/store/portfolioStore',async()=>{
 const actual=await vi.importActual<typeof import('@/store/portfolioStore')>('@/store/portfolioStore');
 const store=actual.usePortfolioStore;
 return {...actual,usePortfolioStore:Object.assign((selector:(s:ReturnType<typeof store.getState>)=>unknown)=>selector(store.getState()),store)};
});
import AnalysisPanel from '@/components/analysis/AnalysisPanel';
import {usePortfolioStore} from '@/store/portfolioStore';
const original=usePortfolioStore.getState();
afterEach(()=>{ usePortfolioStore.setState(original); renderState.loading = false; });
describe('stock detail entry parity',()=>{
 it('allows company and concept reading while price requests are still pending',()=>{
  renderState.loading = true;
  usePortfolioStore.setState({analysisSymbol:'MSFT',macroData:{},stocks:{investing:[],watching:[],sold:[]}});
  const html=renderToStaticMarkup(<AnalysisPanel/>);
  expect(html).toContain('시세와 차트를 확인하고 있어요');
  expect(html).toContain('aria-controls="anchor-company"'); expect(html).toContain('id="anchor-company"');
  expect(html).toContain('data-company-overview'); expect(html).toContain('id="anchor-learning"');
  expect(html).not.toContain('아직 상장 초기라');
 });
 it.each(['MSFT','TSLL','NVDU','SPY','SOXL','005930.KS','247540.KQ'])('%s exposes the same price history controls from search and holdings',symbol=>{
  const render=(held:boolean)=>{
   usePortfolioStore.setState({analysisSymbol:symbol,macroData:{[symbol]:{c:100,d:1,dp:1,t:1700000000,o:99,h:101,l:98,pc:99}},stocks:{investing:held?[{symbol,name:symbol,avgCost:90,shares:1,targetReturn:0,demo:true}]:[],watching:[],sold:[]}});
   return renderToStaticMarkup(<AnalysisPanel/>);
  };
  for(const html of [render(false),render(true)]) {
   expect(html).toContain('id="anchor-chart"');expect(html).toContain('aria-label="차트 기간"');expect(html).toContain('가격 차트');
   if(['TSLL','NVDU'].includes(symbol)){expect(html).not.toContain('차트 해설과 기술 지표 펼쳐보기');expect(html).toContain('이 상품은 AI 분석을 제공하지 않아요');}
  }
 });
});
