'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useNewsData, fetchKoreanNews } from '@/hooks/useStockData';
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import type { StockCategory, QuoteData, MacroEntry, NewsItem, StockItem } from '@/config/constants';
import type { Alert } from '@/utils/alertsEngine';

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
    alerts, dismissedAlerts,
    currency, setCurrency,
  } = usePortfolioStore();

  const [portfolioNews, setPortfolioNews] = useState<(NewsItem & { tag: string })[]>([]);

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

  return (
    <div>
      {/* Hero - centered */}
      <div style={{ textAlign: 'center', paddingTop: '20px', paddingBottom: '40px', position: 'relative' }}>
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

        <div style={{ fontSize: '14px', color: '#8B95A1', fontWeight: 400, marginBottom: '12px' }}>내 수익</div>
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
            <div className="flex items-center justify-center" style={{ gap: '24px', marginTop: '24px' }}>
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
            <div style={{ fontSize: 12, color: '#B0B8C1', marginTop: 12, lineHeight: 1.6, background: '#F8F9FA', padding: '10px 14px', borderRadius: 8, textAlign: 'left', display: 'inline-block', maxWidth: 480 }}>
              {currency === 'KRW'
                ? `💡 원화 금액은 현재 환율(₩${usdKrw.toLocaleString(undefined, { maximumFractionDigits: 0 })}/$)로 환산한 금액이에요. 환율 변동에 따라 실제 수익과 차이가 날 수 있어요.`
                : '💡 달러 기준으로 표시 중이에요. ₩ 버튼으로 원화 전환 가능해요.'
              }
            </div>
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

      {/* Divider + content below */}
      <div style={{ marginTop: '40px', borderTop: '1px solid #F2F4F6', paddingTop: '40px' }}>

        {/* Category tabs */}
        <div className="flex items-center" style={{ gap: 0, borderBottom: '1px solid #F2F4F6', marginBottom: '32px' }}>
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

        {/* Stock table */}
        {displayList.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-[36px] mb-3">📊</div>
            <div className="text-[15px] font-semibold text-[#191F28]">종목이 없습니다</div>
            <div className="text-[13px] text-[#8B95A1] mt-1">상단 검색에서 추가하세요</div>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div
              className="grid items-center"
              style={{
                gridTemplateColumns: 'minmax(180px, 1.5fr) 100px 100px 140px 160px',
                padding: '0 0 12px',
                fontSize: '12px',
                color: '#B0B8C1',
                fontWeight: 400,
              }}
            >
              <span>종목명</span>
              <span className="text-right">현재가</span>
              <span className="text-right">오늘 등락</span>
              <span className="text-right">내 수익</span>
              <span className="text-right">목표 달성</span>
            </div>

            {/* Rows */}
            {displayList.map((stock, i) => {
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
                  className="stock-row grid items-center cursor-pointer transition-all"
                  style={{
                    gridTemplateColumns: 'minmax(180px, 1.5fr) 100px 100px 140px 160px',
                    padding: '14px 0',
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
                      <div className="flex items-center" style={{ fontSize: '15px', fontWeight: 600, gap: '6px' }}>
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
                        {stock.shares > 0 && ` · ${stock.shares}주`}
                        {!stock.shares && stock.buyBelow ? ` · 목표 $${stock.buyBelow}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Price cell */}
                  <div className="text-right">
                    <div className="text-[15px] font-semibold text-[#191F28] tabular-nums">
                      ${price ? price.toFixed(2) : '--'}
                    </div>
                    <div className="text-[11px] text-[#B0B8C1] mt-0.5 tabular-nums">
                      {price > 0 ? `₩${fmtWonShort(priceWon)}` : ''}
                    </div>
                  </div>

                  {/* Today change cell */}
                  <div className="text-right">
                    <div className={`text-[13px] font-semibold tabular-nums ${isStockGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                      {price ? `${isStockGain ? '▲' : '▼'} ${isStockGain ? '+' : ''}${dp.toFixed(2)}%` : '--'}
                    </div>
                    <div className={`text-[11px] font-normal mt-0.5 tabular-nums ${isStockGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                      {price ? `${change >= 0 ? '+' : ''}$${change.toFixed(2)}` : ''}
                    </div>
                  </div>

                  {/* P&L cell */}
                  <div className="text-right">
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
                  <div className="text-right pr-1">
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
                </div>
              );
            })}
          </div>
        )}

        {/* 내 종목 뉴스 — 항상 표시 */}
        <div style={{ marginTop: '48px', borderTop: '1px solid #F2F4F6', paddingTop: '40px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#191F28', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>📰</span> 내 종목 뉴스
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
