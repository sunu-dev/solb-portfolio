import { describe, expect, it } from 'vitest';
import { changeColor, roundedChange, signedChange } from '@/utils/stockTrendPresentation';

describe('price trend presentation', () => {
  it('shows floating point noise and a rounded negative zero without a direction or sign', () => {
    for (const value of [0, -0, -0.0000001, 0.0000001, -.004]) {
      expect(roundedChange(value, 2)).toBe(0);
      expect(signedChange(value, 2)).toBe('0.00');
      expect(changeColor(value, 2)).toBe('var(--text-secondary)');
    }
  });
  it('uses the displayed precision to determine the colour, keeping genuine gains and losses', () => {
    expect(signedChange(-.04, 1)).toBe('0.0');
    expect(changeColor(-.04, 1)).toBe('var(--text-secondary)');
    expect(signedChange(-.04, 2)).toBe('-0.04');
    expect(changeColor(-.04, 2)).toBe('var(--color-loss)');
    expect(signedChange(3.46)).toBe('+3.5');
    expect(changeColor(3.46)).toBe('var(--color-gain)');
  });
});
