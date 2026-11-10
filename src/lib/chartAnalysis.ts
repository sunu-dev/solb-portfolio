import type { IntradayCandles } from './intradayCandles';
import { tradingDate } from './intradayCandles';
import { chartTechnicalContext, chartObservationText, type ChartView } from './chartTechnicalContext';

export const CHART_QUESTION = { id: 'chart-session', mentor: 'trend', question: '이 차트의 모양과 지표를 함께 읽어주세요.',
  focus: '추세·가격이 돌아선 곳·거래량·변동성·모멘텀·봉의 모양 중 실제로 유의미한 관점을 골라 근거와 의미를 설명하세요.' } as const;

export function chartSessionFacts(data: IntradayCandles) {
  const arrays = [data.t, data.o, data.h, data.l, data.c];
  const count = data.t.length;
  if (data.interval !== '5m' || count < 3 || count > 300 || arrays.some(a => a.length !== count || a.some(v => !Number.isFinite(v) || v <= 0))
    || data.t.some((t, i) => i > 0 && t <= data.t[i - 1]) || data.asOf !== data.t.at(-1)
    || data.t.some((t, i) => tradingDate(t, data.timeZone) !== data.sessionDate || data.h[i] < Math.max(data.o[i], data.c[i]) || data.l[i] > Math.min(data.o[i], data.c[i]) || data.l[i] > data.h[i])) throw new Error('invalid_chart_session');
  const time = (i: number) => new Intl.DateTimeFormat('ko-KR', { timeZone: data.timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(data.t[i] * 1000));
  const group = (start: number, end: number) => ({ from: time(start), through: time(end - 1), firstLinePrice: data.c[start], lastLinePrice: data.c[end - 1],
    low: Math.min(...data.l.slice(start, end)), high: Math.max(...data.h.slice(start, end)) });
  const highIndex = data.c.indexOf(Math.max(...data.c)), lowIndex = data.c.indexOf(Math.min(...data.c));
  const technical = chartTechnicalContext(data);
  return { sessionDate: data.sessionDate, timeZone: data.timeZone, interval: '5m', bars: count,
    firstBarAt: time(0), lastBarAt: time(count - 1), firstLinePrice: data.c[0], lastLinePrice: data.c.at(-1)!,
    changeFromFirstLinePercent: Math.round((data.c.at(-1)! / data.c[0] - 1) * 10000) / 100,
    lineHigh: { price: data.c[highIndex], barStart: time(highIndex) }, lineLow: { price: data.c[lowIndex], barStart: time(lowIndex) },
    tradedLow: Math.min(...data.l), tradedHigh: Math.max(...data.h),
    portions: [group(0, Math.ceil(count / 3)), group(Math.ceil(count / 3), Math.ceil(count * 2 / 3)), group(Math.ceil(count * 2 / 3), count)],
    gapsLongerThanFiveMinutes: data.t.slice(1).filter((t, i) => t - data.t[i] > 300).length,
    technical: technical?.facts ?? null, availableViews: technical?.availableViews ?? [],
    coverage: '받은 정규장 자료만 포함. 전체 거래일 완결 여부와 등락 원인은 미확인. 빈 구간을 채우지 않았고 차트 시각은 5분 구간 시작. 이 하루의 5분봉 분석을 일봉·장기 추세로 확대하지 말 것.' };
}

export function chartExplanationPrompt(symbol: string, currency: 'KRW' | 'USD', facts: ReturnType<typeof chartSessionFacts>, preferredViews: readonly ChartView[] = []) {
  return `주비의 주식 초보자용 차트 해설을 한국어 해요체로 작성하세요. 아래 서버 계산 자료만 사용하세요.
선택 질문: ${CHART_QUESTION.question}
- 사용자가 이미 차트에 펼쳐 둔 관점: ${preferredViews.length ? preferredViews.join(', ') : '없음. 직접 중요한 관점을 골라주세요.'}. 자료가 있는 선택은 우선 설명하고, 필요하면 서로 보완되는 관점을 더해 2~3개로 구성해 주세요.
- 가격 처음·끝·최저·최고를 읽어주는 요약은 답이 아니에요. 여러 해설법을 비교해 이 차트에서 근거가 뚜렷하고 서로 보완되는 관점 2~3개를 고르세요. 볼린저밴드를 반드시 선택하지 마세요. 지표 개수를 투표처럼 세거나 같은 가격에서 나온 지표들을 독립된 증거라고 하지 마세요.
- currentStatus: 현재 확인되는 모양과 서로 다른 관점의 일치/차이를 2문장, 180자 이내로 설명하세요. 숫자는 쓰지 마세요. 수치 나열은 UI의 계산 문장이 담당해요.
- chartViews: availableViews 중에서만 2~3개, 중복 없이 골라주세요. 우선순위가 낮은 관점까지 3개로 채우지 마세요. view는 해당 키, title은 어려운 용어보다 관찰을 드러내는 짧은 문장. meaning은 이 관찰과 다른 관찰이 어떻게 연결되는지 이 차트에 맞춰 설명하세요. 개념 정의만 반복하지 마세요. watchNext는 그 해석이 유지되거나 달라졌는지 확인할 구체적 변화예요. 각 필드는 쉬운 1~2문장, 160자 이내. 가격 전망·매매 지시는 하지 마세요.
- 수치와 위아래 관계는 UI가 displayedFacts 문장을 직접 표시해요. meaning과 watchNext에서 같은 수치·위아래 관계를 다시 쓰지 마세요. 평균선은 새 자료마다 바뀌므로 지금의 평균값을 앞으로도 고정된 경계인 것처럼 제시하지 마세요.
- 관점: trend=5·20·60개 평균의 방향/가격 위치/최근 교차, levels=이전에 돌아선 가격과 높고 낮아지는 고점·저점, volume=최근 거래량과 앞 구간 비교, bollinger=밴드 안 위치·폭 변화, rsi=최근 상승·하락 폭의 상대 크기, macd=두 평균의 차이와 그 변화, candles=몸통·위아래 꼬리. 지표 이름만 다르게 반복한 관찰은 빼세요.
- 실제 계산값이 없는 것은 선택하거나 숫자를 만들지 마세요. levels는 고점·저점 양옆2개 관측으로 확인한 국소 전환점이에요. sequenceDescription의 고점·저점 방향이 서로 다르면 '상승 추세였다' 또는 '하락 추세였다'고 통째로 이름 붙이지 마세요. 현재 가격이 과거 모양과 어디가 다른지 설명하세요. 한 번의 가격으로 추세가 끝났다고 확정하지 마세요. lastPriceDistanceFromLatestTroughPercent를 보되 비교 근거 없이 '아주 조금' 같은 크기 형용사를 붙이지 마세요.
- 낮아지는 고점·저점 다음에 가격이 마지막 저점보다 위에 있는 것은 자연스러운 오르내림이에요. 저점보다 위라는 이유만으로 하락 모양을 벗어났다고 하지 마세요. 높은 새 고점·저점이 이어지는지 등 다른 변화도 필요해요. W·쐐기·삼각형의 완성이나 미래 지지·저항은 확정하지 마세요. 뚜렷한 모양이 없으면 그 점을 밝혀도 돼요.
- 이 자료는 같은 거래일 5분봉이에요. 20개 평균을 20일선이라 부르지 마세요. 빈 구간을 건너뛴 받은 관측값 기준이며, 모든 봉이 완결됐다고 하지 마세요. 짧은 장중 흐름을 장기 흐름으로 확대하지 마세요.
- 최근5개 구간의 가격이 제자리여도 그 이전에 이어진 상승/하락 흐름이 없어진 것은 아니에요. 거래량 비교와 평균선이 다루는 구간 수를 구분하세요. '최근5개는횡보'와 '하루전체방향없음'을 혼동하지 마세요.
- 거래량이 줄었다는 것은 거래된 주식 수가 적어졌다는 뜻이에요. 가격 방향과는 다른 관찰이므로 '거래량도 같은 방향을 가리켜 하락이 확인됐다'처럼 쓰지 마세요. 두 개를 단순히 묶어 강한 추세나 추세 종료로 만들지 마세요.
- 거래량의 watchNext는 '거래가 늘 때 가격은 오르는지 내리는지'처럼 무엇을 비교할지 분명히 써주세요. '같은 방향', '힘', '국소 전환점', '참여' 같은 모호한 말은 피하고, 전환점은 '앞뒤 가격보다 높거나 낮았던 곳'으로 풀어주세요.
- 작성 후 고점·저점의 방향, 가격과 평균선의 위아래, 비교 기간이 supplied facts와 맞는지 한 번 대조한 다음 JSON만 반환해 주세요.
- RSI나 밴드의 한 값만으로 향후 방향이나 매매 행동을 정하지 마세요. 거래량으로 매수/매도 주체·투자심리·등락 원인을 만들지 마세요. reference는 미래 목표가가 아니라 이전에 실제 돌아선 가격이에요. 마지막 봉의 고가와 저가가 같으면 그 봉을 특정 반전 모양으로 읽지 마세요.
- 어려운 용어는 바로 쉬운 말로 풀어주세요. '수급', '하방 압력', '모멘텀 약화', '시사', '구간 시작 기준'처럼 추상적인 표현, 비유·격언·당연한 숫자 나열·공부 숙제는 쓰지 마세요.
- conclusion: label 정보 정리, signal neutral. desc는 선택한 해석에 직접 관련된 한계 한 문장. 모든 답에 똑같은 면책 문장을 채우지 마세요.
${JSON.stringify({ symbol, currency, facts, displayedFacts: facts.technical ? chartObservationText(facts.technical, currency) : {} })}`;
}
