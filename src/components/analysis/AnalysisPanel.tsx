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
import { logApiCall } from '@/lib/apiLogger';

const StockChart = dynamic(() => import('./StockChart'), { ssr: false });
import BuySimulator from '@/components/portfolio/BuySimulator';

// AI report cache (module-level, persists across re-renders)
const aiReportCache: Record<string, { report: any; timestamp: number }> = {};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

type ChartLevel = 'basic' | 'detail';

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
    apiKey,
    currency,
  } = usePortfolioStore();

  const { fetchCandle, rawCandle } = useCandleData(analysisSymbol);
  const [tickerNews, setTickerNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLevel, setChartLevel] = useState<ChartLevel>('basic');
  const [chartRange, setChartRange] = useState<number>(60); // default 3M (60 trading days)
  const [showAIReport, setShowAIReport] = useState(false);
  const [aiReport, setAiReport] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const symbol = analysisSymbol;
  const kr = symbol ? (STOCK_KR[symbol] || symbol) : '';
  const avatarColor = symbol ? getAvatarColor(symbol) : '#3182F6';

  // 패널 열릴 때 해당 종목 최신 시세 즉시 fetch
  useEffect(() => {
    if (!symbol || !apiKey) return;
    setLoading(true);

    const fetchFreshQuote = async () => {
      try {
        const isKR = symbol.endsWith('.KS') || symbol.endsWith('.KQ');
        const url = isKR
          ? `/api/kr-quote?symbol=${symbol}`
          : `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
        const r = await fetch(url);
        const d = await r.json();
        if (d?.c) {
          usePortfolioStore.getState().updateMacroEntry(symbol, d);
        }
      } catch { /* fallback to cached */ }
    };

    Promise.all([fetchCandle(), fetchFreshQuote()]).finally(() => setLoading(false));
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
'      <div className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(1px)' }} onClick={close} />

      {/* Panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ padding: 16 }}>
        <div
          className="flex flex-col"
          style={{
            width: '100%',
            maxWidth: 'min(560px, 95vw)',
            maxHeight: '90vh',
            background: '#FFFFFF',
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            border: '1px solid #F2F4F6',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between"
            style={{ padding: '20px 24px', borderBottom: '1px solid #F2F4F6', flexShrink: 0 }}
          >
            <div className="flex items-center" style={{ gap: 12 }}>
              <div
                className="flex items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  backgroundColor: avatarColor,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{symbol.charAt(0)}</span>
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#191F28' }}>{kr !== symbol ? kr : symbol}</div>
                <div style={{ fontSize: 12, color: '#B0B8C1' }}>{symbol} · NASDAQ</div>
              </div>
            </div>
            <button
              onClick={close}
              className="flex items-center justify-center cursor-pointer transition-colors"
              style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none' }}
            >
              <X style={{ width: 20, height: 20, color: '#8B95A1' }} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1" style={{ overflowY: 'auto', padding: 24 }}>
            {loading ? (
              <div className="flex items-center justify-center" style={{ height: 160, fontSize: 13, color: '#8B95A1' }}>
                분석 데이터를 불러오는 중...
              </div>
            ) : (
              <>
                {/* Price hero */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: '#191F28' }}>
                    ${price ? price.toFixed(2) : '--'}
                  </div>
                  <div style={{ fontSize: 14, color: '#8B95A1', marginTop: 4 }}>
                    ₩{priceWon > 0 ? Math.round(priceWon).toLocaleString() : '--'} (×{usdKrw.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 500, marginTop: 4, color: isGain ? '#EF4452' : '#3182F6' }}>
                    {isGain ? '▲' : '▼'} {change >= 0 ? '+' : ''}${change.toFixed(2)} ({cp >= 0 ? '+' : ''}{cp.toFixed(2)}%) 오늘
                  </div>
                  <div style={{ fontSize: 11, color: '#B0B8C1', marginTop: 6 }}>
                    ⏱ 약 15분 지연 시세
                  </div>
                </div>

                {/* AI 분석 리포트 버튼 */}
                <button
                  onClick={async () => {
                    if (showAIReport) { setShowAIReport(false); return; }
                    setShowAIReport(true);
                    if (aiReport) return; // already loaded
                    // Check cache first
                    const cached = symbol ? aiReportCache[symbol] : null;
                    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                      setAiReport(cached.report);
                      return;
                    }
                    setAiLoading(true);
                    setAiError('');
                    try {
                      // AI 분석 시 뉴스를 새로 가져옴 (최신 반영)
                      const freshKr = STOCK_KR[symbol] || symbol;
                      const freshQuery = (freshKr !== symbol ? freshKr + ' ' : '') + symbol + ' 주가';
                      const freshNews = await fetchKoreanNews(freshQuery);
                      if (freshNews?.length) setTickerNews(freshNews.slice(0, 6));
                      // 3시간 이내 뉴스만 필터링
                      const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
                      const recentOnly = (freshNews || tickerNews).filter(n => {
                        if (!n.pubDate) return false;
                        return new Date(n.pubDate).getTime() > threeHoursAgo;
                      });
                      const newsText = recentOnly.length > 0
                        ? recentOnly.slice(0, 3).map(n => n.title).join('\n')
                        : '최근 3시간 내 관련 뉴스 없음';
                      // 최신 가격을 새로 가져옴
                      let latestPrice = price;
                      let latestChange = change;
                      let latestCp = cp;
                      try {
                        const isKr = symbol.endsWith('.KS') || symbol.endsWith('.KQ');
                        const quoteUrl = isKr
                          ? `/api/kr-quote?symbol=${symbol}`
                          : `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
                        const qr = await fetch(quoteUrl);
                        const qd = await qr.json();
                        if (qd?.c) {
                          latestPrice = qd.c;
                          latestChange = qd.d || 0;
                          latestCp = qd.dp || 0;
                        }
                      } catch { /* use existing price */ }

                      const resp = await fetch('/api/ai-analysis', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          symbol,
                          koreanName: kr,
                          price: latestPrice,
                          change: latestChange,
                          changePercent: latestCp,
                          avgCost: stockData?.avgCost,
                          shares: stockData?.shares,
                          targetReturn: stockData?.targetReturn,
                          rsi: analysis?.rsiVal?.toFixed(0),
                          trend: analysis?.trend,
                          cross: analysis?.cross,
                          pattern: analysis?.pattern?.name,
                          bollingerStatus: analysis?.bollingerStatus?.status,
                          macdStatus: analysis?.macdStatus?.status,
                          volRatio: analysis?.volRatio,
                          recentNews: newsText,
                        }),
                      });
                      const data = await resp.json();
                      if (data.success) {
                        setAiReport(data.report);
                        if (symbol) aiReportCache[symbol] = { report: data.report, timestamp: Date.now() };
                        logApiCall('ai_analysis', symbol || undefined, { conclusion: data.report?.conclusion?.label });
                      }
                      else { setAiError(data.error || 'AI 분석에 실패했어요.'); }
                    } catch { setAiError('AI 분석에 실패했어요. 잠시 후 다시 시도해주세요.'); }
                    setAiLoading(false);
                  }}
                  className="flex items-center justify-center cursor-pointer transition-colors"
                  style={{
                    width: '100%',
                    padding: 14,
                    background: '#3182F6',
                    color: '#fff',
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 600,
                    border: 'none',
                    marginBottom: 24,
                    gap: 8,
                  }}
                >
                  <span>📊</span> AI 분석 리포트 {showAIReport ? '닫기' : '보기'}
                </button>

                {/* AI Analysis Report — Gemini API */}
                {showAIReport && (
                  <div style={{ borderRadius: 16, padding: 28, marginBottom: 24, background: '#FAFBFF', border: '1px solid rgba(49,130,246,0.12)' }}>
                    <div className="flex items-center" style={{ gap: 8, marginBottom: 16 }}>
                      <span style={{ fontSize: 18 }}>📊</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#3182F6' }}>SOLB AI 분석</span>
                      <span style={{ fontSize: 12, color: '#B0B8C1', marginLeft: 'auto' }}>
                        {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' })} 기준
                      </span>
                    </div>

                    {aiLoading && (
                      <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <div style={{ fontSize: 28, marginBottom: 12, animation: 'pulse 1.5s infinite' }}>✨</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#3182F6', marginBottom: 6 }}>AI가 분석 중이에요</div>
                        <div style={{ fontSize: 13, color: '#8B95A1' }}>차트, 지표, 뉴스를 종합하고 있어요... (5~10초)</div>
                        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 8 }}>
                          {[0, 1, 2].map(i => (
                            <div key={i} style={{
                              width: 10, height: 10, borderRadius: '50%', background: '#3182F6',
                              animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
                            }} />
                          ))}
                        </div>
                        <style>{`
                          @keyframes bounce {
                            0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
                            40% { transform: translateY(-12px); opacity: 1; }
                          }
                        `}</style>
                      </div>
                    )}

                    {aiError && (
                      <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: '#FF9500' }}>
                        {aiError}
                        <div style={{ marginTop: 8 }}>
                          <span onClick={() => { setAiReport(null); setShowAIReport(false); setTimeout(() => setShowAIReport(true), 100); }} style={{ color: '#3182F6', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>다시 시도 ›</span>
                        </div>
                      </div>
                    )}

                    {aiReport && (
                      <>
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#8B95A1', marginBottom: 8 }}>📉 현재 상태</div>
                          <div style={{ fontSize: 14, color: '#191F28', lineHeight: 1.7 }}>{aiReport.currentStatus}</div>
                        </div>
                        {aiReport.indicators?.length > 0 && (
                          <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#8B95A1', marginBottom: 10 }}>📊 주요 지표</div>
                            <div className="flex flex-col" style={{ gap: 8 }}>
                              {aiReport.indicators.map((ind: any, idx: number) => (
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
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#8B95A1', marginBottom: 8 }}>📈 과거 유사 상황</div>
                            <div style={{ fontSize: 14, color: '#191F28', lineHeight: 1.7 }}>{aiReport.historicalNote}</div>
                          </div>
                        )}
                        {aiReport.newsContext && (
                          <div style={{ marginBottom: 20 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#8B95A1', marginBottom: 8 }}>📰 뉴스 영향</div>
                            <div style={{ fontSize: 14, color: '#191F28', lineHeight: 1.7 }}>{aiReport.newsContext}</div>
                          </div>
                        )}
                        {aiReport.conclusion && (
                          <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                            <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#191F28' }}>💡 종합 판단</span>
                              <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: aiReport.conclusion.signal === 'positive' ? '#EDFCF2' : aiReport.conclusion.signal === 'negative' ? '#FFF0F0' : 'rgba(255,149,0,0.08)', color: aiReport.conclusion.signal === 'positive' ? '#16A34A' : aiReport.conclusion.signal === 'negative' ? '#EF4452' : '#FF9500' }}>
                                {aiReport.conclusion.label} {aiReport.conclusion.signal === 'positive' ? '🟢' : aiReport.conclusion.signal === 'negative' ? '🔴' : '🟡'}
                              </span>
                            </div>
                            <div style={{ fontSize: 14, color: '#4E5968', lineHeight: 1.7 }}>{aiReport.conclusion.desc}</div>
                          </div>
                        )}
                      </>
                    )}

                    {!aiLoading && !aiReport && !aiError && (
                      <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: '#8B95A1' }}>
                        AI 분석을 준비 중이에요...
                      </div>
                    )}

                    <div style={{ fontSize: 11, color: '#B0B8C1', lineHeight: 1.6, textAlign: 'center', paddingTop: 12, borderTop: '1px solid #F2F4F6' }}>
                      이 분석은 AI(Gemini)가 생성한 참고 자료이며, 투자 권유가 아닙니다.
                    </div>
                  </div>
                )}

                {analysis && (
                  <>
                    {/* Chart shape summary card */}
                    <div style={{
                      padding: 20,
                      borderRadius: 14,
                      background: '#F8F9FB',
                      border: '1px solid #F2F4F6',
                      marginBottom: 24,
                    }}>
                      <div className="flex items-center" style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, gap: 8 }}>
                        📊 차트 요약
                      </div>
                      <div className="flex items-center" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, gap: 8 }}>
                        {analysis.chartShape.icon} {analysis.chartShape.title}
                      </div>
                      <div style={{ fontSize: 14, color: '#8B95A1', lineHeight: 1.7, marginBottom: 16 }}>
                        {analysis.chartShape.desc}
                      </div>
                      <div className="flex items-center" style={{ gap: 16, paddingTop: 14, borderTop: '1px solid #F2F4F6' }}>
                        <span
                          className="inline-flex items-center"
                          style={{
                            padding: '4px 12px',
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 700,
                            background: analysis.chartShape.signal === 'positive' ? '#EDFCF2' :
                                       analysis.chartShape.signal === 'caution' ? '#FFF8E6' : '#F2F4F6',
                            color: analysis.chartShape.signal === 'positive' ? '#16A34A' :
                                  analysis.chartShape.signal === 'caution' ? '#E8950A' : '#8B95A1',
                          }}
                        >
                          {analysis.chartShape.signal === 'positive' ? '🟢 긍정적' :
                           analysis.chartShape.signal === 'caution' ? '🟡 관망' : '⚪ 중립'}
                        </span>
                        {analysis.rsiVal != null && (
                          <span style={{ fontSize: 13, color: '#8B95A1', fontWeight: 500 }}>
                            RSI {analysis.rsiVal.toFixed(0)} {analysis.rsiVal < 30 ? '(과매도)' : analysis.rsiVal > 70 ? '(과열)' : '(적정)'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* AI Report was moved outside analysis block */}

                  </>
                )}

                {/* === Below here: always visible regardless of analysis data === */}

                {/* Investment P&L */}
                {stockData && stockData.avgCost > 0 && stockData.shares > 0 && price > 0 && (
                  <div style={{ padding: 20, borderRadius: 14, background: '#F8F9FA', marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#8B95A1', marginBottom: 12 }}>내 투자 현황</div>
                    <div>
                      <div className="flex justify-between items-center" style={{ padding: '6px 0' }}>
                        <span style={{ fontSize: 14, color: '#8B95A1' }}>보유 수량</span>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{stockData.shares}주</span>
                      </div>
                      <div className="flex justify-between items-center" style={{ padding: '6px 0' }}>
                        <span style={{ fontSize: 14, color: '#8B95A1' }}>평균 매수가</span>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>
                          {currency === 'KRW'
                            ? <>₩{Math.round(stockData.avgCost * usdKrw).toLocaleString()}{' '}<span style={{ fontSize: 11, color: '#B0B8C1', fontWeight: 400 }}>(${stockData.avgCost.toFixed(2)})</span></>
                            : <>${stockData.avgCost.toFixed(2)}{' '}<span style={{ fontSize: 11, color: '#B0B8C1', fontWeight: 400 }}>(₩{Math.round(stockData.avgCost * usdKrw).toLocaleString()})</span></>
                          }
                        </span>
                      </div>
                      <div className="flex justify-between items-center" style={{ padding: '6px 0' }}>
                        <span style={{ fontSize: 14, color: '#8B95A1' }}>투자 원금</span>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>
                          {currency === 'KRW'
                            ? <>{fmtWonShort(stockData.avgCost * stockData.shares * usdKrw)}{' '}<span style={{ fontSize: 11, color: '#B0B8C1', fontWeight: 400 }}>(${(stockData.avgCost * stockData.shares).toLocaleString(undefined, { maximumFractionDigits: 0 })})</span></>
                            : <>${(stockData.avgCost * stockData.shares).toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}<span style={{ fontSize: 11, color: '#B0B8C1', fontWeight: 400 }}>({fmtWonShort(stockData.avgCost * stockData.shares * usdKrw)})</span></>
                          }
                        </span>
                      </div>
                      <div className="flex justify-between items-center" style={{ padding: '6px 0' }}>
                        <span style={{ fontSize: 14, color: '#8B95A1' }}>평가 금액</span>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>
                          {currency === 'KRW'
                            ? <>{fmtWonShort(price * stockData.shares * usdKrw)}{' '}<span style={{ fontSize: 11, color: '#B0B8C1', fontWeight: 400 }}>(${(price * stockData.shares).toLocaleString(undefined, { maximumFractionDigits: 0 })})</span></>
                            : <>${(price * stockData.shares).toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}<span style={{ fontSize: 11, color: '#B0B8C1', fontWeight: 400 }}>({fmtWonShort(price * stockData.shares * usdKrw)})</span></>
                          }
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
                          <div className="flex justify-between items-center" style={{ padding: '12px 0 6px', borderTop: '1px solid #F2F4F6', marginTop: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#191F28' }}>수익</span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: plIsGain ? '#EF4452' : '#3182F6' }}>
                              {currency === 'KRW'
                                ? <>{plIsGain ? '+' : '-'}{fmtWonShort(Math.abs(plWon))}</>
                                : <>{plIsGain ? '+' : '-'}${Math.abs(plUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                              }{' '}
                              <span style={{ fontSize: 11, fontWeight: 400 }}>
                                ({plIsGain ? '+' : ''}{plPctVal.toFixed(2)}%)
                              </span>
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                    <div style={{ fontSize: 11, color: '#B0B8C1', marginTop: 8 }}>
                      {currency === 'KRW'
                        ? `💡 환율 ₩${usdKrw.toLocaleString(undefined, { maximumFractionDigits: 0 })}/$ 기준이에요. 환율이 바뀌면 원화 금액도 달라져요.`
                        : '💡 달러 기준으로 표시 중이에요. 괄호 안은 원화 환산 금액이에요.'
                      }
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
                      📋 매수 이력
                    </div>
                    <div>
                      <div className="flex items-center" style={{ gap: 12, padding: '10px 14px', borderRadius: 10, background: '#F8F9FA' }}>
                        <span style={{ fontSize: 12, color: '#B0B8C1', minWidth: 80 }}>매수</span>
                        <span style={{ fontSize: 13, color: '#191F28', flex: 1 }}>{stockData.shares}주</span>
                        <span style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>${stockData.avgCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Buy Simulator */}
                {symbol && price > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <BuySimulator
                      symbol={symbol}
                      currentPrice={price}
                      avgCost={stockData?.avgCost || 0}
                      shares={stockData?.shares || 0}
                      totalPortfolioValue={(() => {
                        const state = usePortfolioStore.getState();
                        let tv = 0;
                        (state.stocks.investing || []).forEach(s => {
                          const q = state.macroData[s.symbol] as QuoteData | undefined;
                          if (q?.c && s.shares) tv += q.c * s.shares;
                        });
                        return tv;
                      })()}
                      usdKrw={usdKrw}
                      currency={currency}
                    />
                  </div>
                )}

                {analysis && (
                  <>
                    {/* Chart Tabs */}
                    <div className="flex items-center" style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, gap: 6 }}>
                      📈 차트 분석
                    </div>

                    {/* Chart level tabs: 2 tabs */}
                    <div className="flex items-center" style={{ border: '1px solid #F2F4F6', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
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
                            color: chartLevel === lvl ? '#fff' : '#8B95A1',
                            background: chartLevel === lvl ? '#191F28' : '#FFFFFF',
                            borderTop: 'none',
                            borderBottom: 'none',
                            borderLeft: 'none',
                            borderRight: idx < 1 ? '1px solid #F2F4F6' : 'none',
                          }}
                        >
                          {lvl === 'basic' ? '기본' : '상세'}
                        </button>
                      ))}
                    </div>

                    {/* Timeframe selector */}
                    <div className="flex items-center justify-center" style={{ gap: 4, marginBottom: 16 }}>
                      {([
                        { label: '1M', days: 22 },
                        { label: '3M', days: 60 },
                        { label: '6M', days: 120 },
                        { label: '1Y', days: 0 },
                      ]).map(tf => (
                        <button
                          key={tf.label}
                          onClick={() => setChartRange(tf.days)}
                          className="cursor-pointer"
                          style={{
                            padding: '5px 14px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: chartRange === tf.days ? 700 : 500,
                            color: chartRange === tf.days ? '#3182F6' : '#8B95A1',
                            background: chartRange === tf.days ? 'rgba(49,130,246,0.08)' : 'transparent',
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
                    />

                    <div style={{ fontSize: 12, color: '#B0B8C1', textAlign: 'center', marginTop: 8, marginBottom: 24 }}>
                      {chartLevel === 'basic' ? '캔들 + MA(20/60) + 거래량' : '캔들 + MA(5/20/60) + 볼린저밴드 + MACD + RSI'}
                    </div>

                    {/* Technical indicators grid */}
                    <div className="flex items-center" style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, gap: 6, marginTop: 24 }}>
                      🔧 기술적 지표
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
                          {analysis.rsiVal != null && analysis.rsiVal < 30 ? '과매도 구간\n반등 가능성 있음' :
                           analysis.rsiVal != null && analysis.rsiVal > 70 ? '과열 구간\n조정 주의' : '적정 수준'}
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
                            ? '현재가보다 아래\n단기 상승 추세'
                            : '현재가보다 위\n단기 하락 추세'}
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
                            ? '현재가보다 아래\n중기 상승 추세'
                            : '현재가보다 위\n중기 하락 추세'}
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
                            background: analysis.bollingerStatus.signal === 'buy' ? '#FFF8E6' :
                                       analysis.bollingerStatus.signal === 'sell' ? '#FFF0F0' : '#EDFCF2',
                            color: analysis.bollingerStatus.signal === 'buy' ? '#E8950A' :
                                  analysis.bollingerStatus.signal === 'sell' ? '#EF4452' : '#16A34A',
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
                            background: analysis.macdStatus.signal === 'buy' ? '#EDFCF2' :
                                       analysis.macdStatus.signal === 'sell' ? '#FFF0F0' : '#FFF8E6',
                            color: analysis.macdStatus.signal === 'buy' ? '#16A34A' :
                                  analysis.macdStatus.signal === 'sell' ? '#EF4452' : '#E8950A',
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
                          background: analysis.volRatio > 1.5 ? '#EDFCF2' :
                                     analysis.volRatio < 0.5 ? '#FFF0F0' : '#EDFCF2',
                          color: analysis.volRatio > 1.5 ? '#16A34A' :
                                analysis.volRatio < 0.5 ? '#EF4452' : '#16A34A',
                        }}>
                          {analysis.volRatio > 1.5 ? '활발' : analysis.volRatio < 0.5 ? '한산' : '평균 수준'}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#8B95A1', lineHeight: 1.6 }}>
                        최근 거래량은 20일 평균{analysis.volRatio > 1.5 ? '보다 많아요. 관심이 높은 상태예요.' : analysis.volRatio < 0.5 ? '보다 적어요. 관심이 낮은 상태예요.' : '과 비슷해요. 큰 매도 압력은 없는 상태예요.'}
                      </div>
                    </div>
                  </>
                )}

                {!analysis && !loading && (
                  <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: '#FF9500' }}>
                    차트 데이터가 부족해요. 잠시 후 다시 시도해주세요.
                  </div>
                )}

                {/* Related news */}
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, marginTop: 24 }}>
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
                          className="cursor-pointer"
                          style={{
                            padding: '12px 0',
                            borderBottom: idx < tickerNews.length - 1 ? '1px solid #F7F8FA' : 'none',
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: 11, color: '#B0B8C1' }}>
                            {item.source}{item.source && date ? ' · ' : ''}{date}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: '#8B95A1' }}>
                    관련 뉴스가 없어요.
                  </div>
                )}

                {/* Disclaimer */}
                <div style={{ fontSize: 11, color: '#B0B8C1', textAlign: 'center', padding: '16px 0', borderTop: '1px solid #F2F4F6', marginTop: 16 }}>
                  ⚠️ 이 분석은 참고 자료이며, 투자 권유가 아닙니다. 투자 판단의 책임은 본인에게 있습니다.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
