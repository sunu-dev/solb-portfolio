import { describe, expect, it } from 'vitest';
import { normalizeInvestorType } from '@/config/investorTypes';

describe('normalizeInvestorType', () => {
  it('keeps a supported investor type', () => {
    expect(normalizeInvestorType('value')).toBe('value');
  });

  it('falls back safely for unsupported API input', () => {
    expect(normalizeInvestorType('balanced')).toBe('diversified');
    expect(normalizeInvestorType(undefined)).toBe('diversified');
  });
});
