'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useCandleData, fetchKoreanNews } from '@/hooks/useStockData';
import {
  calcSMA, calcRSI, calcBollingerBands, calcMACD,
  detectTrend, detectCross, detectPattern, generateSummary,
  getBollingerStatus, getMACDStatus, getChartShapeSummary, generateAIReport,
} from '@/utils/technical';
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import type { StockItem, QuoteData, NewsItem, MacroEntry, TrendType } from '@/config/constants';
import { X } from 'lucide-react';

const StockChart = dynamic(() => import('./StockChart'), { ssr: false });

type ChartLevel = 'basic' | 'analysis' | 'expert';

function fmtWon(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 100000000) return `${(val / 100000000).toFixed(1)}억원`;
  if (abs >= 10000) return `${(val / 10000).toFixed(1)}만원`;
  return `${Math.round(val)}원`;
}

function fmtWonShort(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 100000000) return `₩${(val / 100000000).toFixed(1)}억`;
  if (abs >= 10000) return `₩${(val / 10000).toFixed(0)}만`;
  return `₩${Math.round(val)}`;
}

export default function AnalysisPanel() {
  const {
    analysisSymbol, setAnalysisSymbol,
    macroData, rawCandles,
    stocks,
  } = usePortfolioStore();

  const { fetchCandle, rawCandle } = useCandleData(analysisSymbol);
  const [tickerNews, setTickerNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLevel, setChartLevel] = useState<ChartLevel>('basic');
  const [showAIReport, setShowAIReport] = useState(false);

  const symbol = analysisSymbol;
  const kr = symbol ? (STOCK_KR[symbol] || symbol) : '';
  const avatarColor = symbol ? getAvatarColor(symbol) : '#3182F6';

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    fetchCandle().finally(() => setLoading(false));
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!symbol) return;
    const krName = STOCK_KR[symbol] || symbol;
    const q = (krName !== symbol ? krName + ' ' : '') + symbol + ' 주가';
    fetchKoreanNews(q).then(items => {
      setTickerNews(items?.slice(0, 5) || []);
    });
  }, [symbol]);

  const stockData = useMemo((): StockItem | null => {
    if (!symbol) return null;
    for (const c of ['investing', 'watching', 'sold'] as const) {
      const found = (stocks[c] || []).find(x => x.symbol === symbol);
      if (found) return found;
    }
    return null;
  }, [symbol, stocks]);

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

  // USD/KRW
  const usdKrwEntry = macroData['USD/KRW'] as MacroEntry | undefined;
  const usdKrw = usdKrwEntry?.value || 1400;

  const close = useCallback(() => {
    setAnalysisSymbol(null);
    document.body.style.overflow = '';
  }, [setAnalysisSymbol]);

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
  const priceWon = price * usdKrw;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/20 z-50 backdrop-blur-xs" onClick={close} />

      {/* Panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-[560px] max-h-[90vh] bg-white rounded-[20px] overflow-hidden shadow-2xl animate-fade-in flex flex-col" style={{ border: '1px solid #F2F4F6' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#F2F4F6] shrink-0">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: avatarColor }}
              >
                <span className="text-[15px] font-bold text-white">{symbol.charAt(0)}</span>
              </div>
              <div>
                <div className="text-[17px] font-bold text-[#191F28]">{kr !== symbol ? kr : symbol}</div>
                <div className="text-[12px] text-[#B0B8C1]">{symbol} · NASDAQ</div>
              </div>
            </div>
            <button
              onClick={close}
              className="w-8 h-8 rounded-lg hover:bg-[#F2F4F6] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-[#8B95A1]" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {loading ? (
              <div className="flex items-center justify-center h-40 text-[13px] text-[#8B95A1]">
                분석 데이터를 불러오는 중...
              </div>
            ) : (
              <>
                {/* Price hero */}
                <div className="text-center mb-7">
                  <div className="text-[32px] font-bold text-[#191F28] tabular-nums">
                    ${price ? price.toFixed(2) : '--'}
                  </div>
                  <div className="text-[14px] text-[#8B95A1] mt-1">
                    ₩{priceWon > 0 ? Math.round(priceWon).toLocaleString() : '--'} (×{usdKrw.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                  </div>
                  <div className={`text-[15px] font-medium mt-1 ${isGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                    {isGain ? '▲' : '▼'} {change >= 0 ? '+' : ''}${change.toFixed(2)} ({cp >= 0 ? '+' : ''}{cp.toFixed(2)}%) 오늘
                  </div>
                </div>

                {/* AI 분석 리포트 버튼 */}
                <button
                  onClick={() => setShowAIReport(!showAIReport)}
                  className="w-full py-3.5 bg-[#3182F6] text-white rounded-xl text-[15px] font-semibold cursor-pointer mb-6 flex items-center justify-center gap-2 hover:bg-[#1B64DA] transition-colors"
                >
                  <span>📊</span> AI 분석 리포트 {showAIReport ? '닫기' : '보기'}
                </button>

                {analysis && (
                  <>
                    {/* Chart shape summary card */}
                    <div className="p-5 rounded-[14px] bg-[#F8F9FB] border border-[#F2F4F6] mb-6">
                      <div className="text-[14px] font-bold mb-3.5 flex items-center gap-2">
                        📊 차트 요약
                      </div>
                      <div className="text-[16px] font-bold mb-3 flex items-center gap-2">
                        {analysis.chartShape.icon} {analysis.chartShape.title}
                      </div>
                      <div className="text-[14px] text-[#8B95A1] leading-relaxed mb-4">
                        {analysis.chartShape.desc}
                      </div>
                      <div className="flex items-center gap-4 pt-3.5 border-t border-[#F2F4F6]">
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[13px] font-bold ${
                          analysis.chartShape.signal === 'positive' ? 'bg-[#EDFCF2] text-[#16A34A]' :
                          analysis.chartShape.signal === 'caution' ? 'bg-[#FFF8E6] text-[#E8950A]' :
                          'bg-[#F2F4F6] text-[#8B95A1]'
                        }`}>
                          {analysis.chartShape.signal === 'positive' ? '🟢 긍정적' :
                           analysis.chartShape.signal === 'caution' ? '🟡 관망' : '⚪ 중립'}
                        </span>
                        {analysis.rsiVal != null && (
                          <span className="text-[13px] text-[#8B95A1] font-medium">
                            RSI {analysis.rsiVal.toFixed(0)} {analysis.rsiVal < 30 ? '(과매도)' : analysis.rsiVal > 70 ? '(과열)' : '(적정)'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* AI Analysis Report (collapsible) */}
                    {showAIReport && (
                      <div className="rounded-2xl p-7 mb-6" style={{ background: '#FAFBFF', border: '1px solid rgba(49,130,246,0.12)' }}>
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-[18px]">📊</span>
                          <span className="text-[15px] font-bold text-[#3182F6]">SOLB AI 분석</span>
                          <span className="text-[12px] text-[#B0B8C1] ml-auto">
                            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' })} 기준
                          </span>
                        </div>

                        {/* Current Status */}
                        <div className="mb-5">
                          <div className="text-[13px] font-semibold text-[#8B95A1] mb-2">📉 현재 상태</div>
                          <div className="text-[14px] text-[#191F28] leading-relaxed">
                            {analysis.aiReport.currentStatus}
                          </div>
                        </div>

                        {/* Key Indicators */}
                        <div className="mb-5">
                          <div className="text-[13px] font-semibold text-[#8B95A1] mb-2.5">📊 주요 지표</div>
                          <div className="flex flex-col gap-2">
                            {analysis.aiReport.indicators.map((ind, idx) => (
                              <div key={idx} className="flex justify-between items-center py-2.5 px-3.5 bg-white rounded-[10px]">
                                <span className="text-[13px] text-[#4E5968]">{ind.name}</span>
                                <span className={`text-[13px] font-semibold ${
                                  ind.signal === 'positive' ? 'text-[#EF4452]' :
                                  ind.signal === 'negative' ? 'text-[#3182F6]' : 'text-[#8B95A1]'
                                }`}>
                                  {ind.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Historical */}
                        <div className="mb-5">
                          <div className="text-[13px] font-semibold text-[#8B95A1] mb-2">📈 과거 유사 상황</div>
                          <div className="text-[14px] text-[#191F28] leading-relaxed">
                            {analysis.aiReport.historicalNote}
                          </div>
                        </div>

                        {/* Conclusion */}
                        <div className="bg-white rounded-xl p-4 mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[14px] font-bold text-[#191F28]">💡 종합 판단</span>
                            <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-md ${
                              analysis.aiReport.conclusion.signal === 'positive' ? 'bg-[#EDFCF2] text-[#16A34A]' :
                              analysis.aiReport.conclusion.signal === 'negative' ? 'bg-[#FFF0F0] text-[#EF4452]' :
                              'bg-[rgba(255,149,0,0.08)] text-[#FF9500]'
                            }`}>
                              {analysis.aiReport.conclusion.label} {
                                analysis.aiReport.conclusion.signal === 'positive' ? '🟢' :
                                analysis.aiReport.conclusion.signal === 'negative' ? '🔴' : '🟡'
                              }
                            </span>
                          </div>
                          <div className="text-[14px] text-[#4E5968] leading-relaxed">
                            {analysis.aiReport.conclusion.desc}
                          </div>
                        </div>

                        {/* Disclaimer */}
                        <div className="text-[11px] text-[#B0B8C1] leading-relaxed text-center pt-3 border-t border-[#F2F4F6]">
                          이 분석은 AI가 생성한 참고 자료이며, 투자 권유가 아닙니다. 투자 판단의 책임은 본인에게 있습니다.
                        </div>
                      </div>
                    )}

                    {/* Investment P&L */}
                    {stockData && stockData.avgCost > 0 && stockData.shares > 0 && price > 0 && (
                      <div className="p-5 rounded-[14px] bg-[#F8F9FA] mb-5">
                        <div className="text-[13px] font-semibold text-[#8B95A1] mb-3">내 투자 현황</div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between py-1.5">
                            <span className="text-[14px] text-[#8B95A1]">보유 수량</span>
                            <span className="text-[14px] font-semibold">{stockData.shares}주</span>
                          </div>
                          <div className="flex justify-between py-1.5">
                            <span className="text-[14px] text-[#8B95A1]">평균 매수가</span>
                            <span className="text-[14px] font-semibold">
                              ${stockData.avgCost.toFixed(2)}{' '}
                              <span className="text-[11px] text-[#B0B8C1] font-normal">
                                (₩{Math.round(stockData.avgCost * usdKrw).toLocaleString()})
                              </span>
                            </span>
                          </div>
                          <div className="flex justify-between py-1.5">
                            <span className="text-[14px] text-[#8B95A1]">투자 원금</span>
                            <span className="text-[14px] font-semibold">
                              {fmtWonShort(stockData.avgCost * stockData.shares * usdKrw)}{' '}
                              <span className="text-[11px] text-[#B0B8C1] font-normal">
                                (${(stockData.avgCost * stockData.shares).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                              </span>
                            </span>
                          </div>
                          <div className="flex justify-between py-1.5">
                            <span className="text-[14px] text-[#8B95A1]">평가 금액</span>
                            <span className="text-[14px] font-semibold">
                              {fmtWonShort(price * stockData.shares * usdKrw)}{' '}
                              <span className="text-[11px] text-[#B0B8C1] font-normal">
                                (${(price * stockData.shares).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                              </span>
                            </span>
                          </div>
                          {(() => {
                            const costUsd = stockData.avgCost * stockData.shares;
                            const valUsd = price * stockData.shares;
                            const plUsd = valUsd - costUsd;
                            const plWon = plUsd * usdKrw;
                            const plPctVal = ((price - stockData.avgCost) / stockData.avgCost) * 100;
                            const plIsGain = plUsd >= 0;
                            return (
                              <div className="flex justify-between py-3 border-t border-[#F2F4F6] mt-1.5">
                                <span className="text-[14px] font-semibold text-[#191F28]">수익</span>
                                <span className={`text-[14px] font-semibold ${plIsGain ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                                  {plIsGain ? '+' : '-'}{fmtWonShort(Math.abs(plWon))}{' '}
                                  <span className="text-[11px] font-normal">
                                    ({plIsGain ? '+' : ''}{plPctVal.toFixed(2)}%)
                                  </span>
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Goal progress bar */}
                    {stockData && stockData.targetReturn > 0 && stockData.avgCost > 0 && price > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-[13px] font-semibold text-[#8B95A1]">목표 수익률 달성</span>
                          {(() => {
                            const pct = ((price - stockData.avgCost) / stockData.avgCost) * 100;
                            return (
                              <span className={`text-[14px] font-bold ${pct >= 0 ? 'text-[#EF4452]' : 'text-[#3182F6]'}`}>
                                {pct.toFixed(1)}% / {stockData.targetReturn}%
                              </span>
                            );
                          })()}
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-[#ECEEF0] overflow-hidden">
                          {(() => {
                            const pct = ((price - stockData.avgCost) / stockData.avgCost) * 100;
                            const fill = Math.min(Math.max(pct / stockData.targetReturn * 100, 0), 100);
                            return (
                              <div
                                className={`h-full rounded-full ${pct >= 0 ? 'bg-[#EF4452]' : 'bg-[#3182F6]'}`}
                                style={{ width: `${fill}%` }}
                              />
                            );
                          })()}
                        </div>
                        <div className="flex justify-between mt-1.5 text-[11px] text-[#B0B8C1]">
                          <span>0%</span>
                          <span>목표 {stockData.targetReturn}%</span>
                        </div>
                      </div>
                    )}

                    {/* Buy history (sample) */}
                    {stockData && stockData.avgCost > 0 && stockData.shares > 0 && (
                      <div className="mb-6">
                        <div className="text-[15px] font-bold mb-3 flex items-center gap-1.5">
                          📋 매수 이력
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-3 py-2.5 px-3.5 rounded-[10px] bg-[#F8F9FA]">
                            <span className="text-[12px] text-[#B0B8C1] min-w-[80px]">매수</span>
                            <span className="text-[13px] text-[#191F28] flex-1">{stockData.shares}주</span>
                            <span className="text-[13px] font-semibold shrink-0">${stockData.avgCost.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3-Level Chart Tabs */}
                    <div className="text-[15px] font-bold mb-3 flex items-center gap-1.5">
                      📈 차트 분석
                    </div>

                    <div className="flex items-center border border-[#F2F4F6] rounded-[10px] overflow-hidden mb-4">
                      {(['basic', 'analysis', 'expert'] as ChartLevel[]).map((lvl, idx) => (
                        <button
                          key={lvl}
                          onClick={() => setChartLevel(lvl)}
                          className={`flex-1 py-2.5 text-center text-[14px] font-medium cursor-pointer transition-colors ${
                            idx < 2 ? 'border-r border-[#F2F4F6]' : ''
                          } ${
                            chartLevel === lvl
                              ? 'bg-[#191F28] text-white font-bold'
                              : 'bg-white text-[#8B95A1] hover:bg-[#F9FAFB]'
                          }`}
                        >
                          {lvl === 'basic' ? '기본' : lvl === 'analysis' ? '더 보기' : '전문가'}
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
                    />

                    <div className="text-[12px] text-[#B0B8C1] text-center mt-2 mb-6">
                      {chartLevel === 'basic' && '기본: 캔들 + MA(20/60) + 거래량'}
                      {chartLevel === 'analysis' && '더 보기: 캔들 + MA(20/60) + 볼린저 밴드 + MACD + RSI'}
                      {chartLevel === 'expert' && '전문가: 모든 지표 표시'}
                    </div>

                    {/* Technical indicators grid */}
                    <div className="text-[15px] font-bold mb-3 flex items-center gap-1.5 mt-6">
                      🔧 기술적 지표
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 mb-6">
                      {/* RSI */}
                      <div className="p-3.5 rounded-xl bg-[#F8F9FA] text-center">
                        <div className="text-[11px] text-[#B0B8C1] mb-1.5">RSI (14)</div>
                        <div className={`text-[14px] font-bold ${
                          analysis.rsiVal != null && analysis.rsiVal < 30 ? 'text-[#3182F6]' :
                          analysis.rsiVal != null && analysis.rsiVal > 70 ? 'text-[#EF4452]' : 'text-[#191F28]'
                        }`}>
                          {analysis.rsiVal != null ? analysis.rsiVal.toFixed(1) : '--'}
                        </div>
                        <div className="text-[11px] text-[#8B95A1] mt-1 leading-snug">
                          {analysis.rsiVal != null && analysis.rsiVal < 30 ? '과매도 구간\n반등 가능성 있음' :
                           analysis.rsiVal != null && analysis.rsiVal > 70 ? '과열 구간\n조정 주의' : '적정 수준'}
                        </div>
                      </div>

                      {/* MA 20 */}
                      <div className="p-3.5 rounded-xl bg-[#F8F9FA] text-center">
                        <div className="text-[11px] text-[#B0B8C1] mb-1.5">MA 20일</div>
                        <div className="text-[14px] font-bold text-[#191F28] tabular-nums">
                          {analysis.sma20.length ? `$${analysis.sma20[analysis.sma20.length - 1].toFixed(2)}` : '--'}
                        </div>
                        <div className="text-[11px] text-[#8B95A1] mt-1 leading-snug">
                          {analysis.sma20.length && price > analysis.sma20[analysis.sma20.length - 1]
                            ? '현재가보다 아래\n단기 상승 추세'
                            : '현재가보다 위\n단기 하락 추세'}
                        </div>
                      </div>

                      {/* MA 60 */}
                      <div className="p-3.5 rounded-xl bg-[#F8F9FA] text-center">
                        <div className="text-[11px] text-[#B0B8C1] mb-1.5">MA 60일</div>
                        <div className="text-[14px] font-bold text-[#191F28] tabular-nums">
                          {analysis.sma60.length ? `$${analysis.sma60[analysis.sma60.length - 1].toFixed(2)}` : '--'}
                        </div>
                        <div className="text-[11px] text-[#8B95A1] mt-1 leading-snug">
                          {analysis.sma60.length && price > analysis.sma60[analysis.sma60.length - 1]
                            ? '현재가보다 아래\n중기 상승 추세'
                            : '현재가보다 위\n중기 하락 추세'}
                        </div>
                      </div>
                    </div>

                    {/* Bollinger interpretation */}
                    {analysis.bollingerStatus && (
                      <div className="p-4 rounded-[14px] bg-[#F8F9FA] mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[13px] font-bold text-[#191F28]">볼린저 밴드</span>
                          <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-md ${
                            analysis.bollingerStatus.signal === 'buy' ? 'bg-[#FFF8E6] text-[#E8950A]' :
                            analysis.bollingerStatus.signal === 'sell' ? 'bg-[#FFF0F0] text-[#EF4452]' :
                            'bg-[#EDFCF2] text-[#16A34A]'
                          }`}>
                            {analysis.bollingerStatus.status}
                          </span>
                        </div>
                        <div className="text-[13px] text-[#8B95A1] leading-relaxed">
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
                      <div className="p-4 rounded-[14px] bg-[#F8F9FA] mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[13px] font-bold text-[#191F28]">MACD</span>
                          <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-md ${
                            analysis.macdStatus.signal === 'buy' ? 'bg-[#EDFCF2] text-[#16A34A]' :
                            analysis.macdStatus.signal === 'sell' ? 'bg-[#FFF0F0] text-[#EF4452]' :
                            'bg-[#FFF8E6] text-[#E8950A]'
                          }`}>
                            {analysis.macdStatus.status}
                          </span>
                        </div>
                        <div className="text-[13px] text-[#8B95A1] leading-relaxed">
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
                    <div className="p-4 rounded-[14px] bg-[#F8F9FA] mb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[13px] font-bold text-[#191F28]">거래량</span>
                        <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-md ${
                          analysis.volRatio > 1.5 ? 'bg-[#EDFCF2] text-[#16A34A]' :
                          analysis.volRatio < 0.5 ? 'bg-[#FFF0F0] text-[#EF4452]' :
                          'bg-[#EDFCF2] text-[#16A34A]'
                        }`}>
                          {analysis.volRatio > 1.5 ? '활발' : analysis.volRatio < 0.5 ? '한산' : '평균 수준'}
                        </span>
                      </div>
                      <div className="text-[13px] text-[#8B95A1] leading-relaxed">
                        최근 거래량은 20일 평균{analysis.volRatio > 1.5 ? '보다 많아요. 관심이 높은 상태예요.' : analysis.volRatio < 0.5 ? '보다 적어요. 관심이 낮은 상태예요.' : '과 비슷해요. 큰 매도 압력은 없는 상태예요.'}
                      </div>
                    </div>
                  </>
                )}

                {!analysis && !loading && (
                  <div className="text-center py-8 text-[13px] text-[#FF9500]">
                    차트 데이터가 부족해요. 잠시 후 다시 시도해주세요.
                  </div>
                )}

                {/* Related news */}
                <div className="text-[15px] font-bold mb-3 flex items-center gap-1.5 mt-8">
                  📰 관련 뉴스
                </div>
                {tickerNews.length > 0 ? (
                  <div>
                    {tickerNews.map((item, idx) => {
                      const date = item.pubDate ? new Date(item.pubDate).toLocaleDateString('ko-KR') : '';
                      return (
                        <div
                          key={idx}
                          onClick={() => window.open(item.link, '_blank')}
                          className={`py-3 cursor-pointer ${idx < tickerNews.length - 1 ? 'border-b border-[#F7F8FA]' : ''}`}
                        >
                          <div className="text-[13px] font-semibold leading-relaxed mb-1 line-clamp-2">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-[#B0B8C1]">
                            {item.source}{item.source && date ? ' · ' : ''}{date}
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

                {/* Disclaimer */}
                <div className="mt-6 p-4 rounded-[10px] bg-[#F8F9FA] text-[11px] text-[#B0B8C1] leading-relaxed">
                  본 정보는 투자 판단의 참고 자료이며, 투자 권유가 아닙니다. 모든 투자의 책임은 투자자 본인에게 있으며, SOLB는 투자 결과에 대해 책임을 지지 않습니다. 과거 수익률이 미래 수익률을 보장하지 않습니다.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
