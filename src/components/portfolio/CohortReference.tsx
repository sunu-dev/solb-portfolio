'use client';

import { useMemo } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { INVESTOR_TYPES } from '@/config/investorTypes';
import { STOCK_KR } from '@/config/constants';
import { getSector } from '@/utils/portfolioHealth';
import type { QuoteData } from '@/config/constants';

/**
 * 같은 유형 투자자 코호트 — 큐레이션 기반 참조 (자본시장법 준수: 정보 제공 / 추천·권유 금지)
 *
 * 데이터 소스: INVESTOR_TYPES[type].referencePicks / referenceSectors (큐레이션)
 *
 * 향후(P3): Supabase 서버측 익명 집계로 실제 코호트 데이터 교체
 *  - cohort_stats(investor_type, period) 테이블
 *  - 매주 배치로 같은 유형 사용자들의 보유 종목 분포 집계
 *  - PII 제외, 비중 분포만 저장
 *
 * UI 프레이밍:
 * - "같은 [유형] 투자자들이 자주 살펴보는 종목" — 관찰
 * - "참고용. 실제 투자 판단은 본인이 하세요." — 면책
 * - "추천", "유망", "사세요" 같은 권유 표현 금지
 */
export default function CohortReference() {
  const { stocks, investorType, investorTypeSetAt, addStock, setAnalysisSymbol, macroData } = usePortfolioStore();

  const meta = INVESTOR_TYPES[investorType];
  const hasTypeSet = !!investorTypeSetAt;

  const data = useMemo(() => {
    const heldSymbols = new Set([
      ...(stocks.investing || []).map(s => s.symbol),
      ...(stocks.watching || []).map(s => s.symbol),
      ...(stocks.sold || []).map(s => s.symbol),
    ]);

    // 1. 본인 섹터 분포 (현재 보유 기준)
    const investing = (stocks.investing || []).filter(s => s.shares > 0 && s.avgCost > 0);
    let totalValue = 0;
    const userSectorWeights: Record<string, number> = {};
    for (const s of investing) {
      const q = macroData[s.symbol] as QuoteData | undefined;
      const price = q?.c || 0;
      if (price <= 0) continue;
      const value = price * s.shares;
      totalValue += value;
      const sector = getSector(s.symbol);
      userSectorWeights[sector] = (userSectorWeights[sector] || 0) + value;
    }
    const userSectorPct: Record<string, number> = {};
    if (totalValue > 0) {
      for (const [k, v] of Object.entries(userSectorWeights)) {
        userSectorPct[k] = v / totalValue;
      }
    }

    // 2. Reference 대비 차이 (섹터 단위)
    const refSectors = meta.referenceSectors;
    const sectorComparison = Object.entries(refSectors).map(([sector, refWeight]) => {
      const userWeight = userSectorPct[sector] || 0;
      const diff = userWeight - refWeight;
      return { sector, refWeight, userWeight, diff };
    });

    // 3. 사용자가 보유 안 한 reference picks만 노출
    const newPicks = meta.referencePicks.filter(p => !heldSymbols.has(p.symbol));

    return {
      heldSymbols,
      hasInvestment: investing.length > 0,
      sectorComparison,
      newPicks,
      hasUserSectors: Object.keys(userSectorPct).length > 0,
    };
  }, [stocks.investing, stocks.watching, stocks.sold, investorType, macroData, meta]);

  if (!hasTypeSet) {
    return null; // 유형 미설정 시 숨김
  }

  const handleAddWatch = (symbol: string) => {
    addStock('watching', { symbol, avgCost: 0, shares: 0, targetReturn: 0, buyBelow: 0 });
  };

  return (
    <div
      style={{
        marginBottom: 32,
        padding: '20px 18px',
        borderRadius: 16,
        background: 'var(--surface, #FFFFFF)',
        border: '1px solid var(--border-light, #F2F4F6)',
      }}
    >
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>🌐</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary, #B0B8C1)', letterSpacing: 0.5 }}>
            COHORT REFERENCE
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginTop: 2 }}>
            같은 {meta.nameKr}들의 시선
          </div>
        </div>
        <span style={{
          fontSize: 14,
          padding: '3px 8px',
          borderRadius: 10,
          background: `${meta.accentColor}15`,
          color: meta.accentColor,
        }}>
          {meta.emoji}
        </span>
      </div>

      {/* 면책 한 줄 */}
      <div style={{
        marginTop: 8,
        padding: '8px 10px',
        borderRadius: 8,
        background: 'var(--bg-subtle, #F8F9FA)',
        fontSize: 11,
        color: 'var(--text-tertiary, #B0B8C1)',
        lineHeight: 1.5,
      }}>
        💡 큐레이션 참고자료 · 추천·권유 아님 · 실제 투자 판단은 본인이 하세요
      </div>

      {/* 1. 섹터 비교 */}
      {data.hasInvestment && data.hasUserSectors && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: 'var(--text-tertiary, #B0B8C1)',
            letterSpacing: 0.4,
            marginBottom: 8,
          }}>
            섹터 분포 비교
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.sectorComparison.map(({ sector, refWeight, userWeight, diff }) => {
              const refPct = Math.round(refWeight * 100);
              const userPct = Math.round(userWeight * 100);
              const diffPct = Math.round(diff * 100);
              const isOver = diffPct > 5;
              const isUnder = diffPct < -5;
              return (
                <div
                  key={sector}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: 'var(--bg-subtle, #F8F9FA)',
                  }}
                >
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-primary, #191F28)',
                    minWidth: 60,
                  }}>
                    {sector}
                  </span>
                  {/* 두 막대 같은 너비 컨테이너에 겹쳐 그리기 */}
                  <div style={{ flex: 1, position: 'relative', height: 14 }}>
                    {/* Reference (회색 outline) */}
                    <div style={{
                      position: 'absolute', left: 0, top: 4, height: 6,
                      width: `${Math.min(refPct * 1.4, 100)}%`,
                      borderRadius: 3,
                      background: 'rgba(0,0,0,0.08)',
                    }} />
                    {/* 본인 (컬러) */}
                    <div style={{
                      position: 'absolute', left: 0, bottom: 0, height: 6,
                      width: `${Math.min(userPct * 1.4, 100)}%`,
                      borderRadius: 3,
                      background: meta.accentColor,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <span style={{
                    fontSize: 11,
                    fontFamily: "'SF Mono', monospace",
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--text-tertiary, #B0B8C1)',
                    minWidth: 70,
                    textAlign: 'right',
                  }}>
                    {userPct}% / 평균 {refPct}%
                  </span>
                  {(isOver || isUnder) && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 6,
                      fontFamily: "'SF Mono', monospace",
                      background: isOver
                        ? 'rgba(255,149,0,0.1)'
                        : 'rgba(49,130,246,0.1)',
                      color: isOver ? '#FF9500' : '#3182F6',
                    }}>
                      {diffPct >= 0 ? '+' : ''}{diffPct}%p
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Reference picks (보유 안 한 종목만) */}
      {data.newPicks.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: 'var(--text-tertiary, #B0B8C1)',
            letterSpacing: 0.4,
            marginBottom: 8,
          }}>
            자주 살펴보는 종목
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.newPicks.map(pick => {
              const kr = STOCK_KR[pick.symbol] || pick.symbol;
              return (
                <div
                  key={pick.symbol}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'var(--bg-subtle, #F8F9FA)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <button
                    onClick={() => setAnalysisSymbol(pick.symbol)}
                    style={{
                      flex: 1, minWidth: 0,
                      background: 'transparent', border: 'none', padding: 0,
                      textAlign: 'left', cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        color: 'var(--text-primary, #191F28)',
                        fontFamily: "'SF Mono', monospace",
                      }}>
                        {pick.symbol}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
                        {kr}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.4 }}>
                      {pick.reason}
                    </div>
                  </button>
                  <button
                    onClick={() => handleAddWatch(pick.symbol)}
                    aria-label={`${pick.symbol} 관심 종목 추가`}
                    style={{
                      flexShrink: 0,
                      padding: '6px 10px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 600,
                      background: `${meta.accentColor}15`,
                      color: meta.accentColor,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    + 관심
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 모두 보유 케이스 */}
      {data.newPicks.length === 0 && (
        <div style={{
          marginTop: 14,
          padding: '14px',
          borderRadius: 10,
          background: 'var(--bg-subtle, #F8F9FA)',
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--text-tertiary, #B0B8C1)',
          lineHeight: 1.5,
        }}>
          ✨ 같은 유형 참조 종목 모두 이미 추적 중이에요
        </div>
      )}
    </div>
  );
}
