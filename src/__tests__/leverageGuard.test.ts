import { describe, it, expect } from 'vitest';
import {
  isSingleStockLeverage,
  classifyAssetClass,
  detectLeverageProfile,
  isUniverseEligibleClass,
} from '@/utils/leverageGuard';

// ==========================================
// 단일종목 레버리지 가드 — 불변식 박제 (2026-06-16 SpaceX LETF 패널 결론)
// ==========================================
// 목적 1: 미국 신규 상장 단일종목 LETF(2X 외 1.5X/3X/5X/Bull/Bear)가 새지 않음을 고정.
// 목적 2: 패턴 일반화의 오탐(10X Genomics·Build-A-Bear·iShares 등 정상 종목)을 음성으로 박제.
// 이 테스트가 깨지면 leverageGuard 패턴 변경이 회귀/오탐을 일으킨 것이다.

describe('SpaceX 단일종목 레버리지 LETF — 전부 차단 대상', () => {
  // 실제 발행사 작명 관례 (deep-research 그라운딩). Finnhub는 영문 펀드명을 그대로 내려줌.
  const SPACEX_LETFS: Array<[string, string, boolean]> = [
    // [ticker, Finnhub description, isInverse]
    ['SPAL', 'GraniteShares 2x Long SpaceX Daily ETF', false],
    ['SNK', 'GraniteShares 2x Short SpaceX Daily ETF', true],
    ['SPCU', 'Defiance Daily Target 2X Long SpaceX ETF', false],
    ['SPCQ', 'Defiance Daily Target 2X Short SpaceX ETF', true],
    ['SPXG', 'GraniteShares 1.5X Long SpaceX Daily ETF', false],     // 비-2X — 기존 누수
    ['SPXH', 'GraniteShares 1.75X Long SpaceX Daily ETF', false],    // 비-2X — 기존 누수
    ['SPXB', 'Direxion Daily SpaceX Bull 3X Shares', false],         // 3X — 기존 누수
    ['SPXR', 'Direxion Daily SpaceX Bear 1X Shares', true],          // 인버스 1X — 기존 누수
    ['SSPC', 'Leverage Shares 5x Long SPCX Daily ETP', false],       // 5X — 기존 누수
    ['SPXT', 'T-REX 2X Long SpaceX Daily Target ETF', false],
    ['SPXI', 'T-REX 2X Inverse SpaceX Daily Target ETF', true],
    ['SPXD', 'Defiance Daily Target 1.75X Long SpaceX ETF', false],  // 비-2X — 기존 누수
    ['SPLT', 'Tradr 2X Long SpaceX Daily ETF', false],
  ];

  for (const [ticker, name, isInverse] of SPACEX_LETFS) {
    it(`${ticker} (${name}) → 단일종목 레버리지로 탐지`, () => {
      expect(isSingleStockLeverage(ticker, name)).toBe(true);
      const cls = classifyAssetClass(ticker, name);
      expect(cls).toBe(isInverse ? 'inverse_single' : 'leveraged_single');
      // universe 자동 편입에서 반드시 배제
      expect(isUniverseEligibleClass(cls)).toBe(false);
      const p = detectLeverageProfile(ticker, name);
      expect(p.isLeverage).toBe(true);
      expect(p.isSingle).toBe(true);
      expect(p.isInverse).toBe(isInverse);
    });
  }
});

describe('정상 종목 — 오탐 음성 박제 (절대 레버리지로 오분류 금지)', () => {
  const NORMAL: Array<[string, string]> = [
    ['SPCX', 'SpaceX, Inc.'],                       // SpaceX 보통주 (추종 대상이 아닌 기초자산)
    ['TXG', '10x Genomics, Inc.'],                  // 배수 토큰 '10X' 있지만 펀드 아님
    ['BBW', 'Build-A-Bear Workshop, Inc.'],         // 'Bear' 있지만 배수·펀드 컨텍스트 없음
    ['UCTT', 'Ultra Clean Holdings, Inc.'],         // 'Ultra' 단독
    ['X', 'United States Steel Corporation'],       // 티커가 'X'
    ['LEVI', 'Levi Strauss & Co.'],                 // 'Lev...' 부분문자
    ['AAPL', 'Apple Inc.'],
    ['NVDA', 'NVIDIA Corporation'],
    ['SCHD', 'Schwab US Dividend Equity ETF'],
    ['IVV', 'iShares Core S&P 500 ETF'],            // 'iShares'·'ETF' 있지만 배수 없음
    ['TLT', 'iShares 20+ Year Treasury Bond ETF'],  // 'Long-Term'류 채권 ETF
  ];

  for (const [ticker, name] of NORMAL) {
    it(`${ticker} (${name}) → 레버리지 아님`, () => {
      expect(isSingleStockLeverage(ticker, name)).toBe(false);
      const p = detectLeverageProfile(ticker, name);
      expect(p.isLeverage).toBe(false);
      const cls = classifyAssetClass(ticker, name);
      expect(['leveraged_single', 'inverse_single', 'leveraged_index', 'inverse_index']).not.toContain(cls);
    });
  }
});

describe('기존 동작 보존 (회귀 방지)', () => {
  it('TQQQ — 지수 레버리지: 단일종목 아님 (AI 거부 트리거 X), classifyAssetClass=leveraged_index', () => {
    expect(isSingleStockLeverage('TQQQ')).toBe(false);
    expect(classifyAssetClass('TQQQ')).toBe('leveraged_index');
    expect(isUniverseEligibleClass('leveraged_index')).toBe(false);
  });

  it('SQQQ — 지수 인버스: 단일종목 아님, classifyAssetClass=inverse_index', () => {
    expect(isSingleStockLeverage('SQQQ')).toBe(false);
    expect(classifyAssetClass('SQQQ')).toBe('inverse_index');
  });

  it('TSLL — 미국 단일종목 레버리지 화이트리스트', () => {
    expect(isSingleStockLeverage('TSLL')).toBe(true);
    expect(classifyAssetClass('TSLL')).toBe('leveraged_single');
  });

  it('NVDD — 미국 단일종목 인버스 화이트리스트', () => {
    expect(isSingleStockLeverage('NVDD')).toBe(true);
    expect(classifyAssetClass('NVDD')).toBe('inverse_single');
  });

  it('520100.KS — 한국 단일종목 레버리지 ETN deny-list (description 없이도)', () => {
    expect(isSingleStockLeverage('520100.KS')).toBe(true);
    expect(isSingleStockLeverage('520100')).toBe(true); // bare 코드 정규화
    expect(classifyAssetClass('520100.KS')).toBe('leveraged_single');
  });

  it('0193W0 — KRX 알파뉴메릭 단축코드 deny-list', () => {
    expect(isSingleStockLeverage('0193W0')).toBe(true);
    expect(classifyAssetClass('0193W0.KS')).toBe('leveraged_single');
  });

  it('SPY / AAPL — 일반: normal, universe 적격', () => {
    expect(classifyAssetClass('SPY')).toBe('normal');
    expect(classifyAssetClass('AAPL')).toBe('normal');
    expect(isUniverseEligibleClass('normal')).toBe(true);
  });

  it('지수 레버리지 영문명(화이트리스트 외) → leveraged_index (단일 아님)', () => {
    // SEMICONDUCTOR 등 지수 기초자산이면 single 아님
    const cls = classifyAssetClass('HYPO', 'Direxion Daily Semiconductor Bull 3X Shares');
    expect(cls).toBe('leveraged_single' === cls ? 'leveraged_single' : 'leveraged_index');
    expect(isSingleStockLeverage('HYPO', 'Direxion Daily Semiconductor Bull 3X Shares')).toBe(false);
  });
});

describe('두 분류 함수 정합성 — 같은 입력에 모순 없음', () => {
  const cases = [
    'GraniteShares 2x Long SpaceX Daily ETF',
    'Direxion Daily SpaceX Bull 3X Shares',
    'Leverage Shares 5x Long SPCX Daily ETP',
    'Defiance Daily Target 1.75X Long SpaceX ETF',
  ];
  for (const name of cases) {
    it(`"${name}" — isSingleStockLeverage=true ⟺ classifyAssetClass ∈ {*_single}`, () => {
      const isLev = isSingleStockLeverage('TST', name);
      const cls = classifyAssetClass('TST', name);
      const isSingleClass = cls === 'leveraged_single' || cls === 'inverse_single';
      expect(isLev).toBe(isSingleClass);
    });
  }
});
