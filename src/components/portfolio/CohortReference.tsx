'use client';

import { useMemo } from 'react';
import { resolveUsdKrw } from '@/utils/koreanNumber';
import { usePortfolioStore } from '@/store/portfolioStore';
import { INVESTOR_TYPES } from '@/config/investorTypes';
import { STOCK_KR } from '@/config/constants';
import { getSector } from '@/utils/portfolioHealth';
import { isSingleStockLeverage } from '@/utils/leverageGuard';
import { useShallow } from 'zustand/react/shallow';
import WatchToggle from '@/components/common/WatchToggle';
import type { QuoteData } from '@/config/constants';
import { CheckCircle2, Lightbulb, UsersRound } from 'lucide-react';
import InvestorTypeIcon from '@/components/insights/InvestorTypeIcon';
import { convertStockAmount } from '@/utils/stockCurrency';

/**
 * 숨은 종목 — 같은 유형 투자자가 자주 보는 (큐레이션, 추천 아님)
 *
 * 데이터 소스: INVESTOR_TYPES[type].referencePicks / referenceSectors (큐레이션)
 *
 * UI 프레이밍 (자본시장법 준수):
 * - "[유형]이 자주 보는 종목" — 관찰
 * - "참고용. 실제 투자 판단은 본인이 하세요." — 면책
 * - "추천", "유망", "사세요" 같은 권유 표현 금지
 */
interface Props {
  /** 유형 미설정 시 퀴즈 모달 여는 핸들러 */
  onStartQuiz?: () => void;
}

export default function CohortReference({ onStartQuiz }: Props = {}) {
  const { stocks, investorType, investorTypeSetAt, setAnalysisSymbol, macroData } = usePortfolioStore(useShallow(state => ({
    stocks: state.stocks, investorType: state.investorType, investorTypeSetAt: state.investorTypeSetAt,
    setAnalysisSymbol: state.setAnalysisSymbol, macroData: state.macroData,
  })));

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
    const usdKrw = resolveUsdKrw(macroData);
    let totalValue = 0;
    const userSectorWeights: Record<string, number> = {};
    for (const s of investing) {
      const q = macroData[s.symbol] as QuoteData | undefined;
      const price = q?.c || 0;
      if (price <= 0) continue;
      const value = convertStockAmount(
        s.symbol,
        price,
        usdKrw,
        s.currency,
      ).krw * s.shares;
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
    //    + 단일종목 레버리지·인버스는 신규 발굴 표면이므로 제외 (defense-in-depth, §6).
    //    지수 레버리지(TQQQ 등)는 isSingleStockLeverage=false라 영향 없음.
    const newPicks = meta.referencePicks.filter(
      p => !heldSymbols.has(p.symbol) && !isSingleStockLeverage(p.symbol),
    );

    return {
      heldSymbols,
      hasInvestment: investing.length > 0,
      sectorComparison,
      newPicks,
      hasUserSectors: Object.keys(userSectorPct).length > 0,
    };
  }, [stocks.investing, stocks.watching, stocks.sold, macroData, meta]);

  // 유형 미설정 시 placeholder — 퀴즈 유도 (이전엔 null로 숨겨서 미니 nav 클릭 무반응)
  if (!hasTypeSet) {
    return (
      <div
        style={{
          marginBottom: 32,
          padding: '24px 20px',
          borderRadius: 16,
          background: 'var(--bg-subtle)',
          border: '1px solid var(--border-light)',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <UsersRound size={22} strokeWidth={1.75} color="var(--text-secondary, #8B95A1)" aria-hidden="true" />
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary, #B0B8C1)', letterSpacing: 0.5 }}>
            성향별 참고 종목
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 6 }}>
          관심 있는 투자 방식을 알아보세요
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5, marginBottom: 16 }}>
          가치·성장·배당 등 투자 방식에 맞춰 미리 정리한 참고 종목과 업종 비중 예시를 살펴볼 수 있어요.
        </div>
        <button
          onClick={onStartQuiz}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            background: 'var(--pill-active-bg)',
            color: 'var(--pill-active-fg)',
            minHeight: 44,
            border: 'none',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          내 투자 성향 살펴보기 →
        </button>
      </div>
    );
  }

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
        <UsersRound size={18} strokeWidth={1.75} color="var(--text-secondary, #8B95A1)" aria-hidden="true" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary, #B0B8C1)', letterSpacing: 0.5 }}>
            성향별 참고 종목
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginTop: 2 }}>
            {meta.nameKr} 관점에서 살펴보기
          </div>
        </div>
        <span style={{
          padding: '3px 8px',
          borderRadius: 10,
          background: 'var(--bg-subtle)',
          color: 'var(--text-secondary)',
          display: 'inline-flex',
          alignItems: 'center',
        }}>
          <InvestorTypeIcon type={meta.id} size={15} color="var(--text-secondary)" />
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
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Lightbulb size={13} strokeWidth={1.75} aria-hidden="true" />
          성향별로 미리 정리한 참고 목록이에요. 다른 사용자의 보유·조회 통계가 아니에요.
        </span>
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
            내 업종 비중과 성향별 예시
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
                      background: 'var(--border-light)',
                    }} />
                    {/* 본인 (컬러) */}
                    <div style={{
                      position: 'absolute', left: 0, bottom: 0, height: 6,
                      width: `${Math.min(userPct * 1.4, 100)}%`,
                      borderRadius: 3,
                      background: 'var(--text-secondary)',
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
                    {userPct}% / 예시 {refPct}%
                  </span>
                  {(isOver || isUnder) && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 6,
                      fontFamily: "'SF Mono', monospace",
                      background: 'var(--surface)',
                      color: 'var(--text-secondary)',
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
            아직 살펴보지 않은 참고 종목
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
                      flex: 1, minWidth: 0, minHeight: 44,
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
                        {kr}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
                        {pick.symbol}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.4 }}>
                      {pick.reason}
                    </div>
                  </button>
                  <div style={{ flexShrink: 0 }}>
                    <WatchToggle symbol={pick.symbol} name={kr} />
                  </div>
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true" />
            참고 목록의 종목을 모두 보유·관심·과거 기록에서 찾았어요
          </span>
        </div>
      )}
    </div>
  );
}
