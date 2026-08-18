import { describe, expect, it } from 'vitest';
import { monthStartKstIso, projectAiMonthlyCost } from '@/lib/aiCostProjection';

describe('AI monthly cost projection', () => {
  it('uses the KST calendar month boundary', () => {
    expect(monthStartKstIso(new Date('2026-07-16T12:00:00.000Z')))
      .toBe('2026-06-30T15:00:00.000Z');
  });

  it('projects month-end cost and remaining calls from actual averages', () => {
    const result = projectAiMonthlyCost({
      monthSpentUsd: 10,
      monthCalls: 100,
      budgetStopAtUsd: 95,
      now: new Date('2026-07-16T03:00:00.000Z'), // 7/16 12:00 KST
    });

    expect(result.avgCostPerCallUsd).toBeCloseTo(0.1);
    expect(result.projectedMonthEndUsd).toBeCloseTo(20, 5);
    expect(result.remainingCallsAtBudget).toBe(850);
  });

  it('does not invent projections without calls', () => {
    const result = projectAiMonthlyCost({ monthSpentUsd: 0, monthCalls: 0, budgetStopAtUsd: 95 });
    expect(result.avgCostPerCallUsd).toBeNull();
    expect(result.projectedMonthEndUsd).toBeNull();
    expect(result.remainingCallsAtBudget).toBeNull();
  });
});
