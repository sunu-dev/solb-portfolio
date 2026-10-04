'use client';

import { Plus, Check } from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { STOCK_KR } from '@/config/constants';

/**
 * 관심 추가 어포던스 단일 컴포넌트 (SSOT) — 검색·AI촉·Movers·Cohort 등에서 동일 동사·룩.
 *
 * - 공통 중립 표면과 문구를 사용하고, 이미 관심인 상태는 비활성으로 표시.
 * - 추가 = 보유 0주 watching 엔트리(모든 호출부 동일 페이로드). 제거는 포트폴리오에서.
 * - 카드/행 안에 들어가므로 stopPropagation으로 부모 클릭(살펴보기 등)과 분리.
 */
export default function WatchToggle({ symbol, name, full = false }: { symbol: string; name?: string; full?: boolean }) {
  const inWatching = usePortfolioStore((s) => s.stocks.watching.some((w) => w.symbol === symbol));
  const addStock = usePortfolioStore((s) => s.addStock);
  const companyName = STOCK_KR[symbol] || name || symbol;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (inWatching) return;
        addStock('watching', { symbol, name: companyName, avgCost: 0, shares: 0, targetReturn: 0, buyBelow: 0 });
      }}
      disabled={inWatching}
      aria-pressed={inWatching}
      aria-label={inWatching ? `${companyName} 관심 종목에 있어요` : `${companyName} 관심 종목에 추가`}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        width: full ? '100%' : undefined,
        padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, minHeight: 44,
        background: 'var(--bg-subtle)',
        color: inWatching ? 'var(--text-body)' : 'var(--text-primary)',
        border: 'none', cursor: inWatching ? 'default' : 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {inWatching
        ? <><Check style={{ width: 12, height: 12 }} /> 관심</>
        : <><Plus style={{ width: 12, height: 12 }} /> 관심 추가</>}
    </button>
  );
}
