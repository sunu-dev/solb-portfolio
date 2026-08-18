import { describe, expect, it } from 'vitest';
import { estimateAiCostUsd } from '@/lib/aiCostLedger';

describe('estimateAiCostUsd', () => {
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

