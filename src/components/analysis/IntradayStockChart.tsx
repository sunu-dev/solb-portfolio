'use client';

import { useEffect, useMemo, useState } from 'react';
import { tradingDate, type IntradayCandles } from '@/lib/intradayCandles';
import StockChart from './StockChart';
import IntradayPriceSummary from './IntradayPriceSummary';
import { useNow } from '@/hooks/useNow';
import ChartPriceExplanation, { type ChartQuota } from './ChartPriceExplanation';
import { chartTechnicalContext, CHART_VIEWS, CHART_VIEW_LABEL, type ChartView } from '@/lib/chartTechnicalContext';
import FinancialText from '../common/FinancialText';
import readingUI from '../ui/ReadingUI.module.css';
import appUI from '../ui/AppUI.module.css';
import styles from './IntradayStockChart.module.css';

const EMPTY: number[] = [];
interface Props { symbol: string; currency: 'KRW' | 'USD'; level: 'basic' | 'detail'; analysisQuota?: ChartQuota; allowAnalysis?: boolean; onNews?: () => void }
export default function IntradayStockChart({ symbol, currency, level, analysisQuota, allowAnalysis = true, onNews }: Props) {
  const [state, setState] = useState<{ data?: IntradayCandles; error?: string; notice?: string; ready: boolean }>({ ready: false });
  const [retry, setRetry] = useState(0);
  const [views, setViews] = useState<ChartView[]>([]);
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
  const { data, ready, error, notice } = state;
  const context = useMemo(() => data ? chartTechnicalContext(data) : null, [data]);
  const activeViews = useMemo(() => context ? views.filter(view => context.availableViews.includes(view)) : [], [context, views]);
  const referencePrices = useMemo(() => activeViews.includes('levels') && context ? [context.facts.levels.nearestPreviousTurnAbove, context.facts.levels.nearestPreviousTurnBelow]
    .filter((point): point is NonNullable<typeof point> => !!point).map(point => ({ price: point.price, title: `${point.at} 이전 전환` })) : undefined, [context, activeViews]);
  const overlays = context?.overlays;
  return <div data-intraday-chart style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-body)' }}>
    {!ready && <p role="status" style={{ minHeight: 180, paddingTop: 60, textAlign: 'center' }}>오늘의 장중 흐름을 불러오고 있어요…</p>}
    {error && <p role="status">{error}{data ? ' 마지막으로 받은 자료를 표시하고 있어요.' : ''}</p>}
    {notice && <p role="status">{notice}</p>}
    {ready && !data && !error && <p role="status">최근 거래일의 장중 자료가 없어요. 다른 기간을 선택하면 일별 가격을 확인할 수 있어요.</p>}
    {ready && (error || !data) && <button type="button" onClick={() => setRetry(value => value + 1)} style={{ minHeight: 44, padding: '8px 14px', border: '1px solid var(--border-light)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer' }}>장중 자료 다시 불러오기</button>}
    {data && <>
      <p data-intraday-session style={{ marginBottom: 12 }}>{data.sessionDate} · {tradingDate(now / 1000, data.timeZone) === data.sessionDate ? '오늘' : '최근 거래일'} 정규장<br />거래소 현지 날짜 기준 · 장전·장후 거래 제외</p>
      {context && <details className={styles.studyControls}>
        <summary className={readingUI.disclosure}>다른 관점으로 차트 보기</summary>
        <div className={styles.studyButtons}>{CHART_VIEWS.map(view => <button key={view} type="button" className={appUI.secondaryButton}
          aria-pressed={activeViews.includes(view)} disabled={!context.availableViews.includes(view)}
          onClick={() => setViews(current => current.includes(view) ? current.filter(v => v !== view) : [...current, view])}>{CHART_VIEW_LABEL[view]}</button>)}</div>
        <p className={styles.note}>차트 표시를 바꾸는 데는 AI 설명 횟수를 쓰지 않아요.</p>
      </details>}
      {!!activeViews.length && <p className={styles.studyLegend}>함께 보기: {activeViews.map(view => CHART_VIEW_LABEL[view]).join(' · ')}</p>}
      <StockChart key={data.sessionDate} raw={data} sma5={activeViews.includes('trend') ? overlays?.sma5 ?? EMPTY : EMPTY}
        sma20={activeViews.includes('trend') ? overlays?.sma20 ?? EMPTY : EMPTY} sma60={activeViews.includes('trend') ? overlays?.sma60 ?? EMPTY : EMPTY}
        bollingerBands={activeViews.includes('bollinger') ? overlays?.bands : undefined} rsiData={activeViews.includes('rsi') ? overlays?.rsi : undefined}
        macdData={activeViews.includes('macd') ? overlays?.macd : undefined} analysisViews={activeViews} referencePrices={referencePrices}
        level={level} visibleBars={0} currency={currency} intradayTimeZone={data.timeZone} />
      {!!activeViews.length && <details className={styles.guide}>
        <summary className={readingUI.disclosure}>표시한 선과 지표 읽는 법</summary>
        {activeViews.includes('trend') && <p><FinancialText>이동평균선은 받은 5분봉의 마지막 가격을 5개·20개·60개씩 평균 낸 선이에요. 자료가 충분히 쌓인 평균선부터 표시해요.</FinancialText></p>}
        {activeViews.includes('bollinger') && <p><FinancialText>볼린저밴드는 최근 20개 가격의 평균과 위아래 경계를 보여줘요. 점선 사이가 넓어지면 최근 가격의 흔들림도 커진 거예요.</FinancialText></p>}
        {activeViews.includes('levels') && <p>가로 점선은 이전에 가격이 돌아섰던 곳이에요. 앞으로도 그 가격에서 멈춘다는 뜻은 아니에요.</p>}
        {activeViews.includes('volume') && <p><FinancialText>아래 막대는 각 5분 구간의 거래량이에요. 거래한 주체와 매수·매도 이유는 이 자료로 알 수 없어요.</FinancialText></p>}
        {activeViews.includes('rsi') && <p><FinancialText>RSI는 최근 14개 구간에서 오른 폭과 내린 폭을 비교해요. 30·70은 비교 기준이며 매매 지시는 아니에요.</FinancialText></p>}
        {activeViews.includes('macd') && <p><FinancialText>MACD는 최근 가격에 더 비중을 둔 12개·26개 평균의 차이예요. 그 차이의 9개 평균과 함께 변화 방향을 봐요.</FinancialText></p>}
        {activeViews.includes('candles') && <p><FinancialText>봉의 몸통은 5분 구간의 첫 가격과 마지막 가격 사이예요. 위아래 꼬리는 그 사이에 더 높거나 낮게 거래된 가격을 보여줘요.</FinancialText></p>}
        {!!context?.facts.basis.gapsInLatestTwenty && <p>자료가 비어 있는 구간은 채우지 않고, 받은 가격으로 계산했어요.</p>}
      </details>}
      <IntradayPriceSummary data={data} currency={currency} level={level} />
      {allowAnalysis && analysisQuota && <ChartPriceExplanation key={`${symbol}:${data.sessionDate}`} symbol={symbol} currency={currency} data={data}
        quota={analysisQuota} onNews={onNews} selectedViews={activeViews} onData={(next, message, selectedViews) => { setState({ ready: true, data: next, notice: message }); if (selectedViews) setViews(current => [...new Set([...current, ...selectedViews])]); }} />}
      <p style={{ marginTop: 6, fontSize: 12 }}>마지막 자료 {new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(data.asOf * 1000))} (한국시간) · Yahoo Finance · 자료가 지연될 수 있어요.</p>
    </>}
  </div>;
}
