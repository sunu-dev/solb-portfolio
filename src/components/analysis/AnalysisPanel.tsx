'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useCandleData, fetchKoreanNews } from '@/hooks/useStockData';
import { calcSMA, calcRSI, detectTrend, detectCross, detectPattern, generateSummary } from '@/utils/technical';
import { STOCK_KR, PERIODS, TREND_INFO } from '@/config/constants';
import type { StockItem, QuoteData, NewsItem, StockCategory, TrendType, PatternResult } from '@/config/constants';

// Dynamic import for StockChart (no SSR for canvas)
const StockChart = dynamic(() => import('./StockChart'), { ssr: false });

// --- Signal helper (from ui.js) ---
function getSignal(
  stock: StockItem,
  price: number,
  cp: number,
  currentTab: StockCategory
): { cls: string; text: string } {
  if (!price) return { cls: 'signal-neutral', text: '데이터를 불러오는 중이에요...' };
  if (currentTab === 'short') {
    if (stock.stopLoss && price <= stock.stopLoss * 1.03) return { cls: 'signal-caution', text: '⚠️ 손절가에 가까워요. 매도를 고려해보세요.' };
    if (stock.targetSell && price >= stock.targetSell * 0.97) return { cls: 'signal-positive', text: '🎯 목표가 거의 도달! 수익 실현을 고려해보세요.' };
    if (cp > 2) return { cls: 'signal-positive', text: '📈 좋은 흐름이에요. 목표가까지 지켜보세요.' };
    if (cp < -3) return { cls: 'signal-caution', text: '📉 많이 빠졌어요. 손절가를 확인하세요.' };
    return { cls: 'signal-neutral', text: '보합 중이에요. 큰 변동 없이 유지되고 있어요.' };
  }
  if (currentTab === 'long') {
    if (stock.buyZones?.length) {
      const near = stock.buyZones.find(z => price <= z * 1.02);
      if (near) return { cls: 'signal-positive', text: `💰 매수 구간($${near}) 진입! 분할 매수를 검토해보세요.` };
      const dist = ((stock.buyZones[0] - price) / price * 100).toFixed(1);
      if (Number(dist) > 0) return { cls: 'signal-neutral', text: `1차 매수 구간($${stock.buyZones[0]})까지 ${dist}% 남았어요.` };
    }
    return { cls: 'signal-neutral', text: '장기 투자 종목이에요. 여유있게 지켜보세요.' };
  }
  if (stock.buyBelow && price <= stock.buyBelow) return { cls: 'signal-positive', text: `💰 목표 매수가($${stock.buyBelow}) 이하! 매수 검토해보세요.` };
  return { cls: 'signal-neutral', text: '관심 종목으로 모니터링 중이에요.' };
}

export default function AnalysisPanel() {
  const {
    analysisSymbol, setAnalysisSymbol,
    macroData, rawCandles, candleCache,
    stocks, currentTab,
  } = usePortfolioStore();

  const { fetchCandle, rawCandle } = useCandleData(analysisSymbol);
  const [tickerNews, setTickerNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const symbol = analysisSymbol;
  const kr = symbol ? (STOCK_KR[symbol] || '') : '';

  // Fetch candle data on open
  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    fetchCandle().finally(() => setLoading(false));
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch ticker news
  useEffect(() => {
    if (!symbol) return;
    const krName = STOCK_KR[symbol] || symbol;
    const q = (krName !== symbol ? krName + ' ' : '') + symbol + ' 주가';
    fetchKoreanNews(q).then(items => {
      setTickerNews(items?.slice(0, 6) || []);
    });
  }, [symbol]);

  // Find stock data in portfolio
  const stockData = useMemo((): StockItem | null => {
    if (!symbol) return null;
    for (const c of ['short', 'long', 'watch'] as const) {
      const found = stocks[c].find(x => x.symbol === symbol);
      if (found) return found;
    }
    return null;
  }, [symbol, stocks]);

  // Technical analysis
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
    return { closes, sma5, sma20, sma60, rsi, trend, cross, pattern, summary, rsiVal, volRatio, raw };
  }, [symbol, rawCandles]);

  const close = useCallback(() => {
    setAnalysisSymbol(null);
    document.body.style.overflow = '';
  }, [setAnalysisSymbol]);

  // Lock body scroll
  useEffect(() => {
    if (symbol) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [symbol]);

  if (!symbol) return null;

  const quote = macroData[symbol] as QuoteData | undefined;
  const price = quote?.c || 0;
  const change = quote?.d || 0;
  const cp = quote?.dp || 0;
  const isGain = change >= 0;
  const candles = candleCache[symbol] || {};

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-50"
        onClick={close}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-[480px] bg-white z-50 overflow-y-auto animate-slide-in">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-black/[0.06] px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[17px] font-bold text-[#191F28]">{symbol}</span>
            {kr && <span className="text-[14px] text-[#8B95A1]">{kr}</span>}
          </div>
          <button
            onClick={close}
            className="p-2 rounded-xl hover:bg-[#F2F4F6] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4E5968" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-[13px] text-[#8B95A1]">
            분석 데이터를 불러오는 중...
          </div>
        ) : (
          <div className="px-4 pb-8">
            {/* Price hero */}
            <div className="py-6 text-center">
              <div className="text-[28px] font-bold text-[#191F28]">
                ${price ? price.toFixed(2) : '--'}
              </div>
              <div className={`text-[14px] font-semibold mt-1 ${isGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                {isGain ? '▲' : '▼'} {Math.abs(change).toFixed(2)} ({cp > 0 ? '+' : ''}{cp.toFixed(2)}%)
              </div>
            </div>

            {analysis && (
              <>
                {/* Signal summary card */}
                <div className={`rounded-[14px] p-4 mb-4 ${analysis.summary.cls}`}>
                  <div className="text-[15px] font-bold mb-1">
                    {analysis.summary.icon} {analysis.summary.label}
                  </div>
                  <div className="text-[13px] text-[#4E5968] leading-relaxed">
                    {analysis.summary.body}
                  </div>
                </div>

                {/* Investment status P&L */}
                {stockData && stockData.avgCost > 0 && stockData.shares > 0 && price > 0 && (
                  <div className="bg-white rounded-[14px] border border-black/[0.06] p-4 mb-4">
                    <div className="text-[14px] font-bold text-[#191F28] mb-3">내 투자 현황</div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <div className="text-[11px] text-[#8B95A1]">매수 단가</div>
                        <div className="text-[14px] font-semibold">${stockData.avgCost.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#8B95A1]">수량</div>
                        <div className="text-[14px] font-semibold">{stockData.shares}주</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#8B95A1]">투자금</div>
                        <div className="text-[14px] font-semibold">${(stockData.avgCost * stockData.shares).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-[#8B95A1]">평가금</div>
                        <div className="text-[14px] font-semibold">${(price * stockData.shares).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                    </div>
                    {(() => {
                      const totalCost = stockData.avgCost * stockData.shares;
                      const totalValue = price * stockData.shares;
                      const pl = totalValue - totalCost;
                      const plPct = ((price - stockData.avgCost) / stockData.avgCost * 100);
                      const plGain = pl >= 0;
                      const targetPrice = stockData.targetReturn ? (stockData.avgCost * (1 + stockData.targetReturn / 100)) : 0;
                      const targetDist = targetPrice && price ? ((targetPrice - price) / price * 100).toFixed(1) : '0';
                      return (
                        <>
                          <div className={`rounded-xl p-3 text-center ${plGain ? 'bg-[#EF4452]/[0.06]' : 'bg-[#3182F6]/[0.06]'}`}>
                            <span className={`text-[16px] font-bold ${plGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                              {pl >= 0 ? '+' : ''}${Math.abs(pl).toLocaleString(undefined, { maximumFractionDigits: 0 })} ({pl >= 0 ? '+' : ''}{plPct.toFixed(1)}%)
                            </span>
                          </div>
                          {stockData.targetReturn > 0 && (
                            <div className="text-[11px] text-[#8B95A1] text-center mt-2">
                              목표 수익률 {stockData.targetReturn}% (목표가 ${targetPrice.toFixed(2)}) | 남은 거리 {Number(targetDist) > 0 ? '+' : ''}{targetDist}%
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Period returns */}
                <div className="bg-white rounded-[14px] border border-black/[0.06] p-4 mb-4">
                  <div className="text-[14px] font-bold text-[#191F28] mb-3">기간별 수익률</div>
                  <div className="grid grid-cols-5 gap-2">
                    {PERIODS.slice(0, 5).map(p => {
                      const v = candles[p.days];
                      return (
                        <div key={p.days} className="text-center">
                          <div className="text-[11px] text-[#8B95A1] mb-1">{p.label}</div>
                          <div className={`text-[13px] font-bold ${v != null ? (v >= 0 ? 'text-[#EF4452]' : 'text-[#3182F6]') : 'text-[#B0B8C1]'}`}>
                            {v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` : '--'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Buy zones / target-stoploss */}
                {stockData && (() => {
                  let content = null;
                  if (currentTab === 'short' && stockData.targetSell) {
                    const tp = price ? ((stockData.targetSell - price) / price * 100).toFixed(1) : '0';
                    const sp = price ? ((price - (stockData.stopLoss || 0)) / price * 100).toFixed(1) : '0';
                    content = (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[13px] text-[#4E5968]">목표 ${stockData.targetSell}</span>
                          <span className="text-[13px] font-bold text-[#EF4452]">+{tp}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[13px] text-[#4E5968]">손절 ${stockData.stopLoss}</span>
                          <span className="text-[13px] font-bold text-[#3182F6]">-{Math.abs(Number(sp))}%</span>
                        </div>
                      </div>
                    );
                  } else if (currentTab === 'long' && stockData.buyZones?.length) {
                    content = (
                      <div className="space-y-2">
                        {stockData.buyZones.map((z, j) => {
                          const zp = price ? ((z - price) / price * 100).toFixed(1) : '0';
                          return (
                            <div key={j} className="flex justify-between items-center">
                              <span className="text-[13px] text-[#4E5968]">{j + 1}차 ${z}</span>
                              <span className="text-[13px] font-semibold">{Number(zp) > 0 ? '+' : ''}{zp}%</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  } else if (currentTab === 'watch' && stockData.buyBelow) {
                    const bp = price ? ((stockData.buyBelow - price) / price * 100).toFixed(1) : '0';
                    content = (
                      <div className="flex justify-between items-center">
                        <span className="text-[13px] text-[#4E5968]">매수 목표 ${stockData.buyBelow}</span>
                        <span className="text-[13px] font-semibold text-[#3182F6]">{Number(bp) > 0 ? '+' : ''}{bp}%</span>
                      </div>
                    );
                  }
                  if (!content) return null;
                  return (
                    <div className="bg-white rounded-[14px] border border-black/[0.06] p-4 mb-4">
                      <div className="text-[14px] font-bold text-[#191F28] mb-3">매매 구간</div>
                      {content}
                    </div>
                  );
                })()}

                {/* 52-week range bar */}
                {quote && (
                  <div className="bg-white rounded-[14px] border border-black/[0.06] p-4 mb-4">
                    {(() => {
                      const hi = quote.h || 0;
                      const lo = quote.l || 0;
                      const wp = (hi && lo && hi !== lo) ? ((price - lo) / (hi - lo) * 100) : 50;
                      return (
                        <div>
                          <div className="flex justify-between text-[11px] text-[#8B95A1] mb-2">
                            <span>${lo ? lo.toFixed(0) : '--'}</span>
                            <span className="text-[10px]">52주 범위</span>
                            <span>${hi ? hi.toFixed(0) : '--'}</span>
                          </div>
                          <div className="relative h-2 bg-[#F2F4F6] rounded-full">
                            <div
                              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#191F28] rounded-full"
                              style={{ left: `calc(${wp}% - 5px)` }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Chart */}
                <div className="bg-white rounded-[14px] border border-black/[0.06] p-4 mb-4">
                  <div className="text-[14px] font-bold text-[#191F28] mb-3">캔들 차트</div>
                  <StockChart
                    raw={analysis.raw}
                    sma5={analysis.sma5}
                    sma20={analysis.sma20}
                    sma60={analysis.sma60}
                  />
                </div>

                {/* Technical indicator cards */}
                <div className="bg-white rounded-[14px] border border-black/[0.06] p-4 mb-4">
                  <div className="text-[14px] font-bold text-[#191F28] mb-3">기술 지표</div>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Trend */}
                    {(() => {
                      const ti = TREND_INFO[analysis.trend as TrendType] || TREND_INFO.unknown;
                      return (
                        <div className="text-center p-3 bg-[#F7F8FA] rounded-xl">
                          <div className="text-[11px] text-[#8B95A1] mb-1">추세</div>
                          <div className="text-[18px] mb-0.5">{ti.icon}</div>
                          <div className="text-[13px] font-bold text-[#191F28]">{ti.text}</div>
                          <div className="text-[10px] text-[#8B95A1] mt-0.5">{ti.desc}</div>
                        </div>
                      );
                    })()}

                    {/* RSI */}
                    {(() => {
                      const rsiVal = analysis.rsiVal;
                      let rsiIcon = '🟡', rsiText = '보통', rsiDesc = '';
                      if (rsiVal != null) {
                        if (rsiVal < 30) { rsiIcon = '🟢'; rsiText = '과매도'; rsiDesc = `RSI ${rsiVal.toFixed(0)} — 반등 가능`; }
                        else if (rsiVal > 70) { rsiIcon = '🔴'; rsiText = '과열'; rsiDesc = `RSI ${rsiVal.toFixed(0)} — 조정 주의`; }
                        else { rsiDesc = `RSI ${rsiVal.toFixed(0)} — 적정`; }
                      }
                      return (
                        <div className="text-center p-3 bg-[#F7F8FA] rounded-xl">
                          <div className="text-[11px] text-[#8B95A1] mb-1">과열도</div>
                          <div className="text-[18px] mb-0.5">{rsiIcon}</div>
                          <div className="text-[13px] font-bold text-[#191F28]">{rsiText}</div>
                          <div className="text-[10px] text-[#8B95A1] mt-0.5">{rsiDesc}</div>
                        </div>
                      );
                    })()}

                    {/* Volume */}
                    {(() => {
                      const volRatio = analysis.volRatio;
                      let volIcon = '🟡', volText = '보통';
                      const volDesc = `평균 대비 ${(volRatio * 100).toFixed(0)}%`;
                      if (volRatio > 1.5) { volIcon = '🟢'; volText = '활발'; }
                      else if (volRatio < 0.5) { volIcon = '🔴'; volText = '한산'; }
                      return (
                        <div className="text-center p-3 bg-[#F7F8FA] rounded-xl">
                          <div className="text-[11px] text-[#8B95A1] mb-1">거래량</div>
                          <div className="text-[18px] mb-0.5">{volIcon}</div>
                          <div className="text-[13px] font-bold text-[#191F28]">{volText}</div>
                          <div className="text-[10px] text-[#8B95A1] mt-0.5">{volDesc}</div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Pattern detection */}
                {analysis.pattern && (
                  <div className="bg-white rounded-[14px] border border-black/[0.06] p-4 mb-4">
                    <div className="text-[14px] font-bold text-[#191F28] mb-3">차트 패턴</div>
                    <div className="p-3 bg-[#F7F8FA] rounded-xl">
                      <div className={`text-[14px] font-bold mb-1 ${
                        (analysis.pattern.type === 'bullish' || analysis.pattern.type === 'potentially_bullish')
                          ? 'text-[#EF4452]'
                          : analysis.pattern.type === 'bearish'
                          ? 'text-[#3182F6]'
                          : 'text-[#3182F6]'
                      }`}>
                        {analysis.pattern.name}
                      </div>
                      <div className="text-[12px] text-[#4E5968] leading-relaxed">
                        {analysis.pattern.desc}
                      </div>
                    </div>
                  </div>
                )}

                {/* Cross event */}
                {analysis.cross && (
                  <div className="bg-white rounded-[14px] border border-black/[0.06] p-4 mb-4">
                    <div className="p-3 bg-[#F7F8FA] rounded-xl">
                      <div className={`text-[14px] font-bold mb-1 ${
                        analysis.cross === 'golden' ? 'text-[#EF4452]' : 'text-[#3182F6]'
                      }`}>
                        {analysis.cross === 'golden' ? '골든크로스 발생' : '데드크로스 발생'}
                      </div>
                      <div className="text-[12px] text-[#4E5968] leading-relaxed">
                        {analysis.cross === 'golden'
                          ? '단기 이동평균(5일)이 장기 이동평균(20일)을 위로 돌파했어요. 상승 추세 전환의 신호로 봐요.'
                          : '단기 이동평균(5일)이 장기 이동평균(20일)을 아래로 돌파했어요. 하락 추세 전환의 신호예요.'
                        }
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* No analysis data */}
            {!analysis && !loading && (
              <div className="text-center py-8 text-[13px] text-[#FF9500]">
                차트 데이터가 부족해요. 잠시 후 다시 시도해주세요.
              </div>
            )}

            {/* Related news */}
            <div className="bg-white rounded-[14px] border border-black/[0.06] p-4 mb-4">
              <div className="text-[14px] font-bold text-[#191F28] mb-3">관련 뉴스</div>
              {tickerNews.length > 0 ? (
                <div className="space-y-3">
                  {tickerNews.map((item, idx) => {
                    const date = item.pubDate ? new Date(item.pubDate).toLocaleDateString('ko-KR') : '';
                    return (
                      <div
                        key={idx}
                        onClick={() => window.open(item.link, '_blank')}
                        className="cursor-pointer p-3 rounded-xl hover:bg-[#F7F8FA] transition-colors"
                      >
                        <div className="text-[13px] font-semibold text-[#191F28] leading-snug mb-1">
                          {item.title}
                        </div>
                        <div className="flex justify-between text-[11px] text-[#8B95A1]">
                          <span>{item.source || ''}</span>
                          <span>{date}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-[13px] text-[#8B95A1]">
                  관련 뉴스가 없어요.
                </div>
              )}
            </div>

            {/* Disclaimer */}
            <div className="text-[11px] text-[#8B95A1] text-center leading-relaxed py-4">
              ⚠️ 이 분석은 AI가 생성한 참고 자료이며, 투자 권유가 아닙니다. 투자 판단의 책임은 본인에게 있습니다.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
