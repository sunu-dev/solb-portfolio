'use client';

import { useState, useEffect, useMemo } from 'react';
import { BarChart3, Activity, Bell, MessageSquare, X } from 'lucide-react';
import FxStaleNotice from '@/components/common/FxStaleNotice';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR } from '@/config/constants';
import { formatDisplayAmount, resolveUsdKrw } from '@/utils/koreanNumber';
import type { QuoteData, MacroEntry } from '@/config/constants';
import { useActiveAlerts } from '@/hooks/useActiveAlerts';
import {
  findCanonicalSnapshotNearDate,
  getDateDaysAgo,
  getSnapshotKrwTotals,
  getTodayKST,
} from '@/utils/dailySnapshot';
import { useNow } from '@/hooks/useNow';
import { summarizePortfolioCurrency } from '@/utils/stockCurrency';
import EconomicHighlights from '@/components/economy/EconomicHighlights';
import { getBriefingSession } from '@/utils/briefingSession';

const STORAGE_KEY = 'solb_briefing_seen';

/**
 * 오늘 아침 브리핑 — 클라이언트 사이드 데일리 리추얼.
 *
 * 본래 E(KST 7시 알림)는 Vercel Cron + 이메일/카톡이 본 구현이지만,
 * 인프라 없이도 "하루 첫 방문 시 자동 펼침" 패턴으로 동등한 가치 제공.
 *
 * 표시 조건:
 * - 투자 중 종목 ≥ 1개
 * - localStorage 'solb_briefing_seen' 날짜 ≠ 오늘
 * - 데이터 콘텐츠 ≥ 1개 (어제 비교 OR 큰 움직임 OR 알림 OR 메모)
 *
 * 콘텐츠:
 * - 시간대별 인사 + 날짜
 * - 시장 심리(S&P/NASDAQ) 한 줄
 * - 어제 vs 오늘 자산 변화 (스냅샷 기반)
 * - 가장 큰 움직임 종목
 * - 주목할 알림 Top 2
 * - 최근 메모 회상 (7일 이내)
 *
 * "확인했어요" 클릭 → 그날은 다시 안 보임. 다음 날 자동 복귀.
 */
export default function MorningBriefing({ onClose }: { onClose?: () => void } = {}) {
  const { stocks, macroData, dailySnapshots, currency, setAnalysisSymbol } = usePortfolioStore();
  const activeAlerts = useActiveAlerts();
  const currentTime = useNow();
  const [hidden, setHidden] = useState(true); // 초기 hidden(깜빡임 방지) — useEffect에서 결정

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const seen = localStorage.getItem(STORAGE_KEY);
        const today = getTodayKST();
        setHidden(seen === today);
      } catch {
        setHidden(false);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const data = useMemo(() => {
    if (currentTime === 0) return null;
    const investing = (stocks.investing || []).filter(s => s.shares > 0 && s.avgCost > 0);
    if (investing.length === 0) return null;

    const session = getBriefingSession(currentTime);
    // P3 — 시장 심리 정교화: 단순 평균 → 동조/분기 감지
    // S&P(가치 포함 광범위)와 NASDAQ(성장 편중)이 다른 방향이면 시장 로테이션 신호
    const sp = macroData['S&P 500'] as MacroEntry | undefined;
    const nasdaq = macroData['NASDAQ'] as MacroEntry | undefined;
    const spCp = sp?.changePercent || 0;
    const nasdaqCp = nasdaq?.changePercent || 0;

    const SIG = 0.3; // 의미 임계값
    const STRONG = 1.0;
    const spUp = spCp > SIG, spDown = spCp < -SIG;
    const nqUp = nasdaqCp > SIG, nqDown = nasdaqCp < -SIG;
    const spread = nasdaqCp - spCp; // 양수: NASDAQ 강세, 음수: S&P 강세

    let marketLabel: string;
    let marketTone: 'gain' | 'loss' | 'neutral';

    if (spUp && nqUp) {
      // 동조 상승
      const max = Math.max(spCp, nasdaqCp);
      marketLabel = max >= STRONG ? '동조 상승' : '소폭 상승';
      marketTone = 'gain';
    } else if (spDown && nqDown) {
      // 동조 하락
      const min = Math.min(spCp, nasdaqCp);
      marketLabel = min <= -STRONG ? '동조 하락' : '소폭 하락';
      marketTone = 'loss';
    } else if (Math.abs(spread) >= 0.7) {
      // 분기 — 한쪽만 또는 반대 방향
      if (spread > 0) {
        marketLabel = nqUp || !spDown ? '성장주 강세' : '성장주만 회복';
        marketTone = nqUp ? 'gain' : 'neutral';
      } else {
        marketLabel = spUp || !nqDown ? '가치주 강세 (성장주 약세)' : '성장주 약세';
        marketTone = nqDown ? 'loss' : 'neutral';
      }
    } else {
      marketLabel = '혼조';
      marketTone = 'neutral';
    }

    // 현재 자산 + 가장 큰 움직임
    const usdKrw = resolveUsdKrw(macroData);
    const portfolio = summarizePortfolioCurrency(
      investing.map((stock) => {
        const quote = macroData[stock.symbol] as QuoteData | undefined;
        return {
          symbol: stock.symbol,
          currency: stock.currency,
          avgCost: stock.avgCost,
          shares: stock.shares,
          currentPrice: quote?.c || 0,
          dayChange: quote?.d || 0,
          purchaseRate: stock.purchaseRate,
        };
      }),
      usdKrw,
    );
    const currentValueKrw = portfolio.totalValueKrw;
    let biggestMove: { symbol: string; dp: number; absDp: number } | null = null;
    for (const s of investing) {
      const q = macroData[s.symbol] as QuoteData | undefined;
      if (!q?.c) continue;
      const dp = q.dp || 0;
      const absDp = Math.abs(dp);
      if (!biggestMove || absDp > biggestMove.absDp) {
        biggestMove = { symbol: s.symbol, dp, absDp };
      }
    }

    // 어제 vs 오늘 (스냅샷)
    const yDate = getDateDaysAgo(1);
    const ySnap = findCanonicalSnapshotNearDate(dailySnapshots, yDate, 2);
    let deltaVsYesterday: { delta: number; pct: number } | null = null;
    const yTotals = ySnap ? getSnapshotKrwTotals(ySnap) : null;
    const completeQuotes = investing.every(stock => ((macroData[stock.symbol] as QuoteData | undefined)?.c ?? 0) > 0);
    if (completeQuotes && yTotals && yTotals.totalValueKrw > 0) {
      const delta = currentValueKrw - yTotals.totalValueKrw;
      const pct = (delta / yTotals.totalValueKrw) * 100;
      deltaVsYesterday = { delta, pct };
    }

    // 가장 최근 메모 (7일 이내)
    let latestNote: { symbol: string; text: string; emoji: string; date: Date } | null = null;
    const all = [...(stocks.investing || []), ...(stocks.sold || [])];
    const sevenDaysAgo = currentTime - 7 * 86400 * 1000;
    for (const s of all) {
      for (const note of (s.notes || [])) {
        const isoPart = note.date.split('_')[0];
        const dt = new Date(isoPart);
        if (isNaN(dt.getTime())) continue;
        if (dt.getTime() < sevenDaysAgo) continue;
        if (!latestNote || dt > latestNote.date) {
          latestNote = { symbol: s.symbol, text: note.text, emoji: note.emoji, date: dt };
        }
      }
    }

    return {
      session,
      hasIndices: Number.isFinite(sp?.changePercent) && Number.isFinite(nasdaq?.changePercent),
      biggestMove: session.reason || !session.known ? null : biggestMove,
      deltaVsYesterday: session.reason || !session.known ? null : deltaVsYesterday,
      latestNote,
      marketLabel,
      marketTone,
      spCp,
      nasdaqCp,
      topAlerts: session.reason || !session.known ? [] : activeAlerts.slice(0, 2),
    };
  }, [stocks.investing, stocks.sold, macroData, dailySnapshots, activeAlerts, currentTime]);

  if (!data) return onClose ? (
    <div style={{ padding: 24, color: 'var(--text-body)' }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><strong>오늘의 브리핑</strong><button onClick={onClose} style={{minHeight:44}}>닫기</button></div>
      <EconomicHighlights compact />
      <p>보유 종목과 시세가 준비되면 시장 흐름과 내 종목의 변화를 함께 보여드려요.</p>
      <button onClick={onClose} style={{ minHeight: 44, marginTop: 16 }}>확인했어요</button>
    </div>
  ) : null;
  if (hidden && !onClose) return null;

  // 콘텐츠가 너무 빈약하면 표시 안 함 — 첫 방문 직후 등
  const hasContent = !!data.session.reason || !!data.deltaVsYesterday
    || (data.biggestMove && data.biggestMove.absDp >= 1)
    || data.topAlerts.length > 0
    || !!data.latestNote;
  if (!hasContent && !onClose) return null;

  const handleDismiss = () => {
    if (onClose) { onClose(); return; }
    try {
      localStorage.setItem(STORAGE_KEY, getTodayKST());
    } catch { /* ignore */ }
    setHidden(true);
  };

  const usdKrw = resolveUsdKrw(macroData);
  const fmtMoney = (krw: number) => formatDisplayAmount(krw, currency, usdKrw);

  const today = new Date(currentTime);
  const dateLabel = `${today.getMonth() + 1}월 ${today.getDate()}일`;
  const hour = today.getHours();
  const greeting = hour < 6 ? '🌙 새벽까지 깨어 계시네요'
    : hour < 11 ? '☀️ 좋은 아침이에요'
    : hour < 17 ? '🌤️ 오늘 하루도 수고하세요'
    : hour < 21 ? '🌆 오늘 하루 어떠셨어요'
    : '🌙 오늘 마무리 보고드릴게요';

  const marketColor =
    data.marketTone === 'gain' ? 'var(--color-gain, #EF4452)'
    : data.marketTone === 'loss' ? 'var(--color-loss, #3182F6)'
    : 'var(--text-secondary, #4E5968)';

  return (
    <div
      className="joobi-morning-briefing"
      role="region"
      aria-label="오늘의 주비 브리핑"
      style={{
        marginTop: onClose ? 0 : 24,
        marginBottom: onClose ? 0 : 32,
        padding: '24px',
        borderRadius: 24,
        background: 'var(--bg-subtle)',
        position: 'relative',
        animation: 'briefing-fade-in 0.4s ease-out',
      }}
    >
      <style>{`
        @keyframes briefing-fade-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .joobi-morning-briefing { animation: none !important; }
        }
      `}</style>

      {/* 닫기 X */}
      <button
        onClick={handleDismiss}
        aria-label="브리핑 닫기"
        style={{
          position: 'absolute',
          top: 4, right: 4,
          width: 44, height: 44,
          borderRadius: '50%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-tertiary, #B0B8C1)',
          lineHeight: 1,
        }}
      >
        <X size={18} aria-hidden="true" />
      </button>

      {/* 헤더 */}
      <div style={{ marginBottom: 12, paddingRight: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-body)', lineHeight: 1.6 }}>
          오늘의 브리핑 · {dateLabel}
        </div>
        <div style={{ fontSize: 22, fontWeight: 750, color: 'var(--text-primary, #191F28)', marginTop: 10, lineHeight: 1.5, letterSpacing: '-0.03em', wordBreak: 'keep-all' }}>
          {greeting}
        </div>
      </div>

      <EconomicHighlights compact />

      {/* 시장 심리 한 줄 */}
      <div style={{
        fontSize: 15,
        color: 'var(--text-body)',
        lineHeight: 1.75,
        marginBottom: 20,
      }}>
        {data.session.reason ? (
          <><strong>미국 {data.session.date.slice(5).replace('-', '/')}은 {data.session.reason} 휴장이었어요.</strong>
            <span style={{ display: 'block', marginTop: 6, fontSize: 13 }}>최근 정규 거래일은 {data.session.lastTradingDate?.slice(5).replace('-', '/')}이에요. 휴장일의 새 등락은 없어요.</span></>
        ) : <>최근 수신한 미국 지수{' '}<strong style={{ color: marketColor, fontWeight: 700 }}>{data.hasIndices ? data.marketLabel : '확인 중'}</strong></>}
        {!data.session.reason && data.hasIndices && (
        <span style={{ display: 'block', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: 'var(--text-body)', marginTop: 8 }}>
          S&P {data.spCp >= 0 ? '+' : ''}{data.spCp.toFixed(2)}% · NASDAQ {data.nasdaqCp >= 0 ? '+' : ''}{data.nasdaqCp.toFixed(2)}%
        </span>
        )}
      </div>

      {/* 1. 어제 vs 오늘 */}
      {data.deltaVsYesterday && (
        <BriefingRow
          icon={<BarChart3 size={20} aria-hidden="true" />}
          label="어제 대비"
          mainValue={
            <span style={{
              fontSize: 20, fontWeight: 750,
              color: data.deltaVsYesterday.delta >= 0 ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)',
              fontFamily: "'SF Mono', monospace",
              fontVariantNumeric: 'tabular-nums',
            }}>
              {data.deltaVsYesterday.delta >= 0 ? '+' : '-'}{fmtMoney(data.deltaVsYesterday.delta)}
              <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 8 }}>
                ({data.deltaVsYesterday.pct >= 0 ? '+' : ''}{data.deltaVsYesterday.pct.toFixed(2)}%)
              </span>
            </span>
          }
        />
      )}

      {/* 2. 오늘 가장 큰 움직임 */}
      {(data.biggestMove && data.biggestMove.absDp >= 1 || data.topAlerts.length > 0 || data.latestNote) && (
      <details className="briefing-details">
        <summary style={{ cursor: 'pointer', minHeight: 48, padding: '14px 0', fontSize: 15, fontWeight: 650, color: 'var(--text-primary)' }}>
          종목과 기록 자세히 보기
        </summary>
      {data.biggestMove && data.biggestMove.absDp >= 1 && (
        <BriefingRow
          icon={<Activity size={20} aria-hidden="true" />}
          label="가장 큰 움직임"
          mainValue={
            <button
              onClick={() => { onClose?.(); setAnalysisSymbol(data.biggestMove!.symbol); }}
              style={{
                minHeight: 44, background: 'transparent', border: 'none', padding: '8px 0', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'baseline', gap: 6,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)', fontFamily: "'SF Mono', monospace" }}>
                {data.biggestMove.symbol}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
                {STOCK_KR[data.biggestMove.symbol] || ''}
              </span>
              <span style={{
                fontSize: 14, fontWeight: 800,
                color: data.biggestMove.dp >= 0 ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)',
                fontFamily: "'SF Mono', monospace",
                fontVariantNumeric: 'tabular-nums',
              }}>
                {data.biggestMove.dp >= 0 ? '+' : ''}{data.biggestMove.dp.toFixed(2)}%
              </span>
            </button>
          }
        />
      )}

      {/* 3. 주목할 알림 (Top 2) */}
      {data.topAlerts.length > 0 && (
        <BriefingRow
          icon={<Bell size={20} aria-hidden="true" />}
          label="짚어볼 것"
          mainValue={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {data.topAlerts.map(a => (
                <div key={a.id} style={{
                  fontSize: 15, color: 'var(--text-body)',
                  lineHeight: 1.7, wordBreak: 'keep-all',
                  display: 'flex', gap: 6, alignItems: 'baseline',
                }}>
                  <span style={{ fontSize: 9, opacity: 0.7 }}>
                    {a.type === 'urgent' ? '🚨' : a.type === 'risk' ? '⚠️' : a.type === 'insight' ? '✨' : '💡'}
                  </span>
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          }
        />
      )}

      {/* 4. 최근 메모 회상 */}
      {data.latestNote && (
        <BriefingRow
          icon={<MessageSquare size={20} aria-hidden="true" />}
          label="최근 메모"
          mainValue={
            <button
              onClick={() => { onClose?.(); setAnalysisSymbol(data.latestNote!.symbol); }}
              style={{
                minHeight: 44, background: 'transparent', border: 'none', padding: '8px 0', cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{
                fontSize: 15, color: 'var(--text-body)',
                lineHeight: 1.7, wordBreak: 'keep-all',
              }}>
                {data.latestNote.emoji}{' '}
                <span style={{ fontFamily: "'SF Mono', monospace", fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                  {data.latestNote.symbol}
                </span>
                {' · '}
                &ldquo;{(() => {
                  const userPart = data.latestNote.text.replace(/^\[[^\]]+\]\s*/, '').trim();
                  const display = userPart.length > 28 ? userPart.slice(0, 28) + '…' : userPart;
                  return display || '메모 작성됨';
                })()}&rdquo;
              </span>
            </button>
          }
        />
      )}

      </details>
      )}

      {/* 확인 버튼 */}
      <button
        onClick={handleDismiss}
        style={{
          marginTop: 14,
          padding: '10px 14px',
          borderRadius: 10,
          background: 'var(--pill-active-bg)',
          color: 'var(--pill-active-fg)',
          fontSize: 14,
          fontWeight: 600,
          border: 'none',
          cursor: 'pointer',
          width: '100%',
          minHeight: 44,
        }}
      >
        확인했어요 →
      </button>
      <FxStaleNotice style={{ marginTop: 10 }} />
    </div>
  );
}

// ─── Sub: 브리핑 한 줄 ──────────────────────────────────────────────────────
function BriefingRow({
  icon, label, mainValue,
}: {
  icon: React.ReactNode;
  label: string;
  mainValue: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '16px 0',
    }}>
      <span style={{ flexShrink: 0, marginTop: 2, color: 'var(--text-body)' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 500,
          color: 'var(--text-body)',
          letterSpacing: 0.3,
          marginBottom: 6,
        }}>
          {label}
        </div>
        <div style={{ fontSize: 13 }}>
          {mainValue}
        </div>
      </div>
    </div>
  );
}
