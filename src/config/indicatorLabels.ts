/**
 * 기술 지표 한국어 번역 — 초보자 친화
 * 전문 용어 → 쉬운 설명
 */

export const INDICATOR_LABELS: Record<string, { name: string; simple: string; desc: string }> = {
  // 이동평균
  'SMA': { name: '이동평균선', simple: '평균 가격 흐름', desc: '최근 N일간 평균 가격을 이은 선이에요' },
  'SMA20': { name: '20일 이동평균', simple: '20일 평균 흐름', desc: '최근 20일간 평균 가격이에요' },
  'SMA60': { name: '60일 이동평균', simple: '60일 평균 흐름', desc: '최근 60일간 평균 가격이에요' },
  'golden-cross': { name: '골든크로스', simple: '상승 전환 신호', desc: '단기 평균이 장기 평균을 위로 넘었어요' },
  'death-cross': { name: '데드크로스', simple: '하락 전환 신호', desc: '단기 평균이 장기 평균을 아래로 내려갔어요' },

  // RSI
  'RSI': { name: 'RSI', simple: '과열/침체 지수', desc: '0~100 사이 값으로, 70 이상이면 과열, 30 이하면 침체 구간이에요' },
  'RSI-oversold': { name: 'RSI 과매도', simple: '많이 떨어진 구간', desc: '가격이 많이 떨어져서 반등 가능성이 있는 구간이에요' },
  'RSI-overbought': { name: 'RSI 과매수', simple: '많이 오른 구간', desc: '가격이 많이 올라서 조정 가능성이 있는 구간이에요' },

  // MACD
  'MACD': { name: 'MACD', simple: '추세 전환 지표', desc: '가격 흐름의 방향이 바뀌는지 알려주는 지표예요' },
  'MACD-bull': { name: 'MACD 상승 전환', simple: '위로 방향 전환', desc: '가격 흐름이 위쪽으로 바뀌고 있어요' },
  'MACD-bear': { name: 'MACD 하락 전환', simple: '아래로 방향 전환', desc: '가격 흐름이 아래쪽으로 바뀌고 있어요' },

  // 볼린저밴드
  'Bollinger': { name: '볼린저밴드', simple: '가격 범위 표시', desc: '가격이 보통 움직이는 범위를 보여주는 밴드예요' },
  'BB-lower': { name: '볼린저 하단', simple: '가격이 범위 아래로', desc: '평소보다 많이 떨어진 상태예요' },
  'BB-upper': { name: '볼린저 상단', simple: '가격이 범위 위로', desc: '평소보다 많이 오른 상태예요' },

  // 거래량
  'volume': { name: '거래량', simple: '거래 활발도', desc: '얼마나 많이 사고팔았는지 보여줘요' },

  // PER/PBR
  'PER': { name: 'PER', simple: '주가수익비율', desc: '주가가 1년 순이익의 몇 배인지. 낮을수록 상대적으로 저평가' },
  'EPS': { name: 'EPS', simple: '주당순이익', desc: '주식 1주당 벌어들이는 순이익이에요' },
};

/**
 * 기술 지표 이름을 쉬운 한국어로 변환
 */
export function simpleLabel(key: string): string {
  return INDICATOR_LABELS[key]?.simple || key;
}
