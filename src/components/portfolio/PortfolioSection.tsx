'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
// 내 종목 뉴스는 뉴스 탭으로 이동 — import 제거
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import type { StockCategory, QuoteData, MacroEntry, StockItem, CandleRaw } from '@/config/constants';
import type { Alert } from '@/utils/alertsEngine';
import { Edit3, Trash2 } from 'lucide-react';
import { logApiCall } from '@/lib/apiLogger';
import PortfolioHeatmap from './PortfolioHeatmap';
import PortfolioCompactBar from './PortfolioCompactBar';
import BenchmarkCompare from './BenchmarkCompare';
import GoalProgress from './GoalProgress';
import PortfolioHealth from './PortfolioHealth';
import Dashboard from './Dashboard';
import MorningBriefing from './MorningBriefing';
import { computeVolBaseline, computeZScore, adaptiveDailyMoveThreshold } from '@/utils/volatility';
// AI 촉 → AI 인사이트 탭으로 이동
import ShareCard from './ShareCard';
import OcrImportModal from './OcrImportModal';
import InvestmentJournal from './InvestmentJournal';
import StockPulse from './StockPulse';
import PortfolioValueChart from './PortfolioValueChart';
import PortfolioDNA from './PortfolioDNA';
import ThrowbackCard from './ThrowbackCard';
import TradePatternMirror from './TradePatternMirror';
import MonthlyReplay from './MonthlyReplay';
// ConversationalTimeline은 AI 인사이트 탭에 유지 (내러티브 카테고리)

const QUICK_ADD_STOCKS = [
  { symbol: '005930.KS', label: '삼성전자' },
  { symbol: 'NVDA', label: 'NVDA' },
  { symbol: 'AAPL', label: 'AAPL' },
  { symbol: 'MSFT', label: 'MSFT' },
  { symbol: 'TSLA', label: 'TSLA' },
];

const TABS: { id: StockCategory; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'investing', label: '투자 중' },
  { id: 'watching', label: '관심 종목' },
  { id: 'sold', label: '매도 완료' },
];

const CAT_BADGES: Record<string, { label: string; bgCls: string; textCls: string }> = {
  investing: { label: '투자 중', bgCls: 'bg-[#F0F4FF]', textCls: 'text-[#3182F6]' },
  watching: { label: '관심', bgCls: 'bg-[#F0FAF0]', textCls: 'text-[#20C997]' },
  sold: { label: '매도 완료', bgCls: 'bg-[#F5F5F5]', textCls: 'text-[#8B95A1]' },
};

const SORT_OPTIONS: { key: 'name' | 'price' | 'change' | 'pnl' | 'goal'; label: string }[] = [
  { key: 'name', label: '종목명' },
  { key: 'price', label: '현재가' },
  { key: 'change', label: '등락률' },
  { key: 'pnl', label: '수익률' },
  { key: 'goal', label: '목표' },
];

type PeriodKey = '1d' | '1w' | '1m' | '3m' | '1y';
const PERIOD_OPTIONS: { key: PeriodKey; label: string; days: number }[] = [
  { key: '1d', label: '오늘',  days: 0  },
  { key: '1w', label: '1주',  days: 7  },
  { key: '1m', label: '1달',  days: 31 },
  { key: '3m', label: '3달',  days: 92 },
  { key: '1y', label: '1년',  days: 365 },
];

function getPeriodReturn(
  symbol: string,
  period: PeriodKey,
  currentPrice: number,
  prevClose: number | undefined,
  rawCandles: Record<string, CandleRaw>,
): number | null {
  if (!currentPrice) return null;
  if (period === '1d') {
    if (!prevClose || prevClose === currentPrice) return null;
    return ((currentPrice - prevClose) / prevClose) * 100;
  }
  const candles = rawCandles[symbol];
  if (!candles?.t?.length || !candles?.c?.length) return null;
  const days = PERIOD_OPTIONS.find(p => p.key === period)!.days;
  const targetTs = Date.now() / 1000 - days * 86400;
  let idx = -1;
  for (let i = candles.t.length - 1; i >= 0; i--) {
    if (candles.t[i] <= targetTs) { idx = i; break; }
  }
  if (idx < 0) return null;
  const histPrice = candles.c[idx];
  if (!histPrice) return null;
  return ((currentPrice - histPrice) / histPrice) * 100;
}

const ALERT_BADGE_COLORS: Record<Alert['type'], { bg: string; color: string; dot: string }> = {
  urgent: { bg: 'rgba(239,68,82,0.08)', color: '#EF4452', dot: '🔴' },
  risk: { bg: 'rgba(255,149,0,0.08)', color: '#FF9500', dot: '🟡' },
  opportunity: { bg: 'rgba(0,198,190,0.08)', color: '#00C6BE', dot: '🟢' },
  insight: { bg: 'rgba(49,130,246,0.08)', color: '#3182F6', dot: '🔵' },
  celebrate: { bg: 'rgba(175,82,222,0.08)', color: '#AF52DE', dot: '🟣' },
};

function getAlertBadgeText(alert: Alert): string {
  // Short label for inline badge
  if (alert.id.includes('stoploss-hit')) return '손절 도달';
  if (alert.id.includes('stoploss-near')) return '손절 근접';
  if (alert.id.includes('target-hit')) return '목표 달성';
  if (alert.id.includes('target-near')) return '목표 근접';
  if (alert.id.includes('below-avgcost')) return '평단 하회';
  if (alert.id.includes('buy-zone')) return '관심가 도달';
  if (alert.id.includes('daily-surge')) return '급등';
  if (alert.id.includes('daily-plunge')) return '급락';
  if (alert.id.includes('near-52w-low')) return '52주 저점';
  if (alert.id.includes('near-52w-high')) return '52주 고점';
  if (alert.id.includes('golden-cross')) return '골든크로스';
  if (alert.id.includes('death-cross')) return '데드크로스';
  if (alert.id.includes('rsi-oversold')) {
    const match = alert.message.match(/RSI (\d+)/);
    return match ? `RSI ${match[1]}` : 'RSI 과매도';
  }
  if (alert.id.includes('rsi-overbought')) {
    const match = alert.message.match(/RSI (\d+)/);
    return match ? `RSI ${match[1]}` : 'RSI 과매수';
  }
  if (alert.id.includes('bb-lower')) return 'BB 하단';
  if (alert.id.includes('bb-upper')) return 'BB 상단';
  if (alert.id.includes('macd-bull')) return 'MACD 상승';
  if (alert.id.includes('macd-bear')) return 'MACD 하락';
  if (alert.id.includes('target-return')) return '수익 달성';
  return '알림';
}

// 원화 포맷 — 공통 유틸 사용
import { formatKRW, formatKRWChange } from '@/utils/formatKRW';
function fmtWon(val: number): string { return formatKRW(val, { suffix: '원', prefix: false }); }
function fmtWonShort(val: number): string { return formatKRW(val); }

export default function PortfolioSection() {
  const {
    stocks, currentTab, macroData,
    setCurrentTab, setAnalysisSymbol,
    deleteStock, setEditingCat, setEditingIdx,
    addStock,
    alerts, dismissedAlerts, dismissAlert,
    currency, setCurrency,
    lastUpdate,
    rawCandles,
  } = usePortfolioStore();

  const [sortBy, setSortBy] = useState<'name' | 'price' | 'change' | 'pnl' | 'goal'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [subTab, setSubTab] = useState<'stocks' | 'analysis'>('stocks');
  const [undoData, setUndoData] = useState<{ cat: 'investing' | 'watching' | 'sold'; stock: StockItem; timer: NodeJS.Timeout } | null>(null);
  const [showOcr, setShowOcr] = useState(false);
  const [periodTab, setPeriodTab] = useState<PeriodKey>('1d');

  // Dashboard 건강점수 pill 클릭 → 분석 탭 전환 + 스크롤
  useEffect(() => {
    const handler = () => {
      setSubTab('analysis');
      // 다음 프레임에 PortfolioHealth 위치로 스크롤
      requestAnimationFrame(() => {
        const health = document.querySelector('[data-slot="portfolio-health"]');
        if (health) health.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
    window.addEventListener('solb-goto-analysis', handler);
    return () => window.removeEventListener('solb-goto-analysis', handler);
  }, []);

  // 내 종목 뉴스 fetch 로직은 NewsSection으로 이전 — 제거

  // USD/KRW rate
  const usdKrwEntry = macroData['USD/KRW'] as MacroEntry | undefined;
  const usdKrw = usdKrwEntry?.value || 1400;

  // Calculate totals (investing only)
  const investingStocks = stocks.investing || [];
  const watchingStocks = stocks.watching || [];
  const soldStocks = stocks.sold || [];
  const allStocksList = [...investingStocks, ...watchingStocks, ...soldStocks];

  let totalValue = 0, totalCost = 0, holdingCount = 0;

  investingStocks.forEach(stock => {
    const d = macroData[stock.symbol] as QuoteData | undefined;
    const price = d?.c || 0;
    if (stock.avgCost > 0 && stock.shares > 0 && price > 0) {
      totalValue += price * stock.shares;
      totalCost += stock.avgCost * stock.shares;
      holdingCount++;
    }
  });

  const totalPL = totalValue - totalCost;
  const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  const isGain = totalPL >= 0;
  const totalValueWon = totalValue * usdKrw;
  const totalCostWon = totalCost * usdKrw;
  const totalPLWon = totalPL * usdKrw;
  const hasInvestment = totalCost > 0;

  // 오늘 변동 계산 (투자중 종목의 당일 변동 합산)
  let todayChange = 0;
  let winCount = 0;
  let bestStock = { symbol: '', dp: -Infinity };
  let worstStock = { symbol: '', dp: Infinity };
  investingStocks.forEach(stock => {
    const d = macroData[stock.symbol] as QuoteData | undefined;
    if (!d?.c || !stock.shares) return;
    todayChange += (d.d || 0) * stock.shares;
    if (d.c > stock.avgCost && stock.avgCost > 0) winCount++;
    const dp = d.dp || 0;
    if (dp > bestStock.dp) bestStock = { symbol: stock.symbol, dp };
    if (dp < worstStock.dp) worstStock = { symbol: stock.symbol, dp };
  });
  const todayChangeWon = todayChange * usdKrw;
  const todayChangePct = totalValue > 0 ? (todayChange / (totalValue - todayChange)) * 100 : 0;
  const todayGain = todayChange >= 0;

  // 오늘의 한 줄 헤드라인 — 첫 화면 정보 위계 강화 (이상 신호 우선)
  // P2 알고리즘 업그레이드: 절대값(|dp|≥3%) → z-score(종목별 변동성 정규화)
  // - 안정 종목(KO σ≈1%) 1.5% 변동 = 1.5σ → 신호로 잡음 (기존엔 무시)
  // - 변동 종목(TSLA σ≈4%) 3% 변동 = 0.75σ → 노이즈로 무시 (기존엔 알림)
  let todayHeadline: { emoji: string; text: string; tone: 'gain' | 'loss' | 'neutral' } | null = null;
  const headlineCandidates = investingStocks
    .map(s => {
      const d = macroData[s.symbol] as QuoteData | undefined;
      const dp = d?.dp || 0;
      const c = d?.c || 0;
      if (s.shares <= 0 || c <= 0) return null;
      const baseline = computeVolBaseline(rawCandles[s.symbol]);
      const z = computeZScore(dp, baseline);
      const threshold = adaptiveDailyMoveThreshold(baseline, 2, 3);
      // z 신뢰 가능하면 |z|≥1.8 (≈약 2σ), 아니면 fallback 절대 임계값
      const isSignal = z !== null
        ? Math.abs(z) >= 1.8
        : Math.abs(dp) >= threshold;
      return {
        symbol: s.symbol, dp, c, shares: s.shares,
        z, threshold, isSignal,
        // 정렬 키 — z 있으면 |z|, 없으면 |dp|/threshold
        magnitude: z !== null ? Math.abs(z) : Math.abs(dp) / Math.max(1, threshold),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null && s.isSignal)
    .sort((a, b) => b.magnitude - a.magnitude);

  if (headlineCandidates.length > 0) {
    const top = headlineCandidates[0];
    const kr = STOCK_KR[top.symbol] || top.symbol;
    // z 사용 가능하면 "Nσ 움직임"으로 명시, 아니면 기존 표현
    const sigmaTag = top.z !== null
      ? ` (${Math.abs(top.z).toFixed(1)}σ)`
      : '';
    const reasonText = top.z !== null
      ? '평소 대비 이례적'
      : '평소보다 큰 움직임';
    todayHeadline = top.dp > 0
      ? { emoji: '🔥', text: `${kr} +${top.dp.toFixed(2)}%${sigmaTag} — ${reasonText}`, tone: 'gain' }
      : { emoji: '🧊', text: `${kr} ${top.dp.toFixed(2)}%${sigmaTag} — ${reasonText}`, tone: 'loss' };
  } else {
    for (const s of investingStocks) {
      if (s.shares <= 0) continue;
      const d = macroData[s.symbol] as QuoteData | undefined;
      const candles = rawCandles[s.symbol];
      if (!d?.c || !candles?.c?.length) continue;
      const high52 = Math.max(...candles.c);
      const low52 = Math.min(...candles.c);
      const highDist = ((high52 - d.c) / d.c) * 100;
      const lowDist = ((d.c - low52) / d.c) * 100;
      const kr = STOCK_KR[s.symbol] || s.symbol;
      if (highDist < 3) {
        todayHeadline = { emoji: '🎯', text: `${kr}가 52주 고점 근처 (${highDist.toFixed(1)}%)`, tone: 'neutral' };
        break;
      }
      if (lowDist < 3) {
        todayHeadline = { emoji: '🌱', text: `${kr}가 52주 저점 근처 (${lowDist.toFixed(1)}%)`, tone: 'neutral' };
        break;
      }
    }
  }

  // Build display list
  const activeTab = currentTab as string;
  type DisplayStock = StockItem & { category: 'investing' | 'watching' | 'sold'; originalIdx: number };
  let displayList: DisplayStock[] = [];

  if (activeTab === 'all') {
    (['investing', 'watching', 'sold'] as const).forEach(cat => {
      (stocks[cat] || []).forEach((s, idx) => {
        displayList.push({ ...s, category: cat, originalIdx: idx });
      });
    });
  } else if (activeTab === 'investing' || activeTab === 'watching' || activeTab === 'sold') {
    const cat = activeTab as 'investing' | 'watching' | 'sold';
    displayList = (stocks[cat] || []).map((s, idx) => ({ ...s, category: cat, originalIdx: idx }));
  }

  function handleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  }

  const sortedList = [...displayList].sort((a, b) => {
    const qa = macroData[a.symbol] as QuoteData | undefined;
    const qb = macroData[b.symbol] as QuoteData | undefined;
    let va = 0, vb = 0;
    switch (sortBy) {
      case 'name': return sortDir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol);
      case 'price': va = qa?.c || 0; vb = qb?.c || 0; break;
      case 'change': va = qa?.dp || 0; vb = qb?.dp || 0; break;
      case 'pnl':
        va = a.avgCost > 0 && (qa?.c || 0) > 0 ? ((qa!.c - a.avgCost) / a.avgCost * 100) : -999;
        vb = b.avgCost > 0 && (qb?.c || 0) > 0 ? ((qb!.c - b.avgCost) / b.avgCost * 100) : -999;
        break;
      case 'goal':
        va = a.targetReturn > 0 && a.avgCost > 0 && (qa?.c || 0) > 0 ? ((qa!.c - a.avgCost) / a.avgCost * 100) / a.targetReturn : -999;
        vb = b.targetReturn > 0 && b.avgCost > 0 && (qb?.c || 0) > 0 ? ((qb!.c - b.avgCost) / b.avgCost * 100) / b.targetReturn : -999;
        break;
    }
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  // Urgent inline banners (severity 1 only)
  const urgentAlerts = alerts
    .filter(a => a.severity <= 1 && !dismissedAlerts.includes(a.id))
    .slice(0, 2);

  return (
    <div>
      {showOcr && <OcrImportModal onClose={() => setShowOcr(false)} />}

      {/* 오늘 아침 브리핑 — 하루 첫 방문 시 자동 펼침, "확인했어요"로 그날 닫기 */}
      <MorningBriefing />

      {/* Unified Dashboard — 브리핑+히어로+출석+알림 통합 */}
      <Dashboard />

      {/* 서브탭: 종목 / 분석 — 세그먼트 pill */}
      {allStocksList.length > 0 && (
        <div style={{ display: 'flex', gap: 4, padding: '4px', borderRadius: 12, background: 'var(--bg-subtle, #F2F4F6)', marginBottom: 16 }}>
          {([['stocks', '종목'], ['analysis', '분석']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className="cursor-pointer"
              style={{
                flex: 1,
                padding: '10px 0',
                minHeight: 40,
                fontSize: 14,
                fontWeight: subTab === key ? 600 : 400,
                color: subTab === key ? 'var(--surface, #fff)' : 'var(--text-secondary, #8B95A1)',
                background: subTab === key ? 'var(--text-primary, #191F28)' : 'transparent',
                border: 'none',
                borderRadius: 10,
                transition: 'all 0.2s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Empty state — 종목이 전혀 없을 때 */}
      {allStocksList.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ 
            width: 80, 
            height: 80, 
            margin: '0 auto 24px',
            background: 'var(--bg-subtle, #F2F4F6)',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.8
          }}>
            <svg viewBox="0 0 100 100" style={{ width: '60%', height: '60%' }}>
              <polyline points="10,80 28,54 48,62 68,34 86,20" stroke="#D1D5DB" strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="86" cy="20" r="8" fill="#D1D5DB" />
            </svg>
          </div>
          <div style={{ fontSize: 'clamp(18px, 5vw, 24px)', fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 6 }}>
            종목을 추가해보세요
          </div>          <div style={{ fontSize: 13, color: 'var(--text-secondary, #8B95A1)', marginBottom: 20 }}>이미 투자 중이라면 스크린샷으로 한번에 가져올 수 있어요</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <button
              onClick={() => setShowOcr(true)}
              style={{ padding: '12px 28px', borderRadius: 12, background: '#191F28', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span style={{ fontSize: 16 }}>📸</span> 증권앱에서 가져오기
            </button>
            <button
              onClick={() => {
                const searchBtn = document.querySelector('[data-slot="search-trigger"]') as HTMLElement;
                if (searchBtn) searchBtn.click();
              }}
              style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--bg-subtle, #F2F4F6)', color: 'var(--text-secondary, #4E5968)', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              직접 종목 검색하기
            </button>
          </div>
        </div>
      )}

      {/* ===== 종목 탭 ===== */}
      {subTab === 'stocks' && (
      <div style={{ marginTop: 8, paddingTop: 12 }}>

        {/* 오늘의 한 줄 헤드라인 — 이상 신호가 있을 때만 표시 */}
        {todayHeadline && investingStocks.length > 0 && (
          <div
            style={{
              marginBottom: 12,
              padding: '10px 14px',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
              border: '1px solid',
              ...(todayHeadline.tone === 'gain'
                ? { background: 'var(--color-gain-bg, rgba(239,68,82,0.06))', color: 'var(--color-gain, #EF4452)', borderColor: 'rgba(239,68,82,0.18)' }
                : todayHeadline.tone === 'loss'
                ? { background: 'var(--color-loss-bg, rgba(49,130,246,0.06))', color: 'var(--color-loss, #3182F6)', borderColor: 'rgba(49,130,246,0.18)' }
                : { background: 'var(--bg-subtle, #F2F4F6)', color: 'var(--text-primary, #191F28)', borderColor: 'var(--border-light, #F2F4F6)' }),
            }}
          >
            <span style={{ fontSize: 14 }}>{todayHeadline.emoji}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {todayHeadline.text}
            </span>
          </div>
        )}

        {/* Category tabs + 종목 추가 버튼 (같은 줄) */}
        <div className="flex items-center" style={{ borderBottom: '1px solid var(--border-light, #F2F4F6)', marginBottom: '20px' }}>
          <div className="flex items-center overflow-x-auto scrollbar-hide" style={{ flex: 1, gap: 0 }}>
          {TABS.map((tab, tabIdx) => {
            const isActive = activeTab === tab.id;
            const isFirst = tabIdx === 0;
            let count = 0;
            if (tab.id === 'all') count = allStocksList.length;
            else if (tab.id === 'investing') count = investingStocks.length;
            else if (tab.id === 'watching') count = watchingStocks.length;
            else if (tab.id === 'sold') count = soldStocks.length;

            return (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className="relative cursor-pointer"
                style={{
                  padding: isFirst ? '0 24px 14px 0' : '0 24px 14px',
                  fontSize: '15px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--text-primary, #191F28)' : 'var(--text-secondary, #8B95A1)',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
                <span className="tabular-nums" style={{ fontSize: '13px', color: 'var(--text-tertiary, #B0B8C1)', marginLeft: '4px', fontWeight: 400 }}>
                  {count}
                </span>
                {isActive && (
                  <span
                    className="absolute"
                    style={{
                      bottom: 0,
                      height: '2px',
                      background: 'var(--text-primary, #191F28)',
                      borderRadius: '1px',
                      left: isFirst ? 0 : '24px',
                      right: '24px',
                    }}
                  />
                )}
              </button>
            );
          })}
          </div>
          <div style={{ display: 'flex', gap: 6, marginLeft: 8, marginBottom: 4 }}>
            <button
              onClick={() => setShowOcr(true)}
              className="cursor-pointer shrink-0"
              style={{ padding: '6px 10px', fontSize: 12, fontWeight: 600, color: '#4E5968', background: '#F2F4F6', border: 'none', borderRadius: 8, whiteSpace: 'nowrap' }}
              title="MTS 스크린샷으로 한번에 가져오기"
            >
              📸
            </button>
            <button
              onClick={() => {
                const searchBtn = document.querySelector('[data-slot="search-trigger"]') as HTMLElement;
                if (searchBtn) searchBtn.click();
              }}
              className="cursor-pointer shrink-0"
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--brand-gradient, #1B6B3A)', border: 'none', borderRadius: 8, whiteSpace: 'nowrap' }}
            >
              + 종목 추가
            </button>
          </div>
        </div>

        {/* 기간 탭 + 지연 시세 — 종목 있을 때만 */}
        {displayList.length > 0 && (
          <div className="flex items-center justify-between" style={{ marginBottom: 12, gap: 8 }}>
            {/* 기간 탭 */}
            <div className="flex items-center scrollbar-hide" style={{ gap: 4, overflowX: 'auto', flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginRight: 4, whiteSpace: 'nowrap', flexShrink: 0 }}>기간</span>
              {PERIOD_OPTIONS.map(opt => {
                const isActive = periodTab === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setPeriodTab(opt.key)}
                    className="cursor-pointer shrink-0"
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      fontWeight: isActive ? 700 : 400,
                      color: isActive ? '#fff' : 'var(--text-tertiary, #8B95A1)',
                      background: isActive ? 'var(--text-primary, #191F28)' : 'transparent',
                      border: `1px solid ${isActive ? 'var(--text-primary, #191F28)' : 'var(--border-light, #E5E8EB)'}`,
                      borderRadius: 20,
                      whiteSpace: 'nowrap',
                      minHeight: 30,
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {/* 지연 시세 안내 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#B0B8C1', whiteSpace: 'nowrap', flexShrink: 0 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#B0B8C1', display: 'inline-block' }} />
              15분 지연{lastUpdate && ` · ${lastUpdate}`}
            </div>
          </div>
        )}

        {/* Stock table */}
        {displayList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#x1F4CA;</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 8 }}>종목을 추가해볼까요?</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary, #8B95A1)', lineHeight: 1.6, marginBottom: 32 }}>
              관심 있는 종목을 추가하면<br/>실시간 가격, AI 분석, 스마트 알림을 받을 수 있어요.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
              {QUICK_ADD_STOCKS.map(s => {
                const allStocks = [...(stocks.investing || []), ...(stocks.watching || []), ...(stocks.sold || [])];
                const alreadyAdded = allStocks.some(st => st.symbol === s.symbol);
                return (
                  <button
                    key={s.symbol}
                    onClick={() => {
                      if (alreadyAdded) {
                        // 해제: 해당 종목 찾아서 삭제
                        for (const cat of ['investing', 'watching', 'sold'] as const) {
                          const idx = (stocks[cat] || []).findIndex(st => st.symbol === s.symbol);
                          if (idx >= 0) { deleteStock(cat, idx); break; }
                        }
                      } else {
                        addStock('watching', { symbol: s.symbol, avgCost: 0, shares: 0, targetReturn: 0, buyBelow: 0 });
                      }
                    }}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 20,
                      background: alreadyAdded ? '#3182F6' : 'var(--bg-subtle, #F2F4F6)',
                      fontSize: 14,
                      fontWeight: 500,
                      color: alreadyAdded ? '#fff' : 'var(--text-primary, #333D4B)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {alreadyAdded ? `\u2713 ${s.label}` : `+ ${s.label}`}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 24 }}>
              또는 상단 검색에서 원하는 종목을 찾아보세요
            </div>

            {/* 샘플 포트폴리오 체험 */}
            <button
              onClick={() => {
                const samples = [
                  { symbol: 'NVDA', avgCost: 95, shares: 10, targetReturn: 30 },
                  { symbol: 'AAPL', avgCost: 175, shares: 5, targetReturn: 15 },
                  { symbol: 'MSFT', avgCost: 380, shares: 3, targetReturn: 20 },
                ];
                samples.forEach(s => {
                  const existing = [...(stocks.investing || []), ...(stocks.watching || []), ...(stocks.sold || [])];
                  if (!existing.some(st => st.symbol === s.symbol)) {
                    addStock('investing', s);
                  }
                });
              }}
              style={{
                padding: '10px 24px',
                borderRadius: 12,
                background: 'transparent',
                color: '#3182F6',
                fontSize: 13,
                fontWeight: 600,
                border: '1px dashed rgba(49,130,246,0.4)',
                cursor: 'pointer',
              }}
            >
              샘플 포트폴리오로 체험하기
            </button>
          </div>
        ) : (
          <div>
            {/* Sort selector — 모바일 필수, 데스크톱 보조 */}
            <div className="flex items-center scrollbar-hide" style={{ gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
              {SORT_OPTIONS.map(opt => {
                const isActive = sortBy === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => handleSort(opt.key)}
                    className="cursor-pointer shrink-0"
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#3182F6' : 'var(--text-tertiary, #8B95A1)',
                      background: isActive ? 'rgba(49,130,246,0.08)' : 'transparent',
                      border: `1px solid ${isActive ? 'rgba(49,130,246,0.2)' : 'var(--border-light, #E5E8EB)'}`,
                      borderRadius: 20,
                      whiteSpace: 'nowrap',
                      minHeight: 36,
                    }}
                  >
                    {opt.label}{isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </button>
                );
              })}
            </div>

            {/* Table header */}
            <div
              className="stock-table-header grid items-center"
              style={{
                gridTemplateColumns: 'minmax(160px, 1fr) 90px 90px 120px 120px 60px',
                padding: '0 0 12px',
                fontSize: '12px',
                color: 'var(--text-tertiary, #B0B8C1)',
                fontWeight: 400,
              }}
            >
              <span onClick={() => handleSort('name')} style={{ cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.color = '#4E5968')} onMouseLeave={e => (e.currentTarget.style.color = '#B0B8C1')}>
                종목명 {sortBy === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </span>
              <span onClick={() => handleSort('price')} className="text-right" style={{ cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.color = '#4E5968')} onMouseLeave={e => (e.currentTarget.style.color = '#B0B8C1')}>
                현재가 {sortBy === 'price' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </span>
              <span onClick={() => handleSort('change')} className="text-right" style={{ cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.color = '#4E5968')} onMouseLeave={e => (e.currentTarget.style.color = '#B0B8C1')}>
                {PERIOD_OPTIONS.find(p => p.key === periodTab)?.label ?? '오늘'} 등락 {sortBy === 'change' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </span>
              <span onClick={() => handleSort('pnl')} className="text-right hide-mobile" style={{ cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.color = '#4E5968')} onMouseLeave={e => (e.currentTarget.style.color = '#B0B8C1')}>
                내 수익 {sortBy === 'pnl' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </span>
              <span onClick={() => handleSort('goal')} className="text-right hide-mobile" style={{ cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.color = '#4E5968')} onMouseLeave={e => (e.currentTarget.style.color = '#B0B8C1')}>
                목표 달성 {sortBy === 'goal' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
              </span>
            </div>

            {/* Rows */}
            {sortedList.map((stock, i) => {
              const d = macroData[stock.symbol] as QuoteData | undefined;
              const price = d?.c || 0;
              const change = d?.d || 0;
              const dp = d?.dp || 0;
              const kr = STOCK_KR[stock.symbol] || stock.symbol;
              const isStockGain = dp >= 0;
              const avatarColor = getAvatarColor(stock.symbol);
              const badge = CAT_BADGES[stock.category];
              const priceWon = price * usdKrw;

              // Find highest-severity alert for this symbol
              const stockAlert = alerts
                .filter(a => a.symbol === stock.symbol && !dismissedAlerts.includes(a.id))
                .sort((a, b) => a.severity - b.severity)[0] || null;

              // P&L calculation (환차익 포함)
              let plWon = 0;
              let plUsd = 0;
              let plPct = 0;
              let stockPnLWon = 0;
              let fxPnLWon = 0;
              let hasFxData = false;
              let hasPosition = false;
              if (stock.avgCost > 0 && stock.shares > 0 && price > 0) {
                hasPosition = true;
                const costUsd = stock.avgCost * stock.shares;
                const valUsd = price * stock.shares;
                plUsd = valUsd - costUsd;
                const isKR = stock.symbol.endsWith('.KS') || stock.symbol.endsWith('.KQ');
                if (!isKR && stock.purchaseRate && stock.purchaseRate > 0) {
                  // 실제 원화 P&L = 현재평가 - 원화매수비용
                  const purchaseCostKrw = stock.avgCost * stock.shares * stock.purchaseRate;
                  const currentValueKrw = price * stock.shares * usdKrw;
                  plWon = currentValueKrw - purchaseCostKrw;
                  plPct = (plWon / purchaseCostKrw) * 100;
                  // 분리: 주식 수익 vs 환율 수익
                  stockPnLWon = plUsd * usdKrw;
                  fxPnLWon = stock.avgCost * stock.shares * (usdKrw - stock.purchaseRate);
                  hasFxData = true;
                } else {
                  plWon = plUsd * usdKrw;
                  plPct = ((price - stock.avgCost) / stock.avgCost) * 100;
                }
              }
              const plGain = plPct >= 0;

              // Goal progress
              let goalPct = 0;
              let hasGoal = false;
              if (stock.targetReturn > 0 && hasPosition) {
                hasGoal = true;
                goalPct = plPct;
              }

              return (
                <div
                  key={`${stock.symbol}-${stock.category}-${i}`}
                  onClick={() => setAnalysisSymbol(stock.symbol)}
                  className="stock-row stock-table-row grid items-center cursor-pointer transition-all"
                  style={{
                    gridTemplateColumns: 'minmax(160px, 1fr) 90px 90px 120px 120px 60px',
                    padding: '14px 0',
                    animationDelay: `${i * 30}ms`,
                    borderTop: '1px solid var(--border-light, #F2F4F6)',
                  }}
                >
                  {/* Name cell */}
                  <div className="flex items-center" style={{ gap: '12px' }}>
                    <div
                      className="flex items-center justify-center shrink-0"
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: avatarColor,
                      }}
                    >
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>{stock.symbol.charAt(0)}</span>
                    </div>
                    <div className="min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div className="flex items-center flex-wrap" style={{ fontSize: '15px', fontWeight: 600, gap: '6px' }}>
                        <span>{kr}</span>
                        {badge && (
                          <span
                            className={`${badge.bgCls} ${badge.textCls}`}
                            style={{
                              fontSize: '10px',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {badge.label}
                          </span>
                        )}
                        {stockAlert && (() => {
                          const badgeStyle = ALERT_BADGE_COLORS[stockAlert.type];
                          const badgeText = getAlertBadgeText(stockAlert);
                          return (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                padding: '2px 6px',
                                borderRadius: '10px',
                                whiteSpace: 'nowrap',
                                background: badgeStyle.bg,
                                color: badgeStyle.color,
                              }}
                            >
                              {badgeStyle.dot} {badgeText}
                            </span>
                          );
                        })()}
                      </div>
                      <div style={{ fontSize: '12px', color: '#B0B8C1' }}>
                        {stock.symbol}
                        {stock.shares > 0 && stock.avgCost > 0
                          ? ` · ${stock.shares}주 · 평단 ${currency === 'KRW' ? `${fmtWonShort(stock.avgCost * usdKrw)}` : `$${stock.avgCost.toFixed(2)}`}`
                          : stock.shares > 0
                            ? ` · ${stock.shares}주`
                            : ''}
                        {!stock.shares && stock.buyBelow
                          ? ` · 목표 ${currency === 'KRW' ? `${fmtWonShort(stock.buyBelow * usdKrw)}` : `$${stock.buyBelow}`}`
                          : ''}
                      </div>
                    </div>
                  </div>

                  {/* Price cell */}
                  <div className="text-right">
                    <div className="text-[15px] font-semibold text-[#191F28] tabular-nums">
                      {price
                        ? currency === 'KRW'
                          ? `${fmtWonShort(priceWon)}`
                          : `$${price.toFixed(2)}`
                        : <span className="skeleton-shimmer inline-block" style={{ width: 60, height: 16, borderRadius: 4 }} />}
                    </div>
                    <div className="text-[11px] text-[#B0B8C1] mt-0.5 tabular-nums">
                      {price > 0
                        ? currency === 'KRW'
                          ? `$${price.toFixed(2)}`
                          : `${fmtWonShort(priceWon)}`
                        : ''}
                    </div>
                  </div>

                  {/* Period return cell */}
                  {(() => {
                    const periodPct = periodTab === '1d'
                      ? (price ? dp : null)
                      : getPeriodReturn(stock.symbol, periodTab, price, d?.pc, rawCandles);
                    const isUp = (periodPct ?? 0) >= 0;
                    return (
                      <div className="text-right">
                        <div className={`text-[13px] font-semibold tabular-nums ${isUp ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                          {periodPct != null
                            ? `${isUp ? '▲' : '▼'} ${isUp ? '+' : ''}${periodPct.toFixed(2)}%`
                            : price ? <span style={{ color: 'var(--text-tertiary, #B0B8C1)', fontWeight: 400 }}>—</span> : '--'}
                        </div>
                        {/* 오늘만 절대값 표시 */}
                        {periodTab === '1d' && price > 0 && (
                          <div className={`text-[11px] font-normal mt-0.5 tabular-nums ${isUp ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                            {currency === 'KRW'
                              ? `${change >= 0 ? '+' : ''}${fmtWonShort(Math.abs(change * usdKrw))}`
                              : `${change >= 0 ? '+' : ''}$${change.toFixed(2)}`}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* P&L cell */}
                  <div className="text-right hide-mobile">
                    {hasPosition ? (
                      <>
                        <div
                          className="tabular-nums"
                          style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: plGain ? '#EF4452' : '#3182F6',
                          }}
                        >
                          {stock.symbol.endsWith('.KS') || stock.symbol.endsWith('.KQ') || currency === 'KRW'
                            ? `${plGain ? '+' : '-'}${fmtWonShort(Math.abs(plWon))}`
                            : `${plGain ? '+' : '-'}$${Math.abs(plUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          }
                        </div>
                        <div
                          className="tabular-nums"
                          style={{
                            fontSize: '12px',
                            fontWeight: 400,
                            marginTop: '2px',
                            color: plGain ? 'rgba(239,68,82,0.7)' : 'rgba(49,130,246,0.7)',
                          }}
                        >
                          ({plGain ? '+' : ''}{plPct.toFixed(2)}%)
                        </div>
                        {/* 환차익 분리 표시 */}
                        {hasFxData && currency === 'KRW' && (
                          <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', lineHeight: 1.5 }}>
                            <div>주식 {stockPnLWon >= 0 ? '+' : ''}{fmtWonShort(stockPnLWon)}</div>
                            <div style={{ color: fxPnLWon >= 0 ? 'rgba(239,68,82,0.6)' : 'rgba(49,130,246,0.6)' }}>
                              환율 {fxPnLWon >= 0 ? '+' : ''}{fmtWonShort(fxPnLWon)}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="text-[13px] font-semibold text-[#B0B8C1]">-</div>
                        <div className="text-[11px] text-[#B0B8C1] mt-0.5">미보유</div>
                      </>
                    )}
                  </div>

                  {/* Goal progress cell */}
                  <div className="text-right pr-1 hide-mobile">
                    {hasGoal ? (
                      <div className="flex items-center justify-end" style={{ gap: '6px' }}>
                        {goalPct >= stock.targetReturn ? (
                          // 목표 초과 달성: 바 없이 텍스트만 (● 마커로 데이터-잉크 비율 개선)
                          <>
                            <span aria-label="목표 달성" style={{ fontSize: '7px', color: '#6B48FF', lineHeight: 1 }}>●</span>
                            <span className="tabular-nums" style={{ fontSize: '12px', color: '#6B48FF', whiteSpace: 'nowrap', fontWeight: 700 }}>
                              {plPct.toFixed(1)}/{stock.targetReturn}%
                            </span>
                          </>
                        ) : goalPct < 0 ? (
                          // 마이너스: 바 없이 텍스트만
                          <span className="tabular-nums" style={{ fontSize: '12px', color: 'var(--text-tertiary, #B0B8C1)', whiteSpace: 'nowrap' }}>
                            {plPct.toFixed(1)}/{stock.targetReturn}%
                          </span>
                        ) : (
                          // 진행 중: 진행 바 + 텍스트
                          <>
                            <div style={{ width: '60px', height: '4px', background: 'var(--bg-subtle, #F2F4F6)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  borderRadius: '2px',
                                  background: '#3182F6',
                                  width: `${Math.min(goalPct / stock.targetReturn * 100, 100)}%`,
                                }}
                              />
                            </div>
                            <span className="tabular-nums" style={{ fontSize: '12px', color: '#8B95A1', whiteSpace: 'nowrap' }}>
                              {plPct.toFixed(1)}/{stock.targetReturn}%
                            </span>
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#B0B8C1]">-</span>
                    )}
                  </div>

                  {/* Edit/Delete actions */}
                  <div className="row-actions flex items-center gap-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingCat(stock.category); setEditingIdx(stock.originalIdx); }}
                      style={{ padding: 10, borderRadius: 8, cursor: 'pointer', background: 'transparent', border: 'none', minWidth: 34, minHeight: 34 }}
                    >
                      <Edit3 size={14} color="#B0B8C1" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const deleted = stocks[stock.category]?.[stock.originalIdx];
                        if (!deleted) return;
                        deleteStock(stock.category, stock.originalIdx);
                        logApiCall('stock_delete', stock.symbol);
                        // Undo 토스트
                        if (undoData?.timer) clearTimeout(undoData.timer);
                        const timer = setTimeout(() => setUndoData(null), 5000);
                        setUndoData({ cat: stock.category, stock: deleted, timer });
                      }}
                      style={{ padding: 10, borderRadius: 8, cursor: 'pointer', background: 'transparent', border: 'none', minWidth: 34, minHeight: 34 }}
                    >
                      <Trash2 size={14} color="#B0B8C1" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 월간 회고 — 시간 적응형 시즌 카드 (위치: 종목 리스트 바로 아래)
            진행 중(1~25일): "이번 달 페이스" 차분 톤
            마감 임박(26~말일): "○월 마감 임박 D-N" 긴장감
            확정(다음 달 1~5일): "○월 회고" 컬러풀 + 공유 강조 */}
        {investingStocks.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <MonthlyReplay />
          </div>
        )}

        {/* 포트폴리오 맵 — NASDAQ 스타일 미니 히트맵 */}
        {investingStocks.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{
              fontSize: 12, fontWeight: 700,
              color: 'var(--text-tertiary, #B0B8C1)',
              marginBottom: 8, letterSpacing: 0.4,
            }}>
              포트폴리오 맵
            </div>
            <PortfolioHeatmap
              variant="compact"
              stocks={investingStocks}
              macroData={macroData}
              usdKrw={usdKrw}
              currency={currency}
              rawCandles={rawCandles}
              onExpand={() => setSubTab('analysis')}
              onCellClick={(sym) => setAnalysisSymbol(sym)}
            />
          </div>
        )}

        {/* AI 촉 안내 CTA — 인사이트 탭으로 유도 */}
        {displayList.length > 0 && (
          <button
            onClick={() => {
              const { setCurrentSection } = usePortfolioStore.getState();
              setCurrentSection('insights');
            }}
            style={{
              width: '100%', marginTop: 32, padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 10,
              borderRadius: 14,
              background: 'linear-gradient(135deg, var(--color-info-bg, rgba(49,130,246,0.06)) 0%, rgba(175,82,222,0.05) 100%)',
              border: '1px solid var(--border-light, #F2F4F6)',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 22 }}>🤖</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                AI 촉 · 주비의 이야기 · 숨은 종목
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B95A1)', marginTop: 2 }}>
                주비 AI가 오늘 당신의 포트폴리오를 읽어드려요
              </div>
            </div>
            <span style={{ fontSize: 14, color: 'var(--text-tertiary, #B0B8C1)' }}>›</span>
          </button>
        )}

        {/* 내 종목 뉴스는 '뉴스' 탭으로 이동 — 여기서는 간단한 링크만 */}
        {investingStocks.length > 0 && (
          <button
            onClick={() => {
              const { setCurrentSection, setCurrentNewsMarket } = usePortfolioStore.getState();
              setCurrentNewsMarket('all');
              setCurrentSection('news');
            }}
            aria-label="뉴스 탭으로 이동해 내 종목 뉴스 보기"
            style={{
              width: '100%', marginTop: 24, padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
              borderRadius: 14,
              background: 'var(--bg-subtle, #F8F9FA)',
              border: '1px solid var(--border-light, #F2F4F6)',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 22 }}>📰</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                내 종목 뉴스 보기
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B95A1)', marginTop: 2 }}>
                뉴스 탭에서 보유 종목 관련 기사를 확인하세요
              </div>
            </div>
            <span style={{ fontSize: 14, color: 'var(--text-tertiary, #B0B8C1)' }}>›</span>
          </button>
        )}

      </div>
      )}

      {/* ===== 분석 탭 ===== */}
      {subTab === 'analysis' && allStocksList.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {hasInvestment ? (() => {
            const investingData = investingStocks.map(s => {
              const q = macroData[s.symbol] as QuoteData | undefined;
              return {
                symbol: s.symbol, avgCost: s.avgCost, shares: s.shares,
                targetReturn: s.targetReturn, currentPrice: q?.c || 0,
                value: (q?.c || 0) * s.shares,
              };
            });
            return (
              <>
                <PortfolioValueChart />
                {/* 데스크탑 2-column 그리드 */}
                <div className="portfolio-widgets-grid">
                  <style>{`
                    .portfolio-widgets-grid { display: flex; flex-direction: column; gap: 0; }
                    @media (min-width: 1024px) {
                      .portfolio-widgets-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                    }
                  `}</style>
                  <BenchmarkCompare />
                  <PortfolioHeatmap
                    stocks={investingStocks}
                    macroData={macroData}
                    usdKrw={usdKrw}
                    currency={currency}
                    rawCandles={rawCandles}
                    onCellClick={(sym) => setAnalysisSymbol(sym)}
                  />
                  <PortfolioHealth stocks={investingData} />
                </div>
                <GoalProgress stocks={investingData} currency={currency} usdKrw={usdKrw} />
                {/* IA 재정비 — AI 인사이트 탭에서 이동된 회고/통계 컴포넌트 */}
                <ThrowbackCard />
                <TradePatternMirror />
                <PortfolioDNA />
                <StockPulse />
                <InvestmentJournal />
                <ShareCard />
              </>
            );
          })() : (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #191F28)', marginBottom: 6 }}>
                투자 종목을 추가하면
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary, #8B95A1)', lineHeight: 1.6 }}>
                포트폴리오 맵, 건강 점수, 시장 대비 성과,<br/>목표 달성 현황을 여기서 확인할 수 있어요.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Undo 삭제 토스트 */}
      {undoData && (
        <div style={{
          position: 'fixed',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--text-primary, #191F28)',
          color: '#FFFFFF',
          padding: '12px 20px',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          fontSize: 13,
          fontWeight: 500,
          maxWidth: 'calc(100vw - 32px)',
        }}>
          <span>{STOCK_KR[undoData.stock.symbol] || undoData.stock.symbol} 삭제됨</span>
          <button
            onClick={() => {
              addStock(undoData.cat, undoData.stock);
              clearTimeout(undoData.timer);
              setUndoData(null);
            }}
            style={{ background: 'none', border: 'none', color: '#3182F6', fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: '4px 8px' }}
          >
            되돌리기
          </button>
        </div>
      )}
    </div>
  );
}

