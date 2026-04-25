'use client';

import { useMemo, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { formatKRW } from '@/utils/formatKRW';
import { STOCK_KR } from '@/config/constants';
import type { MacroEntry } from '@/config/constants';
import { computeChapterTime, buildChapterStats, buildTodayLine } from '@/utils/monthlyChapter';

/**
 * Monthly Chapter — 30일 시즌으로 작동하는 투자 일지 척추 카드.
 *
 * 전문가 회의 결론:
 * - 매일 노출되어도 hedonic adaptation 안 일어나도록 P1~P4 신선도 엔진
 * - D-카운트다운 + 진행 바 (목표 근접 효과)
 * - 누적 + 어제 대비 델타 (매일 갱신 명시)
 * - 챔피언 + Streak + 주별 씬 (Phase 2)
 * - 클릭 시 풀스크린 회고 (Phase 3)
 *
 * "한 달이라는 단위가 매일 의미 있는 살아있는 시즌"
 */
interface Props {
  /** 풀스크린 회고(Wrapped) 열기 핸들러 — Phase 3 연결 */
  onOpenWrapped?: () => void;
}

export default function MonthlyChapter({ onOpenWrapped }: Props = {}) {
  const { stocks, macroData, rawCandles, currency, dailySnapshots } = usePortfolioStore();
  const [hovered, setHovered] = useState(false);

  const data = useMemo(() => {
    const time = computeChapterTime();
    const stats = buildChapterStats({
      stocks, macroData, rawCandles, snapshots: dailySnapshots,
    });
    if (!stats) return null;
    const todayLine = buildTodayLine({ time, stats, snapshots: dailySnapshots });
    return { time, stats, todayLine };
  }, [stocks, macroData, rawCandles, dailySnapshots]);

  if (!data) return null;
  const { time, stats, todayLine } = data;

  const usdKrw = (macroData['USD/KRW'] as MacroEntry | undefined)?.value || 1400;
  const isGain = stats.totalAbsReturn >= 0;
  const fmt = (usd: number) => currency === 'KRW'
    ? formatKRW(Math.round(Math.abs(usd) * usdKrw))
    : `$${Math.abs(usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  // 어제 대비 델타 (있을 때만)
  const deltaPct = stats.prevTotalPctReturn !== null
    ? stats.totalPctReturn - stats.prevTotalPctReturn
    : null;

  // Phase별 톤
  const isHighlight = time.phase !== 'progress';

  // 주별 씬 — 이번 달 진행 상태 (1~4주차)
  const weekProgress = time.dayOfMonth / 7;
  const weeks = [
    { num: 1, status: weekProgress >= 1 ? 'done' : weekProgress >= 0 ? 'active' : 'pending' },
    { num: 2, status: weekProgress >= 2 ? 'done' : weekProgress >= 1 ? 'active' : 'pending' },
    { num: 3, status: weekProgress >= 3 ? 'done' : weekProgress >= 2 ? 'active' : 'pending' },
    { num: 4, status: weekProgress >= 4 ? 'done' : weekProgress >= 3 ? 'active' : 'pending' },
  ];

  return (
    <div
      onClick={onOpenWrapped}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role={onOpenWrapped ? 'button' : undefined}
      tabIndex={onOpenWrapped ? 0 : undefined}
      style={{
        marginBottom: 0,
        padding: '20px 18px',
        borderRadius: 16,
        cursor: onOpenWrapped ? 'pointer' : 'default',
        background: isHighlight
          ? (isGain
            ? 'linear-gradient(135deg, var(--color-gain-bg, rgba(239,68,82,0.06)) 0%, rgba(175,82,222,0.05) 100%)'
            : 'linear-gradient(135deg, var(--color-loss-bg, rgba(49,130,246,0.06)) 0%, rgba(175,82,222,0.05) 100%)')
          : 'var(--surface, #FFFFFF)',
        border: `1px solid ${isHighlight ? 'rgba(175,82,222,0.18)' : 'var(--border-light, #F2F4F6)'}`,
        boxShadow: hovered && onOpenWrapped ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
        transition: 'box-shadow 0.18s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 헤더 — 챕터명 + D-카운트다운 + 진행바 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary, #B0B8C1)', letterSpacing: 0.5 }}>
            {time.phase === 'recap' ? 'CHAPTER WRAPPED' : 'CURRENT CHAPTER'}
          </span>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary, #191F28)' }}>
            {time.monthLabel} 챕터
          </span>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700,
          fontFamily: "'SF Mono', monospace",
          color: time.daysRemaining <= 7 && time.phase !== 'recap'
            ? 'var(--color-warning, #FF9500)'
            : 'var(--text-tertiary, #B0B8C1)',
          padding: '3px 8px', borderRadius: 10,
          background: 'var(--bg-subtle, #F2F4F6)',
        }}>
          {time.phase === 'recap'
            ? '회고'
            : time.daysRemaining === 0
            ? '오늘 마감'
            : `D-${time.daysRemaining}`}
        </span>
      </div>

      {/* 진행 바 */}
      <div style={{
        height: 4, borderRadius: 2,
        background: 'var(--bg-subtle, #F2F4F6)',
        overflow: 'hidden', marginBottom: 14,
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(time.progress * 100, 100)}%`,
          background: isHighlight
            ? 'linear-gradient(90deg, #AF52DE 0%, #3182F6 100%)'
            : 'var(--text-tertiary, #B0B8C1)',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* 누적 손익 큰 숫자 + 어제 대비 델타 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span className="tabular-nums" style={{
          fontSize: 32, fontWeight: 800,
          color: isGain ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)',
          fontFamily: "'SF Mono', monospace",
          letterSpacing: '-0.02em', lineHeight: 1,
        }}>
          {isGain ? '+' : '-'}{fmt(stats.totalAbsReturn)}
        </span>
        <span className="tabular-nums" style={{
          fontSize: 14, fontWeight: 700,
          color: isGain ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)',
          fontFamily: "'SF Mono', monospace",
        }}>
          ({isGain ? '+' : ''}{stats.totalPctReturn.toFixed(2)}%)
        </span>
        {deltaPct !== null && Math.abs(deltaPct) >= 0.05 && (
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: 'var(--text-tertiary, #B0B8C1)',
            fontFamily: "'SF Mono', monospace",
          }}>
            {deltaPct >= 0 ? '↑' : '↓'} 어제 {deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(2)}%p
          </span>
        )}
      </div>

      {/* 오늘의 한 줄 — P1~P4 신선도 엔진 */}
      <div style={{
        padding: '10px 12px',
        borderRadius: 10,
        background: 'var(--bg-subtle, #F8F9FA)',
        fontSize: 12, lineHeight: 1.5, fontWeight: 600,
        color: 'var(--text-primary, #191F28)',
        marginBottom: 14,
      }}>
        {todayLine.emoji && <span style={{ marginRight: 6 }}>{todayLine.emoji}</span>}
        {todayLine.text}
      </div>

      {/* Phase 2: Streak + 챔피언 */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap',
      }}>
        {/* Streak */}
        <div style={{
          flex: '1 1 130px', minWidth: 130,
          padding: '8px 10px', borderRadius: 10,
          background: 'var(--bg-subtle, #F8F9FA)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>🔥</span>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', fontWeight: 600 }}>
              메모 STREAK
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'SF Mono', monospace" }}>
              {stats.memoStreak}일
            </div>
          </div>
        </div>

        {/* 챔피언 */}
        {stats.champion && (
          <div style={{
            flex: '1 1 130px', minWidth: 130,
            padding: '8px 10px', borderRadius: 10,
            background: 'var(--bg-subtle, #F8F9FA)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>🏆</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', fontWeight: 600 }}>
                챕터 챔피언
              </div>
              <div style={{
                fontSize: 12, fontWeight: 700, fontFamily: "'SF Mono', monospace",
                color: stats.champion.pctReturn >= 0
                  ? 'var(--color-gain, #EF4452)'
                  : 'var(--color-loss, #3182F6)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {stats.champion.symbol} {stats.champion.pctReturn >= 0 ? '+' : ''}{stats.champion.pctReturn.toFixed(1)}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 주별 씬 (스토리보드 메타포) */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        {weeks.map(w => (
          <div
            key={w.num}
            style={{
              flex: 1,
              padding: '6px 4px',
              borderRadius: 6,
              background: w.status === 'done'
                ? 'var(--text-primary, #191F28)'
                : w.status === 'active'
                ? 'rgba(49,130,246,0.15)'
                : 'var(--bg-subtle, #F2F4F6)',
              color: w.status === 'done' ? '#FFFFFF' : 'var(--text-tertiary, #B0B8C1)',
              fontSize: 9, fontWeight: 700, textAlign: 'center',
              letterSpacing: 0.4,
            }}
          >
            WEEK {w.num} {w.status === 'done' ? '✓' : w.status === 'active' ? '●' : ''}
          </div>
        ))}
      </div>

      {/* 풀스크린 회고 진입 힌트 (Phase 3) */}
      {onOpenWrapped && (
        <div style={{
          marginTop: 10,
          fontSize: 10,
          color: 'var(--text-tertiary, #B0B8C1)',
          textAlign: 'right',
          opacity: hovered ? 1 : 0.6,
          transition: 'opacity 0.18s',
        }}>
          전체 회고 보기 →
        </div>
      )}
    </div>
  );
}
