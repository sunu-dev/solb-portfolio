import { describe, expect, it } from 'vitest';
import { quoteDirection, quoteTimestamp } from '@/utils/quotePresentation';

describe('quote presentation', () => {
  it('does not invent an unchanged comparison when data is missing', () => {
    expect(quoteDirection(undefined)).toBe('unknown');
    expect(quoteDirection(NaN)).toBe('unknown');
    expect(quoteDirection(0)).toBe('flat');
    expect(quoteDirection(-0.001)).toBe('flat');
    expect(quoteDirection(0.8)).toBe('up');
    expect(quoteDirection(-0.8)).toBe('down');
  });
  it('shows the supplied quote time in Korea without substituting the fetch time', () => {
    const seconds = Date.parse('2026-10-02T06:30:00Z') / 1000;
    expect(quoteTimestamp(seconds)).toContain('15:30');
    expect(quoteTimestamp(seconds)).toBe(quoteTimestamp(seconds * 1000));
    expect(quoteTimestamp(0)).toBeNull();
    expect(quoteTimestamp(undefined)).toBeNull();
  });
});
