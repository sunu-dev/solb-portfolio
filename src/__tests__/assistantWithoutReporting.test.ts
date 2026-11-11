import { describe, expect, it } from 'vitest';
import { assistantAsksForCause, assistantQuestionPrompt, assistantUnsourcedCauseIssue, type AssistantQuestion } from '@/lib/assistantQuestion';
import type { AssistantEvidencePacket } from '@/lib/assistantEvidence';

// 기사 본문 없이 원인 질문에 답할 때: 가격 비교까지만 말하고, 이유는 확인하지 못했다고 밝힌다.
const q = (text: string, history: AssistantQuestion['history'] = []): AssistantQuestion => ({ text, symbol: '035420.KS', unclearTerms: [], period: '1d', market: 'kr', history });
const answer = (currentStatus: string, extra: Record<string, unknown> = {}) => ({ currentStatus, keyAdvice: [], assistantInsights: [], ...extra });

describe('an answer about a move with no reporting behind it', () => {
  it('passes when it compares prices and says the reason is unconfirmed', () => {
    expect(assistantUnsourcedCauseIssue(answer('NAVER는 11월 10일 전 거래일보다 오른 채 마감했고, 코스피도 함께 올랐어요.\nNAVER만 따로 오른 것은 아니에요.\n왜 올랐는지 직접적인 이유는 확인하지 못했어요.'))).toBeUndefined();
    expect(assistantUnsourcedCauseIssue(answer('엔비디아는 전날보다 내렸어요. 이 움직임을 설명하는 기사는 찾지 못해서 원인은 알 수 없어요.'))).toBeUndefined();
    expect(assistantUnsourcedCauseIssue(answer('마이크론은 전 거래일보다 내린 채 마감했어요.\n왜 내렸는지는 확인하지 못했어요.'))).toBeUndefined();
    expect(assistantUnsourcedCauseIssue(answer('무엇 때문인지는 아직 알 수 없어요. 전 거래일보다 내렸어요.'))).toBeUndefined();
    // Hedged causal wording is the honest form, not a claim.
    expect(assistantUnsourcedCauseIssue(answer('코스피와 함께 올랐지만, 같은 이유 때문이라고 단정할 수는 없어요. 이유는 확인하지 못했어요.'))).toBeUndefined();
  });
  it('rejects an answer that never says the reason is unconfirmed', () => {
    expect(assistantUnsourcedCauseIssue(answer('NAVER는 전 거래일보다 올랐고 코스피도 함께 올랐어요.'))).toBe('missing_unconfirmed_cause');
    // Saying some unrelated thing is unconfirmed does not count.
    expect(assistantUnsourcedCauseIssue(answer('NAVER는 전 거래일보다 올랐어요. 다음 실적 발표일은 확인하지 못했어요.'))).toBe('missing_unconfirmed_cause');
  });
  it.each([
    '코스피가 크게 오른 영향으로 NAVER도 올랐어요. 직접적인 이유는 확인하지 못했어요.',
    '최근 많이 오른 뒤 차익 실현 매물 때문에 내렸어요. 정확한 원인은 확인하지 못했어요.',
    '반도체 업황 기대에 힘입어 올랐어요. 이유를 설명하는 기사는 찾지 못했어요.',
  ])('rejects a cause stated without a source: %s', text => {
    expect(assistantUnsourcedCauseIssue(answer(text))).toBe('unsourced_cause');
  });
  it('rejects extra findings that have no article to stand on', () => {
    expect(assistantUnsourcedCauseIssue(answer('전 거래일보다 올랐어요. 이유는 확인하지 못했어요.', { assistantInsights: [{ kind: 'observation', text: '외국인이 샀어요.', evidenceIds: ['P1'] }] }))).toBe('unsourced_insight');
  });
  it('tells a why-question from a follow-up that asks something else', () => {
    for (const text of ['최근 주가가 왜 움직였어요?', '오늘 시장에 무슨 일이 있었어요?', '내린 이유가 뭐야?', '뭐 때문에 올랐어?']) expect(assistantAsksForCause(q(text))).toBe(true);
    for (const text of ['그럼 코스피랑 비교하면 어때?', '이 회사는 뭘 만들어?', '메모리가 뭐야?']) expect(assistantAsksForCause(q(text))).toBe(false);
  });
});

describe('the prompt when no reporting was found', () => {
  const packet: AssistantEvidencePacket = { version: 1, symbol: '035420.KS', period: '1d', checkedAt: '2026-11-10T07:00:00Z', comparisons: [], gaps: ['이 움직임을 설명하는 기사 본문이나 발표 자료를 가져오지 못했어요.'],
    price: { symbol: '035420.KS', label: 'NAVER', day: '2026-11-10', baselineDay: '2026-11-09', at: '2026-11-10T06:30:00Z', price: 250000, changePercent: 1.2, currency: 'KRW', sessionState: 'closed' },
    evidence: [{ id: 'P1', kind: 'price', title: 'NAVER', text: '가격 변화 1.2%', url: 'https://finance.yahoo.com/quote/035420.KS/history/', publisher: 'Yahoo Finance', publishedAt: '2026-11-10T06:30:00Z', checkedAt: '2026-11-10T07:00:00Z' }] };
  it('forbids naming a cause and asks for the price comparison and the unconfirmed reason', () => {
    const prompt = assistantQuestionPrompt(q('오늘 왜 움직였어요?'), { evidence: packet, withoutReporting: true });
    expect(prompt).toContain('기사 본문이나 발표 자료를 구하지 못했어요');
    expect(prompt).toContain('원인을 말하지 마세요');
    expect(prompt).toContain('확인하지 못했다는 한 문장');
    expect(prompt).toContain('keyAdvice와 assistantInsights는 반드시 []');
  });
  it('leaves the normal prompt untouched when reporting exists', () => {
    expect(assistantQuestionPrompt(q('오늘 왜 움직였어요?'), { evidence: packet })).not.toContain('기사 본문이나 발표 자료를 구하지 못했어요');
  });
  it('tells a buy or sell question not to pretend it knows recent news', () => {
    const prompt = assistantQuestionPrompt(q('지금 더 사도 될까요?'), { evidence: packet, withoutReporting: true });
    expect(prompt).toContain('최근 기사 본문이나 발표 자료를 구하지 못했어요');
    expect(prompt).not.toContain('원인을 말하지 마세요');
  });
});
