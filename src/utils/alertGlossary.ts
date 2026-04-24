/**
 * 알림에 등장하는 기술 용어 / 개념 사전
 * - UI 툴팁(?) 버튼 클릭 시 노출
 * - alertId에서 타입을 추출해 해당 설명을 찾음
 */

interface GlossaryEntry {
  term: string;
  oneLine: string;    // 한 줄 요약
  detail: string;     // 2~3문장 설명 (초보자 눈높이)
}

const GLOSSARY: Record<string, GlossaryEntry> = {
  'rsi-oversold': {
    term: 'RSI 과매도',
    oneLine: '가격이 너무 많이 떨어져 반등 가능성이 있는 구간',
    detail: 'RSI는 최근 상승/하락 강도를 0~100으로 나타낸 지표예요. 30 아래면 "과매도"로, 단기 반등 가능성이 있다고 봐요. 단, 하락 추세가 강하면 오래 머무르기도 해요.',
  },
  'rsi-overbought': {
    term: 'RSI 과매수',
    oneLine: '가격이 너무 많이 올라 조정 가능성이 있는 구간',
    detail: 'RSI 70 이상이면 "과매수"로, 단기 조정 가능성이 있다고 봐요. 상승 모멘텀이 강하면 과매수 상태가 유지될 수도 있으니 하나의 신호로만 참고하세요.',
  },
  'golden-cross': {
    term: '골든 크로스',
    oneLine: '단기 이동평균이 장기를 상향 돌파 — 긍정적 전환 신호',
    detail: '짧은 기간(50일선) 평균이 긴 기간(200일선) 평균을 뚫고 올라선 상태예요. 전통적으로 상승 추세 전환 신호로 해석되지만, 지연 지표라서 이미 많이 오른 뒤에 나오기도 해요.',
  },
  'death-cross': {
    term: '데드 크로스',
    oneLine: '단기 이동평균이 장기를 하향 돌파 — 주의 신호',
    detail: '50일선이 200일선을 뚫고 내려간 상태예요. 하락 추세 전환 신호로 보지만, 이미 많이 빠진 뒤 나오는 경우가 많아요. 손절선을 점검할 타이밍이에요.',
  },
  'bb-lower': {
    term: '볼린저밴드 하단',
    oneLine: '통계적 과매도 영역 — 단기 반등 기대',
    detail: '20일 평균 ± 표준편차 × 2로 만든 밴드의 하단에 닿았어요. 가격이 최근 변동성 대비 낮은 쪽 극단에 와있다는 뜻. 강한 하락 추세에선 밴드를 타고 내려가기도 해요.',
  },
  'bb-upper': {
    term: '볼린저밴드 상단',
    oneLine: '통계적 과매수 영역 — 조정 가능성',
    detail: '가격이 최근 변동성 대비 높은 쪽 극단에 와있어요. 단기 조정이 흔하지만, 강한 상승장에선 밴드를 타고 계속 오르기도 해요.',
  },
  'macd-bull': {
    term: 'MACD 상승 전환',
    oneLine: '모멘텀이 상승으로 돌아섬',
    detail: 'MACD 선이 시그널선을 상향 돌파한 상태예요. 추세의 방향 전환 초기 신호로 자주 쓰여요.',
  },
  'macd-bear': {
    term: 'MACD 하락 전환',
    oneLine: '모멘텀이 하락으로 돌아섬',
    detail: 'MACD 선이 시그널선을 하향 돌파했어요. 상승세가 약해지는 초기 신호일 수 있어요.',
  },
  'near-52w-high': {
    term: '52주 고점 근접',
    oneLine: '1년 중 최고가 근처',
    detail: '52주(약 1년) 동안의 최고가에 가까운 상태예요. 돌파하면 추가 상승 추세가 될 수도, 저항선이 될 수도 있어요.',
  },
  'near-52w-low': {
    term: '52주 저점 근접',
    oneLine: '1년 중 최저가 근처',
    detail: '52주 최저가에 가까운 상태예요. 가치 매수 관점에서 관심 가질 만하지만, 추세가 더 내려갈 수 있으니 기업 펀더멘털을 꼭 확인하세요.',
  },
  'stoploss-hit': {
    term: '손절가 도달',
    oneLine: '미리 설정한 손절 가격에 도달',
    detail: '"더 이상 내려가면 팔겠다"고 정한 가격에 닿았어요. 원칙대로 매도할지, 재판단할지는 본인의 전략에 달려있어요. 감정보다 원칙이 중요해요.',
  },
  'stoploss-near': {
    term: '손절가 근접',
    oneLine: '손절 기준까지 얼마 안 남음',
    detail: '손절 기준과 가까워진 상태예요. 추가 하락 시 실행할지, 기준을 조정할지 미리 판단해두는 게 좋아요.',
  },
  'target-hit': {
    term: '목표 수익 달성',
    oneLine: '설정한 목표 수익률/목표가에 도달',
    detail: '처음 정한 목표에 도달했어요. 일부 매도(익절)하거나 목표를 상향할 시점이에요. 목표 없이 계속 보유하면 모멘텀 바뀔 때 수익이 녹을 수 있어요.',
  },
  'target-near': {
    term: '목표 수익 근접',
    oneLine: '목표에 거의 도달',
    detail: '90% 이상 도달했어요. 분할 매도 계획을 세우기 좋은 타이밍이에요.',
  },
  'below-avgcost': {
    term: '평단 하회',
    oneLine: '현재가가 평균 매수가 아래로 내려감',
    detail: '수익 상태에서 손실 상태로 전환됐어요. 추세 전환인지 단기 조정인지 구분이 중요해요. 손절가가 설정돼있지 않다면 지금 정하는 걸 추천해요.',
  },
  'buy-zone': {
    term: '관심 매수가 도달',
    oneLine: '관심종목이 원하던 가격에 진입',
    detail: '관심종목에 설정한 매수가 이하로 내려왔어요. 매수 시나리오를 검토할 타이밍이지만, 해당 가격대가 된 이유(뉴스/실적)를 먼저 확인하세요.',
  },
  'daily-surge': {
    term: '급등',
    oneLine: '하루 동안 큰 폭으로 상승',
    detail: '일일 등락률이 +5% 이상이에요. 뉴스/실적/단순 반등 등 원인이 다양해요. 추격 매수 전에 원인과 지속 가능성을 확인하세요.',
  },
  'daily-plunge': {
    term: '급락',
    oneLine: '하루 동안 큰 폭으로 하락',
    detail: '일일 등락률이 -5% 이상이에요. 뉴스/실적 악재, 시장 전반 하락 등 다양한 원인이 있어요. 감정적 매도 전에 이유를 확인하는 게 중요해요.',
  },
  'composite-strong-uptrend': {
    term: '강한 상승 추세',
    oneLine: '여러 지표가 동시에 강세 신호',
    detail: 'MACD, RSI, 이동평균 등 여러 기술 지표가 동시에 상승 추세를 가리켜요. 추세 추종 관점에서 주목할 만한 신호예요.',
  },
  'composite-strong-downtrend': {
    term: '강한 하락 추세',
    oneLine: '여러 지표가 동시에 약세 신호',
    detail: '여러 지표가 동시에 하락을 가리키는 상태. 단순 조정보다 구조적 약세일 가능성이 있어요. 손절 기준 점검 필요.',
  },
  'composite-strong-bounce': {
    term: '강한 반등 신호',
    oneLine: '과매도 + 추세 전환 조짐',
    detail: '과매도 구간에서 여러 지표가 반등을 가리켜요. 단기 상승 가능성이 있지만, 큰 하락 추세에선 일시적 반등으로 끝나기도 해요.',
  },
  'composite-overheated': {
    term: '과열 주의',
    oneLine: '여러 지표가 동시에 과매수',
    detail: 'RSI, BB 상단, 거래량 급증 등이 겹친 상태. 단기 조정 위험이 높아요. 일부 익절을 고려할 타이밍.',
  },
  'composite-squeeze': {
    term: '볼린저 스퀴즈',
    oneLine: '변동성 극저 — 큰 움직임 임박',
    detail: '볼린저 밴드 폭이 매우 좁아진 상태예요. 큰 변동성이 임박했다는 신호로 쓰이지만, 방향(상승/하락)은 알려주지 않아요.',
  },
  'target-return': {
    term: '목표 수익률 달성',
    oneLine: '설정한 % 목표 달성',
    detail: '수익률 기준 목표에 도달했어요. 분할 매도로 이익을 확정하는 게 원칙이에요.',
  },
  'target-profit-usd': {
    term: '목표 수익금 ($) 달성',
    oneLine: '설정한 달러 금액 목표 달성',
    detail: '미리 정한 달러 기준 이익이 실현됐어요. 익절 기준이 명확할 때 강력한 매도 신호예요.',
  },
  'target-profit-krw': {
    term: '목표 수익금 (₩) 달성',
    oneLine: '설정한 원화 금액 목표 달성',
    detail: '환율 포함 원화 기준 목표가 달성됐어요. 한국 투자자에게 더 체감되는 지표예요.',
  },
  'stoploss-pct': {
    term: '손절률 도달',
    oneLine: '설정한 손실 % 도달',
    detail: '정한 손실 비율에 도달했어요. 원칙대로 대응할지 재판단할지는 현재 상황/뉴스를 함께 보고 결정하세요.',
  },
  'portfolio-down': {
    term: '포트폴리오 전체 하락',
    oneLine: '포트폴리오 총액이 크게 하락',
    detail: '개별 종목이 아닌 포트폴리오 전체가 크게 내려간 상태예요. 시장 전반 요인일 가능성이 높아요. 감정 대응 금지.',
  },
};

/**
 * alertId에서 type 추출
 * 예: "AAPL-risk-rsi-oversold-30" → "rsi-oversold"
 */
function extractType(alertId: string): string | null {
  const parts = alertId.split('-');
  if (parts.length < 3) return null;
  const core = parts.slice(2);
  const last = core[core.length - 1];
  if (/^\d+$/.test(last)) core.pop();
  return core.join('-');
}

export function getAlertExplanation(alertId: string): GlossaryEntry | null {
  const type = extractType(alertId);
  if (!type) return null;
  return GLOSSARY[type] || null;
}
