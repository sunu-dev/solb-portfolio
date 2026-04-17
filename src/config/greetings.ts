/**
 * 감성 인사 시스템 — 시간/계절/요일/특별일/장상태/하락장 조합
 * 110+ 메시지 풀에서 조건 매칭 → 랜덤 선택
 */

interface Greeting {
  text: string;
  emoji: string;
  condition?: {
    hours?: number[];        // 특정 시간대
    months?: number[];       // 특정 월
    days?: number[];         // 특정 요일 (0=일, 1=월, ..., 6=토)
    dates?: string[];        // 특정 날짜 (MM-DD)
    isMarketOpen?: boolean;
    isWeekend?: boolean;
    isLoss?: boolean;        // 포트폴리오 손실 중
  };
}

const GREETINGS: Greeting[] = [
  // ===== 새벽 (0~5시) =====
  { text: '늦은 밤까지 고생이에요. 내일은 푹 쉬세요', emoji: '🌙', condition: { hours: [0,1,2,3,4,5] } },
  { text: '새벽 공기처럼 차분하게, 오늘의 시장을 봐요', emoji: '🌙', condition: { hours: [0,1,2,3,4,5] } },
  { text: '밤늦게까지 투자 공부 중이시네요. 대단해요', emoji: '✨', condition: { hours: [0,1,2,3,4,5] } },
  { text: '지금 미국은 한창 거래 중이에요', emoji: '🌃', condition: { hours: [0,1,2,3,4] } },
  { text: '잠이 안 오시나요? 주비가 함께할게요', emoji: '🌙', condition: { hours: [0,1,2,3] } },

  // ===== 아침 (6~11시) =====
  { text: '좋은 아침이에요! 오늘도 좋은 하루 되세요', emoji: '☀️', condition: { hours: [6,7,8,9,10,11] } },
  { text: '상쾌한 아침, 포트폴리오도 체크하고 출발해요', emoji: '🌅', condition: { hours: [6,7,8] } },
  { text: '커피 한 잔과 함께 오늘의 시장을 확인해보세요', emoji: '☕', condition: { hours: [7,8,9] } },
  { text: '출근길에 잠깐! 어제 내 종목은 어땠을까요', emoji: '🚇', condition: { hours: [7,8,9], days: [1,2,3,4,5] } },
  { text: '하루의 시작, 주비와 함께해요', emoji: '🌤️', condition: { hours: [6,7,8,9,10,11] } },

  // ===== 오후 (12~17시) =====
  { text: '점심 드셨어요? 오늘도 수고하고 계시네요', emoji: '🍚', condition: { hours: [12,13] } },
  { text: '오후에도 파이팅! 포트폴리오 한번 확인해볼까요', emoji: '💪', condition: { hours: [13,14,15] } },
  { text: '오후의 여유, 잠깐 종목 체크해보세요', emoji: '☕', condition: { hours: [14,15,16] } },
  { text: '퇴근 준비 중이시죠? 오늘 하루도 수고하셨어요', emoji: '🌇', condition: { hours: [17] } },
  { text: '좋은 오후예요. 시장은 어떤가요?', emoji: '👋', condition: { hours: [12,13,14,15,16,17] } },

  // ===== 저녁 (18~23시) =====
  { text: '수고하셨어요. 편하게 쉬면서 확인해보세요', emoji: '🌆', condition: { hours: [18,19,20] } },
  { text: '저녁 식사는 하셨어요? 건강이 최고 자산이에요', emoji: '🍽️', condition: { hours: [18,19] } },
  { text: '오늘 하루를 정리해볼게요', emoji: '📋', condition: { hours: [20,21] } },
  { text: '미국 장이 곧 열려요. 준비되셨나요?', emoji: '🔔', condition: { hours: [21,22] } },
  { text: '미국 장 시작! 오늘은 어떤 하루일까요', emoji: '🟢', condition: { hours: [22,23] } },

  // ===== 월요일 =====
  { text: '월요일이에요! 이번 주도 응원할게요', emoji: '💪', condition: { days: [1] } },
  { text: '새로운 한 주의 시작, 같이 힘내요', emoji: '🚀', condition: { days: [1] } },

  // ===== 금요일 =====
  { text: '금요일이에요! 한 주 수고하셨어요', emoji: '🎉', condition: { days: [5] } },
  { text: '불금! 오늘은 좀 쉬어도 괜찮아요', emoji: '🍻', condition: { days: [5], hours: [18,19,20,21,22,23] } },

  // ===== 주말 =====
  { text: '주말이에요. 편하게 쉬세요. 시장도 쉬고 있어요', emoji: '😴', condition: { isWeekend: true } },
  { text: '주말엔 투자 공부 한 스푼? 주비가 도와줄게요', emoji: '📚', condition: { isWeekend: true } },
  { text: '쉬는 날, 지난 한 주를 돌아보기 좋은 시간이에요', emoji: '🧘', condition: { isWeekend: true } },

  // ===== 봄 (3~5월) =====
  { text: '봄바람이 부는 계절, 포트폴리오에도 봄이 오길', emoji: '🌸', condition: { months: [3,4,5] } },
  { text: '벚꽃처럼 활짝 피는 수익을 기대해봐요', emoji: '🌷', condition: { months: [3,4] } },
  { text: '따뜻한 봄날, 마음도 투자도 여유롭게', emoji: '🌿', condition: { months: [4,5] } },

  // ===== 여름 (6~8월) =====
  { text: '더운 날씨에 건강 조심하세요! 물 많이 드세요', emoji: '🌊', condition: { months: [6,7,8] } },
  { text: '무더운 여름, 시원한 곳에서 종목 체크하세요', emoji: '🧊', condition: { months: [7,8] } },
  { text: '여름 휴가 계획 세우셨어요? 투자 수익으로 가볼까요', emoji: '🏖️', condition: { months: [6,7] } },

  // ===== 가을 (9~11월) =====
  { text: '가을 하늘처럼 높이, 시야를 넓게 봐요', emoji: '🍂', condition: { months: [9,10,11] } },
  { text: '선선한 바람이 불어요. 오늘도 좋은 하루 되세요', emoji: '🍁', condition: { months: [9,10] } },
  { text: '독서의 계절, 투자 서적 한 권 어때요?', emoji: '📖', condition: { months: [10,11] } },

  // ===== 겨울 (12~2월) =====
  { text: '추운 날씨에 감기 조심하세요! 건강이 최고 자산', emoji: '🧣', condition: { months: [12,1,2] } },
  { text: '따뜻한 차 한 잔과 함께 포트폴리오 체크', emoji: '🍵', condition: { months: [12,1,2] } },
  { text: '겨울을 이겨내는 투자자처럼, 묵묵히 함께할게요', emoji: '📈', condition: { months: [12,1,2] } },
  { text: '추운 겨울이지만, 마음만은 따뜻하게', emoji: '❄️', condition: { months: [12,1] } },

  // ===== 특별한 날 =====
  { text: '새해 복 많이 받으세요! 올해 투자도 응원해요', emoji: '🎆', condition: { dates: ['01-01', '01-02'] } },
  { text: '즐거운 설날 되세요! 가족과 따뜻한 시간 보내세요', emoji: '🏮', condition: { dates: ['01-28', '01-29', '01-30'] } },
  { text: '발렌타인데이! 달콤한 하루 보내세요', emoji: '💝', condition: { dates: ['02-14'] } },
  { text: '어린이날이에요! 동심으로 돌아가볼까요', emoji: '🎈', condition: { dates: ['05-05'] } },
  { text: '메리 크리스마스! 따뜻한 연말 보내세요', emoji: '🎄', condition: { dates: ['12-24', '12-25'] } },
  { text: '한 해의 마지막 날이에요. 올해도 수고하셨어요', emoji: '🎊', condition: { dates: ['12-31'] } },
  { text: '즐거운 추석 보내세요! 가족과 행복한 시간', emoji: '🌕', condition: { dates: ['09-16', '09-17', '09-18'] } },
  { text: '광복절이에요. 감사한 마음으로', emoji: '🇰🇷', condition: { dates: ['08-15'] } },
  { text: '스승의 날이에요. 주비도 좋은 스승이 되고 싶어요', emoji: '🌹', condition: { dates: ['05-15'] } },

  // ===== 하락장 위로 =====
  { text: '힘든 하루였죠. 괜찮아요, 시장은 다시 회복될 거예요', emoji: '📈', condition: { isLoss: true } },
  { text: '폭풍우가 지나면 무지개가 와요. 함께할게요', emoji: '🌈', condition: { isLoss: true } },
  { text: '잃어도 괜찮아요. 배우는 과정이에요', emoji: '💙', condition: { isLoss: true } },
  { text: '나만 떨어지는 게 아니에요. 시장은 파도가 있어요', emoji: '🌊', condition: { isLoss: true } },
  { text: '장기적으로 보면 괜찮아질 거예요. 주비가 응원해요', emoji: '🍀', condition: { isLoss: true } },
  { text: '오늘은 좀 쉬어도 돼요. 내일은 내일의 시장이 있어요', emoji: '🛋️', condition: { isLoss: true } },
  { text: '하락장은 경험치예요. 다음엔 더 강해질 거예요', emoji: '💪', condition: { isLoss: true } },
  { text: '속상해하지 마요. 어려운 투자는 주비가 다 도와줄게요', emoji: '🫂', condition: { isLoss: true } },
  { text: '지치지 마세요. 당신의 곁엔 항상 주비가 있어요', emoji: '✨', condition: { isLoss: true } },

  // ===== 기본 (조건 없음) =====
  { text: '오늘도 주비와 함께해요', emoji: '✨', condition: {} },
  { text: '당신의 모든 내일을 응원해요', emoji: '✨', condition: {} },
  { text: '작은 한 걸음이 큰 차이를 만들어요. 천천히 가요', emoji: '👣', condition: {} },
  { text: '궁금한 건 언제든 물어보세요. 제가 다 읽어드릴게요', emoji: '💬', condition: {} },
  { text: '투자는 마라톤이에요. 당신의 페이스가 가장 중요해요', emoji: '🏃', condition: {} },
  { text: '오늘 배운 것 하나가 소중한 자산이 될 거예요', emoji: '📝', condition: {} },
  { text: '어려운 차트도, 복잡한 뉴스도 제가 쉽게 알려드릴게요', emoji: '📖', condition: {} },
  { text: '당신이 투자를 즐겼으면 좋겠어요. 그게 제 마음이에요', emoji: '🧡', condition: {} },
];

/**
 * 현재 조건에 맞는 인사 메시지 선택
 */
export function getGreeting(isLoss: boolean = false): { text: string; emoji: string } {
  const now = new Date();
  const hour = now.getHours();
  const month = now.getMonth() + 1;
  const day = now.getDay();
  const dateStr = `${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isWeekend = day === 0 || day === 6;

  // 조건 매칭 점수 계산 — 명시된 조건은 반드시 일치해야 후보에 포함 (AND 로직)
  const scored = GREETINGS.map(g => {
    let score = 0;
    const c = g.condition || {};

    // 특별한 날 — 명시됐는데 불일치 → 제외
    if (c.dates) {
      if (!c.dates.includes(dateStr)) return { g, score: -1 };
      score += 100;
    }
    // 하락장 — 명시됐는데 불일치 → 제외
    if (c.isLoss === true) {
      if (!isLoss) return { g, score: -1 };
      score += 50;
    }
    // 주말 — 명시됐는데 불일치 → 제외
    if (c.isWeekend === true) {
      if (!isWeekend) return { g, score: -1 };
      score += 30;
    }
    // 시간대 — 명시됐는데 불일치 → 제외
    if (c.hours) {
      if (!c.hours.includes(hour)) return { g, score: -1 };
      score += 20;
    }
    // 요일 — 명시됐는데 불일치 → 제외
    if (c.days) {
      if (!c.days.includes(day)) return { g, score: -1 };
      score += 15;
    }
    // 계절 — 명시됐는데 불일치 → 제외
    if (c.months) {
      if (!c.months.includes(month)) return { g, score: -1 };
      score += 10;
    }
    // 조건 없으면 기본 (낮은 점수)
    if (!c.dates && !c.isLoss && !c.isWeekend && !c.hours && !c.days && !c.months) score += 1;

    return { g, score };
  }).filter(x => x.score > 0);

  // 상위 점수에서 랜덤 선택
  scored.sort((a, b) => b.score - a.score);
  const topScore = scored[0]?.score || 0;
  const top = scored.filter(x => x.score >= topScore - 5); // 상위 그룹 (유사 점수만)
  const pick = top[Math.floor(Math.random() * top.length)];

  return pick ? { text: pick.g.text, emoji: pick.g.emoji } : { text: '오늘도 주비와 함께해요', emoji: '✨' };
}
