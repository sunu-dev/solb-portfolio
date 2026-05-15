'use client';

/**
 * BrokerSummaryCard — 증권사별 보유 종목 분포 요약 (Phase B-1)
 *
 * docs/BROKER_FEATURE.md 점진 노출 원칙:
 * - 실제 등록된 broker 수 < 2 → 컴포넌트 자체 미렌더 (UI 변화 0)
 * - 2 이상 → 카드 자동 노출
 *
 * 표시 내용: 증권사별 종목 수 + 총 평가액 + 손익 비율 (한국 증권사 15개)
 */

import { useMemo } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import {
  BROKER_LABELS, BROKER_ORDER, BROKER_DISCOVERY_THRESHOLD,
  type Broker, type MacroEntry,
} from '@/config/constants';

interface BrokerStat {
  broker: Broker | 'unspecified';
  label: string;
  count: number;
  totalValueKrw: number;
  totalCostKrw: number;
  pnlPct: number;
}

interface Props {
  /** 활성 필터 (null = 전체) — 부모가 관리 */
  active?: Broker | 'unspecified' | null;
  /** 칩 클릭 핸들러 — 같은 칩 재클릭 시 null 전달 (해제) */
  onSelect?: (broker: Broker | 'unspecified' | null) => void;
}

export default function BrokerSummaryCard({ active = null, onSelect }: Props = {}) {
  const { stocks, macroData } = usePortfolioStore();

  const stats = useMemo<BrokerStat[]>(() => {
    const investing = stocks.investing || [];
    const usdKrw = (macroData['USD/KRW'] as MacroEntry | undefined)?.value || 1400;

    // broker별 집계
    const acc: Record<string, BrokerStat> = {};
    for (const s of investing) {
      if (!s.shares || s.shares <= 0) continue;
      const isKR = s.symbol.endsWith('.KS') || s.symbol.endsWith('.KQ');
      const quote = macroData[s.symbol] as { c?: number } | undefined;
      const currentPrice = quote?.c || s.avgCost;
      const value = currentPrice * s.shares * (isKR ? 1 : usdKrw);
      const cost = s.avgCost * s.shares * (isKR ? 1 : (s.purchaseRate || usdKrw));

      const key = s.broker || 'unspecified';
      const label = s.broker ? BROKER_LABELS[s.broker as Broker] : '미지정';
      if (!acc[key]) {
        acc[key] = { broker: key as Broker | 'unspecified', label, count: 0, totalValueKrw: 0, totalCostKrw: 0, pnlPct: 0 };
      }
      acc[key].count++;
      acc[key].totalValueKrw += value;
      acc[key].totalCostKrw += cost;
    }
    // 손익률 계산
    for (const k of Object.keys(acc)) {
      const a = acc[k];
      a.pnlPct = a.totalCostKrw > 0 ? ((a.totalValueKrw - a.totalCostKrw) / a.totalCostKrw) * 100 : 0;
    }

    // 점진 노출 — 미지정 제외한 실제 broker 종류 ≥ threshold 일 때만 렌더
    const realBrokers = Object.keys(acc).filter(k => k !== 'unspecified');
    if (realBrokers.length < BROKER_DISCOVERY_THRESHOLD) return [];

    // 정렬: BROKER_ORDER 순 + 미지정은 맨 뒤
    return Object.values(acc).sort((a, b) => {
      if (a.broker === 'unspecified') return 1;
      if (b.broker === 'unspecified') return -1;
      const ai = BROKER_ORDER.indexOf(a.broker as Broker);
      const bi = BROKER_ORDER.indexOf(b.broker as Broker);
      return ai - bi;
    });
  }, [stocks, macroData]);

  if (stats.length === 0) return null;

  return (
    <section style={{
      marginBottom: 20,
      padding: '16px 18px',
      borderRadius: 16,
      background: 'var(--surface, #fff)',
      border: '1px solid var(--border-light, #F2F4F6)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>🏦</span>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)', margin: 0 }}>
          증권사별 보유 현황
        </h3>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginLeft: 'auto' }}>
          사용자 입력 정보 · 실제 보유와 다를 수 있어요
        </span>
      </div>

      {/* Phase M-3 — 통합 자산 합계 (모든 broker 합산) */}
      {(() => {
        const totalValue = stats.reduce((sum, s) => sum + s.totalValueKrw, 0);
        const totalCost = stats.reduce((sum, s) => sum + s.totalCostKrw, 0);
        const totalPnlKrw = totalValue - totalCost;
        const totalPnlPct = totalCost > 0 ? (totalPnlKrw / totalCost) * 100 : 0;
        const pnlColor = totalPnlPct > 0 ? '#EF4452' : totalPnlPct < 0 ? '#3182F6' : '#8B95A1';
        return (
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 8,
            padding: '10px 12px', marginBottom: 10,
            borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(14,124,123,0.10), rgba(245,158,11,0.06))',
            border: '1px solid rgba(14,124,123,0.18)',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-primary)' }}>💎 통합 자산</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary, #191F28)', marginLeft: 'auto' }}>
              ₩{Math.round(totalValue).toLocaleString()}
            </span>
            {totalCost > 0 && (
              <span style={{ fontSize: 12, fontWeight: 700, color: pnlColor }}>
                {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(1)}%
              </span>
            )}
          </div>
        );
      })()}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stats.map(s => {
          const pnlColor = s.pnlPct > 0 ? '#EF4452' : s.pnlPct < 0 ? '#3182F6' : '#8B95A1';
          const pct = stats.length > 0 ? (s.totalValueKrw / Math.max(...stats.map(x => x.totalValueKrw), 1)) * 100 : 0;
          const isActive = active === s.broker;
          const isOtherActive = active !== null && !isActive;
          const Wrap = onSelect ? 'button' : 'div';
          return (
            <Wrap key={s.broker} type={onSelect ? 'button' : undefined}
              onClick={onSelect ? () => onSelect(isActive ? null : s.broker) : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10,
                background: isActive ? 'rgba(14,124,123,0.12)' : 'var(--bg-subtle, #F8F9FA)',
                border: isActive ? '1px solid rgba(14,124,123,0.35)' : '1px solid transparent',
                opacity: isOtherActive ? 0.5 : 1,
                cursor: onSelect ? 'pointer' : 'default',
                width: '100%',
                textAlign: 'left',
                transition: 'opacity 0.2s, background 0.2s',
              }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
                    {s.count}종목
                  </span>
                </div>
                <div style={{ height: 4, background: 'var(--border-light, #E5E8EB)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.max(2, pct)}%`,
                    height: '100%',
                    background: s.broker === 'unspecified' ? '#B0B8C1' : 'var(--brand-primary)',
                    borderRadius: 2,
                  }} />
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 80 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                  ₩{Math.round(s.totalValueKrw).toLocaleString()}
                </div>
                {s.totalCostKrw > 0 && Math.abs(s.pnlPct) >= 0.1 && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: pnlColor }}>
                    {s.pnlPct >= 0 ? '+' : ''}{s.pnlPct.toFixed(1)}%
                  </div>
                )}
              </div>
            </Wrap>
          );
        })}
      </div>
      {active !== null && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--brand-primary)', textAlign: 'center' }}>
          🔍 필터 활성 — 같은 칩을 다시 누르면 전체 보기
        </div>
      )}
    </section>
  );
}
