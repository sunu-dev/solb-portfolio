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
  // 2026-11-12 배포 전 검토에서 나온 반례. 문장 어딘가의 '못'·'확인'이 원인 주장을 무르지 못하고, '때문에'가 없어도 소식을 움직임에 이으면 막는다.
  it.each([
    '3분기 실적이 시장 기대에 못 미쳤기 때문에 내렸어요. 정확한 이유는 확인하지 못했어요.',
    '왜 내렸는지 기사로 확인하지 못했지만, 반도체 가격 하락 우려 때문으로 보여요.',
    '뚜렷한 호재가 없었기 때문에 내렸어요. 정확한 이유는 확인하지 못했어요.',
    '실적 부진이 확인됐기 때문에 급락했어요. 정확한 이유는 확인하지 못했어요.',
    '반도체 업종 전체가 약했던 영향으로 함께 내렸고, 그 밖의 이유는 확인하지 못했어요.',
    '실적 때문일 수도 있지만 이유는 확인하지 못했어요. 전 거래일보다 내렸어요.',
    '외국인 매도세가 이어지면서 주가가 밀렸어요. 정확한 이유는 확인하지 못했어요.',
    '반도체 업황 회복 기대감에 올랐어요. 정확한 이유는 확인하지 못했어요.',
    '금리 인상 우려로 투자 심리가 나빠져 내렸어요. 정확한 이유는 확인하지 못했어요.',
    '차익 실현 매물이 나오며 하락했어요. 정확한 이유는 확인하지 못했어요.',
    '미국 금리 인하 기대가 커진 영향이 컸어요. 정확한 이유는 확인하지 못했어요.',
    '삼성전자는 오늘 내렸어요. 미국 금리 인상 우려가 커지면서 반도체주가 함께 팔렸어요. 정확한 이유는 확인하지 못했어요.',
    '실적 발표 뒤 주가가 올랐어요. 이유는 확인하지 못했어요.',
    '외국인이 많이 판 탓에 내렸어요. 이유는 확인하지 못했어요.',
    '미국 반도체 주식이 크게 오른 것이 계기로 꼽혔어요. 이유는 확인하지 못했어요.',
    '시장 전체 분위기도 함께 작용했어요. 이유는 확인하지 못했어요.',
    // 2026-11-12 재검토: 소수점 퍼센트, 흔한 동사 꼴, '원인은 …이에요', 짐작, 이름 없는 전문가, 함께 움직인 것을 원인처럼 잇는 말
    '실적 우려로 주가가 3.2% 내렸어요. 이유는 확인하지 못했어요.',
    '금리 인하 기대감에 삼성전자는 2.4% 올랐어요. 이유는 확인하지 못했어요.',
    '외국인 매도세가 이어지며 1.8% 하락했어요. 이유는 확인하지 못했어요.',
    '실적 우려가 커지면서 오늘 주가는 내려갔어요. 이유는 확인하지 못했어요.',
    '실적 우려로 주가가 내리고 있어요. 이유는 확인하지 못했어요.',
    '실적 우려에 주가가 약세예요. 이유는 확인하지 못했어요.',
    '대규모 수주 소식에 주가가 치솟았어요. 이유는 확인하지 못했어요.',
    '하락의 원인은 반도체 가격 하락이에요. 정확한 이유는 확인하지 못했어요.',
    '주가가 오른 이유는 신제품 출시예요. 그 밖의 이유는 확인하지 못했어요.',
    'AI 반도체 수요가 늘어난 것이 주가 상승의 배경이에요. 이유는 확인하지 못했어요.',
    '실적 우려로 인한 하락이에요. 이유는 확인하지 못했어요.',
    '실적 우려가 주가 하락으로 이어졌어요. 이유는 확인하지 못했어요.',
    '실적 우려가 주가를 눌렀어요. 이유는 확인하지 못했어요.',
    '외국인이 많이 팔면서 주가가 내렸어요. 이유는 확인하지 못했어요.',
    '미국 증시가 내리자 삼성전자도 따라 내렸어요. 이유는 확인하지 못했어요.',
    '시장 전체가 내려서 이 종목도 같이 내렸어요. 이유는 확인하지 못했어요.',
    '차익 실현 매물이 나온 것으로 보여요. 이유는 확인하지 못했어요.',
    '금리 영향일 가능성이 있어요. 이유는 확인하지 못했어요.',
    '전문가들은 금리 우려를 원인으로 꼽아요. 이유는 확인하지 못했어요.',
    '증권가에서는 차익 실현 매물로 보고 있어요. 이유는 확인하지 못했어요.',
    // 유보처럼 보이지만 원인을 말한 문장
    '실적 우려 때문인지 투자자들이 주식을 많이 팔았어요. 이유는 확인하지 못했어요.',
    '실적 우려 때문에 피할 수 없는 하락이었어요. 이유는 확인하지 못했어요.',
    '금리 우려 때문에 얼마나 더 내릴지 모르는 투자자들이 주식을 팔았어요. 이유는 확인하지 못했어요.',
    '소식은 확인하지 못했지만 금리 우려로 내렸어요.',
    '확인하지 못한 악재로 내렸어요. 이유는 확인하지 못했어요.',
    '금리 우려로 내렸고 다른 이유는 확인하지 못했지만 시장은 올랐어요.',
    // 기사가 없는데 보도를 옮기는 말투
    '뉴스1은 데이터센터 지연 우려가 하락의 직격탄이 됐다고 전했어요. 이유는 확인하지 못했어요.',
    '한국경제 보도에 따르면 코스피는 오른 채 마감했어요. 이유는 확인하지 못했어요.',
  ])('rejects a cause that a stray hedge or a missing connective used to let through: %s', text => {
    expect(assistantUnsourcedCauseIssue(answer(text))).toBe('unsourced_cause');
  });
  it.each([
    '삼성전자는 내렸고 코스피도 함께 내렸어요. 이 움직임을 설명하는 기사나 발표 자료는 구하지 못했어요.',
    '전 거래일보다 내렸어요. 왜 내렸는지는 확인이 어려워요.',
    '전 거래일보다 내렸어요. 내린 이유는 지금 자료로는 알기 어려워요.',
    '전 거래일보다 내렸어요. 왜 내렸는지는 모르겠어요.',
    '코스피도 함께 내렸지만 같은 이유 때문이라고 보기는 어려워요. 왜 내렸는지는 확인하지 못했어요.',
    '시장 전체가 내린 것 때문인지는 불분명해요. 왜 내렸는지는 확인하지 못했어요.',
    '오늘 삼성전자는 전 거래일보다 내렸어요. 실적 때문에 내렸는지는 확인하지 못했어요.',
    '오늘 삼성전자는 내렸어요. 주가에 영향을 준 뉴스가 있었는지는 확인하지 못했어요.',
    '오늘 삼성전자는 내렸어요. 관련 기사는 찾지 못했어요.',
    '전 거래일보다 내렸어요. 무엇이 계기였는지는 확인하지 못했어요.',
    '같은 날 코스피도 내리면서 시장 전체가 약했어요. 왜 내렸는지는 확인하지 못했어요.',
    // 2026-11-12 재검토: '확인하지 못했다'가 가격 움직임 앞에 오는 정직한 문장, 편한 말투의 유보
    '최근 소식은 확인하지 못했지만 주가는 어제보다 2% 내렸어요. 이유는 확인하지 못했어요.',
    '실적 발표나 공시 같은 소식은 확인하지 못했고, 가격은 3% 내렸어요. 왜 내렸는지는 확인하지 못했어요.',
    '이 움직임을 설명하는 기사나 발표 자료는 구하지 못했지만, 삼성전자는 오늘 3.2% 내렸어요. 코스피는 1.1% 내렸어요.',
    '전망이나 발표 자료는 가져오지 못했고 주가는 2% 하락했어요. 이유는 확인하지 못했어요.',
    '삼성전자는 3% 내렸는데 반도체 업황을 보여주는 업종 지수는 1% 올랐어요. 이유는 확인하지 못했어요.',
    '이 하락을 실적 때문이라고 볼 근거는 없어요. 이유는 확인하지 못했어요.',
    '오늘 3% 내렸어요. 이유는 아직 몰라요.',
    '오늘 3% 내렸어요. 이유까지는 확인 못 했어요.',
    '오늘 3% 내렸어요. 왜 내렸는지 설명하는 기사는 아직 못 찾았어요.',
    '오늘 3% 내렸어요. 아직 알려진 이유는 없어요.',
    '이 움직임을 설명하는 기사 본문이나 발표 자료를 가져오지 못했어요. 그래서 이유는 확인하지 못했고, 가격 비교까지만 답했어요.',
    // 실제 모델이 기사 없이 쓴 답(2026-11-12 서버 경로)
    '질문하신 11월 12일 삼성전자 주가는 전날 종가보다 오른 채 장을 마쳤어요. 내렸다고 보기는 어렵고, 같은 날 코스피 시장은 내려서 시장 전체와는 반대로 움직였어요.\n삼성전자가 시장과 다르게 움직인 것은 관찰이에요. 왜 그렇게 움직였는지는 이 움직임을 설명하는 기사나 발표 자료를 가져오지 못해 확인하지 못했어요.',
    '마이크론(MU)은 2026-11-11 거래일에 전 거래일보다 크게 오른 채 마감했어요. 다만 실적 때문에 움직였는지는 확인하지 못했어요.\n같은 날 미국 대형주 시장(S&P 500)도 올랐고, 반도체 기업을 담은 SOXX ETF도 함께 올랐어요. 그중 마이크론이 가장 크게 올라서, 시장과 반도체 업종이 함께 움직인 가운데 이 종목의 움직임이 더 컸어요.',
    'NAVER 주식은 11월 5일 대비 11월 12일 마감까지 내림 쪽으로 움직였어요. 같은 기간 코스피 시장도 내려서 NAVER만 움직인 것은 아니었어요.\n다만 NAVER의 내림폭이 코스피보다 컸어요. 왜 움직였는지는 설명하는 기사나 발표 자료를 가져오지 못해 확인하지 못했어요.',
    // 실제 모델이 기사 없이 쓴 답(2026-11-11 합성 검수)
    'NAVER는 2026년 11월 11일 장을 마칠 때 전날보다 조금 오른 194,300원이었어요. 같은 날 코스피 시장은 그보다 훨씬 크게 올랐어요.\n그래서 NAVER만 따로 크게 움직인 날이라기보다, 시장이 크게 오르는 가운데 NAVER는 상대적으로 덜 오른 날이에요. 함께 움직였다는 점은 관찰일 뿐 이유는 아니에요.\n왜 움직였는지는 설명하는 기사나 발표 자료를 확인하지 못했어요.',
    '테슬라는 2026-11-10 마감 기준 전 거래일보다 조금 올랐어요. 왜 올랐는지 설명하는 기사나 발표 자료는 가져오지 못해서 이유는 확인하지 못했어요.\n같은 날 미국 대형주 시장(S&P 500)은 내렸고, 경기소비재 기업을 담은 XLY는 거의 제자리였어요. 시장 전체가 내린 날 테슬라는 반대로 올랐다는 점이 관찰돼요.',
  ])('accepts an honest answer in the words the model and the prompt actually use: %s', text => {
    expect(assistantUnsourcedCauseIssue(answer(text))).toBeUndefined();
  });
  it('checks a follow-up that asks something else for unsourced causes only', () => {
    const comparison = '코스피는 전날보다 오른 채 장을 마쳤어요. NAVER도 올랐지만 코스피보다 덜 올랐어요.';
    expect(assistantUnsourcedCauseIssue(answer(comparison))).toBe('missing_unconfirmed_cause');
    expect(assistantUnsourcedCauseIssue(answer(comparison), { asksWhy: false })).toBeUndefined();
    expect(assistantUnsourcedCauseIssue(answer('코스피가 크게 오른 영향으로 NAVER도 올랐어요.'), { asksWhy: false })).toBe('unsourced_cause');
    expect(assistantUnsourcedCauseIssue(answer(comparison, { assistantInsights: [{ kind: 'observation', text: '외국인이 샀어요.', evidenceIds: ['P1'] }] }), { asksWhy: false })).toBe('unsourced_insight');
    // 회사가 하는 일을 설명하는 '때문에'는 가격이 움직인 이유가 아니다.
    expect(assistantUnsourcedCauseIssue(answer('메모리는 정보를 저장하는 부품이기 때문에 서버에 꼭 필요해요.'), { asksWhy: false })).toBeUndefined();
  });
  // 2026-11-12 재검토: 이어지는 질문에서는 주가가 움직였다는 문장에 이유를 붙일 때만 막는다.
  it.each([
    '금리가 오르면 새로 나오는 채권이 이자를 더 많이 주기 때문에, 예전에 나온 채권은 가격이 내려가요.',
    '메모리 반도체는 가격이 자주 바뀌기 때문에 실적도 해마다 크게 달라져요.',
    '매출의 절반이 반도체에서 나오기 때문에 반도체 업황이 중요해요.',
    '이 회사 실적은 메모리 가격에 영향을 받아요.',
    '그중 반도체 사업이 실적을 이끌고 있어요.',
    '회사는 사업보고서에서 반도체가 주력이라고 밝혔어요.',
    '회사가 밝힌 자료에 따르면 매출의 60%가 반도체에서 나와요.',
    'AI 반도체 수요가 늘면서 지난해 매출이 크게 올랐어요.',
    '금리가 오르면 보통 주식 시장 전체가 약세를 보여요.',
    '시장 전체가 내린 날에는 대부분의 종목이 함께 내리기 때문에, 이 종목만의 일인지 구분할 수 있어요.',
    '삼성전자는 수출 비중이 커서 환율에 따라 원화로 바꾼 매출이 달라지는 회사예요.',
    '코스피는 1.2% 내렸고 삼성전자는 3.1% 내렸어요. 삼성전자가 더 많이 내렸어요.',
    '다른 반도체 회사의 가격은 이번 자료에 없어서 함께 내렸는지는 말할 수 없어요.',
  ])('lets a company or concept explanation through on a follow-up: %s', text => {
    expect(assistantUnsourcedCauseIssue(answer(text), { asksWhy: false })).toBeUndefined();
  });
  it.each([
    '금리 인상 우려로 반도체 회사들이 함께 내렸어요.',
    '외국인이 많이 팔면서 주가가 내렸어요.',
    '뉴스1은 데이터센터 지연 우려로 삼성전자가 내렸다고 전했어요.',
    '금리가 올랐고 그 영향으로 주가가 내렸어요.',
    '실적 우려 때문에 주가가 3.2% 내렸어요.',
    '주가가 오른 이유는 신제품 출시예요.',
  ])('still blocks a cause attached to an actual price move on a follow-up: %s', text => {
    expect(assistantUnsourcedCauseIssue(answer(text), { asksWhy: false })).toBe('unsourced_cause');
  });
  it('rejects extra findings that have no article to stand on', () => {
    expect(assistantUnsourcedCauseIssue(answer('전 거래일보다 올랐어요. 이유는 확인하지 못했어요.', { assistantInsights: [{ kind: 'observation', text: '외국인이 샀어요.', evidenceIds: ['P1'] }] }))).toBe('unsourced_insight');
  });
  it('tells a why-question from a follow-up that asks something else', () => {
    for (const text of ['최근 주가가 왜 움직였어요?', '오늘 시장에 무슨 일이 있었어요?', '내린 이유가 뭐야?', '뭐 때문에 올랐어?', '오늘 실적 때문에 떨어진 거야?', '오늘 주가에 영향 준 뉴스 있어?', '오늘 떨어진 거 무슨 때문이야?']) expect(assistantAsksForCause(q(text))).toBe(true);
    // '영향·덕분'만으로는 이유를 묻는 말이 아니다. 주가 움직임과 함께 쓰일 때만 그렇다.
    for (const text of ['그럼 코스피랑 비교하면 어때?', '이 회사는 뭘 만들어?', '메모리가 뭐야?', '환율 영향은 어때?', '금리 영향 많이 받는 회사야?', '반도체 덕분에 돈 버는 회사야?']) expect(assistantAsksForCause(q(text))).toBe(false);
  });
});

describe('the prompt when no reporting was found', () => {
  const packet: AssistantEvidencePacket = { version: 1, symbol: '035420.KS', period: '1d', checkedAt: '2026-11-10T07:00:00Z', comparisons: [], gaps: ['이 움직임을 설명하는 기사 본문이나 발표 자료를 가져오지 못했어요.'],
    price: { symbol: '035420.KS', label: 'NAVER', day: '2026-11-10', baselineDay: '2026-11-09', at: '2026-11-10T06:30:00Z', price: 250000, changePercent: 1.2, currency: 'KRW', sessionState: 'closed' },
    evidence: [{ id: 'P1', kind: 'price', title: 'NAVER', text: '가격 변화 1.2%', url: 'https://finance.yahoo.com/quote/035420.KS/history/', publisher: 'Yahoo Finance', publishedAt: '2026-11-10T06:30:00Z', checkedAt: '2026-11-10T07:00:00Z' }] };
  it('forbids naming a cause and asks for the price comparison and the unconfirmed reason', () => {
    const prompt = assistantQuestionPrompt(q('오늘 왜 움직였어요?'), { evidence: packet, withoutReporting: true });
    expect(prompt).toContain('기사 본문이나 발표 자료를 충분히 확보하지 못했어요');
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
    expect(prompt).toContain('assistantInsights는 []로 두세요');
  });
});

describe('certainty wording must contain an actual denial', () => {
  it.each([
    '금리 인상 때문이라고 단정할 수 있어요',
    '금리 인상 때문이라고 확정할 수 있어요',
    '금리 인상이라고 단정해요',
    '금리 인상이라고 확정됐어요',
    '금리 인상이라는 확정적인 사실이에요',
    '금리 인상이라고 단정하기 충분해요',
  ])('rejects an affirmative claim: %s', claim => {
    const report = answer(`주가 하락의 이유는 ${claim}. 정확한 원인은 확인하지 못했어요.`);
    expect(assistantUnsourcedCauseIssue(report)).toBe('unsourced_cause');
    expect(assistantUnsourcedCauseIssue(report, { asksWhy: false })).toBe('unsourced_cause');
  });
  it.each([
    '금리 인상 때문이라고 단정할 수는 없어요',
    '금리 인상 때문이라고 확정할 수 없어요',
    '금리 인상이라고 단정하기 어려워요',
    '금리 인상이라고 확정하기는 어려워요',
    '아직 단정하지 못했어요',
    '아직 확정되지 않았어요',
    '확정할 근거가 없어요',
  ])('preserves a genuine denial: %s', denial => {
    expect(assistantUnsourcedCauseIssue(answer(`주가 하락의 이유는 ${denial}.`))).toBeUndefined();
  });
});
