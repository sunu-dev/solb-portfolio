'use client';

import { useEffect, useState } from 'react';
import { formatRelativeKo } from '@/utils/koreanDate';
import { useNow } from '@/hooks/useNow';
import { usePortfolioStore } from '@/store/portfolioStore';
import { isSingleStockLeverage } from '@/utils/leverageGuard';
import { changeColor, signedChange } from '@/utils/stockTrendPresentation';
import { formatNativeAmount } from '@/utils/koreanNumber';
import WatchToggle from '@/components/common/WatchToggle';
import styles from './MarketMovers.module.css';

interface MoverItem {
  symbol: string;
  krName: string;
  market: 'US' | 'KR';
  currentPrice: number | null;
  todayChange: number | null;
  todayChangePct: number | null;
}
interface MoversResp {
  ok: boolean;
  ranAt: string;
  cached: boolean;
  us: { gainers: MoverItem[]; losers: MoverItem[] };
  kr: { gainers: MoverItem[]; losers: MoverItem[] };
}

export default function MarketMovers() {
  const setAnalysisSymbol = usePortfolioStore(state => state.setAnalysisSymbol);
  const [data, setData] = useState<MoversResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [market, setMarket] = useState<'US' | 'KR'>('KR');
  const [tab, setTab] = useState<'gainers' | 'losers'>('gainers');
  const now = useNow();

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    void fetch('/api/market-movers', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('unavailable');
      const result = await response.json();
      if (!result?.ok || !Array.isArray(result.us?.gainers) || !Array.isArray(result.us?.losers)
        || !Array.isArray(result.kr?.gainers) || !Array.isArray(result.kr?.losers)) throw new Error('invalid');
      if (active) { setData(result); setError(''); }
    }).catch(() => {
      if (active) setError(controller.signal.aborted ? '시장 자료를 가져오는 데 시간이 오래 걸리고 있어요.' : '시장 자료를 불러오지 못했어요. 잠시 후 다시 확인해주세요.');
    }).finally(() => {
      clearTimeout(timer);
      if (active) setLoading(false);
    });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [retry]);

  const list = (data?.[market === 'US' ? 'us' : 'kr'][tab] || [])
    .filter(item => item && typeof item.symbol === 'string' && typeof item.krName === 'string'
      && !isSingleStockLeverage(item.symbol, item.krName));
  const retryLoad = () => { setLoading(true); setError(''); setRetry(value => value + 1); };

  return <section className={styles.root} aria-label="시장별 가격 변화">
    <p className={styles.intro}>주요 기업 중 전일 종가보다 많이 오르거나 내린 종목이에요. 시장 전체의 순위는 아니에요.</p>
    <div className={styles.controls}>
      <div role="group" aria-label="시장 선택">{(['KR', 'US'] as const).map(value => <button key={value} type="button" aria-pressed={market === value} onClick={() => setMarket(value)}>{value === 'KR' ? '한국' : '미국'}</button>)}</div>
      <div role="group" aria-label="가격 변화 선택">{(['gainers', 'losers'] as const).map(value => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)}>{value === 'gainers' ? '상승' : '하락'}</button>)}</div>
    </div>
    {loading && <p className={styles.notice} role="status">{data ? '새로운 시장 자료를 확인하고 있어요.' : '종목별 시세를 모으고 있어요. 잠시만 기다려주세요.'}</p>}
    {error && <div className={styles.notice} role="status"><p>{error}</p>{data && <p>이전에 확인한 목록을 표시하고 있어요.</p>}<button type="button" onClick={retryLoad}>다시 확인하기</button></div>}
    {list.length > 0 ? <div className={styles.list}>{list.map(item => {
      const change = item.todayChangePct;
      const hasChange = change != null && Number.isFinite(change);
      return <article key={item.symbol} className={styles.card}>
        <button type="button" className={styles.stock} onClick={() => setAnalysisSymbol(item.symbol)} aria-label={`${item.krName || item.symbol} 살펴보기`}>
          <strong>{item.krName || item.symbol}</strong><span>{item.symbol}</span>
          {item.currentPrice != null && Number.isFinite(item.currentPrice) && <span className={styles.price}>{formatNativeAmount(item.currentPrice, item.market === 'KR' ? 'KRW' : 'USD')}</span>}
          <span className={styles.change}><span>전일 종가 대비</span><b style={{ color: hasChange ? changeColor(change, 2) : 'var(--text-secondary)' }}>{hasChange ? `${signedChange(change, 2)}%` : '정보 없음'}</b></span>
        </button>
        <div className={styles.watch}><WatchToggle symbol={item.symbol} name={item.krName} full /></div>
      </article>;
    })}</div> : !loading && !error && <div className={styles.notice} role="status"><p>확인된 {market === 'KR' ? '한국' : '미국'} 종목 중 {tab === 'gainers' ? '상승' : '하락'} 목록이 없어요.</p><p>다른 시장이나 가격 변화도 선택해보세요.</p></div>}
    {data && <p className={styles.timestamp}>{formatRelativeKo(data.ranAt, Math.max(now, Date.parse(data.ranAt) || 0))} 목록 조회 · 시세는 지연될 수 있어요</p>}
  </section>;
}
