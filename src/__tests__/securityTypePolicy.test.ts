import { describe, expect, it } from 'vitest';
import {
  countUnsupportedFinnhubSecurityTypes,
  isSupportedFinnhubSecurityType,
  normalizeFinnhubSecurityType,
} from '@/utils/securityTypePolicy';

describe('Finnhub 종목 유형 정책', () => {
  it.each([
    ['Common Stock', true],
    ['ADR', true],
    ['adr', true],
    [' ETP ', true],
    ['ETF', true],
    ['Preferred Stock', false],
    ['Warrant', false],
    ['GDR', false],
    ['', false],
    [undefined, false],
  ])('%s 허용 여부는 %s다', (type, expected) => {
    expect(isSupportedFinnhubSecurityType(type)).toBe(expected);
  });

  it('SKHY의 Finnhub ADR 응답을 허용한다', () => {
    const skhy = { symbol: 'SKHY', description: 'SK HYNIX INC-ADR', type: 'ADR' };
    expect(isSupportedFinnhubSecurityType(skhy.type)).toBe(true);
  });

  it('지원하지 않는 공급자 유형을 정규화해 집계한다', () => {
    expect(countUnsupportedFinnhubSecurityTypes([
      { type: 'Preferred Stock' },
      { type: 'preferred stock' },
      { type: 'Warrant' },
      { type: undefined },
      { type: 'ADR' },
    ])).toEqual({
      'PREFERRED STOCK': 2,
      WARRANT: 1,
      '(EMPTY)': 1,
    });
    expect(normalizeFinnhubSecurityType(' Common Stock ')).toBe('COMMON STOCK');
  });
});
