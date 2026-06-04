import { describe, it, expect } from 'vitest';
import {
  calcHealthScore,
  recommendNextAction,
  DIVERSIFIABLE_SECTORS,
  SECTOR_MAP,
  KR_SECTOR_MAP,
  type HealthStock,
} from '@/utils/portfolioHealth';
import { STOCK_KR } from '@/config/constants';

// ────────────────────────────────────────────────────────────────────────────
// 건강 점수 '다음 액션'은 절대 특정 종목을 지목하지 않는다(방향0·자본시장법 §6 불변식).
// recommendNextAction 출력에 어떤 티커/종목명도 새지 않음을 코드로 박제한다.
// FORBIDDEN_PHRASES(문자열 lint)는 카피 우회 시 false-negative라, 로직 산출물을 직접 스캔.
// ────────────────────────────────────────────────────────────────────────────

function mk(symbol: string, value: number, o: Partial<HealthStock> = {}): HealthStock {
  return {
    symbol,
    value,
    avgCost: o.avgCost ?? 100,
    shares: o.shares ?? 1,
    currentPrice: o.currentPrice ?? 100,
    targetReturn: o.targetReturn ?? 0,
  };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * action 텍스트에 종목이 새지 않았는지 단언.
 * 스캔 사전 = STOCK_KR 티커·종목명 ∪ SECTOR_MAP 티커(STOCK_KR에 없는 ABBV/COP/KO/PEP 등
 * 이 모듈이 직접 인지하는 티커까지) + bare 6자리 한국 코드. (리뷰 false-negative 보강)
 */
const LEAK_TICKERS = Array.from(new Set([...Object.keys(STOCK_KR), ...Object.keys(SECTOR_MAP), ...Object.keys(KR_SECTOR_MAP)]));
function assertNoStockLeak(text: string) {
  for (const name of Object.values(STOCK_KR)) {
    if (name && name.length >= 2) {
      expect(text.includes(name), `종목명 누출: "${name}" in "${text}"`).toBe(false);
    }
  }
  for (const ticker of LEAK_TICKERS) {
    const re = new RegExp(`\\b${escapeRe(ticker)}\\b`);
    expect(re.test(text), `티커 누출: "${ticker}" in "${text}"`).toBe(false);
  }
  // bare 6자리 한국 종목코드(예: 005930)
  expect(/\b\d{6}\b/.test(text), `6자리 종목코드 누출 in "${text}"`).toBe(false);
}

describe('calcHealthScore — 기본', () => {
  it('빈 포트폴리오는 0점 + 안전한 sectorBreakdown 기본값', () => {
    const r = calcHealthScore([]);
    expect(r.total).toBe(0);
    expect(r.sectorBreakdown.classifiable).toBe(false);
    expect(r.sectorBreakdown.present).toEqual([]);
  });

  it('총점은 0~100 범위, sectorBreakdown 채워짐', () => {
    const r = calcHealthScore([
      mk('NVDA', 1000, { avgCost: 100, currentPrice: 130 }),
      mk('JPM', 1000, { avgCost: 100, currentPrice: 110 }),
      mk('JNJ', 1000, { avgCost: 100, currentPrice: 90 }),
    ]);
    expect(r.total).toBeGreaterThanOrEqual(0);
    expect(r.total).toBeLessThanOrEqual(100);
    expect(r.sectorBreakdown.present.length).toBeGreaterThan(0);
    expect(r.sectorBreakdown.classifiable).toBe(true); // 전부 미국 분류 가능
  });
});

describe('섹터 갭 진단 (대안 A) — 추천 아닌 descriptive', () => {
  it('미국 IT 일색이면 빈 산업 카테고리를 이름으로 노출(티커 없이)', () => {
    // 동일 비중 IT 5종 → 집중도는 분산되나 섹터분산=0 → diversification이 최약축
    const stocks = ['NVDA', 'AMD', 'AAPL', 'MSFT', 'GOOGL'].map(s =>
      mk(s, 1000, { avgCost: 100, currentPrice: 100 })
    );
    const r = calcHealthScore(stocks);
    expect(r.sectorBreakdown.topSector).toBe('IT');
    expect(r.sectorBreakdown.classifiable).toBe(true);
    expect(r.sectorBreakdown.absent).toContain('헬스케어');
    expect(r.sectorBreakdown.absent).not.toContain('IT');

    const action = recommendNextAction(r);
    expect(action).not.toBeNull();
    expect(action!.axis).toBe('diversification');
    // 빈 산업 카테고리(추상 섹터명)는 노출하되, 특정 종목은 절대 노출 안 함
    expect(action!.action).toMatch(/헬스케어|금융|소비재|에너지|자동차|미디어/);
    assertNoStockLeak(action!.title + ' ' + action!.action);
  });

  it('한국 종목도 섹터 매핑되어 갭 진단 작동(삼성전자=IT, NAVER=IT…)', () => {
    // KR_SECTOR_MAP 적용 후 한국 IT 일색도 분류 가능 → 빈 산업 노출(과거엔 '한국주식'으로 묻혔음)
    const stocks = ['005930.KS', '000660.KS', '035420.KS'].map(s =>
      mk(s, 1000, { avgCost: 100, currentPrice: 100 })
    );
    const r = calcHealthScore(stocks);
    expect(r.sectorBreakdown.topSector).toBe('IT');
    expect(r.sectorBreakdown.classifiable).toBe(true);
    expect(r.sectorBreakdown.absent).toContain('금융');
    expect(r.sectorBreakdown.absent).not.toContain('IT');

    const action = recommendNextAction(r);
    if (action && action.axis === 'diversification') {
      expect(action.action).toMatch(/아직 없는 산업/);
      assertNoStockLeak(action.title + ' ' + action.action);
    }
  });

  it('미등록 한국 종목은 "한국주식" 폴백 → 분류 불가 → 일반 안내', () => {
    // KR_SECTOR_MAP에 없는 가상 한국 티커 → '한국주식' catch-all → classifiable=false
    const stocks = ['999991.KS', '999992.KS', '999993.KS'].map(s =>
      mk(s, 1000, { avgCost: 100, currentPrice: 100 })
    );
    const r = calcHealthScore(stocks);
    expect(r.sectorBreakdown.classifiable).toBe(false);
    const action = recommendNextAction(r);
    if (action && action.axis === 'diversification') {
      expect(action.action).not.toMatch(/아직 없는 산업/);
      assertNoStockLeak(action.title + ' ' + action.action);
    }
  });

  it('H1 — 미국 금융 + 삼성전자(IT)는 매핑으로 "IT 비었다" 오진이 사라짐', () => {
    // 매핑 후 삼성전자=IT → IT가 present → absent에 IT 없음(과거 거짓 갭 해소)
    const stocks = [
      mk('JPM', 1020), mk('V', 1020), mk('MA', 1020), mk('BAC', 1020), mk('GS', 1020), // 금융 51%
      mk('005930.KS', 4900), // 삼성전자(IT) 49%
    ];
    const r = calcHealthScore(stocks);
    expect(r.sectorBreakdown.classifiable).toBe(true);   // 이제 분류 가능
    expect(r.sectorBreakdown.absent).not.toContain('IT'); // IT 보유 → 거짓 갭 없음
    expect(r.sectorBreakdown.absent).not.toContain('금융');
    const action = recommendNextAction(r);
    if (action) assertNoStockLeak(action.title + ' ' + action.action);
  });

  it('지주/복합(기타)·미등록 비중이 크면 분류 불가로 폴백', () => {
    // SK·LG 지주(기타) 다수 → unknownWeight↑ → classifiable=false
    const r = calcHealthScore(['034730.KS', '003550.KS', '078930.KS'].map(s => mk(s, 1000)));
    expect(r.sectorBreakdown.classifiable).toBe(false);
    const action = recommendNextAction(r);
    if (action && action.axis === 'diversification') {
      expect(action.action).not.toMatch(/아직 없는 산업/);
    }
    if (action) assertNoStockLeak(action.title + ' ' + action.action);
  });

  it('다섹터 한국 포트는 분산 점수가 높다(올바른 멀티섹터 분류)', () => {
    // 과거엔 전부 '한국주식'=1섹터라 divScore≈0. 매핑 후 5섹터 → 분산 점수 상승.
    const r = calcHealthScore([
      mk('005930.KS', 1000), // IT
      mk('105560.KS', 1000), // 금융
      mk('068270.KS', 1000), // 헬스케어
      mk('005380.KS', 1000), // 자동차
      mk('033780.KS', 1000), // 소비재
    ]);
    expect(r.sectorBreakdown.present).toEqual(
      expect.arrayContaining(['IT', '금융', '헬스케어', '자동차', '소비재'])
    );
    expect(r.diversification.score).toBeGreaterThan(15); // 5섹터 효과 분산
  });
});

describe('누출 불변식 — 모든 액션은 종목명/티커 0', () => {
  it('다양한 포트폴리오 배터리에서 recommendNextAction은 절대 종목을 지목하지 않는다', () => {
    const portfolios: HealthStock[][] = [
      // 단일 종목
      [mk('TSLA', 1000, { avgCost: 100, currentPrice: 80 })],
      // IT 집중(고비중 1종)
      [mk('NVDA', 9000, { avgCost: 100, currentPrice: 150 }), mk('AAPL', 1000)],
      // 목표 미설정 다수
      ['NVDA', 'JPM', 'JNJ', 'XOM', 'KO'].map(s => mk(s, 1000)),
      // 손실 큰 종목 섞임
      [
        mk('NVDA', 1000, { avgCost: 100, currentPrice: 40 }),
        mk('JPM', 1000, { avgCost: 100, currentPrice: 50 }),
        mk('JNJ', 1000, { avgCost: 100, currentPrice: 105 }),
      ],
      // 한국 종목(매핑됨: 삼성전자·SK하이닉스=IT)
      ['005930.KS', '000660.KS'].map(s => mk(s, 1000)),
      // 미등록 한국 종목(한국주식 폴백)
      ['999991.KS', '999992.KS'].map(s => mk(s, 1000)),
      // 미분류 티커(기타)
      [mk('ZZZZ', 1000), mk('YYYY', 1000)],
      // 균형 잡힌 다섹터(액션 null 가능)
      [
        mk('NVDA', 1000, { targetReturn: 20, currentPrice: 125, avgCost: 100 }),
        mk('JPM', 1000, { targetReturn: 20, currentPrice: 125, avgCost: 100 }),
        mk('JNJ', 1000, { targetReturn: 20, currentPrice: 125, avgCost: 100 }),
        mk('XOM', 1000, { targetReturn: 20, currentPrice: 125, avgCost: 100 }),
        mk('KO', 1000, { targetReturn: 20, currentPrice: 125, avgCost: 100 }),
      ],
    ];

    for (const p of portfolios) {
      const action = recommendNextAction(calcHealthScore(p));
      if (action) assertNoStockLeak(action.title + ' ' + action.action);
    }
  });

  it('DIVERSIFIABLE_SECTORS에는 티커/종목명이 섞이지 않는다(상수 오염 방지)', () => {
    for (const sector of DIVERSIFIABLE_SECTORS) {
      assertNoStockLeak(sector);
      expect(Object.keys(STOCK_KR)).not.toContain(sector);
    }
  });
});
