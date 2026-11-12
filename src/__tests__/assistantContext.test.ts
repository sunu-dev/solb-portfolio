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

// 2026-11-12 사용자 승인: 실존 인물의 사생활·개인 의혹은 옮기지 않고, 주가와 이어지는 회사 쪽 사실만 담담하게 전한다.
it.each([
  '이투데이는 엔비디아 젠슨 황 CEO를 둘러싼 사생활 폭로가 국가안보 문제로 번졌다고 전했어요.',
  '최고경영자의 불륜 의혹이 불거지며 경영 공백 걱정이 커졌어요.',
  '회장의 스캔들 보도 뒤 그룹 계열사 주가가 흔들렸어요.',
  '창업자의 혼외자 논란이 이어지고 있어요.',
])('sends a real person\'s private life or scandal wording to the rewrite: %s', text => {
  expect(assistantContextIssue({ currentStatus: text }, q('오늘 왜 떨어졌어?'))).toBe('personal_allegation');
  // Also when the wording sits in the expanded parts of the answer.
  expect(assistantContextIssue({ currentStatus: '전 거래일보다 내렸어요.', assistantInsights: [{ text }] }, q('오늘 왜 떨어졌어?'))).toBe('personal_allegation');
  expect(assistantContextIssue({ currentStatus: '전 거래일보다 내렸어요.', conclusion: { desc: text } }, q('오늘 왜 떨어졌어?'))).toBe('personal_allegation');
});
it.each([
  '야후 파이낸스는 엔비디아 이사회가 최고경영자 관련 조사를 시작했다고 전했어요.',
  '경영진 교체 가능성을 다룬 보도가 나온 뒤 불확실성이 커졌다고 전했어요.',
  '애플은 사생활 보호 기능을 강조해 왔어요.',
  '현대차는 내연기관 차와 전기차를 함께 팔아요.',
  '해외도 비슷한 흐름이에요. 예외도 있어요.',
])('lets neutral company wording through: %s', text => {
  expect(assistantContextIssue({ currentStatus: text }, q('오늘 왜 떨어졌어?'))).toBeUndefined();
});
it('tells both prompts and the rewrite how to handle reporting about a real person', () => {
  const question = { ...q('오늘 왜 떨어졌어?'), period: '1d' as const, market: 'us' as const };
  expect(assistantQuestionPrompt(question, {})).toContain('실존 인물의 사생활');
  expect(assistantQuestionPrompt({ ...question, text: '지금 더 사도 될까?' }, {})).toContain('실존 인물의 사생활');
  const repair = assistantRepairPrompt('기존 지시', 'personal_allegation');
  expect(repair).toContain('사생활이나 확인되지 않은 개인 의혹의 내용은 빼세요');
  expect(repair).not.toContain('젠슨');
});
