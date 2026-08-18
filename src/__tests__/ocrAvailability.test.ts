import { describe, expect, it } from 'vitest';
import { isOcrProviderEnabled } from '@/lib/ocrAvailability';

describe('isOcrProviderEnabled', () => {
  it('fails closed unless both the UI flag and paid-service attestation are true', () => {
    expect(isOcrProviderEnabled({})).toBe(false);
    expect(isOcrProviderEnabled({ NEXT_PUBLIC_OCR_ENABLED: 'true' })).toBe(false);
    expect(isOcrProviderEnabled({ GEMINI_PAID_SERVICE: 'true' })).toBe(false);
    expect(isOcrProviderEnabled({
      NEXT_PUBLIC_OCR_ENABLED: 'true',
      GEMINI_PAID_SERVICE: 'true',
    })).toBe(true);
  });
});
