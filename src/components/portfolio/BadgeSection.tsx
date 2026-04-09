'use client';

import { useMemo } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { BADGE_TIERS, BADGES } from '@/config/badges';
import { checkUnlockedBadges } from '@/utils/badgeChecker';
import type { QuoteData } from '@/config/constants';

export default function BadgeSection() {
  const { stocks, macroData } = usePortfolioStore();

  const unlocked = useMemo(() => {
    const allStocks = [...(stocks.investing || []), ...(stocks.watching || []), ...(stocks.sold || [])];
    let profitCount = 0;
    let allProfit = allStocks.length > 0;
    let targetHit = false;

    (stocks.investing || []).forEach(s => {
      const q = macroData[s.symbol] as QuoteData | undefined;
      if (q?.c && s.avgCost > 0) {
        if (q.c > s.avgCost) profitCount++;
        else allProfit = false;
        if (s.targetReturn > 0) {
          const pct = ((q.c - s.avgCost) / s.avgCost) * 100;
          if (pct >= s.targetReturn) targetHit = true;
        }
      } else {
        allProfit = false;
      }
    });

    // streak + AI 사용횟수 localStorage에서 읽기
    let streak = 0;
    let aiUsageCount = 0;
    try {
      const raw = localStorage.getItem('solb_streak');
      if (raw) streak = JSON.parse(raw).count || 0;
    } catch { /* ignore */ }
    try {
      aiUsageCount = parseInt(localStorage.getItem('solb_ai_usage') || '0', 10) || 0;
    } catch { /* ignore */ }

    return checkUnlockedBadges({
      totalStocks: allStocks.length,
      streak,
      aiUsageCount,
      mentorUsed: new Set(),
      profitCount,
      allProfit: allProfit && (stocks.investing || []).length > 0,
      targetHit,
      rainLight: false,
    });
  }, [stocks, macroData]);

  const unlockedIds = new Set(unlocked.map(b => b.id));

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 4 }}>
        내 뱃지
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 16 }}>
        {unlocked.length}/{BADGES.length}개 달성
      </div>

      {BADGE_TIERS.map(tier => (
        <div key={tier.tier} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: tier.color, marginBottom: 8 }}>
            {tier.tier} · {tier.label}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {tier.badges.map(badge => {
              const isUnlocked = unlockedIds.has(badge.id);
              return (
                <div
                  key={badge.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: isUnlocked ? `${badge.color}12` : 'var(--bg-subtle, #F2F4F6)',
                    opacity: isUnlocked ? 1 : 0.4,
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{badge.icon}</span>
                  <span style={{ fontWeight: isUnlocked ? 600 : 400, color: isUnlocked ? badge.color : 'var(--text-tertiary, #B0B8C1)' }}>
                    {badge.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
