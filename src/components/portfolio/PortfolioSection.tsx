'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useNewsData, fetchKoreanNews } from '@/hooks/useStockData';
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import type { StockCategory, QuoteData, MacroEntry, NewsItem, StockItem } from '@/config/constants';
import type { Alert } from '@/utils/alertsEngine';
import { Edit3, Trash2 } from 'lucide-react';
import { logApiCall } from '@/lib/apiLogger';
import PortfolioHeatmap from './PortfolioHeatmap';
import GoalProgress from './GoalProgress';
import PortfolioHealth from './PortfolioHealth';
import LoginStreak from './LoginStreak';
import ShareCard from './ShareCard';

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

// Tag colors for portfolio news
const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  MU: { bg: '#EBF3FF', color: '#3182F6' },
  MSFT: { bg: '#F0FAF0', color: '#20C997' },
  ASTX: { bg: '#F3F0FF', color: '#6366F1' },
  BEX: { bg: '#FFF0F5', color: '#EC4899' },
  AVGO: { bg: '#FFF0F0', color: '#EF4444' },
  AMZN: { bg: '#FFF8E1', color: '#FF9900' },
};

function getTagColor(symbol: string) {
  return TAG_COLORS[symbol] || { bg: '#F2F4F6', color: '#8B95A1' };
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
  if (alert.id.includes('buy-zone')) return '매수 구간';
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
  if (alert.id.includes('macd-bull')) return 'MACD 매수';
  if (alert.id.includes('macd-bear')) return 'MACD 매도';
  if (alert.id.includes('target-return')) return '수익 달성';
  return '알림';
}

function fmtWon(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 100000000) return `${(val / 100000000).toFixed(1)}억원`;
  if (abs >= 10000) return `${(val / 10000).toFixed(1)}만원`;
  return `${Math.round(val)}원`;
}

function fmtWonShort(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 100000000) return `${(val / 100000000).toFixed(1)}억`;
  if (abs >= 10000) return `${(val / 10000).toFixed(1)}만`;
  return `${Math.round(val)}`;
}

export default function PortfolioSection() {
  const {
    stocks, currentTab, macroData,
    setCurrentTab, setAnalysisSymbol,
    deleteStock, setEditingCat, setEditingIdx,
    addStock,
    alerts, dismissedAlerts,
    currency, setCurrency,
    lastUpdate,
  } = usePortfolioStore();

  const [portfolioNews, setPortfolioNews] = useState<(NewsItem & { tag: string })[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'change' | 'pnl' | 'goal'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Fetch portfolio-related news — use shorter queries for better results
  useEffect(() => {
    const investingSymbols = (stocks.investing || []).map(s => s.symbol);
    if (!investingSymbols.length) return;
    // Use stocks that have Korean names for better search results
    const krNames = investingSymbols
      .map(s => STOCK_KR[s])
      .filter(Boolean)
      .slice(0, 3);
    // Fallback: if no Korean names, use "미국 주식" as generic query
    const query = krNames.length > 0 ? krNames.join(' ') + ' 주가' : '미국 주식 증시';
    fetchKoreanNews(query).then(items => {
      if (items) {
        const tagged = items.slice(0, 5).map(item => {
          let tag = investingSymbols[0];
          for (const sym of investingSymbols) {
            const kr = STOCK_KR[sym] || sym;
            if (item.title.includes(kr) || item.title.includes(sym)) {
              tag = sym;
              break;
            }
          }
          return { ...item, tag };
        });
        setPortfolioNews(tagged);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div>
      {/* Login Streak */}
      <LoginStreak />

      {/* Hero - centered */}
      <div className="hero-section" style={{ paddingTop: '20px', paddingBottom: '40px', position: 'relative', background: 'linear-gradient(180deg, #FAFBFF 0%, transparent 100%)', margin: '0 -16px', padding: '20px 16px 40px', borderRadius: 16 }}>
        <style>{`
          .hero-section { text-align: center; }
          @media (min-width: 769px) { .hero-section { margin: 0 -48px !important; padding: 20px 48px 40px !important; } }
          @media (min-width: 1024px) { .hero-section { text-align: left; } }
        `}</style>
        {/* Currency toggle */}
        <div className="flex items-center" style={{ position: 'absolute', top: 0, right: 0 }}>
          <button
            onClick={() => setCurrency('KRW')}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: currency === 'KRW' ? 700 : 400,
              color: currency === 'KRW' ? '#fff' : '#8B95A1',
              background: currency === 'KRW' ? '#191F28' : 'transparent',
              border: '1px solid #E5E8EB',
              borderRadius: '8px 0 0 8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >₩</button>
          <button
            onClick={() => setCurrency('USD')}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: currency === 'USD' ? 700 : 400,
              color: currency === 'USD' ? '#fff' : '#8B95A1',
              background: currency === 'USD' ? '#191F28' : 'transparent',
              border: '1px solid #E5E8EB',
              borderLeft: 'none',
              borderRadius: '0 8px 8px 0',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >$</button>
        </div>

        <div style={{ fontSize: '13px', color: '#8B95A1', fontWeight: 500, marginBottom: '12px', letterSpacing: '0.04em' }}>내 수익</div>
        {hasInvestment ? (
          <>
            <div
              className={`tabular-nums ${isGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}
              style={{ fontSize: '42px', fontWeight: 800, lineHeight: 1.1 }}
            >
              {currency === 'KRW'
                ? `${isGain ? '+' : '-'}₩${fmtWon(Math.abs(totalPLWon))}`
                : `${isGain ? '+' : '-'}$${Math.abs(totalPL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              }
            </div>
            <div
              className={`${isGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}
              style={{ fontSize: '20px', fontWeight: 600, marginTop: '6px' }}
            >
              ({isGain ? '+' : ''}{totalPLPercent.toFixed(2)}%)
            </div>

            {/* 오늘 변동 */}
            {holdingCount > 0 && (
              <div style={{ marginTop: 16, padding: '8px 16px', borderRadius: 10, background: todayGain ? 'rgba(239,68,82,0.06)' : 'rgba(49,130,246,0.06)', display: 'inline-block' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: todayGain ? '#EF4452' : '#3182F6' }}>
                  오늘 {todayGain ? '▲' : '▼'}{' '}
                  {currency === 'KRW'
                    ? `${todayGain ? '+' : ''}₩${fmtWonShort(todayChangeWon)}`
                    : `${todayGain ? '+' : ''}$${todayChange.toFixed(2)}`}
                  {' '}({todayGain ? '+' : ''}{todayChangePct.toFixed(2)}%)
                </span>
              </div>
            )}

            {/* 총평가/총투자/보유 */}
            <div className="flex items-center justify-center lg:justify-start flex-wrap" style={{ gap: '24px', marginTop: '20px' }}>
              <div style={{ fontSize: '14px', color: '#8B95A1' }}>
                총 평가{' '}
                <strong style={{ color: '#191F28', fontWeight: 600 }}>
                  {currency === 'KRW'
                    ? `₩${fmtWon(totalValueWon)}`
                    : `$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  }
                </strong>
              </div>
              <div style={{ width: '1px', height: '14px', background: '#E5E8EB' }} />
              <div style={{ fontSize: '14px', color: '#8B95A1' }}>
                총 투자{' '}
                <strong style={{ color: '#191F28', fontWeight: 600 }}>
                  {currency === 'KRW'
                    ? `₩${fmtWon(totalCostWon)}`
                    : `$${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  }
                </strong>
              </div>
              <div style={{ width: '1px', height: '14px', background: '#E5E8EB' }} />
              <div style={{ fontSize: '14px', color: '#8B95A1' }}>
                종목 <strong style={{ color: '#191F28', fontWeight: 600 }}>{holdingCount}개 보유</strong>
              </div>
            </div>

            {/* 인사이트: 승률 + 최고/최저 */}
            {holdingCount >= 2 && (
              <div className="justify-center lg:justify-start" style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#8B95A1', background: '#F8F9FA', padding: '5px 12px', borderRadius: 8 }}>
                  승률 {holdingCount > 0 ? Math.round((winCount / holdingCount) * 100) : 0}% ({winCount}/{holdingCount})
                </span>
                {bestStock.symbol && bestStock.dp > -Infinity && (
                  <span style={{ fontSize: 12, color: '#EF4452', background: 'rgba(239,68,82,0.06)', padding: '5px 12px', borderRadius: 8 }}>
                    Best {STOCK_KR[bestStock.symbol] || bestStock.symbol} {bestStock.dp >= 0 ? '+' : ''}{bestStock.dp.toFixed(1)}%
                  </span>
                )}
                {worstStock.symbol && worstStock.dp < Infinity && (
                  <span style={{ fontSize: 12, color: '#3182F6', background: 'rgba(49,130,246,0.06)', padding: '5px 12px', borderRadius: 8 }}>
                    Worst {STOCK_KR[worstStock.symbol] || worstStock.symbol} {worstStock.dp >= 0 ? '+' : ''}{worstStock.dp.toFixed(1)}%
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-[32px] font-bold text-[#191F28]">
              {allStocksList.length > 0 ? '데이터 불러오는 중...' : '종목을 추가해보세요'}
            </div>
            <div className="text-[13px] text-[#8B95A1] mt-2">매수 단가와 수량을 설정하면 수익률을 확인할 수 있어요</div>
          </>
        )}
      </div>

      {/* Divider + content below — 종목 리스트 먼저 */}
      <div style={{ marginTop: 32, borderTop: '1px solid #F2F4F6', paddingTop: 32 }}>

        {/* Category tabs */}
        <div className="flex items-center overflow-x-auto scrollbar-hide" style={{ gap: 0, borderBottom: '1px solid #F2F4F6', marginBottom: '32px' }}>
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
                  color: isActive ? '#191F28' : '#8B95A1',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
                <span className="tabular-nums" style={{ fontSize: '13px', color: '#B0B8C1', marginLeft: '4px', fontWeight: 400 }}>
                  {count}
                </span>
                {isActive && (
                  <span
                    className="absolute"
                    style={{
                      bottom: 0,
                      height: '2px',
                      background: '#191F28',
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

        {/* 지연 시세 안내 */}
        {displayList.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 8, fontSize: 11, color: '#B0B8C1' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#B0B8C1', display: 'inline-block' }} />
            15분 지연 시세{lastUpdate && ` · ${lastUpdate} 갱신`}
          </div>
        )}

        {/* Stock table */}
        {displayList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#x1F4CA;</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#191F28', marginBottom: 8 }}>종목을 추가해볼까요?</div>
            <div style={{ fontSize: 14, color: '#8B95A1', lineHeight: 1.6, marginBottom: 32 }}>
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
                      background: alreadyAdded ? '#3182F6' : '#F2F4F6',
                      fontSize: 14,
                      fontWeight: 500,
                      color: alreadyAdded ? '#fff' : '#333D4B',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {alreadyAdded ? `\u2713 ${s.label}` : `+ ${s.label}`}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 13, color: '#B0B8C1' }}>
              또는 상단 검색에서 원하는 종목을 찾아보세요
            </div>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div
              className="stock-table-header grid items-center"
              style={{
                gridTemplateColumns: 'minmax(180px, 1.5fr) 100px 100px 140px 160px auto',
                padding: '0 0 12px',
                fontSize: '12px',
                color: '#B0B8C1',
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
                오늘 등락 {sortBy === 'change' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
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

              // P&L calculation
              let plWon = 0;
              let plUsd = 0;
              let plPct = 0;
              let hasPosition = false;
              if (stock.avgCost > 0 && stock.shares > 0 && price > 0) {
                hasPosition = true;
                const costUsd = stock.avgCost * stock.shares;
                const valUsd = price * stock.shares;
                plUsd = valUsd - costUsd;
                plWon = plUsd * usdKrw;
                plPct = ((price - stock.avgCost) / stock.avgCost) * 100;
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
                    gridTemplateColumns: 'minmax(180px, 1.5fr) 100px 100px 140px 160px auto',
                    padding: '14px 0',
                    animationDelay: `${i * 30}ms`,
                    borderTop: '1px solid #F7F8FA',
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
                          ? ` · ${stock.shares}주 · 평단 ${currency === 'KRW' ? `₩${fmtWonShort(stock.avgCost * usdKrw)}` : `$${stock.avgCost.toFixed(2)}`}`
                          : stock.shares > 0
                            ? ` · ${stock.shares}주`
                            : ''}
                        {!stock.shares && stock.buyBelow
                          ? ` · 목표 ${currency === 'KRW' ? `₩${fmtWonShort(stock.buyBelow * usdKrw)}` : `$${stock.buyBelow}`}`
                          : ''}
                      </div>
                    </div>
                  </div>

                  {/* Price cell */}
                  <div className="text-right">
                    <div className="text-[15px] font-semibold text-[#191F28] tabular-nums">
                      {price
                        ? currency === 'KRW'
                          ? `₩${fmtWonShort(priceWon)}`
                          : `$${price.toFixed(2)}`
                        : '--'}
                    </div>
                    <div className="text-[11px] text-[#B0B8C1] mt-0.5 tabular-nums">
                      {price > 0
                        ? currency === 'KRW'
                          ? `$${price.toFixed(2)}`
                          : `₩${fmtWonShort(priceWon)}`
                        : ''}
                    </div>
                  </div>

                  {/* Today change cell */}
                  <div className="text-right">
                    <div className={`text-[13px] font-semibold tabular-nums ${isStockGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                      {price ? `${isStockGain ? '▲' : '▼'} ${isStockGain ? '+' : ''}${dp.toFixed(2)}%` : '--'}
                    </div>
                    <div className={`text-[11px] font-normal mt-0.5 tabular-nums ${isStockGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                      {price
                        ? currency === 'KRW'
                          ? `${change >= 0 ? '+' : ''}₩${fmtWonShort(Math.abs(change * usdKrw))}`
                          : `${change >= 0 ? '+' : ''}$${change.toFixed(2)}`
                        : ''}
                    </div>
                  </div>

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
                          {/* Korean stocks always show Won; others follow toggle */}
                          {stock.symbol.endsWith('.KS') || stock.symbol.endsWith('.KQ') || currency === 'KRW'
                            ? `${plGain ? '+' : '-'}₩${fmtWonShort(Math.abs(plWon))}`
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
                      <div className="flex items-center justify-end" style={{ gap: '8px' }}>
                        <div style={{ width: '100px', height: '6px', background: '#F2F4F6', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              borderRadius: '3px',
                              background: goalPct >= 0 ? '#EF4452' : '#3182F6',
                              width: `${Math.min(Math.max(goalPct / stock.targetReturn * 100, 0), 100)}%`,
                            }}
                          />
                        </div>
                        <span className="tabular-nums" style={{ fontSize: '12px', color: '#8B95A1', whiteSpace: 'nowrap' }}>
                          {plPct.toFixed(1)}/{stock.targetReturn}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#B0B8C1]">-</span>
                    )}
                  </div>

                  {/* Edit/Delete actions */}
                  <div className="row-actions flex items-center gap-0" style={{ opacity: 0, transition: 'opacity 0.2s' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingCat(stock.category); setEditingIdx(stock.originalIdx); }}
                      style={{ padding: 10, borderRadius: 8, cursor: 'pointer', background: 'transparent', border: 'none', minWidth: 34, minHeight: 34 }}
                    >
                      <Edit3 size={14} color="#B0B8C1" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteStock(stock.category, stock.originalIdx); logApiCall('stock_delete', stock.symbol); }}
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

        {/* 내 종목 뉴스 — 항상 표시 */}
        <div style={{ marginTop: '48px', borderTop: '1px solid #F2F4F6', paddingTop: '40px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#191F28', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            내 종목 뉴스
          </div>
          {portfolioNews.length > 0 ? (
            <div>
              {portfolioNews.map((item, idx) => {
                const tagColor = getTagColor(item.tag);
                const relTime = item.pubDate ? getRelativeTime(item.pubDate) : '';
                return (
                  <div
                    key={idx}
                    onClick={() => window.open(item.link, '_blank')}
                    className="cursor-pointer hover:bg-[#F9FAFB] transition-colors rounded-lg"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '14px',
                      padding: '14px 4px',
                      borderTop: idx > 0 ? '1px solid #F7F8FA' : 'none',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        marginTop: '2px',
                        background: tagColor.bg,
                        color: tagColor.color,
                      }}
                    >
                      {item.tag}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, lineHeight: 1.5, marginBottom: '4px', color: '#191F28' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#B0B8C1' }}>
                        {item.source}{item.source && relTime ? ' · ' : ''}{relTime}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#B0B8C1', padding: '20px 0' }}>
              뉴스를 불러오는 중...
            </div>
          )}
        </div>

        {/* 분석 위젯 — 종목 리스트/뉴스 아래 */}
        {hasInvestment && (() => {
          const investingData = investingStocks.map(s => {
            const q = macroData[s.symbol] as QuoteData | undefined;
            return {
              symbol: s.symbol, avgCost: s.avgCost, shares: s.shares,
              targetReturn: s.targetReturn, currentPrice: q?.c || 0,
              value: (q?.c || 0) * s.shares,
            };
          });
          return (
            <div style={{ marginTop: 32, borderTop: '1px solid #F2F4F6', paddingTop: 32 }}>
              {/* 데스크탑 2-column 그리드 */}
              <div className="portfolio-widgets-grid">
                <style>{`
                  .portfolio-widgets-grid { display: flex; flex-direction: column; gap: 0; }
                  @media (min-width: 1024px) {
                    .portfolio-widgets-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                  }
                `}</style>
                <PortfolioHeatmap stocks={investingStocks} macroData={macroData} usdKrw={usdKrw} currency={currency} />
                <PortfolioHealth stocks={investingData} />
              </div>
              <GoalProgress stocks={investingData} currency={currency} usdKrw={usdKrw} />
              <ShareCard />
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function getRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    return d.toLocaleDateString('ko-KR');
  } catch {
    return '';
  }
}
