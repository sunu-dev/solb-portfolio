'use client';
import type { CandleRaw } from '@/config/constants';
import StockChart from './StockChart';
const EMPTY:number[]=[];
export default function ShortPriceHistory({raw,currency,status,onRetry}:{raw?:CandleRaw;currency:'KRW'|'USD';status:'loading'|'ready'|'empty'|'error';onRetry:()=>void}) {
  return raw?.t.length ? <>
    <StockChart raw={raw} sma5={EMPTY} sma20={EMPTY} sma60={EMPTY} level="basic" currency={currency} visibleBars={0}/>
    <p style={{fontSize:13,lineHeight:1.7,color:'var(--text-secondary)'}}>확인된 {raw.t.length}거래일의 가격을 표시해요. 기술 지표를 계산할 자료는 아직 충분하지 않아요.</p>
  </> : <div style={{fontSize:13,lineHeight:1.7,color:'var(--text-body)'}}>
    <p role="status">{status==='loading'?'일별 가격을 확인하고 있어요…':status==='error'?'일별 가격을 불러오지 못했어요. 연결 상태를 확인한 뒤 다시 시도해주세요.':'이 종목의 일별 가격 자료가 없어요. 1일 차트에서 장중 자료를 확인할 수 있어요.'}</p>
    {status==='error'&&<button type="button" onClick={onRetry} style={{minHeight:44,padding:'8px 14px',border:'1px solid var(--border-light)',borderRadius:8,background:'var(--surface)',color:'var(--text-primary)',cursor:'pointer'}}>일별 자료 다시 불러오기</button>}
  </div>;
}
