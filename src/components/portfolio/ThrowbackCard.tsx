'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR } from '@/config/constants';
import type { QuoteData, CandleRaw } from '@/config/constants';
import { formatDisplayAmount, resolveUsdKrw } from '@/utils/koreanNumber';
import { findCanonicalSnapshotNearDate } from '@/utils/dailySnapshot';
import { Clock3, MessageSquareText, Minus, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { convertStockAmount } from '@/utils/stockCurrency';
import { changeColor, roundedChange, signedChange } from '@/utils/stockTrendPresentation';
import { useShallow } from 'zustand/react/shallow';
import { useNow } from '@/hooks/useNow';

type PeriodKey = '1d' | '1w' | '1m' | '3m' | '6m' | '1y';
interface Period {
  key: PeriodKey;
  label: string;         // 탭 라벨
  selfLabel: string;     // "어제의 당신" 등
  days: number;
}

const PERIODS: Period[] = [
  { key: '1d', label: '1일 전',  selfLabel: '지난 가격과 지금 비교',     days: 1 },
  { key: '1w', label: '1주 전', selfLabel: '지난 가격과 지금 비교',   days: 7 },
  { key: '1m', label: '1달 전', selfLabel: '지난 가격과 지금 비교',   days: 31 },
  { key: '3m', label: '3달 전', selfLabel: '지난 가격과 지금 비교',   days: 92 },
  { key: '6m', label: '6달 전', selfLabel: '지난 가격과 지금 비교',   days: 184 },
  { key: '1y', label: '1년 전', selfLabel: '지난 가격과 지금 비교',   days: 365 },
];

/**
 * "과거의 나와 비교" 카드
 * - 6개 기간 탭 (어제~1년 전)
 * - Retrospective 계산: 현재 보유 수량 × 과거 종가
 * - 실제 매매 이력 미반영 근사치 (Phase 1)
 */
export default function ThrowbackCard() {
  const { stocks, macroData, rawCandles, currency, dailySnapshots } = usePortfolioStore(useShallow(state => ({
    stocks: state.stocks, macroData: state.macroData, rawCandles: state.rawCandles,
    currency: state.currency, dailySnapshots: state.dailySnapshots,
  })));
  const [activePeriod, setActivePeriod] = useState<PeriodKey>('1d');
  const usdKrw = resolveUsdKrw(macroData);
  const currentTime = useNow();

  // 공통: 특정 일수 전 가격 조회
  const priceAtDaysAgo = useCallback((symbol: string, days: number): { price: number; ts: number } | null => {
    const c: CandleRaw | undefined = rawCandles[symbol];
    if (!c?.t?.length || !c?.c?.length) return null;
    const targetTs = currentTime / 1000 - days * 86400;
    for (let i = c.t.length - 1; i >= 0; i--) {
      if (c.t[i] <= targetTs) {
        return Number.isFinite(c.c[i]) && c.c[i] > 0 ? { price: c.c[i], ts: c.t[i] } : null;
      }
    }
    return null;
  }, [rawCandles, currentTime]);

  // 각 기간별 데이터 계산
  // 우선순위: ① Daily Snapshot (실제 과거 보유) → ② Retrospective (현재 보유 × 과거 종가)
  const allData = useMemo(() => {
    const investing = (stocks.investing || []).filter(s => Number.isFinite(s.shares) && s.shares > 0);
    if (investing.length === 0 || currentTime === 0) return null;

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
      const targetDate = new Date(currentTime - period.days * 86400000 + 9 * 3600000).toISOString().slice(0, 10);
      const snap = findCanonicalSnapshotNearDate(dailySnapshots, targetDate, 3);

      if (snap && snap.stocks.length > 0) {
        const perfs: PerfEntry[] = [];
        let totalNow = 0;
        let totalPast = 0;
        for (const snapStock of snap.stocks) {
          const q = macroData[snapStock.symbol] as QuoteData | undefined;
          const now = q?.c || 0;
          if (!Number.isFinite(now) || now <= 0 || !Number.isFinite(snapStock.currentPrice) || snapStock.currentPrice <= 0) continue;
          const nowKrw = convertStockAmount(
            snapStock.symbol,
            now,
            usdKrw,
            snapStock.currency,
          ).krw;
          const pastKrw = convertStockAmount(
            snapStock.symbol,
            snapStock.currentPrice,
            usdKrw,
            snapStock.currency,
          ).krw;
          totalNow += nowKrw * snapStock.shares;
          totalPast += pastKrw * snapStock.shares;
          const deltaAbs = (nowKrw - pastKrw) * snapStock.shares;
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
          const label = `${snap.date} 기록`;
          result[period.key] = {
            perfs, totalDelta, totalPct,
            dateLabel: label,
            best: sorted[0], worst: sorted[sorted.length - 1],
            coverage: perfs.length / snap.stocks.length,
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
      let latestTs: number | null = null;

      for (const s of investing) {
        const q = macroData[s.symbol] as QuoteData | undefined;
        const now = q?.c || 0;
        const past = priceAtDaysAgo(s.symbol, period.days);
        if (!Number.isFinite(now) || now <= 0 || !past) continue;

        const nowKrw = convertStockAmount(s.symbol, now, usdKrw, s.currency).krw;
        const pastKrw = convertStockAmount(s.symbol, past.price, usdKrw, s.currency).krw;
        hypotheticalNow += nowKrw * s.shares;
        hypotheticalPast += pastKrw * s.shares;
        earliestTs = earliestTs == null ? past.ts : Math.min(earliestTs, past.ts);
        latestTs = latestTs == null ? past.ts : Math.max(latestTs, past.ts);

        const deltaAbs = (nowKrw - pastKrw) * s.shares;
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

      const dateOnly = (ts: number) => new Date(ts * 1000 + 9 * 3600000).toISOString().slice(0, 10);
      const firstDate = dateOnly(earliestTs!);
      const lastDate = dateOnly(latestTs!);
      const dateLabel = `${firstDate === lastDate ? firstDate : `${firstDate} ~ ${lastDate}`} 종가 기준`;

      result[period.key] = {
        perfs, totalDelta, totalPct, dateLabel,
        best: sorted[0], worst: sorted[sorted.length - 1],
        coverage,
        source: 'retrospective',
      };
    }

    return result;
  }, [stocks.investing, macroData, dailySnapshots, usdKrw, currentTime, priceAtDaysAgo]);

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
    const investing = (stocks.investing || []).filter(s => Number.isFinite(s.shares) && s.shares > 0);
    const now = currentTime;
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
  }, [stocks.investing, currentTime]);

  if (!allData) return null;

  const active = allData[activePeriod];
  const activeNotes = periodNotes[activePeriod];

  const formatMoney = (krw: number) => formatDisplayAmount(krw, currency, usdKrw);

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
        <Clock3 size={18} strokeWidth={1.75} color="var(--text-secondary, #8B95A1)" aria-hidden="true" />
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary, #B0B8C1)', letterSpacing: 0.5 }}>
            지난 가격 돌아보기
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginTop: 2 }}>
            그때와 지금, 얼마나 달라졌나요?
          </div>
        </div>
      </div>

      {/* 기간 탭 */}
      <div
        role="group"
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
              type="button"
              aria-pressed={isActive}
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
                  : isActive ? 'var(--pill-active-fg, #fff)' : 'var(--text-secondary, #4E5968)',
                background: isActive ? 'var(--pill-active-bg, #191F28)' : 'var(--surface, #FFFFFF)',
                border: `1px solid ${isActive ? 'var(--text-primary, #191F28)' : 'var(--border-light, #F2F4F6)'}`,
                cursor: hasData ? 'pointer' : 'not-allowed',
                opacity: hasData ? 1 : 0.4,
                whiteSpace: 'nowrap',
                minHeight: 44,
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
          이 기간에 비교할 가격 자료가 없어요. 다른 기간이나 보유 종목의 가격을 확인해주세요.
        </div>
      ) : (
        <ActiveBody
          data={active}
          selfLabel={PERIODS.find(p => p.key === activePeriod)!.selfLabel}
          formatMoney={formatMoney}
          notes={activeNotes}
          stockNames={Object.fromEntries(stocks.investing.map(stock => [stock.symbol, STOCK_KR[stock.symbol] || stock.name || stock.symbol]))}
        />
      )}
    </div>
  );
}

// ─── 활성 기간 본문 ──────────────────────────────────────────────────────────
function ActiveBody({
  data, selfLabel, formatMoney, notes, stockNames,
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
  formatMoney: (krw: number) => string;
  notes: { symbol: string; emoji: string; text: string; daysAgo: number }[];
  stockNames: Record<string, string>;
}) {
  const moneyFlat = formatMoney(data.totalDelta) === formatMoney(0);
  const amountColor = moneyFlat ? 'var(--text-secondary)' : changeColor(data.totalDelta, 0);
  const amountSign = moneyFlat ? '' : data.totalDelta > 0 ? '+' : '−';
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
              background: 'var(--bg-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            {isSnapshot ? '저장된 보유 수량' : '현재 수량으로 비교'}
          </span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 8 }}>
          {selfLabel}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5, marginBottom: 8 }}>
          {isSnapshot
            ? '그날 저장된 보유 수량을 유지했다고 가정한 가격 변화예요.'
            : '지금 보유한 수량에 기준일 이전의 종가를 적용한 비교예요. 종목마다 거래일이 다를 수 있어요.'}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 24, fontWeight: 800,
            color: amountColor,
          }}>
            {amountSign}{formatMoney(data.totalDelta)}
          </span>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: changeColor(data.totalPct, 2),
          }}>
            ({signedChange(data.totalPct, 2)}%)
          </span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 6 }}>
          {data.perfs.length}개 종목 기준
          {data.coverage < 1 && ` · 일부 종목 제외`}
           · 이후 매매·배당·환율 변화 미반영
        </div>
      </div>

      {/* Best/Worst */}
      {data.best && data.worst && (roundedChange(data.best.deltaPct, 1) !== 0 || roundedChange(data.worst.deltaPct, 1) !== 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <PerfHighlight
            icon={roundedChange(data.best.deltaPct, 1) > 0 ? TrendingUp : roundedChange(data.best.deltaPct, 1) < 0 ? TrendingDown : Minus}
            label={roundedChange(data.best.deltaPct, 1) > 0 ? '가장 많이 오른' : roundedChange(data.best.deltaPct, 1) < 0 ? '가장 덜 내린' : '가격 변동 없음'}
            symbol={data.best.symbol}
            pct={data.best.deltaPct}
            name={stockNames[data.best.symbol]}
          />
          {data.best.symbol !== data.worst.symbol && (
            <PerfHighlight
              icon={roundedChange(data.worst.deltaPct, 1) < 0 ? TrendingDown : Minus}
              label={roundedChange(data.worst.deltaPct, 1) < 0 ? '가장 많이 내린' : roundedChange(data.worst.deltaPct, 1) > 0 ? '가장 덜 오른' : '가격 변동 없음'}
              symbol={data.worst.symbol}
              pct={data.worst.deltaPct}
              name={stockNames[data.worst.symbol]}
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <MessageSquareText size={13} strokeWidth={1.75} aria-hidden="true" />
              그때의 결정
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {notes.map((n, i) => {
              const kr = stockNames[n.symbol] || STOCK_KR[n.symbol] || n.symbol;
              const avatarColor = 'var(--bg-subtle)';
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
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{kr.charAt(0)}</span>
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
  icon: Icon, label, symbol, pct, name,
}: {
  icon: LucideIcon;
  label: string;
  symbol: string;
  pct: number;
  name?: string;
}) {
  const kr = name || STOCK_KR[symbol] || symbol;
  const avatarColor = 'var(--bg-subtle)';
  const color = changeColor(pct);

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
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon size={12} strokeWidth={1.75} aria-hidden="true" />
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%', background: avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{kr.charAt(0)}</span>
        </div>
        <span style={{
          fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
        }}>
          {kr}
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color }}>
        {signedChange(pct)}%
      </div>
    </div>
  );
}
