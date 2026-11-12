import { describe, expect, it } from 'vitest';
import { assistantAsksBack, assistantSmallTalk, assistantSmallTalkReply } from '@/lib/assistantSmallTalk';

describe('assistantSmallTalk', () => {
  it.each([
    ['ㅎㅇ', 'greeting'], ['안녕!', 'greeting'], ['안녕하세요 주비님 ㅎㅎ', 'greeting'], ['주비야 안녕', 'greeting'], ['Hi', 'greeting'],
    ['고마워', 'thanks'], ['ㅇㅇ 알겠어 고마워', 'thanks'], ['아하 그렇구나, 감사합니다!', 'thanks'], ['정말 고마워요 😊', 'thanks'],
    ['ㅇㅇ', 'acknowledge'], ['알겠어', 'acknowledge'], ['아 그렇구나', 'acknowledge'], ['오케이 이해했어', 'acknowledge'],
    ['너는 누구야? 뭘 할 수 있어?', 'identity'], ['뭘 물어볼 수 있어?', 'identity'], ['주비는 뭐야?', 'identity'],
    ['고마워 다음에 또 올게', 'farewell'], ['수고하세요', 'farewell'],
  ])('%s → %s', (text, kind) => expect(assistantSmallTalk(text)).toBe(kind));

  // A real question must reach the assistant even when it opens politely.
  it.each([
    '고마워. 근데 PER이 뭐야?', '안녕! 주식 처음인데 뭐부터 하면 돼?', '아 그렇구나. 그럼 삼성전자는 어떤 회사야?',
    '뭐야?', '주비야', '네이버', '응 그럼 지금 사도 돼?', '삼성전자 물어봐도 돼?', '오늘 점심 뭐 먹을까?', '좋아하는 종목 있어?',
    '이해가 안 돼', '아니', '감사보고서가 뭐야', 'OK저축은행', '예를 들어 설명해 줘', '더 쉽게 설명해 줘',
  ])('%s is not small talk', text => expect(assistantSmallTalk(text)).toBeNull());

  it('never mentions prices, picks or trades in a local reply', () => {
    for (const kind of ['greeting', 'thanks', 'acknowledge', 'identity', 'farewell'] as const) {
      for (const hasConversation of [true, false]) {
        const reply = assistantSmallTalkReply(kind, { subject: '삼성전자', hasConversation });
        expect(reply).not.toMatch(/\d|%|추천|매수하|매도하|사세요|파세요/);
      }
    }
    expect(assistantSmallTalkReply('greeting', { subject: '삼성전자', hasConversation: false })).toContain('삼성전자');
  });
  it('knows when Joobi ended its answer with a question of its own', () => {
    expect(assistantAsksBack(['처음 산 이유가 아직 맞는지 먼저 따져봐야 해요. 이 돈을 얼마나 오래 묶어둘 수 있나요?'])).toBe(true);
    expect(assistantAsksBack(['삼성전자 주가를 말씀하신 건가요?\n맞다면 최근 가격부터 볼게요.', '추가 설명'])).toBe(true);
    expect(assistantAsksBack(['전 거래일보다 내렸어요.', '왜 내렸는지는 확인하지 못했어요.'])).toBe(false);
    expect(assistantAsksBack([undefined, 3])).toBe(false);
  });
});
