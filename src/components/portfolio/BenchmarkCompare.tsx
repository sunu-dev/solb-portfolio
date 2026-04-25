'use client';

import { useMemo } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import type { QuoteData, MacroEntry } from '@/config/constants';
import { findSnapshotNearDate, getDateDaysAgo } from '@/utils/dailySnapshot';

/**
 * 시장 대비 내 성과 비교.
 *
 * ⚠️ 이전 구현 결함: 포트폴리오 누적 수익률 vs S&P 오늘 변동률 비교 → 시간 축 불일치 → 거짓 신호
 * 수정: 같은 시간 축(오늘 일일 변동률)로 비교. 가능하면 포트폴리오 어제 스냅샷도 활용.
 *
 * 표시 항목:
 * - 오늘 포트폴리오 %  vs  오늘 S&P 500 %
 * - "알파" = 포트폴리오 - S&P (시장 대비 초과 수익)
 *
 * 향후(P3): SPY 히스토리컬 캔들 + dailySnapshots로 1주/1달/YTD 다기간 비교.
 */
export default function BenchmarkCompare() {
  const { stocks, macroData, dailySnapshots } = usePortfolioStore();

  const data = useMemo(() => {
    const investing = stocks.investing || [];
    if (investing.length === 0) return null;

    // 포트폴리오 오늘 일일 변동 — 시장 대비 직접 비교 가능한 유일한 시간 축
    let todayDelta = 0;
    let prevValue = 0;
    let currentValue = 0;
    let totalCost = 0;
    investing.forEach(s => {
      const q = macroData[s.symbol] as QuoteData | undefined;
      if (!q?.c || s.shares <= 0) return;
      const dailyDeltaPerShare = q.d || 0;
      const prevPrice = q.c - dailyDeltaPerShare;
      todayDelta += dailyDeltaPerShare * s.shares;
      prevValue += prevPrice * s.shares;
      currentValue += q.c * s.shares;
      if (s.avgCost > 0) totalCost += s.avgCost * s.shares;
    });

    if (prevValue === 0) return null;
    const myTodayPct = (todayDelta / prevValue) * 100;

    // S&P 500 오늘 일일 변동 — 같은 시간 축
    const sp = macroData['S&P 500'] as MacroEntry | undefined;
    const spTodayPct = sp?.changePercent || 0;

    // 알파 = 포트폴리오 오늘 - 시장 오늘 (시장 대비 초과 수익)
    const alpha = myTodayPct - spTodayPct;

    // 보조 정보: 어제 스냅샷 기반 1일 비교 (가능하면 누적 손익도 별도 표시)
    const yDate = getDateDaysAgo(1);
    const ySnap = findSnapshotNearDate(dailySnapshots, yDate, 2);
    const cumulativeReturn = totalCost > 0 ? ((currentValue - totalCost) / totalCost) * 100 : null;

    return {
      myTodayPct,
      spTodayPct,
      alpha,
      cumulativeReturn,
      hasYesterdaySnap: !!ySnap,
    };
  }, [stocks, macroData, dailySnapshots]);

  if (!data) return null;

  const barMax = Math.max(Math.abs(data.myTodayPct), Math.abs(data.spTodayPct), 1);
  const isWinning = data.alpha > 0.05; // 0.05%p 이상 차이 나야 의미 있음
  const isLosing = data.alpha < -0.05;

  return (
    <div style={{
      padding: '16px 20px',
      borderRadius: 12,
      background: 'var(--bg-subtle, #F8F9FA)',
      marginBottom: 16,
    }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
          오늘 시장 대비
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600,
          padding: '3px 8px', borderRadius: 10,
          background: 'var(--surface, #fff)',
          color: 'var(--text-tertiary, #B0B8C1)',
          fontFamily: "'SF Mono', monospace",
        }}>
          일일 변동 비교
        </span>
      </div>

      {/* 내 포트폴리오 오늘 */}
      <div style={{ marginBottom: 10 }}>
        <div className="flex items-center justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: 'var(--text-secondary, #8B95A1)' }}>내 포트폴리오 오늘</span>
          <span className="tabular-nums" style={{
            fontWeight: 700,
            color: data.myTodayPct >= 0 ? '#EF4452' : '#3182F6',
            fontFamily: "'SF Mono', monospace",
            fontVariantNumeric: 'tabular-nums',
          }}>
            {data.myTodayPct >= 0 ? '+' : ''}{data.myTodayPct.toFixed(2)}%
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--surface, #fff)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            borderRadius: 4,
            width: `${Math.min(Math.abs(data.myTodayPct) / barMax * 100, 100)}%`,
            background: data.myTodayPct >= 0 ? '#EF4452' : '#3182F6',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* S&P 500 오늘 */}
      <div style={{ marginBottom: 12 }}>
        <div className="flex items-center justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: 'var(--text-secondary, #8B95A1)' }}>S&P 500 오늘</span>
          <span className="tabular-nums" style={{
            fontWeight: 700,
            color: data.spTodayPct >= 0 ? '#EF4452' : '#3182F6',
            fontFamily: "'SF Mono', monospace",
            fontVariantNumeric: 'tabular-nums',
          }}>
            {data.spTodayPct >= 0 ? '+' : ''}{data.spTodayPct.toFixed(2)}%
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--surface, #fff)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            borderRadius: 4,
            width: `${Math.min(Math.abs(data.spTodayPct) / barMax * 100, 100)}%`,
            background: data.spTodayPct >= 0 ? 'rgba(239,68,82,0.45)' : 'rgba(49,130,246,0.45)',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* 알파 (시장 대비 초과 수익) */}
      <div style={{
        padding: '10px 12px',
        borderRadius: 10,
        background: isWinning
          ? 'rgba(239,68,82,0.06)'
          : isLosing
          ? 'rgba(49,130,246,0.06)'
          : 'var(--surface, #fff)',
        border: `1px solid ${
          isWinning ? 'rgba(239,68,82,0.18)'
          : isLosing ? 'rgba(49,130,246,0.18)'
          : 'var(--border-light, #F2F4F6)'
        }`,
      }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary, #B0B8C1)' }}>
            알파 (오늘 시장 대비)
          </span>
          <span className="tabular-nums" style={{
            fontSize: 14, fontWeight: 800,
            color: isWinning ? '#EF4452' : isLosing ? '#3182F6' : 'var(--text-primary, #191F28)',
            fontFamily: "'SF Mono', monospace",
            fontVariantNumeric: 'tabular-nums',
          }}>
            {data.alpha >= 0 ? '+' : ''}{data.alpha.toFixed(2)}%p
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.4 }}>
          {isWinning && '오늘은 시장보다 좋은 흐름이에요'}
          {isLosing && '오늘은 시장에 살짝 못 미쳐요'}
          {!isWinning && !isLosing && '오늘은 시장과 비슷한 흐름'}
        </div>
      </div>

      {/* 누적 손익 (보조 정보 — 시장과 직접 비교는 안 함) */}
      {data.cumulativeReturn !== null && (
        <div style={{
          marginTop: 8,
          fontSize: 11,
          color: 'var(--text-tertiary, #B0B8C1)',
          textAlign: 'center',
          fontFamily: "'SF Mono', monospace",
          fontVariantNumeric: 'tabular-nums',
        }}>
          내 누적 손익 {data.cumulativeReturn >= 0 ? '+' : ''}{data.cumulativeReturn.toFixed(2)}%
          <span style={{ marginLeft: 6, opacity: 0.7 }}>
            (시간 축 다름 — 비교 불가)
          </span>
        </div>
      )}
    </div>
  );
}
