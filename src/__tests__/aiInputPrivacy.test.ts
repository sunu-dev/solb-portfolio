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

  it('accepts mentor requests with unavailable fundamentals without inventing values', () => {
    const safe = toPublicAiAnalysisInput({
      symbol: 'TSLL', currency: 'USD', price: 9.71, changePercent: 4.3,
      mentorId: 'value', per: null, eps: null, week52High: 38.5, week52Low: null,
    });
    expect(safe).toMatchObject({ symbol: 'TSLL', price: 9.71, mentorId: 'value', week52High: 38.5 });
    for (const field of ['per', 'eps', 'week52Low']) expect(safe).not.toHaveProperty(field);
  });

  it('still rejects missing required quotes and malformed optional numbers', () => {
    const quote = { symbol: 'TSLL', price: 9.71, changePercent: 4.3 };
    expect(toPublicAiAnalysisInput({ ...quote, price: null })).toBeNull();
    for (const per of ['12', {}, Infinity, NaN]) {
      expect(toPublicAiAnalysisInput({ ...quote, per })).toBeNull();
    }
  });

  it.each([null, undefined])('accepts an unknown daily change (%s) without inventing zero', changePercent => {
    const safe = toPublicAiAnalysisInput({
      symbol: 'AAPL', currency: 'USD', price: 220, mentorId: 'value', changePercent,
    });
    expect(safe).toMatchObject({ symbol: 'AAPL', price: 220, mentorId: 'value' });
    expect(safe).not.toHaveProperty('changePercent');
  });

  it('accepts a candle price without a current daily change field', () => {
    const safe = toPublicAiAnalysisInput({ symbol: 'AAPL', price: 220 });
    expect(safe).toEqual({ symbol: 'AAPL', price: 220 });
  });

  it.each([0, -1.5, 2])('preserves an actual daily change of %s', changePercent => {
    expect(toPublicAiAnalysisInput({ symbol: 'AAPL', price: 220, changePercent }))
      .toHaveProperty('changePercent', changePercent);
  });

  it.each(['0', '', false, {}, Infinity, NaN])('rejects malformed daily change %s', changePercent => {
    expect(toPublicAiAnalysisInput({ symbol: 'AAPL', price: 220, changePercent })).toBeNull();
  });
});
