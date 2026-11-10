'use client';

import { useMemo } from 'react';
import readingUI from '../ui/ReadingUI.module.css';
import { usePortfolioStore } from '@/store/portfolioStore';
import { AVAILABLE_BADGE_TIERS, AVAILABLE_BADGES } from '@/config/badges';
import { checkUnlockedBadges } from '@/utils/badgeChecker';
import type { QuoteData } from '@/config/constants';

export default function BadgeSection({ compact = false }: { compact?: boolean }) {
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
    }).filter(badge => AVAILABLE_BADGES.some(available => available.id === badge.id));
  }, [stocks, macroData]);

  const unlockedIds = new Set(unlocked.map(b => b.id));

  const contents = (
    <div style={{ marginTop: compact ? 8 : 24 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)', marginBottom: 4 }}>
        내 뱃지
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
        {unlocked.length}/{AVAILABLE_BADGES.length}개 달성
      </div>

      {AVAILABLE_BADGE_TIERS.map(tier => (
        <div key={tier.tier} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-body)', marginBottom: 8 }}>
            {tier.tier} · {tier.label}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {tier.badges.map(badge => {
              const isUnlocked = unlockedIds.has(badge.id);
              return (
                <div
                  key={badge.id}
                  aria-label={`${badge.name} · ${isUnlocked ? '달성' : '미달성'}`}
                  title={badge.condition}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: isUnlocked ? `${badge.color}12` : 'var(--bg-subtle, #F2F4F6)',
                    border: '1px solid var(--border-light)',
                    fontSize: 12,
                  }}
                >
                  <span aria-hidden="true" style={{ fontSize: 14 }}>{badge.icon}</span>
                  <span style={{ fontWeight: isUnlocked ? 600 : 400, color: 'var(--text-body)' }}>
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
  return compact ? <details style={{ marginTop: 24, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
    <summary className={readingUI.disclosure}>내 뱃지 보기 · {unlocked.length}개</summary>
    {contents}
  </details> : contents;
}
