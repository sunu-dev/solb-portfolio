/** Edited copy, not runtime AI output. IDs remain stable across copy edits. */
export type ArrivalGroup = 'neutral'|'rest'|'pre'|'live'|'closed'|'spring'|'summer'|'autumn'|'winter'|'morning'|'afternoon'|'evening'|'night'|'clear'|'cloud'|'rain'|'snow'|'hot'|'cold'|'mild'|'wind';
export interface ArrivalPattern { id: string; group: ArrivalGroup; text: string }
export const ARRIVAL_PATTERNS: readonly ArrivalPattern[] = [
  {
    "id": "neutral-01",
    "group": "neutral",
    "text": "오늘의 소식부터, 천천히."
  },
  {
    "id": "neutral-02",
    "group": "neutral",
    "text": "궁금했던 회사부터 살펴봐요."
  },
  {
    "id": "neutral-03",
    "group": "neutral",
    "text": "숫자 옆의 이야기도 함께."
  },
  {
    "id": "neutral-04",
    "group": "neutral",
    "text": "내 투자에 필요한 만큼만."
  },
  {
    "id": "neutral-05",
    "group": "neutral",
    "text": "작은 궁금증 하나부터 시작해요."
  },
  {
    "id": "neutral-06",
    "group": "neutral",
    "text": "알아두면 덜 낯선 시장 이야기."
  },
  {
    "id": "neutral-07",
    "group": "neutral",
    "text": "한 번에 다 알아야 하는 건 아니에요."
  },
  {
    "id": "neutral-08",
    "group": "neutral",
    "text": "내가 이해하는 속도로 읽어봐요."
  },
  {
    "id": "neutral-09",
    "group": "neutral",
    "text": "익숙한 종목도 새롭게 보일 수 있어요."
  },
  {
    "id": "neutral-10",
    "group": "neutral",
    "text": "짧게 들러도 괜찮아요."
  },
  {
    "id": "neutral-11",
    "group": "neutral",
    "text": "오늘 눈에 들어온 종목이 있나요?"
  },
  {
    "id": "neutral-12",
    "group": "neutral",
    "text": "궁금한 내용을 차근차근 연결해봐요."
  },
  {
    "id": "rest-01",
    "group": "rest",
    "text": "오늘은 잠깐 쉬어가도 좋아요."
  },
  {
    "id": "rest-02",
    "group": "rest",
    "text": "차트에서 잠시 눈을 떼어도 좋은 날."
  },
  {
    "id": "rest-03",
    "group": "rest",
    "text": "시장도 쉬는 날, 내 시간도 챙겨요."
  },
  {
    "id": "rest-04",
    "group": "rest",
    "text": "오늘의 여백은 내 몫으로."
  },
  {
    "id": "rest-05",
    "group": "rest",
    "text": "쉬는 날엔 서두르지 않아도 돼요."
  },
  {
    "id": "rest-06",
    "group": "rest",
    "text": "숫자 없는 시간도 소중하니까요."
  },
  {
    "id": "rest-07",
    "group": "rest",
    "text": "쉬는 날의 속도로 천천히 둘러봐요."
  },
  {
    "id": "rest-08",
    "group": "rest",
    "text": "오늘은 관심 가는 이야기 하나만."
  },
  {
    "id": "rest-09",
    "group": "rest",
    "text": "잠깐 둘러보고, 다시 내 하루로."
  },
  {
    "id": "rest-10",
    "group": "rest",
    "text": "시장이 쉬는 동안 나만의 계획을."
  },
  {
    "id": "rest-11",
    "group": "rest",
    "text": "지난 기록은 여유 있을 때 꺼내봐요."
  },
  {
    "id": "rest-12",
    "group": "rest",
    "text": "화면 밖에도 좋은 시간이 기다려요."
  },
  {
    "id": "pre-01",
    "group": "pre",
    "text": "시작 전에, 알아둘 소식부터."
  },
  {
    "id": "pre-02",
    "group": "pre",
    "text": "장이 열리기 전 잠깐의 정리."
  },
  {
    "id": "pre-03",
    "group": "pre",
    "text": "오늘 확인할 것 하나만 골라봐요."
  },
  {
    "id": "pre-04",
    "group": "pre",
    "text": "개장 전에는 지난 소식부터."
  },
  {
    "id": "pre-05",
    "group": "pre",
    "text": "서두르기 전에 기준부터 살펴봐요."
  },
  {
    "id": "pre-06",
    "group": "pre",
    "text": "어떤 회사의 소식이 궁금하세요?"
  },
  {
    "id": "pre-07",
    "group": "pre",
    "text": "거래가 시작되기 전 배경을 읽어요."
  },
  {
    "id": "pre-08",
    "group": "pre",
    "text": "새 소식과 내 생각을 나눠봐요."
  },
  {
    "id": "pre-09",
    "group": "pre",
    "text": "오늘의 일정도 함께 확인해요."
  },
  {
    "id": "pre-10",
    "group": "pre",
    "text": "준비는 작은 확인에서 시작돼요."
  },
  {
    "id": "pre-11",
    "group": "pre",
    "text": "가격이 움직이기 전, 회사 이야기."
  },
  {
    "id": "pre-12",
    "group": "pre",
    "text": "장이 열리기까지 차분히 살펴봐요."
  },
  {
    "id": "live-01",
    "group": "live",
    "text": "오늘의 흐름, 차분히 살펴봐요."
  },
  {
    "id": "live-02",
    "group": "live",
    "text": "가격이 움직이는 배경을 읽어요."
  },
  {
    "id": "live-03",
    "group": "live",
    "text": "큰 숫자일수록 기준부터 확인해요."
  },
  {
    "id": "live-04",
    "group": "live",
    "text": "내 종목과 시장을 함께 살펴봐요."
  },
  {
    "id": "live-05",
    "group": "live",
    "text": "지금 보이는 숫자의 시간을 확인해요."
  },
  {
    "id": "live-06",
    "group": "live",
    "text": "변화와 그 이유를 나눠서 봐요."
  },
  {
    "id": "live-07",
    "group": "live",
    "text": "눈에 띈 움직임부터 하나씩."
  },
  {
    "id": "live-08",
    "group": "live",
    "text": "새로운 소식은 출처와 함께."
  },
  {
    "id": "live-09",
    "group": "live",
    "text": "오늘의 변화가 모두 같은 이유는 아니에요."
  },
  {
    "id": "live-10",
    "group": "live",
    "text": "차트의 방향과 회사의 이야기를 함께."
  },
  {
    "id": "live-11",
    "group": "live",
    "text": "잠깐의 움직임도 맥락이 필요해요."
  },
  {
    "id": "live-12",
    "group": "live",
    "text": "궁금한 변화를 차분히 따라가 봐요."
  },
  {
    "id": "closed-01",
    "group": "closed",
    "text": "지난 거래의 소식부터, 천천히."
  },
  {
    "id": "closed-02",
    "group": "closed",
    "text": "마감 뒤에는 하루를 넓게 봐요."
  },
  {
    "id": "closed-03",
    "group": "closed",
    "text": "오늘의 숫자를 기록으로 남겨봐요."
  },
  {
    "id": "closed-04",
    "group": "closed",
    "text": "마지막 가격 뒤의 이야기도 읽어요."
  },
  {
    "id": "closed-05",
    "group": "closed",
    "text": "하루의 흐름을 한 걸음 떨어져서."
  },
  {
    "id": "closed-06",
    "group": "closed",
    "text": "다음 거래 전에 지난 변화를 살펴요."
  },
  {
    "id": "closed-07",
    "group": "closed",
    "text": "어제의 예상과 실제는 어땠나요?"
  },
  {
    "id": "closed-08",
    "group": "closed",
    "text": "지나간 차트에 궁금증을 남겨봐요."
  },
  {
    "id": "closed-09",
    "group": "closed",
    "text": "거래가 끝난 뒤에도 회사는 움직여요."
  },
  {
    "id": "closed-10",
    "group": "closed",
    "text": "다음에 확인할 일을 하나만 적어봐요."
  },
  {
    "id": "closed-11",
    "group": "closed",
    "text": "마감 숫자와 새 소식을 구분해요."
  },
  {
    "id": "closed-12",
    "group": "closed",
    "text": "오늘의 기록이 다음의 기준이 돼요."
  },
  {
    "id": "spring-01",
    "group": "spring",
    "text": "봄의 한 페이지를 열어봐요."
  },
  {
    "id": "spring-02",
    "group": "spring",
    "text": "새 계절에도 내 속도대로."
  },
  {
    "id": "spring-03",
    "group": "spring",
    "text": "봄날의 계획에 작은 여유를."
  },
  {
    "id": "spring-04",
    "group": "spring",
    "text": "이번 봄, 새롭게 궁금한 회사는요?"
  },
  {
    "id": "spring-05",
    "group": "spring",
    "text": "오래 지켜본 종목도 다시 읽어봐요."
  },
  {
    "id": "spring-06",
    "group": "spring",
    "text": "봄의 시작처럼 가볍게 살펴요."
  },
  {
    "id": "spring-07",
    "group": "spring",
    "text": "새로운 관심사를 하나 발견해봐요."
  },
  {
    "id": "spring-08",
    "group": "spring",
    "text": "계절이 바뀌는 사이 생각도 정리해요."
  },
  {
    "id": "spring-09",
    "group": "spring",
    "text": "봄의 달력에 나만의 계획을."
  },
  {
    "id": "spring-10",
    "group": "spring",
    "text": "서두르지 않고 시작하는 봄."
  },
  {
    "id": "spring-11",
    "group": "spring",
    "text": "이번 계절의 관심사를 모아봐요."
  },
  {
    "id": "spring-12",
    "group": "spring",
    "text": "봄날의 잠깐, 궁금한 소식 하나."
  },
  {
    "id": "spring-13",
    "group": "spring",
    "text": "새 계획은 작은 질문에서."
  },
  {
    "id": "spring-14",
    "group": "spring",
    "text": "봄의 기록을 천천히 쌓아봐요."
  },
  {
    "id": "spring-15",
    "group": "spring",
    "text": "새 계절을 맞아 기준을 돌아봐요."
  },
  {
    "id": "summer-01",
    "group": "summer",
    "text": "여름의 하루에도 잠깐의 여유를."
  },
  {
    "id": "summer-02",
    "group": "summer",
    "text": "긴 여름날, 필요한 소식만 골라요."
  },
  {
    "id": "summer-03",
    "group": "summer",
    "text": "여름의 계획과 내 투자를 함께."
  },
  {
    "id": "summer-04",
    "group": "summer",
    "text": "이번 여름 관심 가는 회사는요?"
  },
  {
    "id": "summer-05",
    "group": "summer",
    "text": "화면을 잠시 내려놓는 시간도."
  },
  {
    "id": "summer-06",
    "group": "summer",
    "text": "여름의 한 페이지를 열어봐요."
  },
  {
    "id": "summer-07",
    "group": "summer",
    "text": "계절의 속도에 휩쓸리지 않고."
  },
  {
    "id": "summer-08",
    "group": "summer",
    "text": "오늘의 소식은 짧게 살펴봐도 돼요."
  },
  {
    "id": "summer-09",
    "group": "summer",
    "text": "여름의 기록을 차분히 남겨요."
  },
  {
    "id": "summer-10",
    "group": "summer",
    "text": "나만의 휴식도 일정에 넣어봐요."
  },
  {
    "id": "summer-11",
    "group": "summer",
    "text": "이번 계절에 달라진 생각은요?"
  },
  {
    "id": "summer-12",
    "group": "summer",
    "text": "여름의 하루를 내 속도로."
  },
  {
    "id": "summer-13",
    "group": "summer",
    "text": "멀리 가는 계획도 작은 확인부터."
  },
  {
    "id": "summer-14",
    "group": "summer",
    "text": "여름의 관심사를 하나씩 모아봐요."
  },
  {
    "id": "summer-15",
    "group": "summer",
    "text": "잠깐의 확인 뒤엔 다시 내 일상으로."
  },
  {
    "id": "autumn-01",
    "group": "autumn",
    "text": "가을의 한 페이지를 열어봐요."
  },
  {
    "id": "autumn-02",
    "group": "autumn",
    "text": "쌓인 기록을 꺼내 보기 좋은 계절."
  },
  {
    "id": "autumn-03",
    "group": "autumn",
    "text": "가을에는 긴 이야기 하나를 천천히."
  },
  {
    "id": "autumn-04",
    "group": "autumn",
    "text": "올해 처음의 생각을 돌아봐요."
  },
  {
    "id": "autumn-05",
    "group": "autumn",
    "text": "가을의 계획에도 여유를 남겨요."
  },
  {
    "id": "autumn-06",
    "group": "autumn",
    "text": "이번 가을 궁금해진 회사는요?"
  },
  {
    "id": "autumn-07",
    "group": "autumn",
    "text": "시간이 지나 달라진 기준도 살펴요."
  },
  {
    "id": "autumn-08",
    "group": "autumn",
    "text": "읽어둔 이야기를 다시 이어봐요."
  },
  {
    "id": "autumn-09",
    "group": "autumn",
    "text": "가을의 하루를 차분히 시작해요."
  },
  {
    "id": "autumn-10",
    "group": "autumn",
    "text": "한 해의 흐름을 조금 넓게 봐요."
  },
  {
    "id": "autumn-11",
    "group": "autumn",
    "text": "이번 계절의 관심사를 정리해봐요."
  },
  {
    "id": "autumn-12",
    "group": "autumn",
    "text": "익숙한 숫자에서 새 질문을 찾아요."
  },
  {
    "id": "autumn-13",
    "group": "autumn",
    "text": "가을의 기록을 한 줄씩."
  },
  {
    "id": "autumn-14",
    "group": "autumn",
    "text": "조금 멀리서 내 투자를 돌아봐요."
  },
  {
    "id": "autumn-15",
    "group": "autumn",
    "text": "이어 읽고 싶었던 이야기가 있나요?"
  },
  {
    "id": "winter-01",
    "group": "winter",
    "text": "겨울의 한 페이지를 열어봐요."
  },
  {
    "id": "winter-02",
    "group": "winter",
    "text": "겨울의 하루에도 나만의 속도로."
  },
  {
    "id": "winter-03",
    "group": "winter",
    "text": "오래 지켜본 기록을 돌아봐요."
  },
  {
    "id": "winter-04",
    "group": "winter",
    "text": "이번 겨울 궁금한 이야기는요?"
  },
  {
    "id": "winter-05",
    "group": "winter",
    "text": "계절이 바뀌어도 기준은 차분히."
  },
  {
    "id": "winter-06",
    "group": "winter",
    "text": "겨울의 계획에 작은 여백을."
  },
  {
    "id": "winter-07",
    "group": "winter",
    "text": "길게 생각할 시간도 남겨둬요."
  },
  {
    "id": "winter-08",
    "group": "winter",
    "text": "지나온 선택을 천천히 읽어봐요."
  },
  {
    "id": "winter-09",
    "group": "winter",
    "text": "겨울의 관심사를 하나씩 모아봐요."
  },
  {
    "id": "winter-10",
    "group": "winter",
    "text": "잠깐의 확인으로 시작해도 괜찮아요."
  },
  {
    "id": "winter-11",
    "group": "winter",
    "text": "이번 계절에는 무엇을 알아볼까요?"
  },
  {
    "id": "winter-12",
    "group": "winter",
    "text": "쌓인 질문을 하나씩 풀어봐요."
  },
  {
    "id": "winter-13",
    "group": "winter",
    "text": "겨울의 기록도 차근차근."
  },
  {
    "id": "winter-14",
    "group": "winter",
    "text": "긴 계획을 짧은 질문으로 나눠봐요."
  },
  {
    "id": "winter-15",
    "group": "winter",
    "text": "오늘 알아둔 이야기를 내일의 기준으로."
  },
  {
    "id": "morning-01",
    "group": "morning",
    "text": "아침에는 필요한 소식부터."
  },
  {
    "id": "morning-02",
    "group": "morning",
    "text": "하루를 시작하는 작은 확인."
  },
  {
    "id": "morning-03",
    "group": "morning",
    "text": "오늘의 계획 옆에 관심 종목 하나."
  },
  {
    "id": "morning-04",
    "group": "morning",
    "text": "아침의 잠깐을 차분하게."
  },
  {
    "id": "morning-05",
    "group": "morning",
    "text": "첫 소식부터 천천히 읽어봐요."
  },
  {
    "id": "morning-06",
    "group": "morning",
    "text": "오늘 무엇을 확인할지 골라봐요."
  },
  {
    "id": "morning-07",
    "group": "morning",
    "text": "하루의 첫 질문을 열어봐요."
  },
  {
    "id": "morning-08",
    "group": "morning",
    "text": "아침에 읽어둘 회사 이야기."
  },
  {
    "id": "morning-09",
    "group": "morning",
    "text": "새 하루에도 내 기준대로."
  },
  {
    "id": "morning-10",
    "group": "morning",
    "text": "바쁜 시작이라면 짧게 둘러봐요."
  },
  {
    "id": "afternoon-01",
    "group": "afternoon",
    "text": "하루 중간, 잠깐의 확인."
  },
  {
    "id": "afternoon-02",
    "group": "afternoon",
    "text": "오후에는 궁금한 소식 하나만."
  },
  {
    "id": "afternoon-03",
    "group": "afternoon",
    "text": "내 하루의 속도로 살펴봐요."
  },
  {
    "id": "afternoon-04",
    "group": "afternoon",
    "text": "짧은 틈에도 맥락을 읽어봐요."
  },
  {
    "id": "afternoon-05",
    "group": "afternoon",
    "text": "오후의 관심사를 이어서 봐요."
  },
  {
    "id": "afternoon-06",
    "group": "afternoon",
    "text": "오늘 남은 시간도 내 몫으로."
  },
  {
    "id": "afternoon-07",
    "group": "afternoon",
    "text": "하루 중간에 생각을 정리해요."
  },
  {
    "id": "afternoon-08",
    "group": "afternoon",
    "text": "잠깐 들러 필요한 것만 확인해요."
  },
  {
    "id": "afternoon-09",
    "group": "afternoon",
    "text": "숫자를 본 뒤에는 내 일상으로."
  },
  {
    "id": "afternoon-10",
    "group": "afternoon",
    "text": "오후의 작은 궁금증을 풀어봐요."
  },
  {
    "id": "evening-01",
    "group": "evening",
    "text": "저녁의 여유만큼 천천히."
  },
  {
    "id": "evening-02",
    "group": "evening",
    "text": "하루 끝에 궁금했던 이야기 하나."
  },
  {
    "id": "evening-03",
    "group": "evening",
    "text": "오늘 남은 시간은 나를 위해."
  },
  {
    "id": "evening-04",
    "group": "evening",
    "text": "저녁에는 필요한 소식부터 골라요."
  },
  {
    "id": "evening-05",
    "group": "evening",
    "text": "내 하루와 시장의 하루를 나눠봐요."
  },
  {
    "id": "evening-06",
    "group": "evening",
    "text": "잠깐 확인하고 편안한 저녁으로."
  },
  {
    "id": "evening-07",
    "group": "evening",
    "text": "오늘의 질문을 차분히 풀어봐요."
  },
  {
    "id": "evening-08",
    "group": "evening",
    "text": "저녁의 한 페이지를 열어봐요."
  },
  {
    "id": "evening-09",
    "group": "evening",
    "text": "하루 동안 달라진 내용을 살펴요."
  },
  {
    "id": "evening-10",
    "group": "evening",
    "text": "오래 읽지 않아도 괜찮아요."
  },
  {
    "id": "night-01",
    "group": "night",
    "text": "늦은 시간에는 필요한 만큼만."
  },
  {
    "id": "night-02",
    "group": "night",
    "text": "밤의 속도로 천천히 읽어요."
  },
  {
    "id": "night-03",
    "group": "night",
    "text": "남은 이야기는 다음에 이어도 돼요."
  },
  {
    "id": "night-04",
    "group": "night",
    "text": "내일 다시 읽을 여백을 남겨요."
  },
  {
    "id": "night-05",
    "group": "night",
    "text": "밤에도 숫자의 기준 시각을 함께."
  },
  {
    "id": "night-06",
    "group": "night",
    "text": "잠깐 확인하고 내 시간으로."
  },
  {
    "id": "night-07",
    "group": "night",
    "text": "지금 궁금한 질문 하나만."
  },
  {
    "id": "night-08",
    "group": "night",
    "text": "밤의 한 페이지를 조용히 열어요."
  },
  {
    "id": "night-09",
    "group": "night",
    "text": "한 번에 결론 내리지 않아도 돼요."
  },
  {
    "id": "night-10",
    "group": "night",
    "text": "긴 이야기라면 나눠 읽어봐요."
  },
  {
    "id": "clear-01",
    "group": "clear",
    "text": "맑은 예보가 반가운 날이네요."
  },
  {
    "id": "clear-02",
    "group": "clear",
    "text": "맑은 하늘 예보, 화면 밖도 살펴봐요."
  },
  {
    "id": "clear-03",
    "group": "clear",
    "text": "오늘 일정에 바깥의 시간도."
  },
  {
    "id": "clear-04",
    "group": "clear",
    "text": "맑은 날의 계획에 작은 여유를."
  },
  {
    "id": "clear-05",
    "group": "clear",
    "text": "예보는 맑음, 내 하루는 내 속도로."
  },
  {
    "id": "cloud-01",
    "group": "cloud",
    "text": "구름 많은 예보, 오늘도 내 속도로."
  },
  {
    "id": "cloud-02",
    "group": "cloud",
    "text": "흐린 하늘 예보에도 내 시간은 소중해요."
  },
  {
    "id": "cloud-03",
    "group": "cloud",
    "text": "구름 낀 날엔 차분한 이야기 하나."
  },
  {
    "id": "cloud-04",
    "group": "cloud",
    "text": "하늘은 흐려도 계획은 천천히."
  },
  {
    "id": "cloud-05",
    "group": "cloud",
    "text": "흐린 날의 여백도 챙겨봐요."
  },
  {
    "id": "rain-01",
    "group": "rain",
    "text": "비 예보가 있어요. 우산도 챙겨요."
  },
  {
    "id": "rain-02",
    "group": "rain",
    "text": "오늘의 준비물에 우산 하나."
  },
  {
    "id": "rain-03",
    "group": "rain",
    "text": "비 오는 시간대, 이동은 여유 있게."
  },
  {
    "id": "rain-04",
    "group": "rain",
    "text": "비 예보가 있는 날엔 일정을 느긋하게."
  },
  {
    "id": "rain-05",
    "group": "rain",
    "text": "창밖의 예보도 잠깐 확인해봐요."
  },
  {
    "id": "snow-01",
    "group": "snow",
    "text": "눈 예보가 있어요. 걸음은 천천히."
  },
  {
    "id": "snow-02",
    "group": "snow",
    "text": "눈 오는 시간대에는 이동에 여유를."
  },
  {
    "id": "snow-03",
    "group": "snow",
    "text": "오늘은 예보와 길 상태도 함께."
  },
  {
    "id": "snow-04",
    "group": "snow",
    "text": "눈 예보가 있는 날, 약속은 여유 있게."
  },
  {
    "id": "snow-05",
    "group": "snow",
    "text": "하얀 예보가 있는 날엔 발걸음을 조심히."
  },
  {
    "id": "hot-01",
    "group": "hot",
    "text": "기온이 높은 시간대예요. 물도 챙겨요."
  },
  {
    "id": "hot-02",
    "group": "hot",
    "text": "더운 예보에는 시원한 쉼표 하나."
  },
  {
    "id": "hot-03",
    "group": "hot",
    "text": "오늘 일정에 더위를 피할 여유를."
  },
  {
    "id": "hot-04",
    "group": "hot",
    "text": "높은 기온 예보, 몸부터 챙겨요."
  },
  {
    "id": "hot-05",
    "group": "hot",
    "text": "더운 날에는 화면에서도 잠깐 쉬어가요."
  },
  {
    "id": "cold-01",
    "group": "cold",
    "text": "기온이 낮은 시간대예요. 따뜻하게 챙겨요."
  },
  {
    "id": "cold-02",
    "group": "cold",
    "text": "추운 예보에는 따뜻한 쉼표 하나."
  },
  {
    "id": "cold-03",
    "group": "cold",
    "text": "오늘은 바깥 기온도 살펴봐요."
  },
  {
    "id": "cold-04",
    "group": "cold",
    "text": "낮은 기온 예보, 외출 준비는 든든히."
  },
  {
    "id": "cold-05",
    "group": "cold",
    "text": "추운 날의 일정에는 작은 여유를."
  },
  {
    "id": "mild-01",
    "group": "mild",
    "text": "온화한 기온 예보가 있는 날이에요."
  },
  {
    "id": "mild-02",
    "group": "mild",
    "text": "잠깐 바깥을 살펴볼 여유도."
  },
  {
    "id": "mild-03",
    "group": "mild",
    "text": "온화한 예보, 내 하루의 계획도 챙겨요."
  },
  {
    "id": "mild-04",
    "group": "mild",
    "text": "기온이 편안한 시간대, 잠깐의 쉼표."
  },
  {
    "id": "mild-05",
    "group": "mild",
    "text": "오늘 일정에 내 시간을 남겨봐요."
  },
  {
    "id": "wind-01",
    "group": "wind",
    "text": "바람이 강한 예보예요. 외출 전 확인해요."
  },
  {
    "id": "wind-02",
    "group": "wind",
    "text": "바람 부는 시간대엔 이동을 여유 있게."
  },
  {
    "id": "wind-03",
    "group": "wind",
    "text": "오늘은 바람 예보도 챙겨봐요."
  },
  {
    "id": "wind-04",
    "group": "wind",
    "text": "강한 바람 예보, 바깥 일정도 살펴요."
  },
  {
    "id": "wind-05",
    "group": "wind",
    "text": "바람 많은 날의 걸음은 천천히."
  }
];
