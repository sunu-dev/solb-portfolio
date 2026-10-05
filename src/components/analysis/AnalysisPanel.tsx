'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import dynamic from 'next/dynamic';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { lockBodyScroll } from '@/lib/bodyScrollLock';
import { useCandleData, fetchKoreanNews } from '@/hooks/useStockData';
import { useAnalysisQuota } from '@/hooks/useAnalysisQuota';
import { useNow } from '@/hooks/useNow';
import {
  calcSMA, calcRSI, calcBollingerBands, calcMACD,
  detectTrend, detectCross, detectPattern, generateSummary,
  getBollingerStatus, getMACDStatus, getChartShapeSummary, generateAIReport,
} from '@/utils/technical';
import { buildChartNarrative } from '@/utils/chartNarrative';
import { STOCK_KR } from '@/config/constants';
import { quoteDirection, quoteTimestamp } from '@/utils/quotePresentation';
import type { AIReport, StockItem, QuoteData, NewsItem } from '@/config/constants';
import { BarChart3, Check, ChevronLeft, ChevronRight, ShieldAlert, Sparkles, X } from 'lucide-react';
import { logApiCall } from '@/lib/apiLogger';
import { logFeatureFirstUse } from '@/lib/tourTelemetry';
import { supabase } from '@/lib/supabase';
import { MENTORS } from '@/config/mentors';
import Disclaimer from '@/components/common/Disclaimer';
import type { Mentor } from '@/config/mentors';
import { buildStockCheckup, getStockVolumeRatio } from '@/utils/stockCheckup';
import { buildAnalysisLoadingFacts, type AnalysisLoadingFact } from '@/utils/analysisLoadingFacts';
import { ANALYSIS_DAILY_LIMIT_MESSAGE, getAnalysisRemaining } from '@/utils/analysisQuota';
import StockCheckup from './StockCheckup';
import StockAnalysisQuestions from './StockAnalysisQuestions';
import StockAnswerLoading from './StockAnswerLoading';
import assistantStyles from './StockAssistant.module.css';
import StockLearning from './StockLearning';
import AnalysisNavigation from './AnalysisNavigation';
import { isSingleStockLeverage, LEVERAGE_ANALYSIS_REFUSAL } from '@/utils/leverageGuard';
import AiResultMeta from '@/components/common/AiResultMeta';
import type { AiResultMeta as AiResultMetaValue } from '@/lib/aiResultMeta';
import {
  convertStockAmount,
  convertStockCostAmount,
  getStockCurrency,
  isKoreanStockSymbol,
} from '@/utils/stockCurrency';

const AI_STEPS = [
  { label: '최신 뉴스 수집 중', pct: 15 },
  { label: '시세 데이터 갱신 중', pct: 35 },
  { label: '기술 지표 분석 중', pct: 55 },
  { label: 'AI 리포트 생성 중', pct: 75 },
  { label: '결과 정리 중', pct: 92 },
];

function AIProgressIndicator() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = AI_STEPS.map((_, i) =>
      setTimeout(() => setStep(i), i === 0 ? 300 : i * 2200 + 300)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const current = AI_STEPS[step] || AI_STEPS[AI_STEPS.length - 1];

  return (
    <div style={{ padding: '28px 0' }}>
      {/* Progress bar */}
      <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-subtle, #F2F4F6)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{
          height: '100%',
          borderRadius: 3,
          background: 'var(--text-primary)',
          width: `${current.pct}%`,
          transition: 'width 1.8s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      </div>

      {/* Percentage + step label */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary, #8B95A1)' }}>
          {current.label}...
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {current.pct}%
        </span>
      </div>

      {/* Step checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {AI_STEPS.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <span style={{
              width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600,
              background: i === step ? 'var(--pill-active-bg)' : 'var(--bg-subtle, #F2F4F6)',
              color: i < step ? 'var(--text-primary)' : i === step ? 'var(--pill-active-fg)' : 'var(--text-tertiary, #B0B8C1)',
              transition: 'all 0.3s ease',
            }}>
              {i < step ? <Check size={12} aria-label="완료" /> : i + 1}
            </span>
            <span style={{
              color: i <= step ? 'var(--text-primary, #191F28)' : 'var(--text-tertiary, #B0B8C1)',
              fontWeight: i === step ? 600 : 400,
              transition: 'all 0.3s ease',
            }}>
              {s.label}
            </span>
            {i === step && (
              <span style={{ marginLeft: 'auto' }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--text-primary)', animation: 'aiPulse 1.2s ease-in-out infinite' }} />
              </span>
            )}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes aiPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

const StockChart = dynamic(() => import('./StockChart'), { ssr: false });
import BuySimulator from '@/components/portfolio/BuySimulator';
import InvestmentNotes from '@/components/portfolio/InvestmentNotes';

// AI report cache (module-level, persists across re-renders)
interface AnalysisReport extends AIReport {
  newsContext?: string;
  newsAnalysis?: { headline: string; impact: string }[];
  scenarios?: { bull: string; bear: string };
  _meta?: AiResultMetaValue;
}

interface MentorReport extends AnalysisReport {
  mentorScore?: number;
  mentorVerdict?: string;
  keyAdvice?: string[];
  quote?: string;
}

interface Fundamentals {
  per?: number;
  eps?: number;
  marketCap?: number;
  dividendYield?: number;
  week52High?: number;
  week52Low?: number;
  sector?: string;
  currency?: 'KRW' | 'USD';
  resolvedSymbol?: string;
}

const aiReportCache: Record<string, { report: AnalysisReport; timestamp: number }> = {};
const mentorReportCache: Record<string, { report: MentorReport; timestamp: number }> = {};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// 캐시 초기화 (계정 전환 시 호출)
export function clearAnalysisCache() {
  Object.keys(aiReportCache).forEach(k => delete aiReportCache[k]);
  Object.keys(mentorReportCache).forEach(k => delete mentorReportCache[k]);
}

type ChartLevel = 'basic' | 'detail';

import { formatKrw, formatUsd, resolveUsdKrwState } from '@/utils/koreanNumber';

function fmtNativePrice(val: number, nativeCurrency: 'KRW' | 'USD'): string {
  return nativeCurrency === 'KRW'
    ? formatKrw(val)
    : formatUsd(val);
}
function fmtMarketCap(val: number, nativeCurrency: 'KRW' | 'USD'): string {
  if (nativeCurrency === 'KRW') {
    if (val >= 1e12) return `${(val / 1e12).toFixed(1)}조원`;
    if (val >= 1e8) return `${(val / 1e8).toFixed(1)}억원`;
    return formatKrw(val, { prefix: false, suffix: '원', short: false });
  }
  if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  return `$${(val / 1e6).toFixed(0)}M`;
}


/**
 * 단일 종목 현재가 — **서버 라우트 경유**.
 *
 * 예전에는 미국 종목을 브라우저에서 Finnhub에 직접 조회했고, 그러려면 클라이언트가
 * API 키를 들고 있어야 했다(/api/ws-token이 전 방문자에게 키를 뿌린 이유).
 * 키 노출 경로를 없애면서 조회를 서버 라우트로 옮겼다.
 */
async function fetchQuoteViaServer(symbol: string): Promise<QuoteData | null> {
  if (isKoreanStockSymbol(symbol)) {
    const r = await fetch(`/api/kr-quote?symbol=${symbol}`);
    return await r.json();
  }
  const r = await fetch('/api/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols: [symbol] }),
  });
  const json = await r.json();
  return json?.quotes?.[symbol] ?? null;
}

export default function AnalysisPanel() {
  const {
    analysisSymbol, setAnalysisSymbol,
    macroData, rawCandles,
    stocks,
    currency,
    getAllSymbols,
  } = usePortfolioStore(useShallow(state => ({
    analysisSymbol: state.analysisSymbol, setAnalysisSymbol: state.setAnalysisSymbol,
    macroData: state.macroData, rawCandles: state.rawCandles, stocks: state.stocks,
    currency: state.currency, getAllSymbols: state.getAllSymbols,
  })));

  const { fetchCandle } = useCandleData(analysisSymbol);
  const [tickerNews, setTickerNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLevel, setChartLevel] = useState<ChartLevel>('basic');
  const [chartRange, setChartRange] = useState<number>(60); // default 3M (60 trading days)
  const [showAIReport, setShowAIReport] = useState(false);
  const [aiReport, setAiReport] = useState<AnalysisReport | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiErrorAction, setAiErrorAction] = useState<'login' | 'daily' | 'unavailable' | 'retry'>('retry');
  const aiRequestRef = useRef<AbortController | null>(null);
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [mentorReport, setMentorReport] = useState<MentorReport | null>(null);
  const [mentorLoading, setMentorLoading] = useState(false);
  const [mentorLoadingPhase, setMentorLoadingPhase] = useState<'preparing' | 'waiting'>('preparing');
  const [mentorLoadingFacts, setMentorLoadingFacts] = useState<AnalysisLoadingFact[]>([]);
  const [mentorError, setMentorError] = useState('');
  const [mentorCachedAt, setMentorCachedAt] = useState<number | null>(null);
  const [mentorErrorAction, setMentorErrorAction] = useState<'login' | 'daily' | 'unavailable' | 'retry'>('retry');
  const mentorRequestRef = useRef<AbortController | null>(null);
  const { quota: aiQuota, remaining: aiRemaining, status: quotaStatus, acceptResponse: acceptQuotaResponse } = useAnalysisQuota(!!analysisSymbol);
  const now = useNow();
  const [fundamentals, setFundamentals] = useState<Fundamentals | null>(null);
  const hasFundamentalValues = !!fundamentals && (
    [fundamentals.per, fundamentals.eps, fundamentals.marketCap,
      fundamentals.week52High, fundamentals.week52Low].some(value => typeof value === 'number' && Number.isFinite(value))
    || (fundamentals.dividendYield ?? 0) > 0 || !!fundamentals.sector
  );
  const [wideMode, setWideMode] = useState(false); // lg+ 넓게 보기(opt-in, localStorage)

  const symbol = analysisSymbol;
  const kr = symbol ? (STOCK_KR[symbol] || symbol) : '';

  // 패널 열릴 때 해당 종목 최신 시세 즉시 fetch
  useEffect(() => {
    if (!symbol) return;
    let active = true;
    setLoading(true);

    const fetchFreshQuote = async () => {
      try {
        const d = await fetchQuoteViaServer(symbol);
        if (d?.c) {
          usePortfolioStore.getState().updateMacroEntry(symbol, d);
        }
      } catch { /* fallback to cached */ }
    };

    const fetchFundamentals = async () => {
      try {
        const r = await fetch(`/api/fundamentals?symbol=${symbol}`);
        const d = await r.json();
        if (active && d?.data) setFundamentals(d.data);
      } catch { /* silent */ }
    };

    Promise.all([fetchCandle(), fetchFreshQuote(), fetchFundamentals()]).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!symbol) return;
    let active = true;
    const krName = STOCK_KR[symbol] || symbol;
    const q = (krName !== symbol ? krName + ' ' : '') + symbol + ' 주가';
    fetchKoreanNews(q).then(result => {
      if (active) setTickerNews(result.items.slice(0, 5));
    });
    return () => { active = false; };
  }, [symbol]);

  const stockData = useMemo((): StockItem | null => {
    if (!symbol) return null;
    for (const c of ['investing', 'watching', 'sold'] as const) {
      const found = (stocks[c] || []).find(x => x.symbol === symbol);
      if (found) return found;
    }
    return null;
  }, [symbol, stocks]);

  // 단일종목 레버리지·인버스: 매수 매력도·매매 방향(차트 신호·기술 지표 '매수' 배지)을 가리고
  // 위험 해설만 — §6 자문업 차단. 영속 종목명(stockData.name) 우선 → 한국 ETF 16종 키워드 탐지.
  const displayName = stockData?.name || kr;
  const isLev = isSingleStockLeverage(symbol || '', displayName);

  const analysis = useMemo(() => {
    const raw = symbol ? rawCandles[symbol] : null;
    if (!raw || !raw.c || raw.c.length <= 20) return null;
    const closes = raw.c;
    const sma5 = calcSMA(closes, 5);
    const sma20 = calcSMA(closes, 20);
    const sma60 = calcSMA(closes, 60);
    const rsi = calcRSI(closes);
    const trend = detectTrend(closes, sma20, sma60);
    const cross = detectCross(sma5, sma20);
    const pattern = detectPattern(closes);
    const summary = generateSummary(closes, rsi, trend, cross, pattern);
    const rsiVal = rsi.length ? rsi[rsi.length - 1] : null;
    const avgVol = raw.v ? raw.v.slice(-20).reduce((a, b) => a + b, 0) / 20 : 0;
    const lastVol = raw.v ? raw.v[raw.v.length - 1] : 0;
    const volRatio = avgVol ? (lastVol / avgVol) : 1;

    // Bollinger Bands
    const bollinger = calcBollingerBands(closes);
    const lastBollinger = bollinger.length ? bollinger[bollinger.length - 1] : null;
    const bollingerStatus = lastBollinger ? getBollingerStatus(closes[closes.length - 1], lastBollinger) : null;

    // MACD
    const macdResult = calcMACD(closes);
    const macdStatus = getMACDStatus(macdResult.macd, macdResult.signal, macdResult.histogram);

    // Chart shape summary
    const chartShape = getChartShapeSummary(trend, pattern, rsi, cross);

    // AI Report
    const aiReport = generateAIReport(closes, rsi, trend, cross, pattern, bollingerStatus, macdStatus, volRatio);

    return {
      closes, sma5, sma20, sma60, rsi, trend, cross, pattern, summary,
      rsiVal, volRatio, raw, bollinger, lastBollinger, bollingerStatus,
      macdResult, macdStatus, chartShape, aiReport,
    };
  }, [symbol, rawCandles]);

  // 신규 상장 등으로 캔들이 구조적으로 부족한 경우 — '잠시 후 재시도'(일시 오류)와 구분.
  // SpaceX 같은 갓 IPO 종목은 시세 이력이 4~5개뿐이라 분석 신뢰도가 낮음을 명시한다.
  const candleCount = symbol ? (rawCandles[symbol]?.c?.length ?? 0) : 0;
  const isThinData = candleCount > 0 && candleCount <= 20;

  // USD/KRW
  const fx = resolveUsdKrwState(macroData);
  const usdKrw = fx.rate;

  const dialogRef = useRef<HTMLDivElement>(null);
  const analysisBodyRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setAnalysisSymbol(null);
    document.body.style.overflow = '';
  }, [setAnalysisSymbol]);

  useEffect(() => {
    if (symbol) return lockBodyScroll();
  }, [symbol]);

  // 모달 접근성 — ESC 닫기 + 포커스 트랩 + 복원 (거짓 aria-modal 해소)
  useFocusTrap(!!symbol, dialogRef, close);

  // 종목 스위처로 symbol이 바뀌면 모달이 재마운트되지 않으므로, 이전 종목의 AI/멘토/차트 상태를
  // 명시적으로 reset(스테일 데이터 노출 방지). fundamentals·tickerNews는 각 per-symbol effect가 재취득.
  useEffect(() => {
    setShowAIReport(false); setAiReport(null); setAiLoading(false); setAiError('');
    setSelectedMentor(null); setMentorReport(null); setMentorLoading(false); setMentorError('');
    setChartLevel('basic'); setChartRange(60); setFundamentals(null); setTickerNews([]);
    return () => {
      mentorRequestRef.current?.abort();
      mentorRequestRef.current = null;
      aiRequestRef.current?.abort();
      aiRequestRef.current = null;
    };
  }, [symbol]);

  useEffect(() => {
    try { setWideMode(localStorage.getItem('solb_analysis_wide') === '1'); } catch { /* SSR/비가용 */ }
  }, []);

  if (!symbol) return null;

  const quote = macroData[symbol] as QuoteData | undefined;
  // 보유/관심이 아닌 '검색 살펴보기' 종목은 macroData에 없을 수 있어 최신 캔들 종가로 폴백
  const price = quote?.c || rawCandles[symbol]?.c?.at(-1) || 0;
  const change = quote?.d || 0;
  const cp = quote?.dp || 0;
  const nativeCurrency = getStockCurrency(symbol, stockData?.currency);
  const isKoreanStock = nativeCurrency === 'KRW';
  const fundamentalsCurrency = fundamentals?.currency || nativeCurrency;
  const priceAmounts = convertStockAmount(
    symbol,
    price,
    usdKrw,
    stockData?.currency,
  );
  const avgCostAmounts = convertStockCostAmount(
    symbol,
    stockData?.avgCost || 0,
    usdKrw,
    stockData?.purchaseRate,
    stockData?.currency,
  );
  const costAmounts = convertStockCostAmount(
    symbol,
    (stockData?.avgCost || 0) * (stockData?.shares || 0),
    usdKrw,
    stockData?.purchaseRate,
    stockData?.currency,
  );
  const valueAmounts = convertStockAmount(
    symbol,
    price * (stockData?.shares || 0),
    usdKrw,
    stockData?.currency,
  );
  const pnlAmounts = {
    krw: valueAmounts.krw - costAmounts.krw,
    usd: valueAmounts.usd - costAmounts.usd,
  };
  const direction = quoteDirection(quote?.c ? quote.dp : undefined);
  const asOf = quoteTimestamp(quote?.c ? quote.t : rawCandles[symbol]?.t?.at(-1));
  const displayPnl = currency === 'KRW' ? pnlAmounts.krw : pnlAmounts.usd;
  const displayCost = currency === 'KRW' ? costAmounts.krw : costAmounts.usd;
  const displayPnlPct = displayCost > 0 ? (displayPnl / displayCost) * 100 : 0;
  const pnlIsGain = displayPnl >= 0;

  // 상세 내 종목 스위처 — 보유/관심/매도 종목 순회(검색 살펴보기 등 목록 밖 종목은 미노출).
  const allSymbols = getAllSymbols();
  const symIdx = allSymbols.indexOf(symbol);
  const showSwitcher = symIdx >= 0 && allSymbols.length > 1;

  const closeMentorAnswer = () => {
    mentorRequestRef.current?.abort();
    mentorRequestRef.current = null;
    setMentorLoading(false);
    setSelectedMentor(null);
    setMentorReport(null);
    setMentorError('');
    setMentorCachedAt(null);
    const more = dialogRef.current?.querySelector<HTMLButtonElement>('[data-question-more]');
    const hiddenAfterClose = more?.getAttribute('aria-expanded') === 'false'
      && !['safe', 'value', 'growth'].includes(selectedMentor?.id ?? '');
    if (hiddenAfterClose) more?.focus();
    else dialogRef.current?.querySelector<HTMLButtonElement>(`[data-question-id="${selectedMentor?.id}"]`)?.focus();
  };

  const handleMentorSelect = async (id: string, retry = false) => {
    const mentor = MENTORS.find(item => item.id === id);
    if (!mentor || mentorRequestRef.current) return;
    if (selectedMentor?.id === id && !retry) { closeMentorAnswer(); return; }
    const cacheKey = `${symbol}-${id}`;
    const cached = mentorReportCache[cacheKey];
    if (quotaStatus === 'checking' && (retry || !cached)) return;
    setSelectedMentor(mentor);
    setMentorReport(null);
    setMentorError('');
    setMentorCachedAt(null);
    setMentorErrorAction('retry');
    if (!retry && cached && (now - cached.timestamp < CACHE_TTL || getAnalysisRemaining(aiQuota) === 0 || quotaStatus === 'checking')) {
      setMentorReport(cached.report);
      setMentorCachedAt(cached.timestamp);
      return;
    }
    if (getAnalysisRemaining(aiQuota) === 0) {
      setMentorError(ANALYSIS_DAILY_LIMIT_MESSAGE);
      setMentorErrorAction('daily');
      return;
    }
    const controller = new AbortController();
    mentorRequestRef.current = controller;
    const isCurrent = () => !controller.signal.aborted && mentorRequestRef.current === controller
      && usePortfolioStore.getState().analysisSymbol === symbol;
    setMentorLoadingPhase('preparing');
    setMentorLoadingFacts([]);
    setMentorLoading(true);
    try {
      const [{ data: { session } }, { buildTimeSeriesContext }, refreshedQuote] = await Promise.all([
        supabase.auth.getSession(), import('@/utils/timeSeries'),
        Number.isFinite(price) && price > 0 ? Promise.resolve(null) : fetchQuoteViaServer(symbol),
      ]);
      if (!isCurrent()) return;
      const requestPrice = Number.isFinite(price) && price > 0 ? price : refreshedQuote?.c;
      if (!requestPrice || !Number.isFinite(requestPrice) || requestPrice <= 0) {
        setMentorError('가격 자료를 확인하지 못했어요. 잠시 후 다시 요청하면 시세부터 확인할게요.');
        return;
      }
      if (refreshedQuote?.c) usePortfolioStore.getState().updateMacroEntry(symbol, refreshedQuote);
      const requestVolumeRatio = getStockVolumeRatio(rawCandles[symbol]);
      setMentorLoadingFacts(buildAnalysisLoadingFacts({
        price: requestPrice, currency: fundamentalsCurrency, volRatio: requestVolumeRatio,
        per: fundamentals?.per, eps: fundamentals?.eps,
      }));
      setMentorLoadingPhase('waiting');
      const response = await fetch('/api/ai-analysis', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          symbol, koreanName: displayName, currency: fundamentalsCurrency,
          price: requestPrice, change: quote?.c ? quote.d : refreshedQuote?.d,
          changePercent: quote?.c ? quote.dp : refreshedQuote?.dp,
          rsi: analysis?.rsiVal?.toFixed(0), trend: analysis?.trend,
          cross: analysis?.cross, pattern: analysis?.pattern?.name,
          bollingerStatus: analysis?.bollingerStatus?.status,
          macdStatus: analysis?.macdStatus?.status,
          volRatio: requestVolumeRatio,
          mentorId: mentor.id, per: fundamentals?.per, eps: fundamentals?.eps,
          week52High: fundamentals?.week52High, week52Low: fundamentals?.week52Low,
          sector: fundamentals?.sector,
          timeSeriesContext: buildTimeSeriesContext(rawCandles[symbol], nativeCurrency),
        }),
      });
      const data = await response.json();
      if (!isCurrent()) return;
      const quota = acceptQuotaResponse(data, session?.user.id ?? null);
      if (response.ok && data.success && data.report) {
        setMentorReport(data.report);
        mentorReportCache[cacheKey] = { report: data.report, timestamp: Date.now() };
        try {
          const previous = parseInt(localStorage.getItem('solb_ai_usage') || '0', 10) || 0;
          localStorage.setItem('solb_ai_usage', String(previous + 1));
        } catch { /* Storage is optional. */ }
        logApiCall('mentor_analysis', symbol, { mentor: mentor.id });
        logFeatureFirstUse('mentor');
      } else {
        setMentorError(quota?.remaining === 0 ? ANALYSIS_DAILY_LIMIT_MESSAGE : data.error || '설명을 불러오지 못했어요. 잠시 후 다시 요청해주세요.');
        setMentorErrorAction(data.loginForMore || response.status === 401 ? 'login'
          : quota?.remaining === 0 ? 'daily' : data.code === 'daily_total_limit' ? 'unavailable' : 'retry');
      }
    } catch {
      if (isCurrent()) setMentorError('연결이 원활하지 않아요. 잠시 후 다시 요청해주세요.');
    } finally {
      if (isCurrent()) {
        mentorRequestRef.current = null;
        setMentorLoading(false);
      }
    }
  };

  const handleAIReportToggle = async (retry = false) => {
    if (aiRequestRef.current) return;
    // 단일종목 레버리지: AI 분석 거부 — API 호출·쿼터 차감·로딩 없이 거부 카드만 토글 (§6).
    if (isLev) { setShowAIReport(p => !p); return; }
    if (showAIReport && !retry) { setShowAIReport(false); return; }
    const cached = symbol ? aiReportCache[symbol] : null;
    if (quotaStatus === 'checking' && !aiReport && !cached) return;
    setShowAIReport(true);
    setAiError('');
    setAiErrorAction('retry');
    if (aiReport) return; // already loaded
    // Check cache first
    if (cached && (now - cached.timestamp < CACHE_TTL || getAnalysisRemaining(aiQuota) === 0 || quotaStatus === 'checking')) {
      setAiReport(cached.report);
      return;
    }
    if (getAnalysisRemaining(aiQuota) === 0) {
      setAiError(ANALYSIS_DAILY_LIMIT_MESSAGE);
      setAiErrorAction('daily');
      return;
    }
    const controller = new AbortController();
    aiRequestRef.current = controller;
    const isCurrent = () => !controller.signal.aborted && aiRequestRef.current === controller
      && usePortfolioStore.getState().analysisSymbol === symbol;
    setAiLoading(true);
    try {
      // AI 분석 시 뉴스를 새로 가져옴 (최신 반영)
      const freshKr = STOCK_KR[symbol] || symbol;
      const freshQuery = (freshKr !== symbol ? freshKr + ' ' : '') + symbol + ' 주가';
      const freshNewsResult = await fetchKoreanNews(freshQuery);
      if (!isCurrent()) return;
      const freshNewsItems = freshNewsResult.items;
      if (freshNewsItems.length) setTickerNews(freshNewsItems.slice(0, 6));
      // 24시간 이내 뉴스 필터링 + 날짜 레이블
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recentOnly = (freshNewsItems.length ? freshNewsItems : tickerNews).filter(n => {
        if (!n.pubDate) return false;
        return new Date(n.pubDate).getTime() > oneDayAgo;
      });
      const newsText = recentOnly.length > 0
        ? recentOnly.slice(0, 5).map(n => {
            const hoursAgo = Math.round((Date.now() - new Date(n.pubDate).getTime()) / 3600000);
            const label = hoursAgo < 1 ? '방금 전' : `${hoursAgo}시간 전`;
            return `[${label}] ${n.title}`;
          }).join('\n')
        : '최근 24시간 내 관련 뉴스 없음';
      // 최신 가격을 새로 가져옴
      let latestPrice = price;
      let latestChange = change;
      let latestCp = cp;
      try {
        const qd = await fetchQuoteViaServer(symbol);
        if (qd?.c) {
          latestPrice = qd.c;
          latestChange = qd.d || 0;
          latestCp = qd.dp || 0;
        }
      } catch { /* use existing price */ }

      const { data: { session } } = await supabase.auth.getSession();
      if (!isCurrent()) return;
      const resp = await fetch('/api/ai-analysis', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          symbol,
          koreanName: displayName,
          currency: fundamentalsCurrency,
          price: latestPrice,
          change: latestChange,
          changePercent: latestCp,
          rsi: analysis?.rsiVal?.toFixed(0),
          trend: analysis?.trend,
          cross: analysis?.cross,
          pattern: analysis?.pattern?.name,
          bollingerStatus: analysis?.bollingerStatus?.status,
          macdStatus: analysis?.macdStatus?.status,
          volRatio: analysis?.volRatio,
          recentNews: newsText,
          per: fundamentals?.per,
          eps: fundamentals?.eps,
          week52High: fundamentals?.week52High,
          week52Low: fundamentals?.week52Low,
          sector: fundamentals?.sector,
          timeSeriesContext: symbol
            ? (await import('@/utils/timeSeries')).buildTimeSeriesContext(
                rawCandles[symbol],
                nativeCurrency,
              )
            : '',
        }),
      });
      const data = await resp.json();
      if (!isCurrent()) return;
      const quota = acceptQuotaResponse(data, session?.user.id ?? null);
      if (resp.ok && data.success && data.report) {
        setAiReport(data.report);
        if (symbol) aiReportCache[symbol] = { report: data.report, timestamp: Date.now() };
        try {
          const prev = parseInt(localStorage.getItem('solb_ai_usage') || '0', 10) || 0;
          localStorage.setItem('solb_ai_usage', String(prev + 1));
        } catch { /* ignore */ }
        logApiCall('ai_analysis', symbol || undefined, { conclusion: data.report?.conclusion?.label });
        logFeatureFirstUse('analysis');
      }
      else {
        setAiError(quota?.remaining === 0 ? ANALYSIS_DAILY_LIMIT_MESSAGE : data.error || 'AI 분석에 실패했어요.');
        setAiErrorAction(data.loginForMore || resp.status === 401 ? 'login'
          : quota?.remaining === 0 ? 'daily' : data.code === 'daily_total_limit' ? 'unavailable' : 'retry');
      }
    } catch {
      if (isCurrent()) setAiError('AI 분석에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      if (isCurrent()) {
        aiRequestRef.current = null;
        setAiLoading(false);
      }
    }
  };

  const cacheReadable = (entry: { timestamp: number } | undefined) => !!entry
    && (now - entry.timestamp < CACHE_TTL || aiRemaining === 0 || quotaStatus === 'checking');
  const cachedQuestionIds = MENTORS.filter(mentor => cacheReadable(mentorReportCache[`${symbol}-${mentor.id}`])).map(mentor => mentor.id);
  const hasCachedAnalysis = cacheReadable(aiReportCache[symbol]);
  const aiActionBlocked = !isLev && !showAIReport && !aiReport && !hasCachedAnalysis
    && (quotaStatus === 'checking' || aiRemaining === 0);

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(1px)' }} onClick={close} />

      {/* Panel */}
      <div className="analysis-shell fixed inset-0 z-[70] flex items-center justify-center" style={{ padding: 16 }}>
        <div
          className={`flex flex-col analysis-modal${wideMode ? ' wide' : ''}`}
          style={{
            width: '100%',
            maxWidth: 'min(700px, 95vw)',
            maxHeight: '90vh',
            background: 'var(--surface, #FFFFFF)',
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            border: '1px solid var(--border-light, #F2F4F6)',
          }}
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`${displayName} 살펴보기`}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between"
            style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light, #F2F4F6)', flexShrink: 0 }}
          >
            <div className="flex items-center" style={{ gap: 12 }}>
              <div
                className="flex items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-subtle)',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-body)' }}>{displayName.charAt(0)}</span>
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{displayName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {symbol} · {isKoreanStock ? '한국 주식' : '미국 주식'}
                </div>
              </div>
            </div>
            <div className="flex items-center" style={{ marginLeft: 'auto', gap: 2 }}>
              {/* 넓게 보기 — lg+ 전용(CSS로 노출). 차트가 넓어짐. 기본 880 / 넓게 1080. */}
              <button
                onClick={() => setWideMode((v) => { try { localStorage.setItem('solb_analysis_wide', v ? '0' : '1'); } catch { /* */ } return !v; })}
                aria-pressed={wideMode}
                aria-label={wideMode ? '기본 너비로' : '넓게 보기'}
                className="analysis-wide-toggle items-center justify-center cursor-pointer"
                style={{ display: 'none', height: 32, padding: '0 10px', borderRadius: 8, background: wideMode ? 'var(--bg-subtle)' : 'transparent', color: wideMode ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                {wideMode ? '기본' : '넓게'}
              </button>
              {showSwitcher && (
                <>
                  <button
                    onClick={() => { if (symIdx > 0) setAnalysisSymbol(allSymbols[symIdx - 1]); }}
                    disabled={symIdx <= 0}
                    aria-label="이전 종목"
                    className="flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-default"
                    style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none' }}
                  >
                    <ChevronLeft style={{ width: 18, height: 18, color: '#8B95A1' }} />
                  </button>
                  <button
                    onClick={() => { if (symIdx < allSymbols.length - 1) setAnalysisSymbol(allSymbols[symIdx + 1]); }}
                    disabled={symIdx >= allSymbols.length - 1}
                    aria-label="다음 종목"
                    className="flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-default"
                    style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none' }}
                  >
                    <ChevronRight style={{ width: 18, height: 18, color: '#8B95A1' }} />
                  </button>
                </>
              )}
              <button
                onClick={close}
                aria-label="닫기"
                className="flex items-center justify-center cursor-pointer transition-colors"
                style={{ width: 44, height: 44, borderRadius: 8, background: 'transparent', border: 'none' }}
              >
                <X style={{ width: 20, height: 20, color: '#8B95A1' }} />
              </button>
            </div>
          </div>

          {!loading && <AnalysisNavigation key={symbol} scrollRef={analysisBodyRef}
            hasChart={!!analysis && !isLev} hasFundamentals={!!fundamentals} hasAssistant={!isLev}
            layoutKey={`${symbol}-${wideMode}`} />}

          {/* Scrollable body */}
          <div ref={analysisBodyRef} className={`flex-1 analysis-body${wideMode && analysis && !isLev ? ' body-2col' : ''}`} style={{ overflowY: 'auto', minHeight: 0, padding: 24 }}>
            <style>{`@media (max-width: 768px) { .analysis-body { padding: 16px !important; } } @media (min-width: 1024px) { .analysis-modal { max-width: 880px !important; } .analysis-modal.wide { max-width: 1120px !important; } .analysis-wide-toggle { display: inline-flex !important; } .analysis-body.body-2col { display: grid; grid-template-columns: minmax(0,1.55fr) minmax(0,1fr); gap: 24px; align-items: start; } .analysis-body.body-2col > * { grid-column: 2; min-width: 0; } .analysis-body.body-2col > .detail-chart-col { grid-column: 1; grid-row: 1 / span 99; align-self: start; } }`}</style>
            {loading ? (
              <div className="flex flex-col items-center justify-center" style={{ height: 160, gap: 12 }}>
                <div style={{ width: 120, height: 4, borderRadius: 2, background: 'var(--bg-subtle, #F2F4F6)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: 'var(--text-primary)', animation: 'loadingBar 1.5s ease-in-out infinite' }} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary, #8B95A1)' }}>분석 데이터를 불러오는 중...</div>
                <style>{`
                  @keyframes loadingBar {
                    0% { width: 0%; }
                    50% { width: 70%; }
                    100% { width: 100%; }
                  }
                `}</style>
              </div>
            ) : (
              <>
                {/* Price hero */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                  <div style={{ fontSize: 'clamp(24px, 7vw, 32px)', fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                    {price
                      ? nativeCurrency === 'KRW'
                        ? formatKrw(priceAmounts.krw)
                        : formatUsd(priceAmounts.usd)
                      : '--'}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 500, marginTop: 8, color: direction === 'up' ? 'var(--color-gain)' : direction === 'down' ? 'var(--color-loss)' : 'var(--text-secondary)' }}>
                    {direction === 'unknown' ? '등락 정보를 확인하고 있어요' : direction === 'flat' ? '전일 종가와 같아요 · 0.00%' : <>
                      {direction === 'up' ? '+' : '−'}{nativeCurrency === 'KRW' ? formatKrw(Math.abs(change)) : formatUsd(Math.abs(change))}
                      {' '}({cp > 0 ? '+' : ''}{cp.toFixed(2)}%) · 전일 종가 대비
                    </>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                    {asOf ? `${asOf} 기준 · 한국시간` : '시세 기준 시각 미확인'} · 지연될 수 있어요
                  </div>
                  {price > 0 && <details style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}><summary style={{ cursor: 'pointer', padding: 8 }}>다른 통화로 보기</summary>{nativeCurrency === 'KRW' ? formatUsd(priceAmounts.usd) : formatKrw(priceAmounts.krw)} · {fx.stale ? '환율 미확인 · 임시 환율로 환산' : '환율에 따른 환산 금액'}</details>}
                </div>

                {analysis && !isLev && (
                  <div className="detail-chart-col">
                    {/* Chart Tabs */}
                    <div id="anchor-chart" className="flex items-center" style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, gap: 6, scrollMarginTop: 44 }}>
                      가격 차트
                    </div>

                    {/* Chart level tabs: 2 tabs */}
                    <div className="flex items-center" style={{ border: '1px solid var(--border-light, #F2F4F6)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
                      {(['basic', 'detail'] as ChartLevel[]).map((lvl, idx) => (
                        <button
                          key={lvl}
                          onClick={() => setChartLevel(lvl)}
                          className="cursor-pointer transition-colors"
                          style={{
                            flex: 1,
                            padding: '10px 0',
                            textAlign: 'center',
                            fontSize: 14,
                            fontWeight: chartLevel === lvl ? 700 : 500,
                            color: chartLevel === lvl ? 'var(--pill-active-fg)' : 'var(--text-secondary)',
                            background: chartLevel === lvl ? 'var(--pill-active-bg)' : 'var(--surface)',
                            borderTop: 'none',
                            borderBottom: 'none',
                            borderLeft: 'none',
                            borderRight: idx < 1 ? '1px solid var(--border-light, #F2F4F6)' : 'none',
                          }}
                        >
                          {lvl === 'basic' ? '기본' : '상세'}
                        </button>
                      ))}
                    </div>

                    {/* Timeframe selector */}
                    <div className="flex items-center justify-center" style={{ gap: 4, marginBottom: 16 }}>
                      {([
                        { label: '1개월', days: 22 },
                        { label: '3개월', days: 60 },
                        { label: '6개월', days: 120 },
                        { label: '1년', days: 0 },
                      ]).map(tf => (
                        <button
                          key={tf.label}
                          onClick={() => setChartRange(tf.days)}
                          aria-pressed={chartRange === tf.days}
                          className="cursor-pointer"
                          style={{
                            padding: '5px 14px',
                            minHeight: 44,
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: chartRange === tf.days ? 700 : 500,
                            color: chartRange === tf.days ? 'var(--text-primary)' : 'var(--text-secondary)',
                            background: chartRange === tf.days ? 'var(--bg-subtle)' : 'transparent',
                            border: 'none',
                          }}
                        >
                          {tf.label}
                        </button>
                      ))}
                    </div>

                    {/* Chart */}
                    <StockChart
                      raw={analysis.raw}
                      sma5={analysis.sma5}
                      sma20={analysis.sma20}
                      sma60={analysis.sma60}
                      level={chartLevel}
                      bollingerBands={analysis.bollinger}
                      macdData={analysis.macdResult}
                      rsiData={analysis.rsi}
                      visibleBars={chartRange}
                      currency={nativeCurrency}
                    />

                    {(() => {
                      const closes = chartRange === 0 ? analysis.closes : analysis.closes.slice(-chartRange);
                      const format = nativeCurrency === 'KRW' ? formatKrw : formatUsd;
                      return <p className="reading-copy" style={{ marginTop: 12, fontSize: 13, lineHeight: 1.7, color: 'var(--text-body)' }}>선택한 기간의 종가는 {format(Math.min(...closes))}부터 {format(Math.max(...closes))} 사이였어요. 가격이 움직인 이유는 실적과 소식을 함께 살펴보세요.</p>;
                    })()}

                    <details style={{ marginTop: 16 }}>
                      <summary style={{ minHeight: 44, padding: '12px 0', cursor: 'pointer', fontSize: 14, color: 'var(--text-body)' }}>차트 해설과 기술 지표 펼쳐보기</summary>
                    {/* 이 차트, 지금 이런 상태예요 — 초보 해설(chartNarrative SSOT, §6 안전). 차트 직하 약어 범례 대체.
                        level 바인딩 — basic 차트엔 볼린저 띠 미렌더라 볼린저 설명 생략(화면-설명 일치). */}
                    {(() => {
                      const recentCloses = analysis.closes.slice(-Math.min(chartRange, analysis.closes.length));
                      const recentHigh = recentCloses.length ? Math.max(...recentCloses) : 0;
                      const recentLow = recentCloses.length ? Math.min(...recentCloses) : 0;
                      // chartRange(거래일) → 여정 기간 라벨. 0=1Y(전체)
                      const periodLabel = chartRange === 22 ? '최근 한 달'
                        : chartRange === 120 ? '최근 여섯 달'
                        : chartRange === 0 ? '최근 1년'
                        : '최근 석 달';
                      const narrative = buildChartNarrative({
                        rsiVal: analysis.rsiVal,
                        bollingerPos: analysis.bollingerStatus
                          ? (analysis.bollingerStatus.status.startsWith('상단') ? 'upper'
                            : analysis.bollingerStatus.status.startsWith('하단') ? 'lower'
                            : analysis.bollingerStatus.status.startsWith('중앙') ? 'middle' : null)
                          : null,
                        price: analysis.closes[analysis.closes.length - 1],
                        recentHigh,
                        recentLow,
                        sma20: analysis.sma20.length ? analysis.sma20[analysis.sma20.length - 1] : null,
                        sma60: analysis.sma60.length ? analysis.sma60[analysis.sma60.length - 1] : null,
                        volRatio: analysis.volRatio,
                        level: chartLevel,
                        periodLabel,
                        hasNews: tickerNews.length > 0,
                      });
                      return (
                        <div style={{ padding: 16, borderRadius: 14, background: 'var(--bg-subtle)', border: '1px solid var(--border-light)', marginTop: 10, marginBottom: 24 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
                            이 차트, 지금 이런 상태예요
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.65 }}>
                            {narrative.summary}
                          </div>
                          <details style={{ marginTop: 10 }}>
                            <summary
                              onClick={() => logApiCall('chart_guide_expand')}
                              style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}
                            >
                              📖 차트 용어 쉽게 풀어보기
                            </summary>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                              {narrative.cards.map((c) => (
                                <div key={c.term} style={{ padding: 12, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border-light)' }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{c.emoji} {c.term}</div>
                                  <div style={{ fontSize: 12.5, color: 'var(--text-body)', lineHeight: 1.6, marginBottom: 4 }}>{c.whatIsIt}</div>
                                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{c.nowMeans}</div>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      );
                    })()}

                    {/* Technical indicators grid */}
                    <div className="flex items-center" style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, gap: 6, marginTop: 24 }}>
                      기술적 지표
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
                      {/* RSI */}
                      <div style={{ padding: 14, borderRadius: 12, background: '#F8F9FA', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#B0B8C1', marginBottom: 6 }}>RSI (14)</div>
                        <div style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: analysis.rsiVal != null && analysis.rsiVal < 30 ? '#3182F6' :
                                analysis.rsiVal != null && analysis.rsiVal > 70 ? '#EF4452' : '#191F28',
                        }}>
                          {analysis.rsiVal != null ? analysis.rsiVal.toFixed(1) : '--'}
                        </div>
                        <div style={{ fontSize: 11, color: '#8B95A1', marginTop: 4, lineHeight: 1.4 }}>
                          {analysis.rsiVal != null && analysis.rsiVal < 30 ? '30 아래\n과매도 구간' :
                           analysis.rsiVal != null && analysis.rsiVal > 70 ? '70 위\n과열 구간' : '30~70\n중간 구간'}
                        </div>
                      </div>

                      {/* MA 20 */}
                      <div style={{ padding: 14, borderRadius: 12, background: '#F8F9FA', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#B0B8C1', marginBottom: 6 }}>MA 20일</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#191F28' }}>
                          {analysis.sma20.length ? `$${analysis.sma20[analysis.sma20.length - 1].toFixed(2)}` : '--'}
                        </div>
                        <div style={{ fontSize: 11, color: '#8B95A1', marginTop: 4, lineHeight: 1.4 }}>
                          {analysis.sma20.length && price > analysis.sma20[analysis.sma20.length - 1]
                            ? '현재가가 20일\n평균보다 위'
                            : '현재가가 20일\n평균보다 아래'}
                        </div>
                      </div>

                      {/* MA 60 */}
                      <div style={{ padding: 14, borderRadius: 12, background: '#F8F9FA', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#B0B8C1', marginBottom: 6 }}>MA 60일</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#191F28' }}>
                          {analysis.sma60.length ? `$${analysis.sma60[analysis.sma60.length - 1].toFixed(2)}` : '--'}
                        </div>
                        <div style={{ fontSize: 11, color: '#8B95A1', marginTop: 4, lineHeight: 1.4 }}>
                          {analysis.sma60.length && price > analysis.sma60[analysis.sma60.length - 1]
                            ? '현재가가 60일\n평균보다 위'
                            : '현재가가 60일\n평균보다 아래'}
                        </div>
                      </div>
                    </div>

                    {/* Bollinger interpretation */}
                    {analysis.bollingerStatus && (
                      <div style={{ padding: '16px 20px', borderRadius: 14, background: '#F8F9FA', marginBottom: 12 }}>
                        <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#191F28' }}>볼린저 밴드</span>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'var(--bg-subtle)',
                            color: 'var(--text-secondary)',
                          }}>
                            {analysis.bollingerStatus.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: '#8B95A1', lineHeight: 1.6 }}>
                          {analysis.bollingerStatus.desc}
                          {analysis.lastBollinger && (
                            <>
                              <br />
                              상단: ${analysis.lastBollinger.upper.toFixed(2)} · 중단: ${analysis.lastBollinger.middle.toFixed(2)} · 하단: ${analysis.lastBollinger.lower.toFixed(2)}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* MACD interpretation */}
                    {analysis.macdStatus && (
                      <div style={{ padding: '16px 20px', borderRadius: 14, background: '#F8F9FA', marginBottom: 12 }}>
                        <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#191F28' }}>MACD</span>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'var(--bg-subtle)',
                            color: 'var(--text-secondary)',
                          }}>
                            {analysis.macdStatus.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: '#8B95A1', lineHeight: 1.6 }}>
                          {analysis.macdStatus.desc}
                          {analysis.macdResult.macd.length > 0 && (
                            <>
                              <br />
                              MACD: {analysis.macdResult.macd[analysis.macdResult.macd.length - 1].toFixed(2)} · Signal: {analysis.macdResult.signal.length ? analysis.macdResult.signal[analysis.macdResult.signal.length - 1].toFixed(2) : '--'} · Histogram: {analysis.macdResult.histogram.length ? analysis.macdResult.histogram[analysis.macdResult.histogram.length - 1].toFixed(2) : '--'}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Volume interpretation */}
                    <div style={{ padding: '16px 20px', borderRadius: 14, background: '#F8F9FA', marginBottom: 24 }}>
                      <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#191F28' }}>거래량</span>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: 'var(--bg-subtle)',
                          color: 'var(--text-secondary)',
                        }}>
                          {analysis.volRatio > 1.5 ? '활발' : analysis.volRatio < 0.5 ? '한산' : '평균 수준'}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#8B95A1', lineHeight: 1.6 }}>
                        최근 거래량은 20일 평균{analysis.volRatio > 1.5 ? '보다 많아요. 관심이 높은 상태예요.' : analysis.volRatio < 0.5 ? '보다 적어요. 관심이 낮은 상태예요.' : '과 비슷해요. 큰 매도 압력은 없는 상태예요.'}
                      </div>
                    </div>
                    </details>
                  </div>
                )}

                {!analysis && !loading && (
                  <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: '#FF9500', lineHeight: 1.6 }}>
                    {isThinData
                      ? '아직 상장 초기라 분석에 필요한 시세 데이터가 충분히 쌓이지 않았어요. 데이터가 더 쌓이면 분석이 정확해져요.'
                      : '차트 데이터가 부족해요. 잠시 후 다시 시도해주세요.'}
                  </div>
                )}

                {/* Investment P&L */}
                {stockData && stockData.avgCost > 0 && stockData.shares > 0 && price > 0 && (
                  <div style={{ padding: 20, borderRadius: 14, background: '#F8F9FA', marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#8B95A1', marginBottom: 12 }}>내 투자 현황</div>
                    {/* $/₩ 2컬럼 정렬 — 라벨 | 메인값(우정렬) | 괄호값(우정렬), grid 트랙 공유로 행 간 세로 정렬. tabular-nums. */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr max-content max-content', columnGap: 8, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 14, color: 'var(--text-secondary)', padding: '6px 0' }}>보유 수량</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', padding: '6px 0' }}>{stockData.shares}주</span>
                      <span style={{ padding: '6px 0' }} />

                      <span style={{ fontSize: 14, color: 'var(--text-secondary)', padding: '6px 0' }}>평균 매수가</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', padding: '6px 0' }}>
                        {currency === 'KRW'
                          ? formatKrw(avgCostAmounts.krw)
                          : formatUsd(avgCostAmounts.usd)}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', padding: '6px 0' }}>
                        {currency === 'KRW'
                          ? `(${formatUsd(avgCostAmounts.usd)})`
                          : `(${formatKrw(avgCostAmounts.krw)})`}
                      </span>

                      <span style={{ fontSize: 14, color: 'var(--text-secondary)', padding: '6px 0' }}>투자 원금</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', padding: '6px 0' }}>
                        {currency === 'KRW'
                          ? formatKrw(costAmounts.krw)
                          : formatUsd(costAmounts.usd)}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', padding: '6px 0' }}>
                        {currency === 'KRW'
                          ? `(${formatUsd(costAmounts.usd)})`
                          : `(${formatKrw(costAmounts.krw)})`}
                      </span>

                      <span style={{ fontSize: 14, color: 'var(--text-secondary)', padding: '6px 0' }}>평가 금액</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', padding: '6px 0' }}>
                        {currency === 'KRW'
                          ? formatKrw(valueAmounts.krw)
                          : formatUsd(valueAmounts.usd)}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', padding: '6px 0' }}>
                        {currency === 'KRW'
                          ? `(${formatUsd(valueAmounts.usd)})`
                          : `(${formatKrw(valueAmounts.krw)})`}
                      </span>

                      <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-light)', marginTop: 6 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', padding: '12px 0 6px' }}>수익</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: pnlIsGain ? '#EF4452' : '#3182F6', textAlign: 'right', fontVariantNumeric: 'tabular-nums', padding: '12px 0 6px' }}>
                        {`${pnlIsGain ? '+' : '-'}${currency === 'KRW'
                          ? formatKrw(Math.abs(displayPnl))
                          : formatUsd(Math.abs(displayPnl))}`}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 400, color: pnlIsGain ? '#EF4452' : '#3182F6', textAlign: 'right', fontVariantNumeric: 'tabular-nums', padding: '12px 0 6px' }}>
                        ({pnlIsGain ? '+' : ''}{displayPnlPct.toFixed(2)}%)
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#B0B8C1', marginTop: 8 }}>
                      {isKoreanStock
                        ? '💡 한국 종목의 원화 시세를 기준으로 계산했어요.'
                        : currency === 'KRW'
                          ? `💡 매입 원금은 ${stockData.purchaseRate ? '입력한 매수 환율' : '현재 환율'}, 평가액은 현재 환율 ${formatKrw(usdKrw, { short: false })}/$를 반영해요.`
                          : '💡 미국 종목의 달러 시세를 기준으로 계산했어요.'}
                    </div>
                  </div>
                )}

                {/* Related news */}
                <div id="anchor-news" style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, marginTop: 24, scrollMarginTop: 44 }}>
                  이 종목의 최근 소식
                </div>
                {tickerNews.length > 0 ? (
                  <div>
                    {tickerNews.map((item, idx) => {
                      const date = item.pubDate ? new Date(item.pubDate).toLocaleDateString('ko-KR') : '';
                      return (
                        <a
                          key={idx}
                          href={item.link} target="_blank" rel="noopener noreferrer"
                          className="cursor-pointer"
                          style={{
                            display: 'block', color: 'var(--text-primary)', textDecoration: 'none', padding: '16px 0',
                            borderBottom: idx < tickerNews.length - 1 ? '1px solid #F7F8FA' : 'none',
                          }}
                        >
                          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.65, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-body)' }}>
                            {item.source}{item.source && date ? ' · ' : ''}{date}
                          </div>
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: '#8B95A1' }}>
                    관련 뉴스가 없어요.
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => document.getElementById('anchor-learning')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  style={{ minHeight: 44, width: '100%', padding: 12, marginTop: 16, borderRadius: 12, border: '1px solid var(--border-light)', background: 'var(--bg-subtle)', color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}
                >뉴스를 읽었다면, 다른 개념도 살펴보기</button>

                {/* 재무 데이터 */}
                {fundamentals && (
                  <div id="anchor-fundamentals" style={{ marginTop: 24, marginBottom: 24, padding: 24, borderRadius: 24, background: 'var(--bg-subtle)', scrollMarginTop: 44 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
                      기업·가격 지표
                    </div>
                    {!hasFundamentalValues && <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-body)' }}>현재 제공된 기업 지표가 없어요. 관련 뉴스와 기업의 공시 자료를 함께 확인해 주세요.</p>}
                    <div className="fundamentals-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: 14 }}>
                      <style>{`@media (max-width: 400px) { .fundamentals-grid { grid-template-columns: 1fr !important; } }`}</style>
                      {fundamentals.per != null && (
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--text-secondary, #8B95A1)' }}>PER (주가수익비율)</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>{fundamentals.per.toFixed(1)}</span>
                        </div>
                      )}
                      {fundamentals.eps != null && (
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--text-secondary, #8B95A1)' }}>EPS (주당순이익)</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
                            {fmtNativePrice(fundamentals.eps, fundamentalsCurrency)}
                          </span>
                        </div>
                      )}
                      {fundamentals.marketCap != null && (
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--text-secondary, #8B95A1)' }}>시가총액</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
                            {fmtMarketCap(fundamentals.marketCap, fundamentalsCurrency)}
                          </span>
                        </div>
                      )}
                      {fundamentals.dividendYield != null && fundamentals.dividendYield > 0 && (
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--text-secondary, #8B95A1)' }}>배당수익률</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>{fundamentals.dividendYield.toFixed(2)}%</span>
                        </div>
                      )}
                      {fundamentals.week52High != null && (
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--text-secondary, #8B95A1)' }}>52주 최고</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
                            {fmtNativePrice(fundamentals.week52High, fundamentalsCurrency)}
                          </span>
                        </div>
                      )}
                      {fundamentals.week52Low != null && (
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--text-secondary, #8B95A1)' }}>52주 최저</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
                            {fmtNativePrice(fundamentals.week52Low, fundamentalsCurrency)}
                          </span>
                        </div>
                      )}
                      {fundamentals.sector && (
                        <div className="flex justify-between" style={{ gridColumn: 'span 2' }}>
                          <span style={{ color: 'var(--text-secondary, #8B95A1)' }}>섹터</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>{fundamentals.sector}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* AI 분석 리포트 버튼 */}
                <button
                  onClick={() => handleAIReportToggle()}
                  disabled={aiLoading || aiActionBlocked}
                  className="flex items-center justify-center transition-colors disabled:cursor-default"
                  style={{
                    width: '100%',
                    padding: 14,
                    // 레버리지: 회색 disabled(고장처럼)가 아니라 의도적 정책임을 앰버 톤으로
                    background: isLev ? 'rgba(245,158,11,0.10)' : aiLoading || aiActionBlocked ? 'var(--bg-subtle)' : 'var(--pill-active-bg)',
                    color: isLev ? '#B45309' : aiLoading || aiActionBlocked ? 'var(--text-secondary)' : 'var(--pill-active-fg)',
                    borderRadius: 12,
                    fontSize: isLev ? 13.5 : 15,
                    fontWeight: isLev ? 700 : 600,
                    border: isLev ? '1px solid rgba(245,158,11,0.25)' : 'none',
                    marginBottom: 24,
                    gap: 8,
                    flexWrap: 'wrap',
                    cursor: aiLoading || aiActionBlocked ? 'default' : 'pointer',
                  }}
                >
                  {isLev
                    ? <><ShieldAlert size={17} style={{ flexShrink: 0 }} aria-hidden="true" /><span className="reading-title">이 상품은 AI 분석을 제공하지 않아요</span></>
                    : <><Sparkles size={17} style={{ flexShrink: 0 }} aria-hidden="true" /><span className="reading-title">{aiLoading ? 'AI 분석 중...' : showAIReport ? 'AI 분석 닫기' : aiReport || hasCachedAnalysis ? '받은 AI 분석 보기' : quotaStatus === 'checking' ? '남은 횟수 확인 중' : aiRemaining === 0 ? '오늘 AI 분석을 모두 사용했어요' : '주비 AI에게 분석 요청하기'}</span></>}
                  {aiRemaining !== null && !showAIReport && !aiLoading && !isLev && (
                    <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 6 }}>({aiRemaining}회 남음)</span>
                  )}
                </button>
                {!isLev && (
                  <div className="reading-copy" style={{ marginTop: -14, marginBottom: 24, textAlign: 'center', fontSize: 12, lineHeight: 1.65, color: 'var(--text-body)' }}>
                    {aiRemaining === 0 && <span style={{ display: 'block', marginBottom: 6 }}>새 분석은 내일 0시(한국시간)에 다시 이용할 수 있어요.</span>}
                    AI에는 종목·공개 시세·지표·뉴스만 전송하며, 평단·수량·목표·메모는 보내지 않아요.
                  </div>
                )}

                {/* 단일종목 레버리지: AI 분석 '거부 + 일반 종목 유도' 카드 (디자인 패널 2026-06-01).
                    모달 X(이미 게이트 거침)·인라인 교체. 면허 아닌 '고위험·적합성' 사유, 방향·추천 0. */}
                {showAIReport && isLev && (
                  <div style={{ borderRadius: 16, padding: '18px 20px', marginBottom: 24, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', wordBreak: 'keep-all' }}>
                    <div style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 8, background: 'rgba(245,158,11,0.14)', color: '#B45309', fontSize: 11, fontWeight: 700, letterSpacing: 0.2, marginBottom: 10 }}>
                      고위험 · AI 분석 제외
                    </div>
                    <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
                      <ShieldAlert size={18} aria-hidden="true" color="#B45309" />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#B45309' }}>이 종목은 AI 분석을 제공하지 않아요</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.7 }}>
                      {LEVERAGE_ANALYSIS_REFUSAL}
                    </div>
                    <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-subtle, #F2F4F6)', fontSize: 12.5, color: 'var(--text-secondary, #4E5968)' }}>
                      보유 현황·수익률·차트·가격 알림은 그대로 관리돼요.
                    </div>
                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(245,158,11,0.18)' }}>
                      <div style={{ fontSize: 12.5, color: 'var(--text-tertiary, #8B95A1)', marginBottom: 8 }}>
                        레버리지가 아닌 일반 종목은 주비 AI 멘토 분석을 받을 수 있어요.
                      </div>
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent('open-search'))}
                        style={{ width: '100%', padding: '11px 16px', background: '#fff', border: '1px solid rgba(245,158,11,0.4)', color: '#B45309', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                      >
                        다른 종목 검색해서 분석받기 ›
                      </button>
                    </div>
                  </div>
                )}

                {/* AI Analysis Report — Gemini API (일반 종목) */}
                {showAIReport && !isLev && (
                  <div style={{ borderRadius: 16, padding: 28, marginBottom: 24, background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                    <div className="flex items-center" style={{ gap: 8, marginBottom: 16 }}>
                      <BarChart3 size={18} aria-hidden="true" />
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>주비 AI 분석</span>
                      <span style={{ fontSize: 12, color: '#B0B8C1', marginLeft: 'auto' }}>
                        {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' })} 기준
                      </span>
                    </div>

                    {aiLoading && <AIProgressIndicator />}

                    {aiError && (
                      <div role="alert" style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: 'var(--text-body)', lineHeight: 1.6 }}>
                        {aiErrorAction === 'daily' && (aiRemaining ?? 0) > 0 ? '새 분석을 요청할 수 있어요.' : aiError}
                        {aiErrorAction === 'login' ? (
                          <div style={{ marginTop: 10 }}>
                            <button
                              onClick={() => window.dispatchEvent(new CustomEvent('open-login'))}
                              style={{ padding: '8px 18px', borderRadius: 8, background: 'var(--pill-active-bg)', color: 'var(--pill-active-fg)', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                            >
                              로그인하기
                            </button>
                          </div>
                        ) : aiErrorAction !== 'unavailable' && (aiErrorAction !== 'daily' || aiRemaining !== 0) ? (
                          <div style={{ marginTop: 8 }}>
                            <button type="button" className={assistantStyles.action} disabled={quotaStatus === 'checking' || aiRemaining === 0}
                              onClick={() => handleAIReportToggle(true)}>{quotaStatus === 'checking' ? '횟수 확인 중' : '다시 요청하기'}</button>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {aiReport && (
                      <>
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#8B95A1', marginBottom: 8 }}>현재 상태</div>
                          <div style={{ fontSize: 14, color: '#191F28', lineHeight: 1.7 }}>{aiReport.currentStatus}</div>
                        </div>
                        {aiReport.indicators?.length > 0 && (
                          <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#8B95A1', marginBottom: 10 }}>주요 지표</div>
                            <div className="flex flex-col" style={{ gap: 8 }}>
                              {aiReport.indicators.map((ind, idx) => (
                                <div key={idx} style={{ padding: '12px 14px', background: '#fff', borderRadius: 10 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: '#8B95A1', marginBottom: 4 }}>{ind.name}</div>
                                  <div style={{ fontSize: 13, color: ind.signal === 'positive' ? '#EF4452' : ind.signal === 'negative' ? '#3182F6' : '#4E5968', lineHeight: 1.6 }}>{ind.value}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {aiReport.historicalNote && (
                          <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#8B95A1', marginBottom: 8 }}>과거 유사 상황</div>
                            <div style={{ fontSize: 14, color: '#191F28', lineHeight: 1.7 }}>{aiReport.historicalNote}</div>
                          </div>
                        )}
                        {aiReport.newsAnalysis && aiReport.newsAnalysis.length > 0 ? (
                          <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#8B95A1', marginBottom: 10 }}>뉴스 기반 분석</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {aiReport.newsAnalysis.map((item, i) => (
                                <div key={i} style={{ background: 'var(--bg-subtle, #F8F9FA)', borderRadius: 10, padding: '10px 14px' }}>
                                  <div style={{ fontSize: 12, color: '#8B95A1', marginBottom: 4, lineHeight: 1.5 }}>{item.headline}</div>
                                  <div style={{ fontSize: 13, color: '#191F28', lineHeight: 1.6 }}>→ {item.impact}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : aiReport.newsContext ? (
                          <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#8B95A1', marginBottom: 8 }}>뉴스 영향</div>
                            <div style={{ fontSize: 14, color: '#191F28', lineHeight: 1.7 }}>{aiReport.newsContext}</div>
                          </div>
                        ) : null}
                        {aiReport.scenarios && (
                          <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#8B95A1', marginBottom: 8 }}>이런 상황이 올 수 있어요</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ background: '#EDFCF2', borderRadius: 10, padding: '12px 14px' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', marginBottom: 4 }}>상승한다면</div>
                                <div style={{ fontSize: 13, color: '#191F28', lineHeight: 1.6 }}>{aiReport.scenarios.bull}</div>
                              </div>
                              <div style={{ background: '#FFF0F0', borderRadius: 10, padding: '12px 14px' }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#EF4452', marginBottom: 4 }}>하락한다면</div>
                                <div style={{ fontSize: 13, color: '#191F28', lineHeight: 1.6 }}>{aiReport.scenarios.bear}</div>
                              </div>
                            </div>
                          </div>
                        )}
                        {aiReport.conclusion && (
                          <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                            <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#191F28' }}>정보 정리</span>
                              <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'var(--bg-subtle, #F2F4F6)', color: 'var(--text-secondary, #4E5968)' }}>
                                {aiReport.conclusion.label}
                              </span>
                            </div>
                            <div style={{ fontSize: 14, color: '#4E5968', lineHeight: 1.7 }}>{aiReport.conclusion.desc}</div>
                          </div>
                        )}
                        <AiResultMeta meta={aiReport._meta} source="ai-analysis" symbol={symbol} />
                      </>
                    )}

                    {!aiLoading && !aiReport && !aiError && (
                      <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: '#8B95A1' }}>
                        AI 분석을 준비 중이에요...
                      </div>
                    )}

                    <Disclaimer />
                  </div>
                )}

                {!isLev && (
                  <div id="anchor-assistant" className={assistantStyles.section}>
                    <div className={assistantStyles.overview}>
                      <StockCheckup checkup={buildStockCheckup({
                        price, candles: rawCandles[symbol], fundamentals, currency: nativeCurrency,
                      })} />
                      <div className={assistantStyles.questions}>
                        <StockAnalysisQuestions key={symbol} selectedId={selectedMentor?.id ?? null}
                          loading={mentorLoading} onSelect={handleMentorSelect} remaining={aiRemaining}
                          quotaStatus={quotaStatus} cachedQuestionIds={cachedQuestionIds}
                          answer={selectedMentor ? (
                            <section id="stock-assistant-answer" aria-labelledby="stock-assistant-answer-title"
                              className={assistantStyles.answer}>
                              <div className={assistantStyles.answerHeader}>
                                <h4 id="stock-assistant-answer-title" className={assistantStyles.answerTitle}>주비의 답변 · {displayName}</h4>
                                <button type="button" className={assistantStyles.close} onClick={closeMentorAnswer}
                                  aria-label={mentorLoading ? '답변 요청 취소' : '답변 닫기'}><X size={18} aria-hidden="true" /></button>
                              </div>
                              {mentorLoading && <StockAnswerLoading onCancel={closeMentorAnswer}
                                stockName={displayName} phase={mentorLoadingPhase} facts={mentorLoadingFacts} />}
                              {mentorReport && <>
                                {mentorCachedAt && <p className={assistantStyles.pending}>
                                  {new Date(mentorCachedAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}에 받은 답변이에요. 최신 자료와 다를 수 있어요.
                                </p>}
                                <p>{mentorReport.currentStatus}</p>
                                {!!mentorReport.keyAdvice?.length && <ol className={assistantStyles.advice}>
                                  {mentorReport.keyAdvice.map((advice, index) => <li key={index}>
                                    <span className={assistantStyles.number} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                                    <span>{advice}</span>
                                  </li>)}
                                </ol>}
                                {mentorReport.conclusion && <div className={assistantStyles.conclusion}>
                                  <h5>이어서 확인할 내용</h5>
                                  <p>{mentorReport.conclusion.desc}</p>
                                </div>}
                                <p className={assistantStyles.note}>공개정보를 바탕으로 AI가 작성한 설명이에요. 중요한 수치는 원문과 함께 확인해주세요.</p>
                                <AiResultMeta key={`${symbol}-${selectedMentor.id}`} meta={mentorReport._meta} source="ai-analysis" symbol={symbol} />
                              </>}
                              {!mentorLoading && mentorError && <>
                                <p role="alert">{mentorErrorAction === 'daily' && (aiRemaining ?? 0) > 0 ? '새 답변을 요청할 수 있어요.' : mentorError}</p>
                                {mentorErrorAction === 'login' ? <button type="button" className={assistantStyles.action}
                                  onClick={() => window.dispatchEvent(new CustomEvent('open-login'))}>로그인하고 질문하기</button>
                                  : mentorErrorAction !== 'unavailable' && (mentorErrorAction !== 'daily' || aiRemaining !== 0) ? <button type="button" className={assistantStyles.action}
                                    disabled={quotaStatus === 'checking' || aiRemaining === 0}
                                    onClick={() => handleMentorSelect(selectedMentor.id, true)}>{quotaStatus === 'checking' ? '횟수 확인 중' : '다시 요청하기'}</button> : null}
                              </>}
                            </section>
                          ) : null} />
                      </div>
                    </div>
                  </div>
                )}

                {/* 가격 확인 → 개념 학습 → 차트·뉴스·기록 탐색 */}
                <div id="anchor-learning" style={{ scrollMarginTop: 56 }}>
                  <StockLearning
                    key={symbol}
                    name={displayName}
                    onChart={analysis && !isLev ? (days) => {
                      setChartRange(days);
                      document.getElementById('anchor-chart')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } : undefined}
                    onNews={() => document.getElementById('anchor-news')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    onNotes={stockData ? () => {
                      const notes = document.getElementById('anchor-notes');
                      notes?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      notes?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
                    } : undefined}
                  />
                </div>

                {analysis && !isLev && (
                  <details className={assistantStyles.technical}>
                    <summary>가격 흐름을 더 자세히 보기</summary>
                    <h4>{analysis.chartShape.title}</h4>
                    <p>{analysis.chartShape.desc}</p>
                    {analysis.rsiVal != null && <p>최근 상승·하락 폭을 비교하는 RSI는 {analysis.rsiVal.toFixed(0)}이에요. 회사의 가치나 앞으로의 수익을 나타내는 점수는 아니에요.</p>}
                  </details>
                )}

                {/* === Below here: always visible regardless of analysis data === */}

                {/* Goal progress bar */}
                {stockData && stockData.targetReturn > 0 && stockData.avgCost > 0 && price > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#8B95A1' }}>목표 수익률 달성</span>
                      {(() => {
                        const pct = ((price - stockData.avgCost) / stockData.avgCost) * 100;
                        return (
                          <span style={{ fontSize: 14, fontWeight: 700, color: pct >= 0 ? '#EF4452' : '#3182F6' }}>
                            {pct.toFixed(1)}% / {stockData.targetReturn}%
                          </span>
                        );
                      })()}
                    </div>
                    <div style={{ width: '100%', height: 10, borderRadius: 5, background: '#ECEEF0', overflow: 'hidden' }}>
                      {(() => {
                        const pct = ((price - stockData.avgCost) / stockData.avgCost) * 100;
                        const fill = Math.min(Math.max(pct / stockData.targetReturn * 100, 0), 100);
                        return (
                          <div
                            style={{
                              height: '100%',
                              borderRadius: 5,
                              background: pct >= 0 ? '#EF4452' : '#3182F6',
                              width: `${fill}%`,
                            }}
                          />
                        );
                      })()}
                    </div>
                    <div className="flex justify-between" style={{ marginTop: 6, fontSize: 11, color: '#B0B8C1' }}>
                      <span>0%</span>
                      <span>목표 {stockData.targetReturn}%</span>
                    </div>
                  </div>
                )}

                {/* Buy history */}
                {stockData && stockData.avgCost > 0 && stockData.shares > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <div className="flex items-center" style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, gap: 6 }}>
                      매수 이력
                    </div>
                    <div>
                      <div className="flex items-center" style={{ gap: 12, padding: '10px 14px', borderRadius: 10, background: '#F8F9FA' }}>
                        <span style={{ fontSize: 12, color: '#B0B8C1', minWidth: 80 }}>매수</span>
                        <span style={{ fontSize: 13, color: '#191F28', flex: 1 }}>{stockData.shares}주</span>
                        <span style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                          {currency === 'KRW'
                            ? formatKrw(avgCostAmounts.krw)
                            : formatUsd(avgCostAmounts.usd)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Buy Simulator — 9인 패널 결정 반영: market/priceCurrency 분리 */}
                {symbol && price > 0 && (() => {
                  const market: 'KR' | 'US' = isKoreanStock ? 'KR' : 'US';
                  const priceCurrency: 'KRW' | 'USD' = nativeCurrency;
                  // 포트폴리오 평가액을 priceCurrency 단위로 통일 (혼합 보유 종목 환산)
                  const totalPortfolioValue = (() => {
                    const state = usePortfolioStore.getState();
                    let tv = 0;
                    (state.stocks.investing || []).forEach(s => {
                      const q = state.macroData[s.symbol] as QuoteData | undefined;
                      if (!q?.c || !s.shares) return;
                      const amounts = convertStockAmount(
                        s.symbol,
                        q.c * s.shares,
                        usdKrw,
                        s.currency,
                      );
                      tv += priceCurrency === 'KRW' ? amounts.krw : amounts.usd;
                    });
                    return tv;
                  })();
                  // 단일종목 레버리지: 추가매수 시뮬(물타기 평단)은 매수 방향 유인 → 미노출 (§6).
                  if (isLev) return null;
                  return (
                    <div style={{ marginBottom: 24 }}>
                      <BuySimulator
                        symbol={symbol}
                        market={market}
                        currentPrice={price}
                        priceCurrency={priceCurrency}
                        avgCost={stockData?.avgCost || 0}
                        shares={stockData?.shares || 0}
                        totalPortfolioValue={totalPortfolioValue}
                        usdKrw={usdKrw}
                        currency={currency}
                      />
                    </div>
                  );
                })()}

                {/* Investment Notes */}
                {symbol && stockData && (() => {
                  // Find the stock's category and index for notes
                  const state = usePortfolioStore.getState();
                  for (const cat of ['investing', 'watching', 'sold'] as const) {
                    const idx = (state.stocks[cat] || []).findIndex(s => s.symbol === symbol);
                    if (idx >= 0) {
                      const stock = state.stocks[cat][idx];
                      return (
                        <div id="anchor-notes" style={{ scrollMarginTop: 56 }}>
                          <InvestmentNotes
                            symbol={symbol}
                            category={cat}
                            stockIdx={idx}
                            notes={stock.notes || []}
                          />
                        </div>
                      );
                    }
                  }
                  return null;
                })()}

                {/* Disclaimer */}
                <div style={{ fontSize: 11, color: '#B0B8C1', textAlign: 'center', padding: '16px 0', borderTop: '1px solid var(--border-light, #F2F4F6)', marginTop: 16 }}>
                  AI가 생성한 참고 자료이며, 투자 자문이 아니에요. 투자 판단의 책임은 이용자에게 있어요.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
