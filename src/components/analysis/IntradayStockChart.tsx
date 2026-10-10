'use client';

import { useEffect, useState } from 'react';
import { tradingDate, type IntradayCandles } from '@/lib/intradayCandles';
import StockChart from './StockChart';
import { useNow } from '@/hooks/useNow';

const EMPTY: number[] = [];
interface Props { symbol: string; currency: 'KRW' | 'USD'; level: 'basic' | 'detail' }
export default function IntradayStockChart({ symbol, currency, level }: Props) {
  const [state, setState] = useState<{ data?: IntradayCandles; error?: string; ready: boolean }>({ ready: false });
  const [retry, setRetry] = useState(0);
  const now = useNow();
  useEffect(() => {
    let active = true;
    let pending = false;
    let controller: AbortController | undefined;
    const load = async () => {
      if (pending) return;
      pending = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 12000);
      try {
        const response = await fetch(`/api/candle?symbol=${encodeURIComponent(symbol)}&range=1d`, { signal: controller.signal });
        if (!response.ok) throw new Error('fetch');
        const data = await response.json();
        if (!active) return;
        if (data.s === 'no_data') setState({ ready: true });
        else if (data.s === 'ok' && data.interval === '5m' && data.t?.length && data.timeZone && data.sessionDate && Number.isFinite(data.asOf)) {
          // Validate the server's exchange zone before formatting it in the UI.
          tradingDate(data.asOf, data.timeZone);
          setState({ ready: true, data });
        } else throw new Error('format');
      } catch {
        if (active) setState(previous => ({ ...previous, ready: true, error: '장중 가격을 새로 확인하지 못했어요. 잠시 후 다시 시도해주세요.' }));
      } finally {
        clearTimeout(timeout);
        pending = false;
      }
    };
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; controller?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [symbol, retry]);
  const { data, ready, error } = state;
  const formatPrice = (value: number) => `${currency === 'USD' ? '$' : ''}${value.toLocaleString('ko-KR', { maximumFractionDigits: currency === 'KRW' ? 0 : 2 })}${currency === 'KRW' ? '원' : ''}`;
  return <div data-intraday-chart style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-body)' }}>
    {!ready && <p role="status" style={{ minHeight: 180, paddingTop: 60, textAlign: 'center' }}>오늘의 장중 흐름을 불러오고 있어요…</p>}
    {error && <p role="status">{error}{data ? ' 마지막으로 받은 자료를 표시하고 있어요.' : ''}</p>}
    {ready && !data && !error && <p role="status">최근 거래일의 장중 자료가 없어요. 다른 기간을 선택하면 일별 가격을 확인할 수 있어요.</p>}
    {ready && (error || !data) && <button type="button" onClick={() => setRetry(value => value + 1)} style={{ minHeight: 44, padding: '8px 14px', border: '1px solid var(--border-light)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer' }}>장중 자료 다시 불러오기</button>}
    {data && <>
      <p data-intraday-session style={{ marginBottom: 12 }}>{data.sessionDate} · {tradingDate(now / 1000, data.timeZone) === data.sessionDate ? '오늘' : '최근 거래일'} 정규장<br />거래소 현지 날짜 기준 · 장전·장후 거래 제외</p>
      <StockChart key={data.sessionDate} raw={data} sma5={EMPTY} sma20={EMPTY} sma60={EMPTY} level={level} visibleBars={0} currency={currency} intradayTimeZone={data.timeZone} />
      <p style={{ marginTop: 12 }}>이 거래일의 5분 구간 가격은 {formatPrice(Math.min(...data.l))}부터 {formatPrice(Math.max(...data.h))} 사이였어요.</p>
      <p style={{ marginTop: 6, fontSize: 12 }}>마지막 자료 {new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(data.asOf * 1000))} (한국시간) · Yahoo Finance · 자료가 지연될 수 있어요.</p>
    </>}
  </div>;
}
