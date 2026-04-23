'use client';

import { useMemo } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import type { QuoteData, CandleRaw } from '@/config/constants';
import { formatKRW } from '@/utils/formatKRW';

/**
 * "1년 전 오늘" 회고 카드
 * - 현재 보유 종목이 1년 전엔 얼마였는지
 * - 같은 수량을 1년 전에 샀다면 현재 수익은?
 * - 가장 많이 오른/내린 종목 하이라이트
 */
export default function YearAgoCard() {
  const { stocks, macroData, rawCandles, currency } = usePortfolioStore();

  const retrospective = useMemo(() => {
    const investing = (stocks.investing || []).filter(s => s.avgCost > 0 && s.shares > 0);
    if (investing.length === 0) return null;

    const priceAtDaysAgo = (symbol: string, days: number): { price: number; ts: number } | null => {
      const c: CandleRaw | undefined = rawCandles[symbol];
      if (!c?.t?.length || !c?.c?.length) return null;
      const targetTs = Date.now() / 1000 - days * 86400;
      for (let i = c.t.length - 1; i >= 0; i--) {
        if (c.t[i] <= targetTs) {
          return c.c[i] ? { price: c.c[i], ts: c.t[i] } : null;
        }
      }
      return null;
    };

    interface PerfEntry {
      symbol: string;
      shares: number;
      priceNow: number;
      priceYearAgo: number;
      deltaAbs: number; // USD 차액
      deltaPct: number;
    }
    const perfs: PerfEntry[] = [];
    let hypotheticalNow = 0;
    let hypotheticalPast = 0;
    let earliestTs: number | null = null;

    for (const s of investing) {
      const q = macroData[s.symbol] as QuoteData | undefined;
      const now = q?.c || 0;
      const past = priceAtDaysAgo(s.symbol, 365);
      if (!now || !past) continue;

      hypotheticalNow += now * s.shares;
      hypotheticalPast += past.price * s.shares;
      earliestTs = earliestTs == null ? past.ts : Math.max(earliestTs, past.ts);

      const deltaAbs = (now - past.price) * s.shares;
      const deltaPct = ((now - past.price) / past.price) * 100;
      perfs.push({
        symbol: s.symbol,
        shares: s.shares,
        priceNow: now,
        priceYearAgo: past.price,
        deltaAbs,
        deltaPct,
      });
    }

    if (perfs.length === 0) return null;

    // 데이터 커버리지 (너무 낮으면 신뢰 불가)
    const coverage = perfs.length / investing.length;
    if (coverage < 0.4) return null;

    const sorted = [...perfs].sort((a, b) => b.deltaPct - a.deltaPct);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    const totalDelta = hypotheticalNow - hypotheticalPast;
    const totalPct = hypotheticalPast > 0 ? (totalDelta / hypotheticalPast) * 100 : 0;

    // 1년 전 날짜 라벨
    const d = new Date((earliestTs ?? Date.now() / 1000) * 1000);
    const dateLabel = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;

    return {
      dateLabel,
      totalDelta,
      totalPct,
      best,
      worst,
      coverage,
      perfCount: perfs.length,
      totalCount: investing.length,
    };
  }, [stocks.investing, macroData, rawCandles]);

  if (!retrospective) return null;

  const usdKrw = (macroData['USD/KRW'] as { value?: number } | undefined)?.value || 1400;
  const isGain = retrospective.totalDelta >= 0;
  const { best, worst } = retrospective;

  const formatMoney = (usd: number) => {
    if (currency === 'KRW') return formatKRW(Math.round(Math.abs(usd) * usdKrw));
    return `$${Math.abs(usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  return (
    <div
      style={{
        marginBottom: 32,
        padding: '22px 20px',
        borderRadius: 16,
        background: 'linear-gradient(135deg, var(--bg-subtle, #F8F9FA) 0%, var(--surface, #FFFFFF) 100%)',
        border: '1px solid var(--border-light, #F2F4F6)',
      }}
    >
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>🕰️</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary, #B0B8C1)', letterSpacing: 0.5 }}>
            THROWBACK
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginTop: 2 }}>
            {retrospective.dateLabel}의 당신
          </div>
        </div>
      </div>

      {/* 가정 시나리오 */}
      <div
        style={{
          padding: '16px 18px',
          borderRadius: 14,
          background: 'var(--surface, #FFFFFF)',
          border: '1px solid var(--border-light, #F2F4F6)',
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5, marginBottom: 8 }}>
          만약 1년 전 오늘 지금 보유한 종목을 같은 수량으로 샀다면
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 26, fontWeight: 800,
            color: isGain ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)',
          }}>
            {isGain ? '+' : '-'}{formatMoney(retrospective.totalDelta)}
          </span>
          <span style={{
            fontSize: 14, fontWeight: 700,
            color: isGain ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)',
          }}>
            ({isGain ? '+' : ''}{retrospective.totalPct.toFixed(1)}%)
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 6 }}>
          {retrospective.perfCount}개 종목 기준
          {retrospective.coverage < 1 && ` · 일부 종목은 데이터 부족으로 제외`}
        </div>
      </div>

      {/* Best / Worst 하이라이트 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <PerfHighlight
          icon="🚀"
          label="가장 많이 오른"
          symbol={best.symbol}
          pct={best.deltaPct}
          isGain
        />
        <PerfHighlight
          icon={worst.deltaPct < 0 ? '📉' : '🐢'}
          label={worst.deltaPct < 0 ? '가장 많이 내린' : '가장 덜 오른'}
          symbol={worst.symbol}
          pct={worst.deltaPct}
          isGain={worst.deltaPct >= 0}
        />
      </div>

    </div>
  );
}

function PerfHighlight({
  icon, label, symbol, pct, isGain,
}: {
  icon: string;
  label: string;
  symbol: string;
  pct: number;
  isGain: boolean;
}) {
  const kr = STOCK_KR[symbol] || symbol;
  const avatarColor = getAvatarColor(symbol);
  const color = isGain ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)';

  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: 'var(--surface, #FFFFFF)',
        border: '1px solid var(--border-light, #F2F4F6)',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 6 }}>
        {icon} {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%', background: avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{symbol.charAt(0)}</span>
        </div>
        <span style={{
          fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
        }}>
          {kr}
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color }}>
        {isGain ? '+' : ''}{pct.toFixed(1)}%
      </div>
    </div>
  );
}

