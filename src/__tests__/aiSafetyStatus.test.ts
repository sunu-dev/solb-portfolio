import { describe, expect, it } from 'vitest';
import { getAiSafetyStatus } from '@/lib/aiSafetyStatus';

describe('getAiSafetyStatus', () => {
  it('warns when the monthly budget is not configured', () => {
    const status = getAiSafetyStatus({});
    expect(status.overall).toBe('warning');
    expect(status.checks.find(check => check.id === 'monthly-budget')?.value).toBe('미설정');
  });

  it('reports a conservative free beta configuration as good', () => {
    const status = getAiSafetyStatus({
      AI_MONTHLY_BUDGET_USD: '100',
      AI_MONTHLY_BUDGET_STOP_RATIO: '0.95',
      AI_DAILY_LIMIT_TOTAL: '250',
      ANALYSIS_DAILY_FREE: '3',
      CHOK_DAILY_FREE: '1',
      OCR_DAILY_LIMIT_USER: '5',
      NEXT_PUBLIC_OCR_ENABLED: 'true',
      GEMINI_PAID_SERVICE: 'true',
      ENABLE_CLAUDE_FALLBACK: 'false',
      AI_AUDIT_SAMPLE_RATE: '0.1',
    });
    expect(status.overall).toBe('good');
    expect(status.checks.find(check => check.id === 'ocr-user')?.value).toBe('로그인 5회/일 · 비로그인 차단');
  });

  it('warns when the OCR user daily limit exceeds the beta guardrail', () => {
    const status = getAiSafetyStatus({
      AI_MONTHLY_BUDGET_USD: '100',
      OCR_DAILY_LIMIT_USER: '10',
      NEXT_PUBLIC_OCR_ENABLED: 'true',
      GEMINI_PAID_SERVICE: 'true',
    });

    expect(status.checks.find(check => check.id === 'ocr-user')?.level).toBe('warning');
  });

  it('reports OCR as safely disabled for a free Gemini project', () => {
    const status = getAiSafetyStatus({
      AI_MONTHLY_BUDGET_USD: '100',
      NEXT_PUBLIC_OCR_ENABLED: 'false',
      GEMINI_PAID_SERVICE: 'false',
    });

    const ocr = status.checks.find(check => check.id === 'ocr-user');
    expect(ocr?.level).toBe('good');
    expect(ocr?.value).toBe('비활성 · 외부 이미지 전송 차단');
  });
});
