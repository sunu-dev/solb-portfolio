'use client';

import { Plus, Check } from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';

/**
 * 관심 추가 어포던스 단일 컴포넌트 (SSOT) — 검색·AI촉·Movers·Cohort 등에서 동일 동사·룩.
 *
 * 토스 PC 리뷰: '관심 추가/+관심/✓관심'이 화면마다 제각각 → 단일 동사·Mossy Teal로 통일.
 * - 이미 관심이면 '✓ 관심'(중립, inert) / 아니면 '관심 추가'(teal). 토스블루 회피.
 * - 추가 = 보유 0주 watching 엔트리(모든 호출부 동일 페이로드). 제거는 포트폴리오에서.
 * - 카드/행 안에 들어가므로 stopPropagation으로 부모 클릭(살펴보기 등)과 분리.
 */
export default function WatchToggle({ symbol, full = false }: { symbol: string; full?: boolean }) {
  const inWatching = usePortfolioStore((s) => s.stocks.watching.some((w) => w.symbol === symbol));
  const addStock = usePortfolioStore((s) => s.addStock);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (inWatching) return;
        addStock('watching', { symbol, avgCost: 0, shares: 0, targetReturn: 0, buyBelow: 0 });
      }}
      disabled={inWatching}
      aria-pressed={inWatching}
      aria-label={inWatching ? `${symbol} 관심 종목에 있어요` : `${symbol} 관심 종목에 추가`}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        width: full ? '100%' : undefined,
        padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
        background: inWatching ? 'var(--bg-subtle, #F2F4F6)' : 'var(--brand-primary-light, rgba(14,124,123,0.08))',
        color: inWatching ? 'var(--text-tertiary, #B0B8C1)' : 'var(--brand-primary, #0E7C7B)',
        border: 'none', cursor: inWatching ? 'default' : 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {inWatching
        ? <><Check style={{ width: 12, height: 12 }} /> 관심</>
        : <><Plus style={{ width: 12, height: 12 }} /> 관심 추가</>}
    </button>
  );
}
