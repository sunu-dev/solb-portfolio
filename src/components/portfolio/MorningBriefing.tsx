'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR } from '@/config/constants';
import { formatKRW } from '@/utils/formatKRW';
import type { QuoteData, MacroEntry } from '@/config/constants';
import { useActiveAlerts } from '@/hooks/useActiveAlerts';
import { findSnapshotNearDate, getDateDaysAgo, getTodayKST } from '@/utils/dailySnapshot';

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
export default function MorningBriefing() {
  const { stocks, macroData, dailySnapshots, currency, setAnalysisSymbol } = usePortfolioStore();
  const activeAlerts = useActiveAlerts();
  const [hidden, setHidden] = useState(true); // 초기 hidden(깜빡임 방지) — useEffect에서 결정

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      const today = getTodayKST();
      setHidden(seen === today);
    } catch {
      setHidden(false);
    }
  }, []);

  const data = useMemo(() => {
    const investing = (stocks.investing || []).filter(s => s.shares > 0 && s.avgCost > 0);
    if (investing.length === 0) return null;

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
    let currentValue = 0;
    let biggestMove: { symbol: string; dp: number; absDp: number } | null = null;
    for (const s of investing) {
      const q = macroData[s.symbol] as QuoteData | undefined;
      if (!q?.c) continue;
      currentValue += q.c * s.shares;
      const dp = q.dp || 0;
      const absDp = Math.abs(dp);
      if (!biggestMove || absDp > biggestMove.absDp) {
        biggestMove = { symbol: s.symbol, dp, absDp };
      }
    }

    // 어제 vs 오늘 (스냅샷)
    const yDate = getDateDaysAgo(1);
    const ySnap = findSnapshotNearDate(dailySnapshots, yDate, 2);
    let deltaVsYesterday: { delta: number; pct: number } | null = null;
    if (ySnap && ySnap.totalValue > 0) {
      const delta = currentValue - ySnap.totalValue;
      const pct = (delta / ySnap.totalValue) * 100;
      deltaVsYesterday = { delta, pct };
    }

    // 가장 최근 메모 (7일 이내)
    let latestNote: { symbol: string; text: string; emoji: string; date: Date } | null = null;
    const all = [...(stocks.investing || []), ...(stocks.sold || [])];
    const sevenDaysAgo = Date.now() - 7 * 86400 * 1000;
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
      currentValue,
      biggestMove,
      deltaVsYesterday,
      latestNote,
      marketLabel,
      marketTone,
      spCp,
      nasdaqCp,
      topAlerts: activeAlerts.slice(0, 2),
    };
  }, [stocks.investing, stocks.sold, macroData, dailySnapshots, activeAlerts]);

  if (hidden || !data) return null;

  // 콘텐츠가 너무 빈약하면 표시 안 함 — 첫 방문 직후 등
  const hasContent = !!data.deltaVsYesterday
    || (data.biggestMove && data.biggestMove.absDp >= 1)
    || data.topAlerts.length > 0
    || !!data.latestNote;
  if (!hasContent) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, getTodayKST());
    } catch { /* ignore */ }
    setHidden(true);
  };

  const usdKrw = (macroData['USD/KRW'] as MacroEntry | undefined)?.value || 1400;
  const fmtMoney = (usd: number) => currency === 'KRW'
    ? formatKRW(Math.round(Math.abs(usd) * usdKrw))
    : `$${Math.abs(usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const today = new Date();
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
      role="region"
      aria-label="오늘 아침 브리핑"
      style={{
        marginBottom: 16,
        padding: '18px 20px',
        borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(255,193,7,0.06) 0%, rgba(49,130,246,0.04) 60%, rgba(175,82,222,0.03) 100%)',
        border: '1px solid rgba(255,193,7,0.18)',
        position: 'relative',
        animation: 'briefing-fade-in 0.4s ease-out',
      }}
    >
      <style>{`
        @keyframes briefing-fade-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* 닫기 X */}
      <button
        onClick={handleDismiss}
        aria-label="브리핑 닫기"
        style={{
          position: 'absolute',
          top: 10, right: 10,
          width: 28, height: 28,
          borderRadius: '50%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          color: 'var(--text-tertiary, #B0B8C1)',
          lineHeight: 1,
        }}
      >
        ✕
      </button>

      {/* 헤더 */}
      <div style={{ marginBottom: 12, paddingRight: 32 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary, #B0B8C1)', letterSpacing: 0.6 }}>
          MORNING BRIEFING · {dateLabel}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginTop: 4, lineHeight: 1.3 }}>
          {greeting}
        </div>
      </div>

      {/* 시장 심리 한 줄 */}
      <div style={{
        fontSize: 12,
        color: 'var(--text-secondary, #4E5968)',
        lineHeight: 1.6,
        marginBottom: 4,
      }}>
        간밤 미국 시장은{' '}
        <strong style={{ color: marketColor, fontWeight: 700 }}>{data.marketLabel}</strong>
        {' · '}
        <span style={{ fontFamily: "'SF Mono', monospace", fontVariantNumeric: 'tabular-nums', fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
          S&P {data.spCp >= 0 ? '+' : ''}{data.spCp.toFixed(2)}% · NASDAQ {data.nasdaqCp >= 0 ? '+' : ''}{data.nasdaqCp.toFixed(2)}%
        </span>
      </div>

      {/* 1. 어제 vs 오늘 */}
      {data.deltaVsYesterday && (
        <BriefingRow
          icon="📊"
          label="어제 대비"
          mainValue={
            <span style={{
              fontSize: 14, fontWeight: 800,
              color: data.deltaVsYesterday.delta >= 0 ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)',
              fontFamily: "'SF Mono', monospace",
              fontVariantNumeric: 'tabular-nums',
            }}>
              {data.deltaVsYesterday.delta >= 0 ? '+' : '-'}{fmtMoney(data.deltaVsYesterday.delta)}
              <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 6, opacity: 0.85 }}>
                ({data.deltaVsYesterday.pct >= 0 ? '+' : ''}{data.deltaVsYesterday.pct.toFixed(2)}%)
              </span>
            </span>
          }
        />
      )}

      {/* 2. 오늘 가장 큰 움직임 */}
      {data.biggestMove && data.biggestMove.absDp >= 1 && (
        <BriefingRow
          icon={data.biggestMove.dp >= 0 ? '🔥' : '🧊'}
          label="가장 큰 움직임"
          mainValue={
            <button
              onClick={() => setAnalysisSymbol(data.biggestMove!.symbol)}
              style={{
                background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
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
          icon="🔔"
          label="짚어볼 것"
          mainValue={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {data.topAlerts.map(a => (
                <div key={a.id} style={{
                  fontSize: 12, color: 'var(--text-secondary, #4E5968)',
                  lineHeight: 1.4, wordBreak: 'keep-all',
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
          icon="💭"
          label="최근 메모"
          mainValue={
            <button
              onClick={() => setAnalysisSymbol(data.latestNote!.symbol)}
              style={{
                background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{
                fontSize: 12, color: 'var(--text-secondary, #4E5968)',
                lineHeight: 1.4, wordBreak: 'keep-all',
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

      {/* 확인 버튼 */}
      <button
        onClick={handleDismiss}
        style={{
          marginTop: 14,
          padding: '10px 14px',
          borderRadius: 10,
          background: 'var(--text-primary, #191F28)',
          color: '#FFFFFF',
          fontSize: 12,
          fontWeight: 600,
          border: 'none',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        확인했어요 →
      </button>
    </div>
  );
}

// ─── Sub: 브리핑 한 줄 ──────────────────────────────────────────────────────
function BriefingRow({
  icon, label, mainValue,
}: {
  icon: string;
  label: string;
  mainValue: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '10px 0',
      borderTop: '1px solid rgba(242,244,246,0.7)',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 600,
          color: 'var(--text-tertiary, #B0B8C1)',
          letterSpacing: 0.3,
          marginBottom: 2,
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
