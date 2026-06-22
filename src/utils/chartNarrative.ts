/**
 * 초보자용 차트 해설 SSOT — "이 차트, 지금 이런 상태예요".
 *
 * 타겟=주식 초보(어머니·어른·입문자). 주식 '비서'답게 "이게 뭔지 → 지금 어떤 뜻인지"를 비유로 쉽게 끝까지 풀어준다.
 *
 * §6 안전 불변식(자본시장법 — 매매 방향 0):
 * - 개념 설명·현재 상태 풀이는 자유(서술).
 * - '사세요/파세요', 개별 종목 한쪽 예측('오를/내릴 거예요')은 금지.
 * src/__tests__/chartNarrative.test.ts 가 금지 토큰을 박제.
 *
 * 요약(summary) = '여정 + 다음 안내'(2026-06-22 R5, 파운더 결정). 차트 기술상태 받아쓰기(평균선/RSI)
 * 대신, 비서답게 (1)이 종목이 어떤 종목인지(이 기간 저점~고점 여정 + 변동성 성격 + 지금 위치)를
 * 사람 말로, (2)더 알 곳(아래 관련 뉴스)을 짚어준다. 전부 현재상태 서술 + 정보 안내(§6 안전).
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
  recentHigh: number;                  // 표시 구간 고점/저점 — '지금 어디쯤인지' 구체 서술용
  recentLow: number;
  sma20: number | null;
  sma60: number | null;
  volRatio: number;
  level: 'basic' | 'detail';           // basic 차트엔 볼린저 띠 미렌더 → 볼린저 설명 생략(화면-설명 일치)
  // ── 여정 요약 입력(optional) — AnalysisPanel이 전달 ──
  periodLabel?: string;                // '최근 석 달' 등 (chartRange 종속 — 여정 기간 표기)
  hasNews?: boolean;                   // 패널 내 '관련 뉴스'가 있으면 → 안내 한 줄 부착
}

// (high-low)/low ≥ 80% → '오르내림이 큰' 성격 부착 (THRESHOLDS.md #56)
const RANGE_WIDE_PCT = 80;

/** 숫자 포맷 — 1000↑ 천단위, 100↑ 정수, 그 외 소수 2자리. */
const fmtNum = (n: number): string => (n >= 1000 ? Math.round(n).toLocaleString() : n.toFixed(n >= 100 ? 0 : 2));

/**
 * 여정 요약 — "이 종목이 어떤 종목인지(저점~고점 여정 + 성격 + 지금 위치) + 더 볼 곳(뉴스)".
 * 전부 현재상태 서술 + 정보 안내(§6 안전). 미래 예측·매수/매도 0.
 */
function buildJourneySummary(i: NarrativeInput): string {
  const parts: string[] = [];
  const lead = i.periodLabel ? `${i.periodLabel} 동안 ` : '';
  if (i.recentHigh > i.recentLow) {
    const widthPct = i.recentLow > 0 ? Math.round(((i.recentHigh - i.recentLow) / i.recentLow) * 100) : 0;
    const wild = widthPct >= RANGE_WIDE_PCT ? ', 오르내림이 큰' : '';
    parts.push(`${lead}가장 낮을 땐 ${fmtNum(i.recentLow)}, 가장 높을 땐 ${fmtNum(i.recentHigh)}까지 갔던${wild} 종목이에요.`);
    const dropFromHigh = i.recentHigh > 0 ? Math.round(((i.recentHigh - i.price) / i.recentHigh) * 100) : 0;
    parts.push(
      dropFromHigh <= 1
        // '마침'(시점 강조 뉘앙스) 제거 — 고점 근처는 매도 심리 인접이라 부사 valence 차단(§6 변호사 권고)
        ? `지금은 ${fmtNum(i.price)}로, 그 제일 높았던 값 근처에 있어요.`
        : `지금은 ${fmtNum(i.price)}로, 제일 비쌌을 때보다 ${dropFromHigh}%쯤 내려온 자리고요.`
    );
  } else {
    parts.push(`지금 가격은 ${fmtNum(i.price)}예요.`);
  }
  // 다음 안내 — 패널 바로 아래에 종목 뉴스가 있을 때만(없는 걸 약속하지 않음)
  if (i.hasNews) parts.push('왜 이렇게 움직였는지는 아래 관련 뉴스를 같이 보면 도움이 돼요.');
  return parts.join(' ');
}

export function buildChartNarrative(i: NarrativeInput): ChartNarrative {
  const rsiHot = i.rsiVal != null && i.rsiVal > 70;
  const rsiCold = i.rsiVal != null && i.rsiVal < 30;
  // 볼린저 띠는 상세 차트에서만 보이므로 카드도 detail일 때만(화면-설명 일치)
  const showBollinger = i.level === 'detail' && i.bollingerPos != null;

  const summary = buildJourneySummary(i);

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
