'use client';

/**
 * MergedHoldingsCard — 다중 broker 분산 보유 종목 통합 뷰 (Phase M-2)
 *
 * docs/BROKER_MERGE_FEATURE.md 합의:
 * - 자동 추론: 같은 symbol을 2개 이상 broker에 보유한 종목이 1개라도 있을 때만 렌더
 * - 통합 row + broker별 lots accordion (펼침)
 * - 가중평균 평단가 표시 + 디스클레이머 (주비 계산값)
 *
 * 단일 broker 사용자 / 분산 보유 0개 → 컴포넌트 자체 미렌더 (UI 변화 0)
 */

import { useMemo, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { BROKER_LABELS, STOCK_KR, type MacroEntry } from '@/config/constants';
import { mergeHoldings } from '@/utils/mergedHoldings';

interface Quote { c?: number; dp?: number }

export default function MergedHoldingsCard() {
  const { stocks, macroData } = usePortfolioStore();
  const [expanded, setExpanded] = useState<string | null>(null);

  const merged = useMemo(() => {
    return mergeHoldings(stocks.investing || []).filter(h => h.hasMultipleBrokers);
  }, [stocks]);

  if (merged.length === 0) return null;

  const usdKrw = (macroData['USD/KRW'] as MacroEntry | undefined)?.value || 1400;

  return (
    <section style={{
      marginBottom: 20,
      padding: '16px 18px',
      borderRadius: 16,
      background: 'linear-gradient(135deg, rgba(49,130,246,0.06), rgba(22,163,74,0.04))',
      border: '1px solid rgba(49,130,246,0.18)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>🧮</span>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)', margin: 0 }}>
          여러 증권사에 분산 보유한 종목
        </h3>
        <span
          title="여러 증권사에 같은 종목이 있을 때 가중평균 평단가로 합쳐 보여드려요. 주비 계산값이라 각 증권사 표시와 다를 수 있어요."
          style={{
            fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginLeft: 'auto', cursor: 'help',
          }}
        >ℹ️ 통합 평단가</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {merged.map(h => {
          const isOpen = expanded === h.symbol;
          const kr = STOCK_KR[h.symbol] || h.symbol;
          const isKR = h.symbol.endsWith('.KS') || h.symbol.endsWith('.KQ');
          const unit = isKR ? '₩' : '$';
          const quote = macroData[h.symbol] as Quote | undefined;
          const currentPrice = quote?.c || h.mergedAvgCost;
          const pnlPct = h.mergedAvgCost > 0 ? ((currentPrice - h.mergedAvgCost) / h.mergedAvgCost) * 100 : 0;
          const pnlColor = pnlPct > 0 ? '#EF4452' : pnlPct < 0 ? '#3182F6' : '#8B95A1';
          const totalValueLocal = currentPrice * h.totalShares;
          const totalValueKrw = isKR ? totalValueLocal : totalValueLocal * usdKrw;
          const brokerLabels = h.brokers.map(b => BROKER_LABELS[b]).join(' + ');
          const brokerSummary = h.hasUnspecifiedBroker
            ? `${brokerLabels}${brokerLabels ? ' + ' : ''}미지정`
            : brokerLabels;

          return (
            <div key={h.symbol} style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--surface, #fff)',
              border: '1px solid var(--border-light, #F2F4F6)',
            }}>
              {/* 통합 row */}
              <button
                onClick={() => setExpanded(isOpen ? null : h.symbol)}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: 0, background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <code style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>{h.symbol}</code>
                    <span style={{ fontSize: 11, color: '#8B95A1' }}>{kr}</span>
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 4,
                      background: 'rgba(49,130,246,0.10)', color: '#3182F6', fontWeight: 600,
                    }}>
                      🏦 {h.lots.length}개 증권사
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
                    {brokerSummary}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 100 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                    {h.totalShares.toLocaleString(undefined, { maximumFractionDigits: 3 })}주
                  </div>
                  <div style={{ fontSize: 11, color: '#8B95A1' }}>
                    평단가 {unit}{h.mergedAvgCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 80 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                    ₩{Math.round(totalValueKrw).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: pnlColor }}>
                    {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                  </div>
                </div>
                <span style={{
                  fontSize: 11, color: '#8B95A1',
                  transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}>▶</span>
              </button>

              {/* broker별 분해 (펼침) */}
              {isOpen && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border-light, #F2F4F6)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {h.lots.map((lot, i) => {
                    const lotPnl = lot.avgCost > 0 ? ((currentPrice - lot.avgCost) / lot.avgCost) * 100 : 0;
                    return (
                      <div key={`${lot.symbol}-${lot.broker || 'na'}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                        <span style={{ minWidth: 88, color: '#4E5968', fontWeight: 600 }}>
                          {lot.broker ? BROKER_LABELS[lot.broker] : '미지정'}
                        </span>
                        <span style={{ flex: 1, color: '#8B95A1' }}>
                          {lot.shares.toLocaleString(undefined, { maximumFractionDigits: 3 })}주 · 평단 {unit}{lot.avgCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                        <span style={{ minWidth: 50, textAlign: 'right', fontWeight: 600, color: lotPnl >= 0 ? '#EF4452' : '#3182F6' }}>
                          {lotPnl >= 0 ? '+' : ''}{lotPnl.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, fontSize: 10, color: '#B0B8C1', lineHeight: 1.5 }}>
        ℹ️ 통합 평단가는 주비 계산값이에요. 각 증권사 표시와 다를 수 있어요. 양도세 계산은 증권사·세무사 확인을 권해요.
      </div>
    </section>
  );
}
