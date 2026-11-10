import { afterEach, expect, it, vi } from 'vitest';
import { assistantQuestionPrompt, assistantGenerationModel, assistantAnswerContract, parseAssistantQuestion } from '@/lib/assistantQuestion';
import { fundProfile } from '@/lib/fundExploration';
import { financialTerm } from '@/lib/financialTerms';
import type { AssistantEvidencePacket } from '@/lib/assistantEvidence';

const question = { text: '왜 떨어졌어?', symbol: 'MU', unclearTerms: [] };
afterEach(() => vi.unstubAllEnvs());
it('keeps Haiku unless the server opts in, and never accepts a browser-selected model', () => {
  vi.stubEnv('JOOBI_ASSISTANT_REASONING_MODEL', '');
  const q = parseAssistantQuestion({ questionConsent: true, questionText: '왜 떨어졌어?', symbol: 'MU', model: 'claude-sonnet-5-5' })!;
  expect(assistantGenerationModel(q)).toBe('claude-haiku-5-5');
  vi.stubEnv('JOOBI_ASSISTANT_REASONING_MODEL', 'claude-sonnet-5-5');
  expect(assistantGenerationModel(q)).toBe('claude-sonnet-5-5');
  expect(assistantGenerationModel({ text: 'ETF란 뭐야?', unclearTerms: [] })).toBe('claude-haiku-5-5');
  expect(assistantGenerationModel({ text: '더 쉽게 설명해 줘', unclearTerms: [], history: [{ question: '왜 떨어졌어?', answer: '공통 배경 설명' }] })).toBe('claude-sonnet-5-5');
  vi.stubEnv('JOOBI_ASSISTANT_REASONING_MODEL', 'unknown-model');
  expect(assistantGenerationModel(q)).toBe('claude-haiku-5-5');
});
const source = { title: 'public evidence', url: 'https://example.com/', publisher: 'publisher', publishedAt: '2026-11-05', checkedAt: '2026-11-07' };
const packet: AssistantEvidencePacket = { version: 1, symbol: 'MU', period: '1d', checkedAt: '2026-11-07', comparisons: [], gaps: [], evidence: [
  { ...source, id: 'N1', kind: 'headline', text: 'unverified causal headline' },
  { ...source, id: 'P1', kind: 'price', text: 'price already calculated' },
  { ...source, id: 'R1', kind: 'reference', text: 'company business facts' },
  { ...source, id: 'A1', kind: 'article', scope: 'company', text: 'actual fetched article' },
] };

it('uses fetched evidence for writing while preserving reference and price citation IDs', () => {
  const before = JSON.stringify(packet);
  const prompt = assistantQuestionPrompt(question, { evidence: packet });
  expect(prompt).not.toContain('unverified causal headline');
  expect(prompt).toContain('actual fetched article');
  expect(prompt).toContain('company business facts');
  expect(prompt).toContain('"id":"P1"');
  expect(JSON.stringify(packet)).toBe(before);
});
it('keeps the resolved yesterday session explicit instead of relabelling an older news event as yesterday', () => {
  const prompt = assistantQuestionPrompt({ ...question, text: '어제 왜 떨어졌어?', sessionReference: 'previous' }, { evidence: { ...packet,
    price: { symbol: 'MU', label: '마이크론', day: '2026-11-06', baselineDay: '2026-11-05', at: '2026-11-06T21:00:00Z', sessionState: 'closed', price: 100, changePercent: 5, currency: 'USD' } } });
  expect(prompt).toContain('"sessionReference":"previous"');
  expect(prompt).toContain('질문의 기준 거래일: 2026-11-06 정규장');
  expect(prompt).toContain('장중에 전혀 떨어진 적 없다고 말하는 것은 아니에요');
  expect(prompt).not.toContain('첫 문장은 그 보도가 짚은');
});

it('does not silently erase the distinction when only headlines are available', () => {
  const prompt = assistantQuestionPrompt(question, { evidence: { ...packet, evidence: packet.evidence.filter(e => e.kind !== 'article') } });
  expect(prompt).toContain('"kind":"headline"');
  expect(prompt).toContain('unverified causal headline');
});

it('supplies definitions for difficult words in the preceding answer to a short rewrite request', () => {
  const prompt = assistantQuestionPrompt({ text: '더 쉽게 설명해 줘', unclearTerms: [], history: [{ question: '왜 그래?', answer: '회사의 가이던스와 수주잔고를 함께 확인해야 해요.' }] }, {});
  expect(prompt).toContain(financialTerm('concept:가이던스')!.meaning);
  expect(prompt).toContain(financialTerm('concept:수주잔고')!.meaning);
});

it.each(['MUU', 'SOXL', 'TSLL'])('requires the actual %s product link using its issuer reference', symbol => {
  const fund = fundProfile(symbol)!;
  const evidence: AssistantEvidencePacket = { ...packet, symbol, evidence: [
    { ...source, id: 'R1', kind: 'reference', url: fund.issuerUrl, text: 'Verified product structure' },
  ] };
  const q = { ...question, symbol };
  const contract = assistantAnswerContract(q, evidence);
  expect(contract.product).toMatchObject({ symbol, target: fund.target, dailyMultiple: fund.multiple, referenceId: 'R1' });
  const prompt = assistantQuestionPrompt(q, { evidence });
  expect(prompt).toContain('상품 연결은 필수');
  expect(prompt).not.toContain('상품 배수는 아래 assistantInsights로 옮기세요');
});

it('does not invent product facts from a ticker when issuer evidence is missing or belongs to another subject', () => {
  expect(assistantAnswerContract({ ...question, symbol: 'MUU' }, packet).product).toBeNull();
  expect(assistantAnswerContract({ ...question, symbol: 'MUU' }, { ...packet, symbol: 'MUU' }).product).toBeNull();
  expect(assistantAnswerContract({ ...question, symbol: 'UNKNOWN' }, packet).product).toBeNull();
  const market = assistantAnswerContract({ ...question, symbol: undefined }, packet);
  expect(market.scope).toBe('market');
  expect(market.product).toBeNull();
});

it('keeps a product distinction in a simpler explanation instead of explicitly deleting it', () => {
  const prompt = assistantQuestionPrompt({ ...question, symbol: 'MUU', text: '더 쉽게 설명해 줘',
    history: [{ question: 'MUU는 왜 떨어져?', answer: 'MUU는 마이크론 하루 등락의 2배를 목표로 해요.' }] }, {});
  expect(prompt).toContain('그 연결도 쉬운 한 문장으로 남기세요');
  expect(prompt).not.toContain('배수·ETF 상품 구조·가격·날짜는 제외하세요');
});
