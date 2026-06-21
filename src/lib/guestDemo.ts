import type { StockItem } from '@/config/constants';

/**
 * 게스트(비로그인) 체험용 샘플 보유 — '보유 거울'을 populated 상태로 보여주기 위한 데모 데이터.
 *
 * 격리(전략회의 decision #4): demo:true 마킹 → ① partialize에서 strip돼 localStorage 미persist(세션 한정)
 *   ② savePortfolioToDB의 stripDemoStocks로 서버 미동기화 ③ 로그인 시 clearGuestDemo로 제거(계정 미이전).
 * §6: 샘플 '보유'는 UI 시연(추천 아님). '체험 모드 · 샘플 데이터' 라벨로 명시.
 */
export const GUEST_DEMO_STOCKS: StockItem[] = [
  { symbol: '005930.KS', avgCost: 71000, shares: 10, targetReturn: 0, demo: true },
  { symbol: 'AAPL',      avgCost: 178,   shares: 5,  targetReturn: 0, demo: true },
  { symbol: 'SPY',       avgCost: 480,   shares: 3,  targetReturn: 0, demo: true },
];
