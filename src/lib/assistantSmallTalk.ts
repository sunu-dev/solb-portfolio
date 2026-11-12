/** 인사·감사·맞장구·자기소개 요청은 AI에 보내지 않고 바로 답한다.
 * 문장 전체가 해당 표현일 때만 인식한다. "고마워. 근데 PER이 뭐야?"처럼 질문이 이어지면 일반 질문이다.
 * 시세·종목·투자 내용은 여기서 만들지 않는다. */
export type AssistantSmallTalk = 'greeting' | 'thanks' | 'acknowledge' | 'identity' | 'farewell';

const ACK = '(?:ㅇㅇ|ㅇㅋ|응|웅|엉|네|넵|넹|예|오케이|오키|ok|okay|아하|아|오|그렇구나|그렇군요?|그런거구나|알겠어요?|알겠습니다|알았어요?|이해했어요?|이해됐어요?|이해돼요?|이해했습니다|좋아요?|좋네요?|굿|good)';
const THANKS = '(?:고마워요?|고맙습니다|고맙다|감사해요|감사합니다|감사|땡큐|쌩큐|thanks|thankyou|thx|ㄱㅅ|도움됐어요?|도움이됐어요?)';
const CALL = '(?:주비(?:야|님)?)?';
const WHO = '(?:(?:너|넌|너는|당신은?|주비는?|주비가)?누구(?:야|니|예요|세요|인가요)|(?:너|넌|너는|주비는?)(?:뭐(?:야|예요|니)|뭐하는(?:애|거|서비스)(?:야|예요)))';
const CAN = '(?:(?:너|넌|너는|주비는?|여기서|여기선)?(?:뭘|뭐|무엇을|어떤걸|어떤것을)?(?:할수있(?:어|어요|나요|니)|도와줄수있(?:어|어요|나요|니)|물어볼수있(?:어|어요|나요|니)|물어봐도돼요?))';
const patterns: [AssistantSmallTalk, RegExp][] = [
  ['greeting', new RegExp(`^${CALL}(?:안녕(?:하세요|하십니까)?|하이|하잉|헬로|hello|hi|ㅎㅇ|반가워요?|반갑습니다|좋은(?:아침|저녁|하루)(?:이에요|입니다)?)${CALL}$`, 'i')],
  ['farewell', new RegExp(`^(?:${ACK})*(?:${THANKS})*(?:잘가요?|안녕히계세요|바이|bye|ㅂㅂ|ㅂㅇ|다음에(?:또)?(?:봐요?|올게요?|물어볼게요?)|나중에(?:또)?(?:봐요?|올게요?|물어볼게요?)|수고(?:했어요?|하세요|하셨습니다))$`, 'i')],
  ['thanks', new RegExp(`^(?:${ACK})*${CALL}(?:정말|진짜|너무|덕분에)?${THANKS}${CALL}$`, 'i')],
  ['acknowledge', new RegExp(`^(?:${ACK})+$`, 'i')],
  ['identity', new RegExp(`^${CALL}(?:${WHO}(?:${CAN})?|${CAN})$|^(?:어떻게(?:써요?|쓰는거야|사용해요?)|사용법(?:알려줘)?)$`)],
];

export function assistantSmallTalk(input: string): AssistantSmallTalk | null {
  // Laughter, emoji and punctuation do not turn a greeting into a question.
  const text = input.replace(/[\s.!?~,。？！…^*]+|[ㅋㅎㅠㅜ]{2,}|\p{Extended_Pictographic}|️|‍/gu, '');
  if (text.length < 1 || text.length > 30) return null;
  for (const [kind, pattern] of patterns) if (pattern.test(text)) return kind;
  return null;
}

/** 주비의 답이 물음으로 끝났는지. 그 뒤의 "네", "응"은 맞장구가 아니라 그 물음에 대한 답이라 AI에 보낸다. */
export function assistantAsksBack(parts: unknown[]): boolean {
  return parts.some(part => typeof part === 'string' && part.split(/\n+/).some(paragraph => /[?？]["'”’)\s]*$/.test(paragraph.trim())));
}

export function assistantSmallTalkReply(kind: AssistantSmallTalk, context: { subject?: string; hasConversation: boolean }): string {
  const about = context.subject ? `${context.subject}에 대해 궁금한 점이나 ` : '';
  switch (kind) {
    case 'greeting': return context.hasConversation
      ? '네, 여기 있어요. 이어서 궁금한 점을 편하게 물어보세요.'
      : `안녕하세요, 주비예요.\n\n${about}주가가 왜 움직였는지, 낯선 용어가 무슨 뜻인지 편하게 물어보세요.`;
    case 'thanks': return context.hasConversation
      ? '도움이 됐다니 다행이에요. 읽다가 막히는 말이 있으면 이어서 물어보세요.'
      : '천만에요. 궁금한 점이 생기면 편하게 물어보세요.';
    case 'acknowledge': return context.hasConversation
      ? '좋아요. 더 궁금한 점이 생기면 이어서 물어보세요.'
      : '좋아요. 궁금한 종목이나 용어를 편하게 물어보세요.';
    case 'farewell': return '네, 다음에 또 이야기해요. 이 탭을 열어두면 대화를 이어갈 수 있어요.';
    case 'identity': return '저는 주식을 처음 시작한 분을 돕는 AI 주식비서 주비예요.\n\n주가가 왜 움직였는지, 회사가 무엇으로 돈을 버는지, 낯선 용어가 무슨 뜻인지 쉬운 말로 설명해요. 답을 읽다가 모르는 용어는 눌러서 내 주식사전에 모아둘 수 있어요.\n\n사라·팔라는 판단이나 목표 가격은 알려드리지 않아요.';
  }
}
