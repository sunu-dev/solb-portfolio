import type { CandleRaw } from '@/config/constants';
import { formatNativeAmount, formatPct } from './koreanNumber';

export interface StockCheckItem {
  id: 'price' | 'volume' | 'earnings' | 'dividend';
  title: string;
  value: string;
  meaning: string;
  nextCheck: string;
  available: boolean;
  mentorId: string;
}

export interface StockCheckupInput {
  price?: number;
  candles?: CandleRaw;
  fundamentals?: {
    per?: number | null;
    eps?: number | null;
    dividendYield?: number | null;
    currency?: 'KRW' | 'USD';
  } | null;
  currency: 'KRW' | 'USD';
}

export interface StockCheckup {
  summary: string;
  items: StockCheckItem[];
}

const PERIOD = 20;
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isPositive = (value: unknown): value is number => isFiniteNumber(value) && value > 0;

/** Keep observations paired with their dates; never turn absent history into a neutral value. */
function dailyWindow(candles: CandleRaw | undefined, field: 'c' | 'v', count: number): number[] | null {
  if (candles?.s !== 'ok' || !Array.isArray(candles.t) || !Array.isArray(candles[field])) return null;
  const values = candles[field];
  if (values.length !== candles.t.length || values.length < count) return null;
  const dates = candles.t.slice(-count);
  if (!dates.every((date, index) => isPositive(date) &&
    (index === 0 || Math.floor(date / 86400) > Math.floor(dates[index - 1] / 86400)))) return null;
  const window = values.slice(-count);
  // Providers may use zero volume for unavailable or unfinished observations. Its cause is unknown.
  return window.every(isPositive) ? window : null;
}

function mean(values: number[]): number {
  // Divide before adding so a finite series cannot overflow during its sum.
  return values.reduce((total, value) => total + value / values.length, 0);
}

/** Latest day's volume against the preceding 20 days, shared by the note and AI input. */
export function getStockVolumeRatio(candles: CandleRaw | undefined): number | undefined {
  const volumes = dailyWindow(candles, 'v', PERIOD + 1);
  if (!volumes) return undefined;
  const ratio = volumes[PERIOD] / mean(volumes.slice(0, PERIOD));
  return isPositive(ratio) ? ratio : undefined;
}

function priceItem(input: StockCheckupInput): StockCheckItem {
  const base = {
    id: 'price' as const,
    title: '최근 가격 흐름',
    mentorId: 'trend',
    nextCheck: '가격이 움직인 배경은 최근 실적과 공시에서 함께 확인해요.',
  };
  if (!isPositive(input.price)) {
    return { ...base, available: false, value: '자료 확인 전', meaning: '현재 가격을 확인하지 못해 최근 평균과 비교할 수 없어요.' };
  }
  const closes = dailyWindow(input.candles, 'c', PERIOD);
  if (!closes) {
    return { ...base, available: false, value: '자료 부족', meaning: '날짜와 종가가 확인된 최근 20거래일 자료가 필요해요.' };
  }
  const average = mean(closes);
  const difference = (input.price / average - 1) * 100;
  if (!isPositive(average) || !isFiniteNumber(difference)) {
    return { ...base, available: false, value: '자료 확인 전', meaning: '가격 자료를 다시 확인해야 평균과 비교할 수 있어요.' };
  }
  return {
    ...base,
    available: true,
    value: Math.abs(difference) < 0.05 ? '평균과 비슷한 수준' : `평균 대비 ${formatPct(difference, 1)}`,
    meaning: `현재 가격을 최근 20거래일 종가 평균 ${formatNativeAmount(average, input.currency)}과 비교했어요. 회사의 적정 가격을 뜻하지는 않아요.`,
  };
}

function volumeItem(input: StockCheckupInput): StockCheckItem {
  const base = {
    id: 'volume' as const,
    title: '거래가 얼마나 늘었나요',
    mentorId: 'trend',
    nextCheck: '거래가 늘었다면 같은 시기에 나온 공시나 뉴스도 살펴봐요. 거래량만으로 오른 이유나 내린 이유를 알 수는 없어요.',
  };
  const volumes = dailyWindow(input.candles, 'v', PERIOD + 1);
  if (!volumes) {
    return {
      ...base, available: false, value: input.candles ? '자료 부족' : '자료 확인 전',
      meaning: '최근 거래량과 그 직전 20거래일 자료가 필요해요. 누락되거나 0으로 제공된 값은 거래가 없었는지 집계 중인지 확인이 필요해요.',
    };
  }
  const ratio = getStockVolumeRatio(input.candles);
  if (ratio === undefined) {
    return { ...base, available: false, value: '자료 확인 전', meaning: '거래량 자료를 다시 확인해야 평소 수준과 비교할 수 있어요.' };
  }
  return {
    ...base, available: true,
    value: `평소의 ${ratio < 0.1 ? '0.1배 미만' : `${ratio.toFixed(1)}배`}`,
    meaning: '가장 최근 거래일의 거래량을 그 직전 20거래일 평균과 비교했어요. 장중에는 거래량이 계속 쌓이므로 마감 뒤 달라질 수 있어요.',
  };
}

function earningsItem(input: StockCheckupInput): StockCheckItem {
  const base = {
    id: 'earnings' as const,
    title: '이익과 주가의 관계',
    mentorId: 'value',
    nextCheck: '최근 실적에서 매출과 이익이 어떻게 달라졌는지, 같은 업종의 기업은 어떤지 함께 살펴봐요.',
  };
  const fundamentals = input.fundamentals;
  if (fundamentals?.currency && fundamentals.currency !== input.currency) {
    return { ...base, available: false, value: '자료 확인 전', meaning: '기업 지표와 주가의 통화가 달라 같은 기준의 자료인지 먼저 확인해야 해요.' };
  }
  const eps = fundamentals?.eps;
  const per = fundamentals?.per;
  if (isFiniteNumber(eps) && eps <= 0) {
    return {
      ...base, available: true,
      value: `주당순이익 ${formatNativeAmount(eps, input.currency)}`,
      meaning: eps < 0
        ? '제공된 주당순이익이 음수예요. 주식 한 주 기준으로 손실이 보고됐다는 뜻이에요. PER만으로 가격을 비교하기 어려워요.'
        : '제공된 주당순이익은 0이에요. 이 값만으로 PER을 계산하거나 주가가 싼지 판단할 수는 없어요.',
      nextCheck: isPositive(per)
        ? '함께 제공된 PER과 주당순이익의 기준이 다를 수 있어요. 최근 실적 공시에서 기준 기간과 수치를 확인해요.'
        : '최근 실적 공시에서 손익의 기준 기간과 일시적인 비용이 있었는지 확인해요.',
    };
  }
  if (isPositive(per)) {
    return {
      ...base, available: true, value: `PER ${per.toFixed(1)}배`,
      meaning: `주가가 주식 한 주당 이익의 몇 배인지 나타내는 값이에요.${isPositive(eps) ? ` 제공된 주당순이익은 ${formatNativeAmount(eps, input.currency)}이에요.` : ''} 낮다는 이유만으로 저평가라고 단정할 수는 없어요.`,
    };
  }
  if (isPositive(eps)) {
    return {
      ...base, available: true, value: `주당순이익 ${formatNativeAmount(eps, input.currency)}`,
      meaning: '회사의 이익을 주식 한 주 기준으로 나타낸 값이에요. 이익이 늘고 있는지는 이전 실적과 비교해야 알 수 있어요.',
    };
  }
  return { ...base, available: false, value: '자료 확인 전', meaning: 'PER과 주당순이익을 확인하지 못했어요. 가격 흐름만으로 회사의 이익이나 성장성을 판단하지 않아요.' };
}

/** Public observations only: no score, personal cost basis, or inferred missing fundamentals. */
export function buildStockCheckup(input: StockCheckupInput): StockCheckup {
  const items = [priceItem(input), volumeItem(input), earningsItem(input)];
  const dividend = input.fundamentals?.dividendYield;
  const sameCurrency = !input.fundamentals?.currency || input.fundamentals.currency === input.currency;
  if (sameCurrency && isFiniteNumber(dividend) && dividend >= 0) {
    items.push({
      id: 'dividend', title: '배당으로 돌려주는 금액', mentorId: 'safe', available: true,
      value: `배당수익률 ${dividend.toFixed(2)}%`,
      meaning: dividend === 0
        ? '제공된 배당수익률은 0%예요. 앞으로도 배당을 하지 않는다는 뜻은 아니에요.'
        : '주가에 비해 배당금이 어느 정도인지 나타내요. 주가와 배당금이 바뀌면 이 비율도 달라져요.',
      nextCheck: '회사의 배당 공시에서 기준 기간과 실제 지급 계획을 확인해요. 과거 배당이 다음 배당을 보장하지는 않아요.',
    });
  }
  const available = items.filter(item => item.available).length;
  return {
    summary: available === 0
      ? '아직 자료가 충분하지 않아요.'
      : available < items.length
        ? '확인된 정보부터 차근차근 살펴봐요.'
        : '가격과 거래, 기업의 이익을 함께 살펴봐요.',
    items,
  };
}
