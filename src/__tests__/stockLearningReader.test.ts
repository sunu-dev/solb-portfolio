import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/tourTelemetry', () => ({ logFeatureFirstUse: vi.fn() }));
vi.mock('@/lib/usageTelemetry', () => ({ usageEvent: vi.fn() }));
import StockLearning from '@/components/analysis/StockLearning';

const render = (overrides: Partial<Parameters<typeof StockLearning>[0]> = {}) => renderToStaticMarkup(createElement(StockLearning, {
  name: '마이크론', owner: 'guest', symbol: 'MU', tags: ['earnings'],
  onNews: () => {}, onCompany: () => {}, ...overrides,
}));

describe('inline background reader', () => {
  it('follows recent topic order rather than always preferring the first catalog lesson', () => {
    const html=render({tags:['dividends','earnings']});
    const recommendations=html.slice(html.indexOf('관련 개념'),html.indexOf('다른 개념 찾아보기'));
    expect(recommendations).toContain('배당수익률');
    expect(recommendations).not.toContain('매출과 이익의 차이');
  });
  it('does not invent a company question when there is no relevant topic', () => {
    const html=render({tags:[]});
    expect(html).toContain('주식 용어와 개념');
    expect(html).not.toContain('이 회사에서 이어지는 궁금증');
    expect(html).not.toContain('최근 기사에서 궁금해지는 질문');
    expect(html).not.toContain('매출과 이익의 차이');
    expect(html).toMatch(/<details[^>]+open=""/);
  });
  it('shows the requested answer before browser history is available and offers at most two next questions', () => {
    const html = render({ embedded: true, initialLessonId: 'earnings', onReturn: () => {}, returnLabel: '실적 기사로 돌아가기' });
    expect(html).toContain('data-open-lesson="earnings"');
    expect(html).toContain('매출과 이익의 차이');
    expect((html.match(/data-learning-related=/g) ?? []).length).toBe(2);
    expect(html).toContain('실적 기사로 돌아가기');
    expect(html).not.toContain('개념 자료실');
    expect(html).not.toContain('읽었어요');
    expect(html).not.toContain('관련 뉴스 확인');
  });

  it('does not turn a fund deep link into a company financial lesson', () => {
    const html = render({ name: 'SOXL', symbol: 'SOXL', instrument: 'fund', embedded: true, initialLessonId: 'earnings' });
    expect(html).not.toContain('data-open-lesson=');
    expect(html).not.toContain('순이익');
    expect(html).toContain('SOXL은 무엇을 추종하고 수익은 어떻게 생기나요?');
  });

  it('keeps the main library optional and makes an invalid embedded destination recoverable', () => {
    expect(render()).toMatch(/<summary\b[^>]*>다른 개념 찾아보기<\/summary>/);
    const html = render({ embedded: true, initialLessonId: 'unknown', onReturn: () => {} });
    expect(html).toContain('연결된 설명을 찾지 못했어요.');
    expect(html).toContain('원래 질문으로 돌아가기');
    expect(html).not.toContain('data-open-lesson=');
  });
});


it('restores the actual concept and its previous-question link after a stock visit', () => {
  const html = render({ embedded: true, initialLessonId: 'earnings', initialReading: {
    active: 'cash', trail: [{ id: 'earnings', top: 420, trigger: '[data-learning-related="cash"]' }],
  } });
  expect(html).toContain('data-open-lesson="cash"');
  expect(html).toContain('data-learning-back');
  expect(html).toContain('매출과 이익의 차이');
});
