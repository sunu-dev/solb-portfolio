import { STOCK_KR } from '@/config/constants';
import { getSector } from './portfolioHealth';

export interface DNAStock {
  symbol: string;
  avgCost: number;
  shares: number;
  currentPrice: number;
  value: number;
  targetReturn: number;
  dp?: number; // today's change %
  /** 30일 일일 수익률 표준편차 (%). P3 — DNA 변동성 축의 정확도 ↑ */
  realizedVol?: number;
}

export interface PortfolioDNA {
  /** 타입 캐릭터 (이모지 + 이름 + 설명) */
  type: {
    emoji: string;
    name: string;
    tagline: string;
    description: string;
  };
  /** 4축 벡터 (0~100 각각) */
  axis: {
    concentration: number; // 집중 (높을수록 몇 종목에 몰빵)
    volatility: number;    // 변동성 (최근 등락 폭)
    growth: number;        // 성장주 비중 (IT + 자동차 + 미디어)
    defense: number;       // 방어주 비중 (헬스케어 + 소비재 + 배당ETF)
  };
  /** 대표 캐릭터 태그 (주요 특징) */
  traits: string[];
}

// 섹터 카테고리화
const GROWTH_SECTORS = new Set(['IT', '자동차', '미디어']);
const DEFENSE_SECTORS = new Set(['헬스케어', '소비재', '에너지']);

const TICKER_GROWTH = new Set([
  'NVDA','AMD','TSLA','META','NFLX','GOOGL','GOOG','AAPL','MSFT','AMZN','AVGO','MU','TSM','CRM','ORCL',
  'PLTR','COIN','RIVN','LCID','ARKK','QQQ','SOXX','VGT','XLK',
]);
const TICKER_DEFENSE = new Set([
  'JNJ','PFE','UNH','LLY','ABBV','KO','PEP','WMT','COST','PG','MCD','XOM','CVX','SCHD','VYM','DVY','JEPI',
]);

function isGrowth(symbol: string): boolean {
  if (TICKER_GROWTH.has(symbol)) return true;
  return GROWTH_SECTORS.has(getSector(symbol));
}

function isDefense(symbol: string): boolean {
  if (TICKER_DEFENSE.has(symbol)) return true;
  return DEFENSE_SECTORS.has(getSector(symbol));
}

/**
 * 포트폴리오 DNA 계산
 * - 집중/변동성/성장/방어 4축으로 프로파일링
 * - 조합에 따라 캐릭터 타입 할당
 */
export function calcPortfolioDNA(stocks: DNAStock[]): PortfolioDNA | null {
  if (stocks.length === 0) return null;

  const totalValue = stocks.reduce((s, st) => s + st.value, 0);
  if (totalValue === 0) return null;

  // ── 1. 집중도 ──
  const weights = stocks.map(s => (s.value / totalValue) * 100);
  const maxW = Math.max(...weights);
  // 허핀달-허시먼 인덱스 (0~10000) 정규화 → 0~100
  const hhi = weights.reduce((acc, w) => acc + w * w, 0);
  const concentration = Math.min(100, Math.round((hhi / 10000) * 100 + (maxW > 50 ? 20 : 0)));

  // ── 2. 변동성 ──
  // P3 — realized volatility(30일 일일 σ) 가용 시 우선 사용. 비중 가중 평균.
  // realizedVol 없는 종목은 |dp| fallback (오늘만 보는 약한 신호).
  // 1% σ = 15점, 6.7% σ = 100점 (3X 레버리지 ETF 수준)
  let weightedVol = 0;
  let volWeightSum = 0;
  let usingRealized = false;
  stocks.forEach(s => {
    const w = totalValue > 0 ? s.value / totalValue : 0;
    if (s.realizedVol !== undefined && s.realizedVol > 0) {
      weightedVol += s.realizedVol * w;
      usingRealized = true;
    } else {
      weightedVol += Math.abs(s.dp || 0) * w; // fallback
    }
    volWeightSum += w;
  });
  // 비중 합이 1 아니면 정규화
  const finalVol = volWeightSum > 0 ? weightedVol / volWeightSum : 0;
  const volatility = Math.min(100, Math.round(finalVol * 15));
  void usingRealized; // 향후 라벨 표시용

  // ── 3. 성장주 비중 ──
  let growthValue = 0;
  let defenseValue = 0;
  stocks.forEach(s => {
    if (isGrowth(s.symbol)) growthValue += s.value;
    else if (isDefense(s.symbol)) defenseValue += s.value;
  });
  const growth = Math.round((growthValue / totalValue) * 100);
  const defense = Math.round((defenseValue / totalValue) * 100);

  // ── 4. 타입 분류 ──
  // 우선순위:
  //  · 집중>60 + 변동성>40  → 🎯 저격수
  //  · 집중>60              → 🏴 외골수
  //  · 성장>70              → ⚡ 스프린터
  //  · 방어>50              → 🛡️ 수비수
  //  · 성장 30~70 & 방어 20~40 → ⚖️ 균형가
  //  · 변동성>50            → 🎢 모험가
  //  · default              → 🌱 새싹
  let type: PortfolioDNA['type'];
  const traits: string[] = [];

  if (concentration > 60 && volatility > 40) {
    type = { emoji: '🎯', name: '저격수', tagline: '소수 정예 고위험', description: '몇 종목에 집중 베팅하는 스타일이에요. 큰 수익도, 큰 손실도 가능성이 있으니 손절 기준을 반드시 지키세요.' };
    traits.push('집중투자');
  } else if (concentration > 60) {
    const topSymbol = stocks.reduce((a, b) => a.value > b.value ? a : b).symbol;
    const topName = STOCK_KR[topSymbol] || topSymbol;
    type = { emoji: '🏴', name: '외골수', tagline: `${topName}을 믿어요`, description: '특정 종목에 강한 확신이 있는 스타일. 분산 투자를 통해 리스크 관리도 고려해보세요.' };
    traits.push('집중투자');
  } else if (growth > 70) {
    type = { emoji: '⚡', name: '스프린터', tagline: '빠르게 더 멀리', description: '성장주 중심 공격적 포트폴리오예요. 약세장에서는 방어주 편입도 검토해보세요.' };
    traits.push('공격적', '성장형');
  } else if (defense > 50) {
    type = { emoji: '🛡️', name: '수비수', tagline: '꾸준함이 전략', description: '안정성을 중시하는 스타일. 인플레이션 구간에서 빛을 발해요.' };
    traits.push('안정적', '방어적');
  } else if (growth >= 30 && growth <= 70 && defense >= 20) {
    type = { emoji: '⚖️', name: '균형가', tagline: '양쪽 모두 챙겨요', description: '성장과 방어의 균형을 잡은 건강한 포트폴리오예요. 현재 사이클에 강한 타입.' };
    traits.push('균형형');
  } else if (volatility > 50) {
    type = { emoji: '🎢', name: '모험가', tagline: '파도를 즐겨요', description: '변동성 높은 종목들이 섞여있어요. 매일 체크하며 감정 관리에 유의하세요.' };
    traits.push('변동성↑');
  } else {
    type = { emoji: '🌱', name: '새싹', tagline: '이제 시작이에요', description: '포트폴리오가 형성 중이에요. 관심 섹터와 장기 전략을 먼저 정해보세요.' };
    traits.push('탐색중');
  }

  // 부가 특성
  if (stocks.length >= 8) traits.push('분산형');
  if (stocks.length <= 3) traits.push('소수정예');
  if (finalVol > 3) traits.push('고변동');
  if (defense > 30 && defense < 50) traits.push('밸런스');

  return {
    type,
    axis: { concentration, volatility, growth, defense },
    traits,
  };
}
