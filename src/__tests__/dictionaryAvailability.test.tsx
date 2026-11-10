import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ ready: false, error: '저장한 단어를 불러오지 못했어요.' }));
vi.mock('@/components/learning/PersonalLearningProvider', () => ({ usePersonalDictionary: () => ({ ...state, owner: 'account', entries: [], reload: () => {}, save: async () => false }) }));
import StockDictionary from '@/components/learning/StockDictionary';

it('keeps public definitions readable during a cloud outage without claiming the account is empty', () => {
  const html = renderToStaticMarkup(createElement(StockDictionary, { titleId: 'dictionary', onClose: () => {} }));
  expect(html).toContain('ETF');
  expect(html).toContain('설명의 출처');
  expect(html).toContain('다시 불러오기');
  expect(html).toContain('저장한 단어 확인 필요');
  expect(html).not.toContain('저장한 단어가 없어요');
  expect(html).toMatch(/aria-label="ETF 사전에 저장" disabled=""/);
});
