'use client';

import { useMemo, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR, getAvatarColor } from '@/config/constants';
import type { QuoteData, CandleRaw } from '@/config/constants';
import { formatKRW } from '@/utils/formatKRW';
import { findSnapshotNearDate, getDateDaysAgo } from '@/utils/dailySnapshot';

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
  const { stocks, macroData, rawCandles, currency, dailySnapshots } = usePortfolioStore();
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

  // 각 기간별 데이터 계산
  // 우선순위: ① Daily Snapshot (실제 과거 보유) → ② Retrospective (현재 보유 × 과거 종가)
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
    interface Data {
      perfs: PerfEntry[];
      totalDelta: number;
      totalPct: number;
      dateLabel: string;
      best: PerfEntry | null;
      worst: PerfEntry | null;
      coverage: number;
      source: 'snapshot' | 'retrospective';
    }

    const result: Record<PeriodKey, Data | null> = {
      '1d': null, '1w': null, '1m': null, '3m': null, '6m': null, '1y': null,
    };

    for (const period of PERIODS) {
      // ① 스냅샷 우선 조회 (±3일 허용)
      const targetDate = getDateDaysAgo(period.days);
      const snap = findSnapshotNearDate(dailySnapshots, targetDate, 3);

      if (snap && snap.stocks.length > 0) {
        const perfs: PerfEntry[] = [];
        let totalNow = 0;
        let totalPast = 0;
        for (const snapStock of snap.stocks) {
          const q = macroData[snapStock.symbol] as QuoteData | undefined;
          const now = q?.c || 0;
          if (!now) continue;
          totalNow += now * snapStock.shares;
          totalPast += snapStock.currentPrice * snapStock.shares;
          const deltaAbs = (now - snapStock.currentPrice) * snapStock.shares;
          const deltaPct = snapStock.currentPrice > 0
            ? ((now - snapStock.currentPrice) / snapStock.currentPrice) * 100 : 0;
          perfs.push({
            symbol: snapStock.symbol,
            shares: snapStock.shares,
            priceNow: now,
            pricePast: snapStock.currentPrice,
            deltaAbs, deltaPct,
          });
        }

        if (perfs.length > 0) {
          const sorted = [...perfs].sort((a, b) => b.deltaPct - a.deltaPct);
          const totalDelta = totalNow - totalPast;
          const totalPct = totalPast > 0 ? (totalDelta / totalPast) * 100 : 0;
          const d = new Date(snap.date);
          const label = period.key === '1d'
            ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (어제 실제)`
            : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (실제)`;
          result[period.key] = {
            perfs, totalDelta, totalPct,
            dateLabel: label,
            best: sorted[0], worst: sorted[sorted.length - 1],
            coverage: 1,
            source: 'snapshot',
          };
          continue;
        }
      }

      // ② Retrospective fallback
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
          symbol: s.symbol, shares: s.shares,
          priceNow: now, pricePast: past.price,
          deltaAbs, deltaPct,
        });
      }

      if (perfs.length === 0) continue;
      const coverage = perfs.length / investing.length;
      if (coverage < 0.4) continue;

      const sorted = [...perfs].sort((a, b) => b.deltaPct - a.deltaPct);
      const totalDelta = hypotheticalNow - hypotheticalPast;
      const totalPct = hypotheticalPast > 0 ? (totalDelta / hypotheticalPast) * 100 : 0;

      const d = new Date((earliestTs ?? Date.now() / 1000) * 1000);
      const dateLabel = period.key === '1d'
        ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (어제 · 근사)`
        : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (근사)`;

      result[period.key] = {
        perfs, totalDelta, totalPct, dateLabel,
        best: sorted[0], worst: sorted[sorted.length - 1],
        coverage,
        source: 'retrospective',
      };
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks.investing, macroData, rawCandles, dailySnapshots]);

  // 기간별 "그때 메모" — 활성 기간의 ±50% 범위 내 작성된 노트
  interface PeriodNote {
    symbol: string;
    emoji: string;
    text: string;
    daysAgo: number;
  }
  const periodNotes = useMemo<Record<PeriodKey, PeriodNote[]>>(() => {
    const out: Record<PeriodKey, PeriodNote[]> = {
      '1d': [], '1w': [], '1m': [], '3m': [], '6m': [], '1y': [],
    };
    const investing = (stocks.investing || []).filter(s => s.avgCost > 0 && s.shares > 0);
    const now = Date.now();
    for (const stock of investing) {
      for (const note of (stock.notes || [])) {
        const isoPart = note.date.split('_')[0];
        const noteTs = new Date(isoPart).getTime();
        if (isNaN(noteTs)) continue;
        const daysAgo = (now - noteTs) / (1000 * 86400);
        for (const period of PERIODS) {
          if (daysAgo >= period.days * 0.5 && daysAgo <= period.days * 1.5) {
            out[period.key].push({
              symbol: stock.symbol,
              emoji: note.emoji,
              text: note.text,
              daysAgo,
            });
          }
        }
      }
    }
    for (const k of Object.keys(out) as PeriodKey[]) {
      out[k].sort((a, b) => b.daysAgo - a.daysAgo); // 오래된 것 먼저
      out[k] = out[k].slice(0, 5);
    }
    return out;
  }, [stocks.investing]);

  if (!allData) return null;

  const active = allData[activePeriod];
  const activeNotes = periodNotes[activePeriod];

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
          notes={activeNotes}
        />
      )}
    </div>
  );
}

// ─── 활성 기간 본문 ──────────────────────────────────────────────────────────
function ActiveBody({
  data, selfLabel, formatMoney, notes,
}: {
  data: {
    perfs: Array<{ symbol: string; shares: number; priceNow: number; pricePast: number; deltaAbs: number; deltaPct: number }>;
    totalDelta: number;
    totalPct: number;
    dateLabel: string;
    best: { symbol: string; deltaPct: number } | null;
    worst: { symbol: string; deltaPct: number } | null;
    coverage: number;
    source: 'snapshot' | 'retrospective';
  };
  selfLabel: string;
  formatMoney: (usd: number) => string;
  notes: { symbol: string; emoji: string; text: string; daysAgo: number }[];
}) {
  const isGain = data.totalDelta >= 0;
  const isSnapshot = data.source === 'snapshot';

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
            {data.dateLabel}
          </span>
          <span
            aria-label={isSnapshot ? '실제 스냅샷 기반' : '근사 계산'}
            style={{
              fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10,
              background: isSnapshot
                ? 'var(--color-success-bg, rgba(0,198,190,0.08))'
                : 'var(--color-warning-bg, rgba(255,149,0,0.08))',
              color: isSnapshot
                ? 'var(--color-success, #00C6BE)'
                : 'var(--color-warning, #FF9500)',
            }}
          >
            {isSnapshot ? '✓ 실제' : '≈ 근사'}
          </span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 8 }}>
          {selfLabel}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5, marginBottom: 8 }}>
          {isSnapshot
            ? '그날 실제 보유하던 종목의 그때 가격 vs 현재 가격'
            : '만약 이 날 지금의 포트폴리오를 같은 수량으로 샀다면'}
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
          {!isSnapshot && ' · 매매 이력 미반영'}
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

      {/* 그날의 결정 — 해당 기간 작성된 메모 */}
      {notes.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: 'var(--text-tertiary, #B0B8C1)',
            letterSpacing: 0.4,
            marginBottom: 8,
          }}>
            💭 그때의 결정
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {notes.map((n, i) => {
              const kr = STOCK_KR[n.symbol] || n.symbol;
              const avatarColor = getAvatarColor(n.symbol);
              const daysLabel = n.daysAgo < 2
                ? `${Math.round(n.daysAgo * 24)}시간 전`
                : `${Math.round(n.daysAgo)}일 전`;
              return (
                <div
                  key={`${n.symbol}-${i}`}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'var(--surface, #FFFFFF)',
                    border: '1px solid var(--border-light, #F2F4F6)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: avatarColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{n.symbol.charAt(0)}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>{kr}</span>
                      <span style={{ fontSize: 10 }}>{n.emoji}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginLeft: 'auto' }}>
                        {daysLabel}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: 'var(--text-secondary, #4E5968)',
                      lineHeight: 1.5,
                      wordBreak: 'keep-all',
                    }}>
                      &ldquo;{n.text}&rdquo;
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
