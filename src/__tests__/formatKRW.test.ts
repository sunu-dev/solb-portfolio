import { describe, it, expect } from 'vitest';
import { formatKRW, formatKRWChange } from '@/utils/formatKRW';

describe('formatKRW', () => {
  it('1만 미만 — 3자리 콤마', () => {
    expect(formatKRW(500)).toBe('₩500');
    expect(formatKRW(2684)).toBe('₩2,684');
    expect(formatKRW(9999)).toBe('₩9,999');
  });

  it('1만 이상 — 만 단위 축약', () => {
    expect(formatKRW(10000)).toBe('₩1.0만');
    expect(formatKRW(53900)).toBe('₩5.4만');
    expect(formatKRW(880230000)).toBe('₩8.8억');
  });

  it('1억 이상 — 억 단위 축약', () => {
    expect(formatKRW(100000000)).toBe('₩1.0억');
    expect(formatKRW(1200000000)).toBe('₩12억');
  });

  it('음수 처리', () => {
    expect(formatKRW(-2684)).toBe('-₩2,684');
    expect(formatKRW(-53900)).toBe('-₩5.4만');
  });

  it('0 처리', () => {
    expect(formatKRW(0)).toBe('₩0');
  });

  it('접두어 없이', () => {
    expect(formatKRW(2684, { prefix: false })).toBe('2,684');
  });

  it('접미어 추가', () => {
    expect(formatKRW(2684, { suffix: '원', prefix: false })).toBe('2,684원');
    expect(formatKRW(53900, { suffix: '원', prefix: false })).toBe('5.4만원');
  });
});

describe('formatKRWChange', () => {
  it('양수에 + 접두어', () => {
    expect(formatKRWChange(2684)).toBe('+₩2,684');
  });

  it('음수에 - 접두어', () => {
    expect(formatKRWChange(-2684)).toBe('-₩2,684');
  });
});
