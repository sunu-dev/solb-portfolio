import { describe, expect, it } from 'vitest';
import {
  PRIVATE_AI_ANALYSIS_FIELDS,
  toPublicAiAnalysisInput,
} from '@/lib/aiInputPrivacy';

describe('toPublicAiAnalysisInput', () => {
  it('keeps public market facts and drops every private portfolio field', () => {
    const input = {
      symbol: 'AAPL',
      koreanName: '애플',
      currency: 'USD',
      price: 220,
      change: 2,
      changePercent: 0.92,
      rsi: '54',
      recentNews: '공개 뉴스 제목',
      avgCost: 150,
      shares: 10,
      targetReturn: 20,
      stopLoss: 130,
      stopLossPct: -10,
      weight: 35,
      buyBelow: 180,
      purchaseRate: 1320,
      currentUsdKrw: 1390,
      category: 'investing',
      investorType: 'momentum',
      userNotes: ['가족 자금으로 매수'],
    };

    const safe = toPublicAiAnalysisInput(input);

    expect(safe).toMatchObject({
      symbol: 'AAPL',
      koreanName: '애플',
      currency: 'USD',
      price: 220,
      change: 2,
      changePercent: 0.92,
      rsi: '54',
      recentNews: '공개 뉴스 제목',
    });
    for (const field of PRIVATE_AI_ANALYSIS_FIELDS) {
      expect(safe).not.toHaveProperty(field);
    }
  });

  it('rejects requests without finite public quote data', () => {
    expect(toPublicAiAnalysisInput({ symbol: 'AAPL', price: '220', changePercent: 1 })).toBeNull();
    expect(toPublicAiAnalysisInput({ symbol: '', price: 220, changePercent: 1 })).toBeNull();
    expect(toPublicAiAnalysisInput({
      symbol: '005930',
      currency: 'EUR',
      price: 220_000,
      changePercent: 1,
    })).toBeNull();
  });
});
