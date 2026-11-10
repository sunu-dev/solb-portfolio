import { expect, it } from 'vitest';
import { assistantContextIssue, assistantPricePremise, assistantQuestionPrompt } from '@/lib/assistantQuestion';
import { assistantRepairPrompt } from '@/lib/assistantRepair';
const q = (text: string) => ({ text, symbol: 'MU', unclearTerms: [] });
it.each(['최근 거래일 마이크론 주가가 움직인 이유를 알려줘', '왜 움직였어?', '오를까?', '떨어질까?', '만약 떨어지면?', '왜 안 올라?', '왜 오르지 않아?', '올랐다가 떨어졌어?'])('does not invent a direction for %s', text => {
  expect(assistantPricePremise(q(text))).toBe('unspecified');
  expect(assistantContextIssue({ currentStatus: '질문의 전제와 달리 내린 날이 아니라 오른 날이에요.' }, q(text))).toBe('invented_question_premise');
});
it.each(['왜 떨어졌어?', '오늘 왜 이렇게 떨어져요?', '어제 하락한 이유는?', '마이크론은 왜이렇게 떨어지는거야?', '주가가 하락하는 이유는?'])('recognizes a stated decline: %s', text => {
  expect(assistantPricePremise(q(text))).toBe('down');
  expect(assistantContextIssue({ currentStatus: '질문의 전제와 달리 최근 거래일은 올랐어요.' }, q(text))).toBeUndefined();
});
it('does not import the previous question premise into a neutral follow-up', () => {
  expect(assistantPricePremise({ ...q('최근 거래일은 어때?'), history: [{ question: '어제 왜 떨어져?', answer: '앞 설명' }] })).toBe('unspecified');
});
it.each([
  '전날 미국 중간선거에서 민주당이 이겨 AI 규제가 강해질까 걱정했어요.',
  '전날 미국 중간선거에서 민주당이 의회 다수를 차지했어요.',
  '어제 총선이 치러졌어요.',
  '전날 미국 중간선거에서 민주당이 의회를 가져간 뒤 AI 시설 규제 우려가 커졌어요.',
  '전날 미국 의회 선거에서 민주당이 이긴 뒤 크게 내렸어요.',
])('rejects ambiguous relative election time: %s', currentStatus => {
  expect(assistantContextIssue({ currentStatus }, q('왜 움직였어?'))).toBe('relative_election_time');
});
it.each([
  '선거 결과 이후 규제가 강해질까 걱정했어요. 전날 급락 뒤 최근 거래일에는 올랐어요.',
  '전날 선거 결과에 대한 우려로 반도체 주가가 내렸다고 보도했어요.',
  '11월 3일 선거 결과가 알려진 뒤 11월 5일 주가가 내렸다고 보도했어요.',
  '최근 거래일은 올랐어요. 그보다 앞선 하락의 배경으로 규제 우려를 짚었어요.',
])('keeps separate event and market reaction statements: %s', currentStatus => {
  expect(assistantContextIssue({ currentStatus }, q('왜 움직였어?'))).toBeUndefined();
});
it('checks expanded advice too and gives targeted repair instructions without copying rejected text', () => {
  const issue = assistantContextIssue({ currentStatus: '선거 소식이에요.', keyAdvice: ['전날 미국 중간선거에서 민주당이 승리했어요.'] }, q('왜 움직였어?'));
  expect(issue).toBe('relative_election_time');
  const repaired = assistantRepairPrompt('verified packet', issue);
  expect(repaired).toContain('기사의 급락일을 선거일로 옮기지 마세요');
  expect(repaired).toContain('verified packet');
});
it('does not tell neutral questions to correct an imagined decline', () => {
  const prompt = assistantQuestionPrompt(q('최근 거래일 움직인 이유는?'), {});
  expect(prompt).toContain('"questionPricePremise":"unspecified"');
  expect(prompt).not.toContain('제공된 가격이 질문의 하락 전제와 다르면');
  expect(prompt).toContain('선거가 치러진 날·결과가 알려진 날·그 결과로 주가가 움직인 날');
});
