/**
 * 초보자용 차트 해설 SSOT — "이 차트, 지금 이런 상태예요".
 *
 * 타겟=주식 초보(어머니·어른·입문자). 주식 '비서'답게 "이게 뭔지 → 지금 어떤 뜻인지"를 비유로 쉽게 끝까지 풀어준다.
 *
 * §6 안전 불변식(자본시장법 — 매매 방향 0):
 * - 개념 설명·현재 상태 풀이는 자유(서술).
 * - '사세요/파세요', 개별 종목 한쪽 예측('오를/내릴 거예요')은 금지.
 * - 앞일 언급은 반드시 '양쪽 다 + 아무도 모름 + 참고용'으로 균형(예측·처방 아님).
 * src/__tests__/chartNarrative.test.ts 가 금지 토큰을 박제.
 */

export interface NarrativeCard {
  emoji: string;
  term: string;       // GlossaryTooltip 용어(있으면)
  whatIsIt: string;   // 이게 뭔지(비유)
  nowMeans: string;   // 지금 어떤 뜻인지(현재 상태, §6 안전)
}

export interface ChartNarrative {
  summary: string;            // 항상 노출 — "이 차트는 현재 이렇습니다"
  cards: NarrativeCard[];     // 펼침 — 용어 쉽게 풀어보기
}

export type BollingerPos = 'upper' | 'lower' | 'middle';

export interface NarrativeInput {
  rsiVal: number | null;
  bollingerPos: BollingerPos | null;   // 데이터 부족이면 null
  price: number;
  sma20: number | null;
  sma60: number | null;
  volRatio: number;
  level: 'basic' | 'detail';           // basic 차트엔 볼린저 띠 미렌더 → 볼린저 설명 생략(화면-설명 일치)
}

export function buildChartNarrative(i: NarrativeInput): ChartNarrative {
  const rsiHot = i.rsiVal != null && i.rsiVal > 70;
  const rsiCold = i.rsiVal != null && i.rsiVal < 30;

  // ── 항상 노출 요약: 지금 상태를 평이하게 + 앞일은 균형/참고용 ──
  const rsiWord = rsiHot ? '최근 빠르게 올라 단기적으로 조금 뜨거운 편'
    : rsiCold ? '최근 많이 내려 단기적으로 조금 차가운 편'
    : '최근 흐름은 무난한 편';
  // 볼린저 띠는 상세 차트에서만 보이므로, 띠 위치 언급도 detail일 때만(화면-설명 일치)
  const showBollinger = i.level === 'detail' && i.bollingerPos != null;
  const bWord = showBollinger && i.bollingerPos === 'upper' ? ' 가격도 평소 오가던 범위의 위쪽에 있어요.'
    : showBollinger && i.bollingerPos === 'lower' ? ' 가격은 평소 오가던 범위의 아래쪽에 있어요.'
    : showBollinger && i.bollingerPos === 'middle' ? ' 가격은 평소 범위 안에서 움직이고 있어요.'
    : '';
  const summary = `지금 이 종목은 ${rsiWord}이에요.${bWord} 앞으로 위로 갈지 아래로 갈지는 아무도 알 수 없으니, 차트는 '참고용'으로만 봐주세요.`;

  const cards: NarrativeCard[] = [];

  if (i.rsiVal != null) {
    cards.push({
      emoji: '🌡️', term: 'RSI',
      whatIsIt: '최근 주가가 얼마나 빠르게 올랐는지·내렸는지를 0~100으로 보여주는 온도계 같은 거예요. 70을 넘으면 "단기간에 많이 올랐다", 30 아래면 "많이 내렸다"고 읽어요.',
      nowMeans: `지금은 ${i.rsiVal.toFixed(0)} 정도예요. ${rsiHot ? '최근 많이 오른 편이에요' : rsiCold ? '최근 많이 내린 편이에요' : '중간 정도예요'}. 많이 올랐다고 꼭 떨어지는 것도, 많이 내렸다고 꼭 오르는 것도 아니에요. "요즘 좀 뜨겁구나/차갑구나" 정도로만 참고하세요.`,
    });
  }

  if (showBollinger) {
    cards.push({
      emoji: '🎈', term: '볼린저밴드',
      whatIsIt: '주가가 평소 오르내리던 "평소 범위"를 띠처럼 그린 거예요. 가운데면 평소처럼 움직이는 거고, 위쪽 띠에 닿으면 평소보다 빠르게 오른, 아래쪽이면 빠르게 내린 거예요.',
      nowMeans: `지금은 ${i.bollingerPos === 'upper' ? '띠의 위쪽에 가까워요' : i.bollingerPos === 'lower' ? '띠의 아래쪽에 가까워요' : '띠 가운데에 있어요'}. 이럴 땐 잠깐 쉬어가기도 하고 가던 대로 더 가기도 해서, 어느 쪽일지는 아무도 몰라요.`,
    });
  }

  if (i.sma20 != null || i.sma60 != null) {
    const parts: string[] = [];
    if (i.sma20 != null) parts.push(`20일 평균보다 ${i.price >= i.sma20 ? '위' : '아래'}`);
    if (i.sma60 != null) parts.push(`60일 평균보다 ${i.price >= i.sma60 ? '위' : '아래'}`);
    cards.push({
      emoji: '〽️', term: '이동평균선',
      whatIsIt: '최근 며칠간의 평균 가격을 이어 그린 선이에요(20일선·60일선). 들쭉날쭉한 주가를 부드럽게 펴서 큰 흐름을 보기 쉽게 해줘요.',
      nowMeans: `지금 현재가는 ${parts.join(', ')}에 있어요. 평균선보다 위에 있다고 꼭 더 오르는 건 아니에요 — 흐름을 가늠하는 참고선이에요.`,
    });
  }

  cards.push({
    emoji: '🧱', term: '지지선·저항선',
    whatIsIt: '과거에 가격이 자주 멈추거나 튕겼던 "눈에 익은 가격대"예요. 아래쪽에서 자주 멈췄으면 지지선(받쳐주는 자리), 위쪽에서 자주 막혔으면 저항선(가로막는 자리)이라고 불러요.',
    nowMeans: '꼭 거기서 멈춘다는 보장은 없어요 — 과거에 그랬다는 "참고 자리"일 뿐이에요.',
  });

  cards.push({
    emoji: '🕯️', term: '캔들(봉)',
    whatIsIt: '막대 하나가 하루를 보여줘요. 그날 시작·끝 가격을 몸통으로, 하루 중 최고·최저를 위아래 꼬리로 그려요. 빨강은 오른 날, 파랑은 내린 날이에요(한국 기준).',
    nowMeans: '막대가 길수록 그날 가격이 크게 움직였다는 뜻이에요.',
  });

  cards.push({
    emoji: '📦', term: '거래량',
    whatIsIt: '차트 맨 아래 막대는 그날 주식이 얼마나 많이 사고팔렸는지예요. 막대가 크면 그날 관심이 많았다는 뜻이에요.',
    nowMeans: i.volRatio > 1.5 ? '최근 거래가 평소보다 활발한 편이에요.'
      : i.volRatio < 0.6 ? '최근 거래는 평소보다 조용한 편이에요.'
      : '최근 거래량은 평소와 비슷한 편이에요.',
  });

  return { summary, cards };
}
