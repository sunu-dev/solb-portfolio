import { describe, expect, it } from 'vitest';
import { companyBusinessProfile, companyDisplayName } from '@/lib/companyBusinessProfile';
import { getStoredIndustry } from '@/lib/storedIndustry';
import catalog from '../../public/stock-catalog.json';

describe('business coverage shared by API, UI and audit', () => {
  it('does not mistake an industry classification for a business explanation', () => {
    const profile = getStoredIndustry('NFLX');
    expect(profile.status).toBe('classified');
    expect(companyBusinessProfile('UNKNOWN', { ...profile, symbol: 'UNKNOWN' })).toEqual({ symbol: 'UNKNOWN', level: 'missing', sources: [] });
    expect(companyBusinessProfile('NFLX', profile).level).toBe('detailed');
  });
  it('resolves Korean identity and refuses products from a different ticker or unsupported source', () => {
    const profile = { ...getStoredIndustry('009150.KS'), products: '전자부품' };
    expect(companyBusinessProfile('009150', profile).level).toBe('detailed');
    expect(companyBusinessProfile('UNKNOWN', profile).level).toBe('missing');
    expect(companyBusinessProfile('UNKNOWN', { ...profile, symbol: 'UNKNOWN', source: 'us' }).level).toBe('missing');
    expect(companyBusinessProfile('UNKNOWN', { ...profile, symbol: 'UNKNOWN', source: 'kr' }).level).toBe('products');
  });
  it.each(['conflict', 'etp', 'shell', 'instrument'] as const)('withholds corporate facts when the security is %s', status => {
    expect(companyBusinessProfile('NFLX', { ...getStoredIndustry('NFLX'), status })).toEqual({ symbol: 'NFLX', level: 'restricted', sources: [] });
  });
  it('never publishes a summary without sources anywhere in the supported catalog', () => {
    for (const { symbol } of catalog.stocks) {
      const result = companyBusinessProfile(symbol, getStoredIndustry(symbol));
      if (['missing', 'restricted'].includes(result.level)) {
        expect(result.summary).toBeUndefined(); expect(result.sources).toEqual([]);
      } else {
        expect(result.summary).toBeTruthy(); expect(result.sources.length).toBeGreaterThan(0);
        for (const source of result.sources) expect(new URL(source.url).protocol).toBe('https:');
      }
    }
  });
  it('uses a company name when stored holdings only contain a code, including Korean aliases', () => {
    expect(companyDisplayName('009150.KS', ['009150', null, '삼성전기'])).toBe('삼성전기');
    expect(companyDisplayName('NFLX', ['nflx', '넷플릭스'])).toBe('넷플릭스');
    expect(companyDisplayName('UNKNOWN', ['', 'UNKNOWN'])).toBe('UNKNOWN');
  });
});
