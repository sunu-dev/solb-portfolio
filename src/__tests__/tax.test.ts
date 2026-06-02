import { describe, it, expect } from 'vitest';
import { computeTaxEstimate, toKrwAtSettle, type TaxBrokerEntry, type FxRate } from '@/utils/tax';

const e = (broker: string, gainKrw: number): TaxBrokerEntry => ({ id: broker, broker, gainKrw });

describe('computeTaxEstimate (v1 합산기)', () => {
  it('빈 입력 → 전부 0, 공제 잔여 250만', () => {
    const r = computeTaxEstimate([]);
    expect(r.totalGainKrw).toBe(0);
    expect(r.estimatedTaxKrw).toBe(0);
    expect(r.deductionUsed).toBe(0);
    expect(r.deductionRemaining).toBe(2_500_000);
  });

  it('합산 +330만 → 과세표준 80만 × 22% = 176,000, 공제 소진', () => {
    const r = computeTaxEstimate([e('kiwoom', 3_300_000)]);
    expect(r.totalGainKrw).toBe(3_300_000);
    expect(r.taxableBaseKrw).toBe(800_000);
    expect(r.estimatedTaxKrw).toBe(176_000);
    expect(r.deductionUsed).toBe(2_500_000);
    expect(r.deductionRemaining).toBe(0);
  });

  it('합산 < 250만 (200만) → 세금 0, 공제 잔여 50만', () => {
    const r = computeTaxEstimate([e('toss', 2_000_000)]);
    expect(r.estimatedTaxKrw).toBe(0);
    expect(r.taxableBaseKrw).toBe(0);
    expect(r.deductionUsed).toBe(2_000_000);
    expect(r.deductionRemaining).toBe(500_000);
  });

  it('손실(-80만) → 세금 0, 공제 잔여 250만 유지 (음수로 안 넘침)', () => {
    const r = computeTaxEstimate([e('samsung', -800_000)]);
    expect(r.totalGainKrw).toBe(-800_000);
    expect(r.estimatedTaxKrw).toBe(0);
    expect(r.deductionUsed).toBe(0);
    expect(r.deductionRemaining).toBe(2_500_000);
  });

  it('다증권사 혼합 [+320만, -80만, +90만] = +330만 → 176,000', () => {
    const r = computeTaxEstimate([e('kiwoom', 3_200_000), e('samsung', -800_000), e('kis', 900_000)]);
    expect(r.totalGainKrw).toBe(3_300_000);
    expect(r.estimatedTaxKrw).toBe(176_000);
  });

  it('NaN/Infinity 가드 → 0으로 취급', () => {
    const r = computeTaxEstimate([e('kiwoom', NaN), e('toss', Infinity), e('kis', 3_300_000)]);
    expect(r.totalGainKrw).toBe(3_300_000);
    expect(r.estimatedTaxKrw).toBe(176_000);
  });
});

describe('toKrwAtSettle (v2 환산 게이트)', () => {
  const rate: FxRate = { date: '2025-03-10', base: 'USD', quote: 'KRW', rate: 1400, source: '테스트' };
  const resolve = (_d: string) => rate;
  const none = (_d: string) => null;

  it('KRW는 환산 안 함 → krw=null(krw-already)', () => {
    const r = toKrwAtSettle(1000, 'KRW', '2025-03-10', resolve);
    expect(r.krw).toBeNull();
    expect((r as { reason: string }).reason).toBe('krw-already');
  });

  it('환율 없으면 숫자 안 지어냄 → krw=null(no-rate)', () => {
    const r = toKrwAtSettle(100, 'USD', '2025-03-10', none);
    expect(r.krw).toBeNull();
    expect((r as { reason: string }).reason).toBe('no-rate');
  });

  it('환율 있으면 환산 + rate 동봉', () => {
    const r = toKrwAtSettle(100, 'USD', '2025-03-10', resolve);
    expect(r.krw).toBe(140_000);
    expect((r as { rate: FxRate }).rate.rate).toBe(1400);
  });
});
