import { describe, expect, it } from 'vitest';
import { evaluateAiBudget } from '@/lib/aiBudgetGuard';

describe('evaluateAiBudget', () => {
  it('is disabled when no positive monthly budget is configured', () => {
    expect(evaluateAiBudget(0, 100)).toMatchObject({ enabled: false, allowed: true });
  });

  it('allows calls below the safety stop ratio', () => {
    expect(evaluateAiBudget(100, 94.99, 0.95)).toMatchObject({
      enabled: true,
      allowed: true,
      stopAtUsd: 95,
    });
  });

  it('blocks calls at the safety stop ratio', () => {
    expect(evaluateAiBudget(100, 95, 0.95)).toMatchObject({
      enabled: true,
      allowed: false,
      reason: 'budget_reached',
      remainingUsd: 5,
    });
  });
});

