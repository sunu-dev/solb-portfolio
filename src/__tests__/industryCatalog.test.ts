import { describe, expect, it } from 'vitest';
import snapshot from '@/data/industry-catalog.json';
import { INDUSTRY_GROUPS, INDUSTRY_CHECKED_AT, type StoredIndustryProfile } from '@/lib/industryRegistry';
import { getStoredIndustry, storedIndustryFields } from '@/lib/storedIndustry';
import { classifiedSectors, SECTORS } from '@/lib/sectorExploration';

const records = snapshot.records as Record<string, Omit<StoredIndustryProfile, 'symbol' | 'checkedAt'>>;
describe('persisted industry evidence', () => {
  it('keeps both snapshots in sync and every industry and peer reachable', () => {
    expect(INDUSTRY_CHECKED_AT).toBe(snapshot.checkedAt);
    expect(INDUSTRY_GROUPS.length).toBeGreaterThan(300);
    expect(new Set(INDUSTRY_GROUPS.map(g => g.id)).size).toBe(INDUSTRY_GROUPS.length);
    for (const group of INDUSTRY_GROUPS) {
      expect(SECTORS.some(s => s.id === group.parent && !s.parent)).toBe(true);
      expect(group.examples.length).toBeGreaterThan(0);
      expect(group.examples.length).toBeLessThanOrEqual(3);
      expect(new Set(group.examples.map(c => c.name.trim().toLowerCase())).size).toBe(group.examples.length);
      for (const peer of group.examples) {
        expect(records[peer.symbol].industryId).toBe(group.id);
        expect(records[peer.symbol].status).toBe('classified');
      }
    }
    for (const [symbol, record] of Object.entries(records)) {
      if (record.status !== 'classified') continue;
      expect(INDUSTRY_GROUPS.some(g => g.id === record.industryId)).toBe(true);
      expect(classifiedSectors(symbol, { classification: getStoredIndustry(symbol) }).sectors.length).toBeGreaterThan(0);
    }
  });
  it('normalizes Korean codes and preserves reviewed business explanations', () => {
    expect(getStoredIndustry(' 005930 ').symbol).toBe('005930.KS');
    expect(getStoredIndustry(' be ').symbol).toBe('BE');
    expect(classifiedSectors('BE', { classification: getStoredIndustry('BE') }).sectors[0].id).toBe('fuel-cells');
    expect(classifiedSectors('COHR', { classification: getStoredIndustry('COHR') }).sectors[0].id).toBe('photonics');
  });
  it('never assigns funds, shell companies, instruments, or conflicts an industry from a generic provider profile', () => {
    for (const status of ['etp', 'shell', 'instrument', 'conflict'] as const) {
      const entry = Object.entries(records).find(([, row]) => row.status === status)!;
      expect(entry).toBeDefined();
      const classification = getStoredIndustry(entry[0]);
      expect(classifiedSectors(entry[0], { classification, sector: 'Technology', industry: 'Semiconductors' }).sectors).toEqual([]);
      expect(storedIndustryFields(entry[0]).industry).toBeNull();
    }
    expect(getStoredIndustry('UNKNOWN-FIXTURE').status).toBe('not-covered');
  });
  it('inherits preferred-share industries only from a verified issuer', () => {
    const preferred = getStoredIndustry('005935.KS');
    expect(preferred.securityType).toBe('preferred');
    expect(preferred.issuerSymbol).toBe('005930.KS');
    expect(preferred.industryId).toBe(getStoredIndustry('005930.KS').industryId);
    expect(getStoredIndustry('007815.KS').industryId).toBeUndefined();
  });
});
