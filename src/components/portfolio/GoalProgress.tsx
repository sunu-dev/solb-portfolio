'use client';

import { STOCK_KR, getAvatarColor } from '@/config/constants';

interface GoalStock {
  symbol: string;
  avgCost: number;
  shares: number;
  targetReturn: number;
  currentPrice: number;
  value: number; // 평가금액
}

interface GoalProgressProps {
  stocks: GoalStock[];
  currency: 'KRW' | 'USD';
  usdKrw: number;
}

function ProgressBar({ current, target, color }: { current: number; target: number; color: string }) {
  const progress = target > 0 ? Math.min((current / target) * 100, 120) : 0;
  const isAchieved = current >= target && target > 0;

  return (
    <div role="progressbar" aria-valuenow={Math.round(current)} aria-valuemin={0} aria-valuemax={Math.round(target)} style={{ position: 'relative', height: 6, borderRadius: 3, background: 'var(--bg-subtle, #F2F4F6)', overflow: 'hidden' }}>
      <div
        style={{
          height: '100%',
          borderRadius: 3,
          background: isAchieved ? '#EF4452' : color,
          width: `${Math.min(Math.max(progress, 0), 100)}%`,
          transition: 'width 0.7s ease-out',
        }}
      />
    </div>
  );
}

export default function GoalProgress({ stocks, currency, usdKrw }: GoalProgressProps) {
  // Filter stocks with both position and target
  const goalStocks = stocks.filter(s => s.avgCost > 0 && s.shares > 0 && s.targetReturn > 0 && s.currentPrice > 0);

  if (goalStocks.length === 0) return null;

  // Portfolio-level goal (weighted average)
  const totalValue = goalStocks.reduce((s, st) => s + st.value, 0);
  const weightedTarget = totalValue > 0
    ? goalStocks.reduce((s, st) => s + (st.targetReturn * (st.value / totalValue)), 0)
    : 0;
  const weightedCurrent = totalValue > 0
    ? goalStocks.reduce((s, st) => {
        const pnlPct = ((st.currentPrice - st.avgCost) / st.avgCost) * 100;
        return s + (pnlPct * (st.value / totalValue));
      }, 0)
    : 0;
  const overallProgress = weightedTarget > 0 ? (weightedCurrent / weightedTarget) * 100 : 0;

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 16 }}>목표 달성 현황</div>

      {/* Portfolio-level goal */}
      <div style={{ background: 'var(--bg-subtle, #F8F9FA)', borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>전체 포트폴리오</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: weightedCurrent >= weightedTarget ? '#EF4452' : '#3182F6' }}>
            {weightedCurrent >= 0 ? '+' : ''}{weightedCurrent.toFixed(1)}% / {weightedTarget.toFixed(1)}%
          </span>
        </div>
        <ProgressBar current={Math.max(weightedCurrent, 0)} target={weightedTarget} color="#3182F6" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>달성률 {Math.round(Math.max(overallProgress, 0))}%</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
            {overallProgress >= 100 ? '🎉 목표 달성!' : `목표까지 ${(weightedTarget - weightedCurrent).toFixed(1)}%p`}
          </span>
        </div>
      </div>

      {/* Per-stock goals */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {goalStocks
          .sort((a, b) => {
            const pa = ((a.currentPrice - a.avgCost) / a.avgCost * 100) / a.targetReturn;
            const pb = ((b.currentPrice - b.avgCost) / b.avgCost * 100) / b.targetReturn;
            return pb - pa;
          })
          .map(stock => {
            const pnlPct = ((stock.currentPrice - stock.avgCost) / stock.avgCost) * 100;
            const progress = (pnlPct / stock.targetReturn) * 100;
            const isGain = pnlPct >= 0;
            const isAchieved = pnlPct >= stock.targetReturn;
            const kr = STOCK_KR[stock.symbol] || stock.symbol;
            const avatarColor = getAvatarColor(stock.symbol);

            return (
              <div
                key={stock.symbol}
                style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  background: isAchieved ? 'rgba(239,68,82,0.04)' : 'var(--surface, #FFFFFF)',
                  border: `1px solid ${isAchieved ? 'rgba(239,68,82,0.15)' : 'var(--border-light, #F2F4F6)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', backgroundColor: avatarColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: '#fff',
                    }}>
                      {stock.symbol.charAt(0)}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>{kr}</span>
                    {isAchieved && <span style={{ fontSize: 10, background: '#EDFCF2', color: '#16A34A', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>달성</span>}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isGain ? '#EF4452' : '#3182F6', fontVariantNumeric: 'tabular-nums' }}>
                    {isGain ? '+' : ''}{pnlPct.toFixed(1)}%
                  </span>
                </div>
                <ProgressBar current={Math.max(pnlPct, 0)} target={stock.targetReturn} color={isGain ? '#EF4452' : '#3182F6'} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
                    목표 {stock.targetReturn}%
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
                    {isAchieved ? `+${(pnlPct - stock.targetReturn).toFixed(1)}%p 초과` : `${(stock.targetReturn - pnlPct).toFixed(1)}%p 남음`}
                  </span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
