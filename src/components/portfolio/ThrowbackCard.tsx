'use client';

import { useMemo, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import type { QuoteData, CandleRaw } from '@/config/constants';
import { formatKRW } from '@/utils/formatKRW';

type PeriodKey = '1d' | '1w' | '1m' | '3m' | '6m' | '1y';
interface Period {
  key: PeriodKey;
  label: string;         // 탭 라벨
  selfLabel: string;     // "어제의 당신" 등
  days: number;
}

const PERIODS: Period[] = [
  { key: '1d', label: '어제',  selfLabel: '어제의 당신',     days: 1 },
  { key: '1w', label: '1주전', selfLabel: '1주 전의 당신',   days: 7 },
  { key: '1m', label: '1달전', selfLabel: '1달 전의 당신',   days: 31 },
  { key: '3m', label: '3달전', selfLabel: '3달 전의 당신',   days: 92 },
  { key: '6m', label: '6달전', selfLabel: '6달 전의 당신',   days: 184 },
  { key: '1y', label: '1년전', selfLabel: '1년 전의 당신',   days: 365 },
];

/**
 * "과거의 나와 비교" 카드
 * - 6개 기간 탭 (어제~1년 전)
 * - Retrospective 계산: 현재 보유 수량 × 과거 종가
 * - 실제 매매 이력 미반영 근사치 (Phase 1)
 */
export default function ThrowbackCard() {
  const { stocks, macroData, rawCandles, currency } = usePortfolioStore();
  const [activePeriod, setActivePeriod] = useState<PeriodKey>('1d');

  // 공통: 특정 일수 전 가격 조회
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

  // 각 기간별 retrospective 데이터 계산 (탭 preview용 모두, 표시는 선택된 것만)
  const allData = useMemo(() => {
    const investing = (stocks.investing || []).filter(s => s.avgCost > 0 && s.shares > 0);
    if (investing.length === 0) return null;

    interface PerfEntry {
      symbol: string;
      shares: number;
      priceNow: number;
      pricePast: number;
      deltaAbs: number;
      deltaPct: number;
    }

    const result: Record<PeriodKey, {
      perfs: PerfEntry[];
      totalDelta: number;
      totalPct: number;
      dateLabel: string;
      best: PerfEntry | null;
      worst: PerfEntry | null;
      coverage: number;
    } | null> = { '1d': null, '1w': null, '1m': null, '3m': null, '6m': null, '1y': null };

    for (const period of PERIODS) {
      const perfs: PerfEntry[] = [];
      let hypotheticalNow = 0;
      let hypotheticalPast = 0;
      let earliestTs: number | null = null;

      for (const s of investing) {
        const q = macroData[s.symbol] as QuoteData | undefined;
        const now = q?.c || 0;
        const past = priceAtDaysAgo(s.symbol, period.days);
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
          pricePast: past.price,
          deltaAbs,
          deltaPct,
        });
      }

      if (perfs.length === 0) continue;
      const coverage = perfs.length / investing.length;
      if (coverage < 0.4) continue; // 커버리지 낮으면 신뢰 불가

      const sorted = [...perfs].sort((a, b) => b.deltaPct - a.deltaPct);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      const totalDelta = hypotheticalNow - hypotheticalPast;
      const totalPct = hypotheticalPast > 0 ? (totalDelta / hypotheticalPast) * 100 : 0;

      const d = new Date((earliestTs ?? Date.now() / 1000) * 1000);
      const dateLabel = period.key === '1d'
        ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (어제)`
        : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;

      result[period.key] = { perfs, totalDelta, totalPct, dateLabel, best, worst, coverage };
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks.investing, macroData, rawCandles]);

  if (!allData) return null;

  const active = allData[activePeriod];

  const usdKrw = (macroData['USD/KRW'] as { value?: number } | undefined)?.value || 1400;
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
            과거의 나와 비교하기
          </div>
        </div>
      </div>

      {/* 기간 탭 */}
      <div
        role="tablist"
        aria-label="회고 기간 선택"
        className="flex scrollbar-hide"
        style={{ gap: 4, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}
      >
        {PERIODS.map(p => {
          const isActive = activePeriod === p.key;
          const hasData = !!allData[p.key];
          return (
            <button
              key={p.key}
              role="tab"
              aria-selected={isActive}
              disabled={!hasData}
              onClick={() => setActivePeriod(p.key)}
              className="cursor-pointer shrink-0"
              style={{
                padding: '6px 12px',
                borderRadius: 16,
                fontSize: 11,
                fontWeight: isActive ? 700 : 500,
                color: !hasData
                  ? 'var(--text-tertiary, #B0B8C1)'
                  : isActive ? '#fff' : 'var(--text-secondary, #4E5968)',
                background: isActive ? 'var(--text-primary, #191F28)' : 'var(--surface, #FFFFFF)',
                border: `1px solid ${isActive ? 'var(--text-primary, #191F28)' : 'var(--border-light, #F2F4F6)'}`,
                cursor: hasData ? 'pointer' : 'not-allowed',
                opacity: hasData ? 1 : 0.4,
                whiteSpace: 'nowrap',
                minHeight: 28,
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {!active ? (
        <div
          style={{
            padding: '20px 16px',
            borderRadius: 12,
            background: 'var(--surface, #FFFFFF)',
            border: '1px solid var(--border-light, #F2F4F6)',
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text-tertiary, #B0B8C1)',
          }}
        >
          해당 기간 데이터를 불러올 수 없어요.<br/>잠시 후 다시 시도해주세요.
        </div>
      ) : (
        <ActiveBody
          data={active}
          selfLabel={PERIODS.find(p => p.key === activePeriod)!.selfLabel}
          formatMoney={formatMoney}
        />
      )}
    </div>
  );
}

// ─── 활성 기간 본문 ──────────────────────────────────────────────────────────
function ActiveBody({
  data, selfLabel, formatMoney,
}: {
  data: {
    perfs: Array<{ symbol: string; shares: number; priceNow: number; pricePast: number; deltaAbs: number; deltaPct: number }>;
    totalDelta: number;
    totalPct: number;
    dateLabel: string;
    best: { symbol: string; deltaPct: number } | null;
    worst: { symbol: string; deltaPct: number } | null;
    coverage: number;
  };
  selfLabel: string;
  formatMoney: (usd: number) => string;
}) {
  const isGain = data.totalDelta >= 0;
  return (
    <>
      {/* 시나리오 카드 */}
      <div
        style={{
          padding: '16px 18px',
          borderRadius: 14,
          background: 'var(--surface, #FFFFFF)',
          border: '1px solid var(--border-light, #F2F4F6)',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 2 }}>
          {data.dateLabel}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 8 }}>
          {selfLabel}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5, marginBottom: 8 }}>
          만약 이 날 지금의 포트폴리오를 같은 수량으로 샀다면
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 24, fontWeight: 800,
            color: isGain ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)',
          }}>
            {isGain ? '+' : '-'}{formatMoney(data.totalDelta)}
          </span>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: isGain ? 'var(--color-gain, #EF4452)' : 'var(--color-loss, #3182F6)',
          }}>
            ({isGain ? '+' : ''}{data.totalPct.toFixed(2)}%)
          </span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 6 }}>
          {data.perfs.length}개 종목 기준
          {data.coverage < 1 && ` · 일부 종목 제외`}
          {' · 매매 이력 미반영 근사치'}
        </div>
      </div>

      {/* Best/Worst */}
      {data.best && data.worst && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <PerfHighlight
            icon="🚀"
            label={data.best.deltaPct > 0 ? '가장 많이 오른' : '가장 덜 내린'}
            symbol={data.best.symbol}
            pct={data.best.deltaPct}
            isGain
          />
          {data.best.symbol !== data.worst.symbol && (
            <PerfHighlight
              icon={data.worst.deltaPct < 0 ? '📉' : '🐢'}
              label={data.worst.deltaPct < 0 ? '가장 많이 내린' : '가장 덜 오른'}
              symbol={data.worst.symbol}
              pct={data.worst.deltaPct}
              isGain={data.worst.deltaPct >= 0}
            />
          )}
        </div>
      )}
    </>
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
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
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
        {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
      </div>
    </div>
  );
}
