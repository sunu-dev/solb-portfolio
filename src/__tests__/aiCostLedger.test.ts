import { describe, expect, it } from 'vitest';
import { estimateAiCostUsd } from '@/lib/aiCostLedger';

describe('estimateAiCostUsd', () => {
  it('accounts for Sonnet explanation tokens and five-minute cache writes without billing them as zero', () => {
    expect(estimateAiCostUsd('claude-sonnet-5-5', { inputTokens: 2702, outputTokens: 262 })).toBeCloseTo(.008024, 10);
    expect(estimateAiCostUsd('claude-sonnet-5-5', { inputTokens: 3000, outputTokens: 100, cachedInputTokens: 1000, cacheWriteInputTokens: 1000 })).toBeCloseTo(.0056, 10);
  });
  it('prices Haiku 5.5 actual usage, cache writes and the long-input tier', () => {
    expect(estimateAiCostUsd('claude-haiku-5-5', { inputTokens: 4908, outputTokens: 870 })).toBeCloseTo(0.0009258, 10);
    expect(estimateAiCostUsd('claude-haiku-5-5', { inputTokens: 100000, outputTokens: 1000 })).toBeCloseTo(0.0105, 10);
    expect(estimateAiCostUsd('claude-haiku-5-5', { inputTokens: 100001, outputTokens: 1000 })).toBeCloseTo(0.0525005, 10);
    expect(estimateAiCostUsd('claude-haiku-5-5', { inputTokens: 2000, outputTokens: 100, cacheWriteInputTokens: 1000 })).toBeCloseTo(0.000275, 10);
  });
  it('calculates Gemini Flash-Lite input and output cost', () => {
    expect(estimateAiCostUsd('gemini-2.5-flash-lite', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })).toBeCloseTo(0.5, 8);
  });

  it('separates cached input tokens from regular input tokens', () => {
    expect(estimateAiCostUsd('gemini-2.5-flash-lite', {
      inputTokens: 1_000_000,
      cachedInputTokens: 400_000,
      outputTokens: 0,
    })).toBeCloseTo(0.07, 8);
  });

  it('returns zero for an unknown model instead of inventing a price', () => {
    expect(estimateAiCostUsd('future-model', {
      inputTokens: 100,
      outputTokens: 100,
    })).toBe(0);
  });
});

