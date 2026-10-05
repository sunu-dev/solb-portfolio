import { formatNativeAmount } from './koreanNumber';

export interface AnalysisLoadingFact {
  id: 'price' | 'volume' | 'earnings';
  label: string;
  value: string | null;
}

interface AnalysisLoadingInput {
  price?: number;
  currency: 'KRW' | 'USD';
  volRatio?: number;
  per?: number;
  eps?: number;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** A preview of the exact submitted facts, never a simulated analysis or score. */
export function buildAnalysisLoadingFacts(input: AnalysisLoadingInput): AnalysisLoadingFact[] {
  const price = isFiniteNumber(input.price) && input.price > 0
    ? formatNativeAmount(input.price, input.currency) : null;
  const volume = isFiniteNumber(input.volRatio) && input.volRatio > 0
    ? `평소의 ${input.volRatio < 0.1 ? '0.1배 미만' : `${input.volRatio.toFixed(1)}배`}` : null;
  const earnings = isFiniteNumber(input.eps) && input.eps <= 0
    ? `주당이익 ${formatNativeAmount(input.eps, input.currency)}`
    : isFiniteNumber(input.per) && input.per > 0
      ? `PER ${input.per < 0.1 ? '0.1배 미만' : `${input.per.toFixed(1)}배`}`
      : isFiniteNumber(input.eps)
        ? `주당이익 ${formatNativeAmount(input.eps, input.currency)}` : null;

  return [
    { id: 'price', label: '가격', value: price },
    { id: 'volume', label: '거래량', value: volume },
    { id: 'earnings', label: '기업 지표', value: earnings },
  ];
}
