import { describe, expect, it } from 'vitest';
import {
  getAnalysisDay,
  getAnalysisRemaining,
  readAnalysisQuotaResponse,
} from '@/utils/analysisQuota';

const BEFORE_MIDNIGHT = Date.parse('2026-10-04T14:59:59.999Z');
const MIDNIGHT = Date.parse('2026-10-04T15:00:00.000Z');

describe('daily AI analysis quota', () => {
  it('uses Korean midnight regardless of the browser timezone', () => {
    expect(getAnalysisDay(BEFORE_MIDNIGHT)).toBe('2026-10-04');
    expect(getAnalysisDay(MIDNIGHT)).toBe('2026-10-05');
    expect(getAnalysisDay(Date.parse('2026-12-31T15:00:00Z'))).toBe('2027-01-01');
  });

  it('expires an exhausted quota at Korean midnight', () => {
    const quota = { remaining: 0, day: '2026-10-04' };
    expect(getAnalysisRemaining(quota, BEFORE_MIDNIGHT)).toBe(0);
    expect(getAnalysisRemaining(quota, MIDNIGHT)).toBeNull();
    expect(getAnalysisRemaining(null, MIDNIGHT)).toBeNull();
  });

  it('accepts a successful response, including the final available request', () => {
    expect(readAnalysisQuotaResponse({ success: true, remaining: 2 }, BEFORE_MIDNIGHT))
      .toEqual({ remaining: 2, day: '2026-10-04' });
    expect(readAnalysisQuotaResponse({ success: true, remaining: 0 }, MIDNIGHT))
      .toEqual({ remaining: 0, day: '2026-10-05' });
  });

  it('accepts an explicitly identified personal daily limit and its legacy response', () => {
    for (const response of [
      { code: 'daily_user_limit', remaining: 0 },
      { limitReached: true, dailyLimit: 3, remaining: 0, tier: 'free' },
    ]) {
      expect(readAnalysisQuotaResponse(response, BEFORE_MIDNIGHT))
        .toEqual({ remaining: 0, day: '2026-10-04' });
    }
  });

  it('keeps the server accounting date when a response crosses Korean midnight', () => {
    const quota = readAnalysisQuotaResponse({ success: true, remaining: 0, day: '2026-10-04' }, MIDNIGHT);
    expect(quota).toEqual({ remaining: 0, day: '2026-10-04' });
    expect(getAnalysisRemaining(quota, MIDNIGHT)).toBeNull();
  });

  it.each(['2026-02-30', '2026-13-01', 'yesterday', '', null, 42])('rejects an invalid explicit accounting date: %s', day => {
    expect(readAnalysisQuotaResponse({ success: true, remaining: 0, day }, MIDNIGHT)).toBeNull();
  });

  it.each([
    { loginForMore: true, limitReached: true, remaining: 0 },
    { code: 'rate_limit', remaining: 0, resetAt: 1_800_000_000 },
    { code: 'daily_total_limit', limitReached: true, remaining: 0 },
    { limitReached: true, remaining: 0 },
    { code: 'daily_usage_unavailable', remaining: 0 },
    { code: 'monthly_budget_limit', budgetLimited: true, remaining: 0 },
    { code: 'ledger_unavailable', remaining: 0 },
    { code: 'circuit_open', retryAfter: 60, remaining: 0 },
    { error: 'AI 서버가 혼잡해요.', remaining: 0 },
    { code: 'gemini_quota', remaining: 0 },
  ])('does not confuse auth, burst limits, or provider failures with daily usage: %j', response => {
    expect(readAnalysisQuotaResponse(response, BEFORE_MIDNIGHT)).toBeNull();
  });

  it('does not allow mixed error fields to override authentication or a different limit', () => {
    expect(readAnalysisQuotaResponse({ success: true, loginForMore: true, remaining: 0 }, MIDNIGHT)).toBeNull();
    expect(readAnalysisQuotaResponse({ code: 'rate_limit', limitReached: true, dailyLimit: 3, remaining: 0 }, MIDNIGHT)).toBeNull();
  });

  it.each([-1, 0.5, NaN, Infinity, '0', null, undefined, Number.MAX_SAFE_INTEGER + 1])('rejects invalid remaining values: %s', remaining => {
    expect(readAnalysisQuotaResponse({ success: true, remaining }, MIDNIGHT)).toBeNull();
  });

  it('requires an explicit numeric daily limit for legacy error responses', () => {
    expect(readAnalysisQuotaResponse({ limitReached: true, dailyLimit: '3', remaining: 0 }, MIDNIGHT)).toBeNull();
    expect(readAnalysisQuotaResponse({ limitReached: true, dailyLimit: NaN, remaining: 0 }, MIDNIGHT)).toBeNull();
  });

  it('fails open for malformed stored state or an invalid clock, instead of retaining a false block', () => {
    expect(getAnalysisRemaining({ remaining: -1, day: '2026-10-05' }, MIDNIGHT)).toBeNull();
    expect(getAnalysisRemaining({ remaining: 0, day: '2026-10-05' }, NaN)).toBeNull();
    expect(readAnalysisQuotaResponse({ success: true, remaining: 0 }, Infinity)).toBeNull();
    for (const response of [null, undefined, [], 0, 'error']) {
      expect(readAnalysisQuotaResponse(response, MIDNIGHT)).toBeNull();
    }
  });
});
