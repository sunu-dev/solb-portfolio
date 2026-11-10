'use client';

import { useEffect, useEffectEvent, useState, useMemo, useCallback, useRef, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';
import dynamic from 'next/dynamic';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { lockBodyScroll } from '@/lib/bodyScrollLock';
import ShortPriceHistory from './ShortPriceHistory';
import StockDetailIntroduction from './StockDetailIntroduction';
import { useCandleData } from '@/hooks/useStockData';
import { fetchCompanyNews } from '@/lib/newsFeed';
import { useAnalysisQuota } from '@/hooks/useAnalysisQuota';
import { useNow } from '@/hooks/useNow';
import { useStockContext } from '@/hooks/useStockContext';
import { matchesStockContext } from '@/lib/stockContextPacket';
import {
  calcSMA, calcRSI, calcBollingerBands, calcMACD,
  detectTrend, detectCross, detectPattern, generateSummary,
  getBollingerStatus, getMACDStatus, getChartShapeSummary, generateAIReport,
} from '@/utils/technical';
import { buildChartNarrative } from '@/utils/chartNarrative';
import { STOCK_KR } from '@/config/constants';
import { quoteDirection, quoteTimestamp } from '@/utils/quotePresentation';
import type { AIReport, StockItem, QuoteData, NewsItem } from '@/config/constants';
import { BarChart3, ChevronLeft, ChevronRight, Maximize2, Minimize2, ShieldAlert, Sparkles, X } from 'lucide-react';
import { logApiCall } from '@/lib/apiLogger';
import { logFeatureFirstUse } from '@/lib/tourTelemetry';
import { supabase } from '@/lib/supabase';
import { MENTORS } from '@/config/mentors';
import Disclaimer from '@/components/common/Disclaimer';
import { STOCK_QUESTIONS, stockQuestion, discoveryTags, lessonForQuestion, type StockQuestion } from '@/config/stockQuestions';
import { evidenceRevision, publicQuestionNews, recentDiscoveryNews } from '@/lib/stockDiscovery';
import { selectReadingAnchor, restoredAnchorTop, type ReadingAnchor } from '@/lib/readingPosition';
import { newsKey } from '@/lib/stockDiscovery';
import StockReturnBrief from './StockReturnBrief';
import StockDailyBrief from './StockDailyBrief';
import StockCompanyOverview from './StockCompanyOverview';
import { companyDisplayName } from '@/lib/companyBusinessProfile';
import StockDetailResources from './StockDetailResources';
import StockVisitSummary from './StockVisitSummary';
import CompanyMark from '../common/CompanyMark';
import { usageEvent } from '@/lib/usageTelemetry';
import { STOCK_LESSONS } from '@/config/stockLearning';
import { buildStockCheckup, getStockVolumeRatio } from '@/utils/stockCheckup';
import { buildAnalysisLoadingFacts, type AnalysisLoadingFact } from '@/utils/analysisLoadingFacts';
import { ANALYSIS_DAILY_LIMIT_MESSAGE, getAnalysisRemaining } from '@/utils/analysisQuota';
import StockCheckup from './StockCheckup';
import StockAnalysisQuestions, { getStockAnalysisAnswerTitle } from './StockAnalysisQuestions';
import JoobiAssistantLauncher from '@/components/learning/JoobiAssistantLauncher';
import IntradayStockChart from './IntradayStockChart';
import ContextExploration, { type ExplorationReadingState } from '@/components/explore/ContextExploration';
import { explorationCompany, stockExploration } from '@/lib/contextExploration';
import StockAnswerLoading from './StockAnswerLoading';
import assistantStyles from './StockAssistant.module.css';
import panelStyles from './AnalysisPanel.module.css';
import StockLearning, { type LearningReadingState } from './StockLearning';
import FundExploration, { type FundReadingState } from '@/components/explore/FundExploration';
import AnalysisNavigation from './AnalysisNavigation';
import { fundProfile, fundQuestions, type FundQuestionId } from '@/lib/fundExploration';
import { isSingleStockLeverage, LEVERAGE_ANALYSIS_REFUSAL } from '@/utils/leverageGuard';
import AiResultMeta from '@/components/common/AiResultMeta';
import type { AiResultMeta as AiResultMetaValue } from '@/lib/aiResultMeta';
import {
  convertStockAmount,
  convertStockCostAmount,
  getStockCurrency,
  isKoreanStockSymbol,
} from '@/utils/stockCurrency';

function AIProgressIndicator() {
  return <div role="status" aria-live="polite" style={{ padding: '28px 0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)', fontSize: 15, fontWeight: 600 }}>
      <Sparkles size={18} aria-hidden="true" /> 주비가 분석을 정리하고 있어요
    </div>
    <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, color: 'var(--text-body)' }}>
      확인한 시세와 뉴스를 바탕으로 설명을 준비하고 있어요. 잠시만 기다려주세요.
    </p>
  </div>;
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

interface CompanyProfile {
  business?: import('@/lib/companyBusinessProfile').CompanyBusinessProfile;
  classification?: import('@/lib/industryRegistry').StoredIndustryProfile;
  sector?: string | null;
  industry?: string | null;
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

const WIDE_MODE_KEY = 'solb_analysis_wide';
const WIDE_MODE_EVENT = 'joobi-analysis-width';
let unavailableStorageWideMode = false;
function subscribeWideMode(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener(WIDE_MODE_EVENT, listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener(WIDE_MODE_EVENT, listener);
  };
}
function readWideMode() {
  try { return localStorage.getItem(WIDE_MODE_KEY) === '1'; } catch { return unavailableStorageWideMode; }
}
const serverWideMode = () => false;

type ChartLevel = 'basic' | 'detail';

import { formatKrw, formatUsd, resolveUsdKrwState } from '@/utils/koreanNumber';

function fmtNativePrice(val: number, nativeCurrency: 'KRW' | 'USD'): string {
  return nativeCurrency === 'KRW'
    ? formatKrw(val)
    : formatUsd(val);
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
    const r = await fetch(`/api/kr-quote?symbol=${encodeURIComponent(symbol)}`, {signal:AbortSignal.timeout(12000)});
    return await r.json();
  }
  const r = await fetch('/api/quotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols: [symbol] }),
    signal: AbortSignal.timeout(12000),
  });
  const json = await r.json();
  return json?.quotes?.[symbol] ?? null;
}

interface InlineReadingEntry {
  symbol: string;
  id: string;
  originId: string;
  returnLabel: string;
  returnTop: number;
  sequence: number;
  reading?: LearningReadingState;
  fundReading?: FundReadingState;
  answerSnapshot?: { question: StockQuestion; report: MentorReport; cachedAt: number | null };
}

export default function AnalysisPanel({ owner = 'guest' }: { owner?: string }) {
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

  const { fetchCandle, candleStatus } = useCandleData(analysisSymbol);
  const [learningEntries, setLearningEntries] = useState<Record<string, InlineReadingEntry>>({});
  const [libraryReadings, setLibraryReadings] = useState<Record<string, LearningReadingState>>({});
  const [tickerNews, setTickerNews] = useState<NewsItem[]>([]);
  const [newsState,setNewsState]=useState<{symbol:string;status:'ok'|'empty'|'error'}|null>(null);
  const [newsRequest,setNewsRequest]=useState(0);
  const [loading, setLoading] = useState(true);
  const [chartLevel, setChartLevel] = useState<ChartLevel>('basic');
  const [chartRange, setChartRange] = useState<number>(1); // 1 = latest intraday session; other values = daily bars
  const [showAIReport, setShowAIReport] = useState(false);
  const [aiReport, setAiReport] = useState<AnalysisReport | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiErrorAction, setAiErrorAction] = useState<'login' | 'daily' | 'unavailable' | 'retry'>('retry');
  const aiRequestRef = useRef<AbortController | null>(null);
  const [selectedMentor, setSelectedMentor] = useState<StockQuestion | null>(null);
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
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [companyProfileRequest, setCompanyProfileRequest] = useState(0);
  const wideMode = useSyncExternalStore(subscribeWideMode, readWideMode, serverWideMode);

  const symbol = analysisSymbol;
  const contextPackets = useStockContext(symbol ?? '');
  const readingKey = `${owner}:${symbol}`;
  const learningEntry = learningEntries[readingKey];
  const kr = symbol ? (STOCK_KR[symbol] || symbol) : '';
  const [activeReadingKey, setActiveReadingKey] = useState(readingKey);
  // Reset before a changed company/account is painted, keeping each company's saved reader.
  if (activeReadingKey !== readingKey) {
    setActiveReadingKey(readingKey);
    setLoading(true);
    setShowAIReport(false); setAiReport(null); setAiLoading(false); setAiError('');
    const saved = learningEntries[readingKey]?.answerSnapshot;
    setSelectedMentor(saved?.question ?? null);
    setMentorReport(saved?.report ?? null);
    setMentorCachedAt(saved?.cachedAt ?? null);
    setMentorLoading(false); setMentorError('');
    setChartLevel('basic'); setChartRange(1); setCompanyProfile(null); setTickerNews([]); setNewsState(null);
  }
  const fetchCurrentCandles = useEffectEvent(() => fetchCandle());

  // 패널 열릴 때 해당 종목 최신 시세 즉시 fetch
  useEffect(() => {
    if (!symbol) return;
    let active = true;

    const fetchFreshQuote = async () => {
      try {
        const d = await fetchQuoteViaServer(symbol);
        if (d?.c) {
          usePortfolioStore.getState().updateMacroEntry(symbol, d);
        }
      } catch { /* fallback to cached */ }
    };

    Promise.allSettled([fetchCurrentCandles(), fetchFreshQuote()]).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [symbol, owner]);

  useEffect(() => {
    if (!symbol) return;
    let active = true;
    const controller = new AbortController();
    const fetchCompanyProfile = async () => {
      try {
        const r = await fetch(`/api/company-profile?symbol=${encodeURIComponent(symbol)}`, {signal:AbortSignal.any([controller.signal, AbortSignal.timeout(5000)])});
        const d = await r.json();
        if (!r.ok || !d?.data?.business) throw new Error('profile_unavailable');
        if (active) setCompanyProfile(d.data);
      } catch {
        if (active) setCompanyProfile({ business: { symbol, level: 'missing', sources: [], origin: 'engine', availability: 'unavailable' } });
      }
    };

    void fetchCompanyProfile();
    return () => { active = false; controller.abort(); };
  }, [symbol, owner, companyProfileRequest]);

  useEffect(() => {
    if (!symbol) return;
    let active = true;
    fetchCompanyNews(symbol, undefined, newsRequest > 0).then(result => {
      if (active) { setTickerNews(result.items.slice(0, 5)); setNewsState({symbol,status:result.status}); }
    });
    return () => { active = false; };
  }, [symbol, owner, newsRequest]);

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
  const displayName = symbol ? companyDisplayName(symbol, [stockData?.name, explorationCompany(symbol)?.name, kr, companyProfile?.classification?.name]) : '';
  const isLev = isSingleStockLeverage(symbol || '', displayName);
  const isFund = isLev || !!fundProfile(symbol || '') || companyProfile?.classification?.status === 'etp';

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
  const readingPositions = useRef(new Map<string, { top: number; range: number; kind: "company" | "position"; anchor?: ReadingAnchor }>());
  const [readingVisits, setReadingVisits] = useState(() => new Map<string, { reading: ExplorationReadingState; companyOffset: number }>());
  const [companyExplorations, setCompanyExplorations] = useState<Record<string, { open?: boolean; reading?: ExplorationReadingState }>>({});

  const restoredReadingKey = useRef<string | null>(null);
  const markReadingHandled = useCallback(() => { restoredReadingKey.current = readingKey; }, [readingKey]);
  useEffect(() => { restoredReadingKey.current = null; }, [symbol, owner]);
  useEffect(() => {
    if (!symbol || loading || restoredReadingKey.current === readingKey) return;
    // News and its inline reader mount independently of the chart request.
    if (newsState?.symbol !== symbol) return;
    const body = analysisBodyRef.current;
    if (!body) return;
    const position = readingPositions.current.get(readingKey);
    // Initial focus is handled by the dialog. Finishing a quote request must not
    // reset a first-time reader's scroll position or steal their current focus.
    if (!position) { restoredReadingKey.current = readingKey; return; }
    const visit = position?.kind === 'company' ? readingVisits.get(readingKey) : undefined;
    if (position) setChartRange(position.range);
    let frame = 0;
    const restore = () => {
      if (restoredReadingKey.current === readingKey) return;
      const reader = learningEntry ? body.querySelector<HTMLElement>(`[data-inline-origin="${CSS.escape(learningEntry.originId)}"]`) : null;
      const originMissing = learningEntry?.originId.startsWith('news-') && !tickerNews.some(item => `news-${newsKey(item)}` === learningEntry.originId);
      if (learningEntry && !reader && !originMissing) return;
      cancelAnimationFrame(frame);
      // Let the restored chart period commit before measuring the reading anchor.
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => {
        const companyIntro = body.querySelector<HTMLElement>('[data-company-exploration-anchor]');
        const anchor = position?.anchor ? body.querySelector<HTMLElement>(position.anchor.selector) : null;
        body.scrollTop = visit && companyIntro
          ? body.scrollTop + companyIntro.getBoundingClientRect().top - body.getBoundingClientRect().top - visit.companyOffset
          : anchor && position?.anchor
            ? restoredAnchorTop(body.scrollTop, anchor.getBoundingClientRect().top - body.getBoundingClientRect().top, position.anchor.offset)
            : position?.top ?? 0;
        const anchorHeading = anchor?.matches('h2,h3') ? anchor : anchor?.querySelector<HTMLElement>('h2,h3');
        const target = anchorHeading ?? reader?.querySelector<HTMLElement>('h3') ?? (visit ? body.querySelector<HTMLElement>('[data-company-exploration-anchor] h3') : dialogRef.current?.querySelector<HTMLElement>('[data-dialog-initial-focus]'));
        if (target && !target.hasAttribute('tabindex')) target.tabIndex = -1;
        target?.focus({ preventScroll: true });
        restoredReadingKey.current = readingKey;
      }); });
    };
    const observer = new MutationObserver(restore);
    observer.observe(body, { childList: true, subtree: true });
    restore();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [symbol, loading, readingVisits, owner, readingKey, newsState, learningEntry, tickerNews]);

  const close = useCallback(() => {
    setAnalysisSymbol(null);
    document.body.style.overflow = '';
  }, [setAnalysisSymbol]);

  useEffect(() => {
    if (symbol) return lockBodyScroll();
  }, [symbol]);

  // 모달 접근성 — ESC 닫기 + 포커스 트랩 + 복원 (거짓 aria-modal 해소)
  useFocusTrap(!!symbol, dialogRef, close);

  // Cancel the previous company/account's requests without resetting unrelated reader state.
  useEffect(() => () => {
    mentorRequestRef.current?.abort();
    mentorRequestRef.current = null;
    aiRequestRef.current?.abort();
    aiRequestRef.current = null;
  }, [symbol, owner]);

  if (!symbol) return null;

  const quote = macroData[symbol] as QuoteData | undefined;
  // 보유/관심이 아닌 '검색 살펴보기' 종목은 macroData에 없을 수 있어 최신 캔들 종가로 폴백
  const price = quote?.c || rawCandles[symbol]?.c?.at(-1) || 0;
  const change = quote?.d || 0;
  const cp = quote?.dp || 0;
  const nativeCurrency = getStockCurrency(symbol, stockData?.currency);
  const isKoreanStock = nativeCurrency === 'KRW';
  const profileCurrency = companyProfile?.currency || nativeCurrency;
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
    requestAnimationFrame(()=>{
      const question=dialogRef.current?.querySelector<HTMLButtonElement>(`[data-question-id="${selectedMentor?.id}"]`);
      if(question?.getClientRects().length)question.focus();
      else dialogRef.current?.querySelector<HTMLButtonElement>('[data-question-more]')?.focus();
    });
  };

  const handleMentorSelect = async (id: string, retry = false) => {
    const question = stockQuestion(id);
    const mentor = MENTORS.find(item => item.id === question?.mentor);
    if (!question || !mentor || mentorRequestRef.current) return;
    if (selectedMentor?.id === id && !retry) { closeMentorAnswer(); return; }
    const cacheKey = `${owner}-${symbol}-${id}-${questionRevision}`;
    const cached = mentorReportCache[cacheKey];
    if (quotaStatus === 'checking' && (retry || !cached)) return;
    setSelectedMentor(question);
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
      const [{ data: { session } }, { buildTimeSeriesContext }, refreshedQuote, requestedNews] = await Promise.all([
        supabase.auth.getSession(), import('@/utils/timeSeries'),
        Number.isFinite(price) && price > 0 ? Promise.resolve(null) : fetchQuoteViaServer(symbol),
        newsState?.symbol===symbol && newsState.status!=='error' ? Promise.resolve(null) : fetchCompanyNews(symbol, displayName),
      ]);
      if (!isCurrent()) return;
      const requestPrice = Number.isFinite(price) && price > 0 ? price : refreshedQuote?.c;
      if (!requestPrice || !Number.isFinite(requestPrice) || requestPrice <= 0) {
        setMentorError('가격 자료를 확인하지 못했어요. 잠시 후 다시 요청하면 시세부터 확인할게요.');
        return;
      }
      const requestNews = requestedNews?.status==='ok' ? requestedNews.items.slice(0,5) : tickerNews;
      if(requestedNews){setTickerNews(requestNews);setNewsState({symbol,status:requestedNews.status});}
      const requestRevision=evidenceRevision(requestNews,(quote?.t??refreshedQuote?.t)?(quote?.t??refreshedQuote!.t!)*1000:undefined,requestPrice);
      const responseCacheKey=`${owner}-${symbol}-${id}-${requestRevision}`;
      if (refreshedQuote?.c) usePortfolioStore.getState().updateMacroEntry(symbol, refreshedQuote);
      const requestVolumeRatio = getStockVolumeRatio(rawCandles[symbol]);
      setMentorLoadingFacts(buildAnalysisLoadingFacts({
        price: requestPrice, currency: profileCurrency, volRatio: requestVolumeRatio,
      }));
      setMentorLoadingPhase('waiting');
      const response = await fetch('/api/ai-analysis', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          symbol, koreanName: displayName, currency: profileCurrency,
          price: requestPrice, change: quote?.c ? quote.d : refreshedQuote?.d,
          changePercent: quote?.c ? quote.dp : refreshedQuote?.dp,
          rsi: analysis?.rsiVal?.toFixed(0), trend: analysis?.trend,
          cross: analysis?.cross, pattern: analysis?.pattern?.name,
          bollingerStatus: analysis?.bollingerStatus?.status,
          macdStatus: analysis?.macdStatus?.status,
          volRatio: requestVolumeRatio,
          mentorId: mentor.id, questionId: question.id, recentNews: publicQuestionNews(requestNews),
          sector: companyProfile?.sector,
          timeSeriesContext: buildTimeSeriesContext(rawCandles[symbol], nativeCurrency),
        }),
      });
      const data = await response.json();
      if (!isCurrent()) return;
      const quota = acceptQuotaResponse(data, session?.user.id ?? null);
      if (response.ok && data.success && data.report) {
        setMentorReport(data.report);
        setMentorCachedAt(Date.now());
        mentorReportCache[responseCacheKey] = { report: data.report, timestamp: Date.now() };
        Object.entries(mentorReportCache).sort((a,b)=>b[1].timestamp-a[1].timestamp).slice(100).forEach(([key])=>delete mentorReportCache[key]);
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
      const freshNewsResult = await fetchCompanyNews(symbol, displayName, true);
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
          currency: profileCurrency,
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
          sector: companyProfile?.sector,
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
  const questionRevision = evidenceRevision(tickerNews,quote?.t ? quote.t*1000 : undefined,price);
  const newsStatus=newsState?.symbol===symbol?newsState.status:'loading';
  const questionTags = [...new Set(recentDiscoveryNews(tickerNews).flatMap(item => discoveryTags(item.title)))];
  const contextPacket = newsStatus === 'ok' ? contextPackets.find(packet => tickerNews.some(item => matchesStockContext(packet, symbol, item, now))) : undefined;
  const cachedQuestionIds = STOCK_QUESTIONS.filter(question => cacheReadable(mentorReportCache[`${owner}-${symbol}-${question.id}-${questionRevision}`])).map(question => question.id);
  const hasCachedAnalysis = cacheReadable(aiReportCache[symbol]);
  const goTo = (id: string) => {
    markReadingHandled();
    analysisBodyRef.current?.querySelector<HTMLElement>(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const fundTopic = (topic: string): FundQuestionId => {
    if (['target', 'returns', 'pitfall', 'compare', 'distribution', 'currency', 'watch'].includes(topic)) return topic as FundQuestionId;
    return ({ 'fund-target': 'target', 'fund-returns': 'returns', 'fund-risk': 'pitfall', 'fund-compare': 'compare', index: 'target', price: 'returns', dividends: 'distribution', fx: 'currency' } as Record<string, FundQuestionId>)[topic] ?? 'watch';
  };
  const openLearning = (topic = 'evidence', originId = 'assistant', returnLabel = '질문으로 돌아가기') => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    trigger?.setAttribute('data-reading-return', originId);
    const id = isFund ? fundTopic(topic) : STOCK_LESSONS.some(item => item.id === topic) ? topic : 'evidence';
    setLearningEntries(previous => ({ ...previous, [readingKey]: {
      symbol, id, originId, returnLabel,
      returnTop: analysisBodyRef.current?.scrollTop ?? 0,
      sequence: (previous[readingKey]?.sequence ?? 0) + 1,
      ...(originId.startsWith("answer-") && selectedMentor && mentorReport ? { answerSnapshot: { question: selectedMentor, report: mentorReport, cachedAt: mentorCachedAt } } : {}),
    } }));
    usageEvent('learning_open');
    requestAnimationFrame(() => {
      const reader = analysisBodyRef.current?.querySelector<HTMLElement>(`[data-inline-origin="${CSS.escape(originId)}"]`);
      reader?.scrollIntoView({ block: 'start' });
      reader?.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
    });
  };
  const returnToOrigin = () => {
    if (!learningEntry) return;
    const entry = learningEntry;
    setLearningEntries(previous => {
      const next = { ...previous }; delete next[readingKey]; return next;
    });
    requestAnimationFrame(() => {
      analysisBodyRef.current?.scrollTo({ top: entry.returnTop, behavior: 'auto' });
      analysisBodyRef.current?.querySelector<HTMLElement>(`[data-reading-return="${CSS.escape(entry.originId)}"]`)?.focus({ preventScroll: true });
    });
  };
  const rememberPosition = (kind: 'company' | 'position' = 'position') => {
    const body = analysisBodyRef.current;
    const bodyTop = body?.getBoundingClientRect().top ?? 0;
    const candidates: { selector: string; offset: number; height: number }[] = [];
    const add = (element: HTMLElement, selector: string) => {
      const rect = element.getBoundingClientRect();
      if (element.getClientRects().length) candidates.push({ selector, offset: rect.top - bodyTop, height: rect.height });
    };
    body?.querySelectorAll<HTMLElement>('[id^="anchor-"]').forEach(element => add(element, `#${CSS.escape(element.id)}`));
    body?.querySelectorAll<HTMLElement>('[data-inline-origin]').forEach(element => {
      const heading = element.querySelector<HTMLElement>('h3');
      if (heading) add(heading, `[data-inline-origin="${CSS.escape(element.dataset.inlineOrigin!)}"] h3`);
    });
    body?.querySelectorAll<HTMLElement>('#anchor-learning [data-open-lesson]').forEach(element => {
      const heading = element.querySelector<HTMLElement>('h3');
      if (heading) add(heading, `#anchor-learning [data-open-lesson="${CSS.escape(element.dataset.openLesson!)}"] h3`);
    });
    readingPositions.current.set(readingKey, { top: body?.scrollTop ?? 0, range: chartRange, kind,
      anchor: selectReadingAnchor(candidates, body?.clientHeight ?? 0) });
    if (readingPositions.current.size > 40) readingPositions.current.delete(readingPositions.current.keys().next().value!);
  };
  const renderInline = (originId: string) => learningEntry?.originId === originId ? (
    <div className={panelStyles.inlineReading} data-inline-explanation data-inline-origin={originId}>
      {isFund ? <FundExploration symbol={symbol} fund={fundProfile(symbol)} embedded
        initialQuestion={learningEntry.id as FundQuestionId} initialReading={learningEntry.fundReading}
        onReadingChange={fundReading => setLearningEntries(previous => {
          const entry = previous[readingKey];
          return entry ? { ...previous, [readingKey]: { ...entry, fundReading } } : previous;
        })}
        entrySequence={learningEntry.sequence} returnLabel={learningEntry.returnLabel} onReturn={returnToOrigin}
        onNews={() => goTo('anchor-news')}
        onOpenStock={(next, fundReading) => {
          rememberPosition();
          setLearningEntries(previous => ({ ...previous, [readingKey]: { ...previous[readingKey], fundReading } }));
          setAnalysisSymbol(next);
        }} /> : <StockLearning name={displayName} owner={owner} symbol={symbol} instrument="stock" tags={questionTags} embedded
        initialLessonId={learningEntry.id} initialReading={learningEntry.reading} entrySequence={learningEntry.sequence}
        onReadingChange={reading => setLearningEntries(previous => {
          const entry = previous[readingKey];
          return entry ? { ...previous, [readingKey]: { ...entry, reading } } : previous;
        })}
        returnLabel={learningEntry.returnLabel} onReturn={returnToOrigin}
        onCompany={() => goTo('anchor-company')} onChart={() => goTo('anchor-chart')}
        onNews={() => goTo('anchor-news')} onNotes={stockData ? () => goTo('anchor-notes') : undefined} />}
    </div>
  ) : null;
  const aiActionBlocked = !isLev && !showAIReport && !aiReport && !hasCachedAnalysis
    && (quotaStatus === 'checking' || aiRemaining === 0);
  const analysisReportControls = (<>
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
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#8B95A1', marginBottom: 8 }}>지금 알아둘 이야기</div>
                          <div style={{ fontSize: 14, color: '#191F28', lineHeight: 1.7 }}>{aiReport.currentStatus}</div>
                        </div>
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
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#8B95A1', marginBottom: 8 }}>52주 가격 범위에서의 위치</div>
                            <div style={{ fontSize: 14, color: '#191F28', lineHeight: 1.7 }}>{aiReport.historicalNote}</div>
                          </div>
                        )}
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
  </>);

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,0.2)' }} onClick={close} />

      {/* Panel */}
      <div className="analysis-shell fixed inset-0 z-[70] flex items-center justify-center" style={{ padding: 16 }}>
        <div
          className={`flex flex-col analysis-modal ${panelStyles.panel}${wideMode ? ' wide' : ''}`}
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`${displayName} 살펴보기`}
        >
          <div className={panelStyles.header}>
            <div className={panelStyles.identity}>
              <CompanyMark key={symbol} symbol={symbol} />
              <div>
                <h2 className={panelStyles.name} tabIndex={-1} data-dialog-initial-focus>{displayName}</h2>
                <div className={panelStyles.symbol}>{symbol} · {isKoreanStock ? '한국' : '미국'} · {isLev ? '레버리지·인버스 ETF' : isFund ? 'ETF·펀드' : '주식'}</div>
              </div>
            </div>
            <div className={panelStyles.controls}>
              {/* 넓게 보기 — 읽는 순서를 유지하고 패널·차트 폭을 900 → 1160px로 확장. */}
              <button
                onClick={(event) => {
                  if (event.detail > 0) event.currentTarget.blur();
                  unavailableStorageWideMode = !wideMode;
                  try { localStorage.setItem(WIDE_MODE_KEY, wideMode ? '0' : '1'); } catch { /* Keep this tab usable when storage is unavailable. */ }
                  window.dispatchEvent(new Event(WIDE_MODE_EVENT));
                }}
                aria-pressed={wideMode}
                aria-label={wideMode ? '기본 너비로' : '넓게 보기'}
                title={wideMode ? '기본 너비로' : '화면 넓게 보기'}
                className={`${panelStyles.control} ${panelStyles.wideControl}`}
              >
                {wideMode ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
                {wideMode ? '기본 너비' : '화면 넓게'}
              </button>
              {showSwitcher && (
                <>
                  <button
                    onClick={() => { if (symIdx > 0) { rememberPosition(); setAnalysisSymbol(allSymbols[symIdx - 1]); } }}
                    disabled={symIdx <= 0}
                    aria-label="이전 종목"
                    className={panelStyles.control}
                  >
                    <ChevronLeft style={{ width: 18, height: 18, color: '#8B95A1' }} />
                  </button>
                  <button
                    onClick={() => { if (symIdx < allSymbols.length - 1) { rememberPosition(); setAnalysisSymbol(allSymbols[symIdx + 1]); } }}
                    disabled={symIdx >= allSymbols.length - 1}
                    aria-label="다음 종목"
                    className={panelStyles.control}
                  >
                    <ChevronRight style={{ width: 18, height: 18, color: '#8B95A1' }} />
                  </button>
                </>
              )}
              <button
                onClick={close}
                aria-label="닫기"
                className={panelStyles.control}
              >
                <X style={{ width: 20, height: 20, color: '#8B95A1' }} />
              </button>
            </div>
          </div>

          <JoobiAssistantLauncher key={`ask:${symbol}`} symbol={symbol} name={displayName} inline />
          <AnalysisNavigation key={symbol} scrollRef={analysisBodyRef}
            hasChart={true} hasCheckup={!isFund} hasResources={!isLev} hasAssistant={!isLev}
            hasPersonal={!!symbol && (!!stockData || (!isLev && price > 0))} isFund={isFund}
            onReadingInteraction={markReadingHandled}
            layoutKey={`${readingKey}-${wideMode}`} />

          {/* Scrollable body */}
          <div key={readingKey} ref={analysisBodyRef} className={`flex-1 analysis-body ${panelStyles.body}`}>
            {loading && <p className={panelStyles.loadingPrice} role="status">시세와 차트를 확인하고 있어요.</p>}
            {(
              <>
                {/* Price hero */}
                <div id="anchor-overview" className={panelStyles.priceHero}>
                  <div>
                  <div className={panelStyles.priceLabel}>현재 가격</div>
                  <div className={panelStyles.price}>
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
                  </div>
                  <div className={panelStyles.priceMeta}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {asOf ? `${asOf} 기준 · 한국시간` : '시세 기준 시각 미확인'} · 지연될 수 있어요
                  </div>
                  {price > 0 && <details style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}><summary className={panelStyles.referenceSummary}>다른 통화로 보기</summary>{nativeCurrency === 'KRW' ? formatUsd(priceAmounts.usd) : formatKrw(priceAmounts.krw)} · {fx.stale ? '환율 미확인 · 임시 환율로 환산' : '환율에 따른 환산 금액'}</details>}
                  </div>
                </div>

                <StockDetailIntroduction symbol={symbol} name={displayName} isFund={isFund}
                  profile={companyProfile ?? { business: { symbol, level: 'missing', sources: [], origin: 'engine', availability: 'loading' } }}
                  onOpen={() => goTo('anchor-company')} />

                {
                  <div className="detail-chart-col">
                    <div className={panelStyles.chartToolbar}>
                    <div id="anchor-chart" className={panelStyles.chartHeading}>
                      가격 차트
                    </div>

                    {!isLev && <div className={panelStyles.chartLevels} role="group" aria-label="차트 표현">
                      {(['basic', 'detail'] as ChartLevel[]).map(lvl => <button key={lvl}
                        type="button" className={panelStyles.chartLevel} aria-pressed={chartLevel === lvl}
                        onClick={() => setChartLevel(lvl)}>{lvl === 'basic' ? '기본' : '상세'}</button>)}
                    </div>}

                    </div>
                    {/* Timeframe selector */}
                    <div className={panelStyles.periods} role="group" aria-label="차트 기간">
                      {([
                        { label: '1일', days: 1 },
                        { label: '1주일', days: 5 },
                        { label: '1개월', days: 22 },
                        { label: '3개월', days: 60 },
                        { label: '6개월', days: 120 },
                        { label: '1년', days: 0 },
                      ]).map(tf => (
                        <button
                          key={tf.label}
                          onClick={() => setChartRange(tf.days)}
                          aria-pressed={chartRange === tf.days}
                          type="button"
                          className={panelStyles.period}
                        >
                          {tf.label}
                        </button>
                      ))}
                    </div>

                    {chartRange === 1 ? <IntradayStockChart key={`${owner}:${symbol}`} symbol={symbol} currency={nativeCurrency} level={isLev ? 'basic' : chartLevel}
                      analysisQuota={{ status: quotaStatus, remaining: aiRemaining, acceptResponse: acceptQuotaResponse }} allowAnalysis={!isLev}
                      onNews={() => goTo('anchor-news')} /> : !analysis ? (
                      <ShortPriceHistory raw={rawCandles[symbol]} currency={nativeCurrency} status={candleStatus} onRetry={() => void fetchCandle()} />
                    ) : <>
                    {chartRange === 5 && <p style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-secondary)' }}>최근 5거래일 기준이에요. 주말·휴장일은 제외해요.</p>}
                    {/* Daily chart and indicators stay on daily data. */}
                    <StockChart
                      raw={analysis.raw}
                      sma5={analysis.sma5}
                      sma20={analysis.sma20}
                      sma60={analysis.sma60}
                      level={isLev ? 'basic' : chartLevel}
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

                    {!isLev && <details style={{ marginTop: 16 }}>
                      <summary className={panelStyles.referenceSummary}>차트 해설과 기술 지표 펼쳐보기</summary>
                    <div className={panelStyles.priceExplanation}>
                      <h4>{analysis.chartShape.title}</h4>
                      <p>{analysis.chartShape.desc}</p>
                    </div>
                    {/* 이 차트, 지금 이런 상태예요 — 초보 해설(chartNarrative SSOT, §6 안전). 차트 직하 약어 범례 대체.
                        level 바인딩 — basic 차트엔 볼린저 띠 미렌더라 볼린저 설명 생략(화면-설명 일치). */}
                    {(() => {
                      const recentCloses = analysis.closes.slice(-Math.min(chartRange, analysis.closes.length));
                      const recentHigh = recentCloses.length ? Math.max(...recentCloses) : 0;
                      const recentLow = recentCloses.length ? Math.min(...recentCloses) : 0;
                      // chartRange(거래일) → 여정 기간 라벨. 0=1Y(전체)
                      const periodLabel = chartRange === 5 ? '최근 일주일(5거래일)'
                        : chartRange === 22 ? '최근 한 달'
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
                              className={panelStyles.referenceSummary}
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

                    <div className={panelStyles.technicalGrid} data-technical-indicators>
                      {/* RSI */}
                      <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-subtle)', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>RSI (14)</div>
                        <div style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: analysis.rsiVal != null && analysis.rsiVal < 30 ? '#3182F6' :
                                analysis.rsiVal != null && analysis.rsiVal > 70 ? '#EF4452' : 'var(--text-primary)',
                        }}>
                          {analysis.rsiVal != null ? analysis.rsiVal.toFixed(1) : '--'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                          {analysis.rsiVal != null && analysis.rsiVal < 30 ? '30 아래\n과매도 구간' :
                           analysis.rsiVal != null && analysis.rsiVal > 70 ? '70 위\n과열 구간' : '30~70\n중간 구간'}
                        </div>
                      </div>

                      {/* MA 20 */}
                      <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-subtle)', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>MA 20일</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {analysis.sma20.length ? fmtNativePrice(analysis.sma20[analysis.sma20.length - 1], nativeCurrency) : '--'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                          {analysis.sma20.length && price > analysis.sma20[analysis.sma20.length - 1]
                            ? '현재가가 20일\n평균보다 위'
                            : '현재가가 20일\n평균보다 아래'}
                        </div>
                      </div>

                      {/* MA 60 */}
                      <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-subtle)', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>MA 60일</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {analysis.sma60.length ? fmtNativePrice(analysis.sma60[analysis.sma60.length - 1], nativeCurrency) : '--'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
                          {analysis.sma60.length && price > analysis.sma60[analysis.sma60.length - 1]
                            ? '현재가가 60일\n평균보다 위'
                            : '현재가가 60일\n평균보다 아래'}
                        </div>
                      </div>
                    </div>

                    {/* Bollinger interpretation */}
                    {analysis.bollingerStatus && (
                      <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--bg-subtle)', marginBottom: 12 }}>
                        <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>볼린저 밴드</span>
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
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          {analysis.bollingerStatus.desc}
                          {analysis.lastBollinger && (
                            <>
                              <br />
                              상단: {fmtNativePrice(analysis.lastBollinger.upper, nativeCurrency)} · 중단: {fmtNativePrice(analysis.lastBollinger.middle, nativeCurrency)} · 하단: {fmtNativePrice(analysis.lastBollinger.lower, nativeCurrency)}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* MACD interpretation */}
                    {analysis.macdStatus && (
                      <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--bg-subtle)', marginBottom: 12 }}>
                        <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>MACD</span>
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
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
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
                    <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--bg-subtle)', marginBottom: 24 }}>
                      <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>거래량</span>
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
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        최근 거래량은 20일 평균{analysis.volRatio > 1.5 ? '보다 많아요. 관심이 높은 상태예요.' : analysis.volRatio < 0.5 ? '보다 적어요. 관심이 낮은 상태예요.' : '과 비슷해요. 큰 매도 압력은 없는 상태예요.'}
                      </div>
                    </div>
                    </details>}
                    </>}
                    {isLev && <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>이 상품 자체의 가격 흐름이에요. 레버리지·인버스 상품은 하루 수익률을 기준으로 움직이므로, 여러 날 보유한 수익률은 기초 종목 수익률의 단순 배수와 달라질 수 있어요.</p>}
                  </div>
                }


                <div id="anchor-news" className={panelStyles.news}>
                  <StockDailyBrief key={`daily:${symbol}`} symbol={symbol} />
                  <StockReturnBrief key={`brief:${owner}:${symbol}`} owner={owner} symbol={symbol} items={tickerNews}
                    contextPacket={contextPacket}
                    onRetryNews={() => { setNewsState(null); setNewsRequest(value => value + 1); }}
                    newsStatus={newsStatus} isFund={isFund} price={quote?.c ?? 0} quoteAt={quote?.t ? quote.t * 1000 : undefined}
                    currency={nativeCurrency} onLearn={(topic, originId) => openLearning(isFund ? 'watch' : topic, originId, '이 기사로 돌아가기')}
                    renderExplanation={renderInline} />
                </div>

                <StockVisitSummary owner={owner} symbol={symbol} items={tickerNews} status={newsStatus} isFund={isFund}
                  onCompany={() => goTo('anchor-company')} onNews={() => goTo('anchor-news')} />

                {!analysis && !loading && (
                  <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: '#FF9500', lineHeight: 1.6 }}>
                    {isThinData
                      ? '현재 받은 일별 가격 자료가 적어요. 차트에서 확인된 기간의 가격을 살펴볼 수 있어요.'
                      : '일별 가격 자료를 불러오지 못했어요. 차트에서 기간을 바꾸거나 다시 불러와 주세요.'}
                  </div>
                )}

                {!isFund && <div id="anchor-checkup" style={{ scrollMarginTop: 56 }}>
                  <StockCheckup checkup={buildStockCheckup({ price, candles: rawCandles[symbol], currency: nativeCurrency })} />
                </div>}


                <div id="anchor-company" style={{ scrollMarginTop: 56 }}>
                  {!isFund && <StockCompanyOverview symbol={symbol} name={displayName} profile={companyProfile ?? { business: { symbol, level: 'missing', sources: [], origin: 'engine', availability: 'loading' } }} onRetry={() => { setCompanyProfile(null); setCompanyProfileRequest(n => n + 1); }}
                    exploration={companyExplorations[readingKey]}
                    onExplorationChange={state => setCompanyExplorations(previous => ({ ...previous, [readingKey]: { ...previous[readingKey], ...state } }))}
                    onOpenStock={(next, reading) => {
                      rememberPosition();
                      setCompanyExplorations(previous => ({ ...previous, [readingKey]: { open: true, reading } }));
                      setAnalysisSymbol(next);
                    }} />}
                  {isFund && <div data-company-exploration-anchor>
                  <ContextExploration key={`exploration:${symbol}`} symbol={symbol} profile={companyProfile ?? undefined} topics={stockExploration(symbol, companyProfile ?? undefined)} context={`${displayName} 살펴보기`}
                    initialReadingState={readingVisits.get(`${owner}:${symbol}`)?.reading}
                    onReadingChange={reading => setReadingVisits(visits => {
                      const next = new Map(visits);
                      next.set(readingKey, { reading, companyOffset: visits.get(readingKey)?.companyOffset ?? 0 });
                      return next;
                    })}
                    onNews={() => analysisBodyRef.current?.querySelector('#anchor-news')?.scrollIntoView({block:'start'})}
                    onOpenStock={(next, reading) => {
                      if (next === symbol) {
                        analysisBodyRef.current?.scrollTo({ top: 0 });
                        dialogRef.current?.querySelector<HTMLElement>('[data-dialog-initial-focus]')?.focus({ preventScroll: true });
                        return;
                      }
                      const body = analysisBodyRef.current;
                      const companyIntro = body?.querySelector<HTMLElement>('[data-company-exploration-anchor]');
                      const companyOffset = body && companyIntro ? companyIntro.getBoundingClientRect().top - body.getBoundingClientRect().top : 0;
                      rememberPosition('company');
                      setReadingVisits(visits => new Map(visits).set(readingKey, { reading, companyOffset }));
                      setAnalysisSymbol(next);
                    }} />
                  </div>}
                </div>

                <div className={panelStyles.details}>
                {!isLev && (
                  <div id="anchor-assistant" className={assistantStyles.section}>
                    <div className={panelStyles.assistantReading}>
                      <div className={assistantStyles.questions}>
                        <StockAnalysisQuestions key={`${owner}:${symbol}`} owner={owner} symbol={symbol} instrument={isFund ? 'fund' : 'stock'} tags={questionTags}
                          backgroundQuestionId={learningEntry?.originId.startsWith("question-") ? learningEntry.originId.slice(9) : undefined}
                          answeredId={mentorReport ? selectedMentor?.id : undefined}
                          onLearn={id => openLearning(isFund ? id : lessonForQuestion(id), `question-${id}`, '이 질문으로 돌아가기')}
                          renderBackground={id => renderInline(`question-${id}`)} selectedId={selectedMentor?.id ?? null}
                          loading={mentorLoading} onSelect={handleMentorSelect} remaining={aiRemaining}
                          quotaStatus={quotaStatus} cachedQuestionIds={cachedQuestionIds}
                          answer={selectedMentor ? (
                            <section id="stock-assistant-answer" aria-labelledby="stock-assistant-answer-title"
                              className={assistantStyles.answer}>
                              <div className={assistantStyles.answerHeader}>
                                <h4 id="stock-assistant-answer-title" className={assistantStyles.answerTitle}>{getStockAnalysisAnswerTitle(selectedMentor.id, displayName)}</h4>
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
                                <button type="button" data-reading-return={`answer-${selectedMentor.id}`} className={assistantStyles.action} onClick={() => openLearning(isFund ? selectedMentor.id : lessonForQuestion(selectedMentor.id), `answer-${selectedMentor.id}`, '이 답변으로 돌아가기')}>이 답변에서 나온 {isFund ? '상품 구조' : '개념'} 더 알아보기 →</button>
                                {renderInline(`answer-${selectedMentor.id}`)}
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

                <StockDetailResources key={`resources:${owner}:${symbol}`}
                  initialId={readingVisits.get(readingKey)?.reading.trail.length ? 'industry' : undefined}
                  items={[
                    ...(!isFund ? [{ id:'industry', title:'산업과 다른 기업', description:'같은 산업에서 맡는 역할 비교', content:(<div data-company-exploration-anchor>
                  <ContextExploration industryOnly key={`exploration:${symbol}`} symbol={symbol} profile={companyProfile ?? undefined} topics={stockExploration(symbol, companyProfile ?? undefined)} context={`${displayName} 살펴보기`}
                    initialReadingState={readingVisits.get(`${owner}:${symbol}`)?.reading}
                    onReadingChange={reading => setReadingVisits(visits => {
                      const next = new Map(visits);
                      next.set(readingKey, { reading, companyOffset: visits.get(readingKey)?.companyOffset ?? 0 });
                      return next;
                    })}
                    onNews={() => analysisBodyRef.current?.querySelector('#anchor-news')?.scrollIntoView({block:'start'})}
                    onOpenStock={(next, reading) => {
                      if (next === symbol) {
                        analysisBodyRef.current?.scrollTo({ top: 0 });
                        dialogRef.current?.querySelector<HTMLElement>('[data-dialog-initial-focus]')?.focus({ preventScroll: true });
                        return;
                      }
                      const body = analysisBodyRef.current;
                      const companyIntro = body?.querySelector<HTMLElement>('[data-company-exploration-anchor]');
                      const companyOffset = body && companyIntro ? companyIntro.getBoundingClientRect().top - body.getBoundingClientRect().top : 0;
                      rememberPosition('company');
                      setReadingVisits(visits => new Map(visits).set(readingKey, { reading, companyOffset }));
                      setAnalysisSymbol(next);
                    }} />
                </div>) }] : []),
                    ...(!isLev ? [{ id:'report', title:'종합 분석', description:'여러 관점으로 정리한 AI 분석', content:analysisReportControls }] : []),
                  ]} />

                {isLev && analysisReportControls}

                <div id="anchor-learning" className={panelStyles.library}>
                  {isFund ? <section aria-labelledby="fund-library-title">
                    <h2 id="fund-library-title">상품에서 이어지는 궁금증</h2>
                    <p className={panelStyles.sectionIntro}>투자 대상부터 수익 구조와 비교 기준까지, 궁금한 질문을 골라 읽어보세요.</p>
                    {fundProfile(symbol) ? <>
                      <div className={panelStyles.fundLibrary}>
                        {(['target', 'pitfall'] as FundQuestionId[]).map(id => <button type="button" key={id} data-reading-return={learningEntry?.id === id ? "library" : undefined} onClick={() => openLearning(id, 'library', '상품 질문 목록으로 돌아가기')}>{fundQuestions(fundProfile(symbol)!)[id].title} →</button>)}
                      </div>
                      <details><summary className={panelStyles.referenceSummary}>다른 구조 질문도 살펴보기</summary><div className={panelStyles.fundLibrary}>
                        {(['returns', 'compare', 'distribution', 'currency', 'watch'] as FundQuestionId[]).map(id => <button type="button" key={id} data-reading-return={learningEntry?.id === id ? "library" : undefined} onClick={() => openLearning(id, 'library', '상품 질문 목록으로 돌아가기')}>{fundQuestions(fundProfile(symbol)!)[id].title} →</button>)}
                      </div></details>
                      {renderInline('library')}
                    </> : <p>이 상품의 구조 자료는 아직 확인하지 못했어요. 상품 이해에서 확인된 상품과 자료 범위를 살펴볼 수 있어요.</p>}
                  </section> : <StockLearning key={`learning:${owner}:${symbol}`}
                    contextPacket={contextPacket}
                    name={displayName} owner={owner} symbol={symbol} instrument="stock" tags={questionTags}
                    initialReading={libraryReadings[readingKey]}
                    onReadingChange={reading => setLibraryReadings(previous => ({ ...previous, [readingKey]: reading }))}
                    onCompany={() => goTo('anchor-company')}
                    onChart={() => goTo('anchor-chart')}
                    onNews={() => goTo('anchor-news')}
                    onNotes={stockData ? () => {
                      goTo('anchor-notes');
                      analysisBodyRef.current?.querySelector<HTMLButtonElement>('#anchor-notes button')?.focus({ preventScroll: true });
                    } : undefined} />}
                </div>

                {symbol && (stockData || (!isLev && price > 0)) && (
                  <section id="anchor-personal" className={panelStyles.personal} aria-labelledby="personal-title">
                    <h2 id="personal-title">내 투자에 연결하기</h2>
                    {stockData && <p className={panelStyles.sectionIntro}>살펴본 내용을 바탕으로 이 종목을 보는 이유와 앞으로 확인할 점을 남겨보세요.</p>}

                {/* Investment P&L */}
                {stockData && stockData.avgCost > 0 && stockData.shares > 0 && price > 0 && (
                  <div style={{ padding: 20, borderRadius: 14, background: 'var(--bg-subtle)', marginBottom: 20 }}>
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
                          <div className="flex items-center" style={{ gap: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--bg-subtle)' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 80 }}>매수</span>
                            <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{stockData.shares}주</span>
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

                  </section>
                )}

                {/* Disclaimer */}
                <div style={{ fontSize: 11, color: '#B0B8C1', textAlign: 'center', padding: '16px 0', borderTop: '1px solid var(--border-light, #F2F4F6)', marginTop: 16 }}>
                  AI가 생성한 참고 자료이며, 투자 자문이 아니에요. 투자 판단의 책임은 이용자에게 있어요.
                </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
