import type { CandleRaw } from '@/config/constants';
import { formatNativeAmount, formatPct } from './koreanNumber';

export interface StockCheckItem {
  id: 'price' | 'volume';
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

/** Public observations only: no score, personal cost basis, or inferred missing fundamentals. */
export function buildStockCheckup(input: StockCheckupInput): StockCheckup {
  const items = [priceItem(input), volumeItem(input)];
  const available = items.filter(item => item.available).length;
  return {
    summary: available === 0
      ? '아직 자료가 충분하지 않아요.'
      : available < items.length
        ? '확인된 정보부터 차근차근 살펴봐요.'
        : '가격과 거래량의 변화를 함께 살펴봐요.',
    items,
  };
}
