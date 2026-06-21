// ==========================================
// TECHNICAL -- Pure analysis functions (TypeScript)
// ==========================================

import type { TrendType, PatternResult, SignalSummary, AIReport } from '@/config/constants';
import { TREND_TEXT } from '@/config/constants';
import { iGa } from './koreanJosa';

export function calcSMA(closes: number[], period: number): number[] {
  const r: number[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    let s = 0;
    for (let j = 0; j < period; j++) s += closes[i - j];
    r.push(s / period);
  }
  return r;
}

export function calcEMA(closes: number[], period: number): number[] {
  if (closes.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  // Start with SMA for the first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  result.push(sum / period);
  for (let i = period; i < closes.length; i++) {
    result.push(closes[i] * k + result[result.length - 1] * (1 - k));
  }
  return result;
}

export function calcRSI(closes: number[], period: number = 14): number[] {
  if (closes.length < period + 1) return [];
  let ag = 0, al = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) ag += d; else al -= d;
  }
  ag /= period;
  al /= period;
  const r: number[] = [];
  for (let i = period; i < closes.length; i++) {
    if (i > period) {
      const d = closes[i] - closes[i - 1];
      ag = (ag * (period - 1) + Math.max(d, 0)) / period;
      al = (al * (period - 1) + Math.max(-d, 0)) / period;
    }
    r.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  }
  return r;
}

export function calcBollingerBands(
  closes: number[],
  period: number = 20,
  stdDev: number = 2
): { middle: number; upper: number; lower: number }[] {
  const result: { middle: number; upper: number; lower: number }[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += closes[i - j];
    const mean = sum / period;
    let variance = 0;
    for (let j = 0; j < period; j++) variance += (closes[i - j] - mean) ** 2;
    const sd = Math.sqrt(variance / period);
    result.push({
      middle: mean,
      upper: mean + stdDev * sd,
      lower: mean - stdDev * sd,
    });
  }
  return result;
}

export function calcMACD(
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  signalPeriod: number = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);

  // Align: emaFast starts at index (fast-1), emaSlow at (slow-1)
  // MACD line = emaFast - emaSlow (aligned from emaSlow start)
  const offset = slow - fast;
  const macdLine: number[] = [];
  for (let i = 0; i < emaSlow.length; i++) {
    macdLine.push(emaFast[i + offset] - emaSlow[i]);
  }

  // Signal line = EMA of MACD line
  const signalLine: number[] = [];
  if (macdLine.length >= signalPeriod) {
    const k = 2 / (signalPeriod + 1);
    let sum = 0;
    for (let i = 0; i < signalPeriod; i++) sum += macdLine[i];
    signalLine.push(sum / signalPeriod);
    for (let i = signalPeriod; i < macdLine.length; i++) {
      signalLine.push(macdLine[i] * k + signalLine[signalLine.length - 1] * (1 - k));
    }
  }

  // Histogram = MACD - Signal (aligned from signal start)
  const histOffset = macdLine.length - signalLine.length;
  const histogram: number[] = [];
  for (let i = 0; i < signalLine.length; i++) {
    histogram.push(macdLine[i + histOffset] - signalLine[i]);
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

export function getBollingerStatus(
  price: number,
  bands: { upper: number; lower: number; middle: number }
): { status: string; desc: string; signal: string } {
  const range = bands.upper - bands.lower;
  if (range === 0) return { status: '데이터 부족', desc: '', signal: 'neutral' };

  const pos = (price - bands.lower) / range;

  if (pos <= 0.1) {
    return {
      status: '하단 이탈',
      desc: '가격이 평소 범위 아래로 벗어나 있어요.',
      signal: 'buy',
    };
  }
  if (pos <= 0.25) {
    return {
      status: '하단 근접',
      desc: '가격이 평소 범위의 아래쪽에 있어요.',
      signal: 'buy',
    };
  }
  if (pos >= 0.9) {
    return {
      status: '상단 이탈',
      desc: '가격이 평소 범위 위로 벗어나 있어요.',
      signal: 'sell',
    };
  }
  if (pos >= 0.75) {
    return {
      status: '상단 근접',
      desc: '가격이 평소 범위의 위쪽에 있어요.',
      signal: 'sell',
    };
  }
  return {
    status: '중앙 구간',
    desc: '가격이 평소 범위 안에 있어요.',
    signal: 'neutral',
  };
}

export function getMACDStatus(
  macd: number[],
  signal: number[],
  histogram: number[]
): { status: string; desc: string; signal: string } {
  if (!macd.length || !signal.length || !histogram.length) {
    return { status: '데이터 부족', desc: '', signal: 'neutral' };
  }

  const lastMacd = macd[macd.length - 1];
  const lastHist = histogram[histogram.length - 1];
  const prevHist = histogram.length > 1 ? histogram[histogram.length - 2] : 0;

  // Check for crossover
  if (histogram.length >= 2) {
    if (prevHist < 0 && lastHist >= 0) {
      return {
        status: '상향 교차',
        desc: 'MACD가 시그널선을 위로 지났어요(상향 교차).',
        signal: 'buy',
      };
    }
    if (prevHist > 0 && lastHist <= 0) {
      return {
        status: '하향 교차',
        desc: 'MACD가 시그널선을 아래로 지났어요(하향 교차).',
        signal: 'sell',
      };
    }
  }

  if (lastMacd > 0 && lastHist > 0) {
    return {
      status: '상승 모멘텀',
      desc: 'MACD가 시그널선 위에 있어요.',
      signal: 'buy',
    };
  }
  if (lastMacd < 0 && lastHist < 0) {
    return {
      status: '하락 모멘텀',
      desc: 'MACD가 시그널선 아래에 있어요.',
      signal: 'sell',
    };
  }

  return {
    status: '전환 구간',
    desc: 'MACD가 시그널선과 가까이 있어요.',
    signal: 'neutral',
  };
}

export function getChartShapeSummary(
  trend: string,
  pattern: PatternResult | null,
  rsi: number[],
  cross: string | null
): { icon: string; title: string; desc: string; signal: string } {
  const rsiVal = rsi.length ? rsi[rsi.length - 1] : 50;

  // Pattern-based
  if (pattern) {
    if (pattern.type === 'bullish' && rsiVal < 40) {
      return {
        icon: '📈',
        title: '바닥 구간에서 멈춘 모양',
        desc: `${pattern.name}${iGa(pattern.name)} 형성됐고, RSI ${rsiVal.toFixed(0)}으로 과매도 구간이에요.`,
        signal: 'positive',
      };
    }
    if (pattern.type === 'bearish') {
      return {
        icon: '📉',
        title: '최근 내려온 흐름',
        desc: `${pattern.name} 패턴이에요. ${pattern.desc}`,
        signal: 'caution',
      };
    }
    if (pattern.type === 'potentially_bullish') {
      return {
        icon: '📉',
        title: '내려오다 멈춘 모양',
        desc: `최근 30일간 내려갔고, 지금은 가격이 더 내려가지 않고 멈춰 있는 모양이에요. 이런 모양이라고 꼭 다시 오르는 건 아니에요.`,
        signal: 'caution',
      };
    }
  }

  // Cross-based
  if (cross === 'golden') {
    return {
      icon: '📈',
      title: '골든크로스 발생',
      desc: '단기선이 장기선을 위로 돌파한 상태예요.',
      signal: 'positive',
    };
  }
  if (cross === 'death') {
    return {
      icon: '📉',
      title: '데드크로스 발생',
      desc: '단기선이 장기선을 아래로 지난 상태예요.',
      signal: 'caution',
    };
  }

  // Trend + RSI based
  if (trend === 'strong_down' || trend === 'down') {
    if (rsiVal < 30) {
      return {
        icon: '📉',
        title: '내려오다 멈춘 모양',
        desc: `최근 30일간 내려갔고, RSI ${rsiVal.toFixed(0)}으로 최근 많이 내린 과매도 구간이에요.`,
        signal: 'caution',
      };
    }
    return {
      icon: '📉',
      title: '최근 내려오는 흐름',
      desc: '가격이 이동평균선 아래에서 거래 중이에요.',
      signal: 'caution',
    };
  }
  if (trend === 'strong_up' || trend === 'up') {
    if (rsiVal > 70) {
      return {
        icon: '📈',
        title: '최근 오른 흐름 · 과열 구간',
        desc: `최근 올라온 흐름이지만, RSI ${rsiVal.toFixed(0)}으로 최근 많이 오른 과열 구간이에요.`,
        signal: 'caution',
      };
    }
    return {
      icon: '📈',
      title: '최근 올라오는 흐름',
      desc: '가격이 이동평균선 위에서 올라온 흐름이에요.',
      signal: 'positive',
    };
  }

  return {
    icon: '➡️',
    title: '횡보 구간',
    desc: '뚜렷한 방향 없이 일정 범위에서 움직이는 모양이에요.',
    signal: 'neutral',
  };
}

export function generateAIReport(
  closes: number[],
  rsi: number[],
  trend: string,
  cross: string | null,
  pattern: PatternResult | null,
  bollingerStatus: { status: string; signal: string } | null,
  macdStatus: { status: string; signal: string } | null,
  volRatio: number
): AIReport {
  const rsiVal = rsi.length ? rsi[rsi.length - 1] : 50;
  const sma20 = calcSMA(closes, 20);
  const sma20Val = sma20.length ? sma20[sma20.length - 1] : 0;
  const price = closes[closes.length - 1];

  // Current status
  let currentStatus = '';
  if (trend === 'down' || trend === 'strong_down') {
    if (rsiVal < 30) {
      currentStatus = `최근 내려온 흐름이고, 20일 이동평균선 아래에서 거래 중이에요. RSI ${rsiVal.toFixed(0)}로 최근 많이 내린 과매도 구간이에요.`;
    } else {
      currentStatus = `최근 내려오는 흐름이에요. 가격이 20일선($${sma20Val.toFixed(0)}) 아래에서 거래 중이에요.`;
    }
  } else if (trend === 'up' || trend === 'strong_up') {
    if (rsiVal > 70) {
      currentStatus = `최근 올라온 흐름이고, RSI ${rsiVal.toFixed(0)}로 최근 많이 오른 과열 구간이에요.`;
    } else {
      currentStatus = `최근 올라오는 흐름이에요. 20일선 위에서 거래 중이에요.`;
    }
  } else {
    currentStatus = `뚜렷한 방향 없이 일정 범위에서 움직이는 모양이에요.`;
  }

  // Indicators
  const indicators: { name: string; value: string; signal: string }[] = [];

  // MA
  if (sma20Val > 0) {
    const maSignal = price > sma20Val ? 'positive' : 'negative';
    indicators.push({
      name: '이동평균',
      value: price > sma20Val
        ? `20일선($${sma20Val.toFixed(0)}) 위 ▲`
        : `20일선($${sma20Val.toFixed(0)}) 아래 ▼`,
      signal: maSignal,
    });
  }

  // RSI
  let rsiSignal = 'neutral';
  let rsiLabel = `${rsiVal.toFixed(0)} (적정)`;
  if (rsiVal < 30) { rsiSignal = 'positive'; rsiLabel = `${rsiVal.toFixed(0)} (과매도) 🟢`; }
  else if (rsiVal > 70) { rsiSignal = 'negative'; rsiLabel = `${rsiVal.toFixed(0)} (과열) 🔴`; }
  else { rsiLabel = `${rsiVal.toFixed(0)} (적정) 🟡`; }
  indicators.push({ name: 'RSI', value: rsiLabel, signal: rsiSignal });

  // Bollinger
  if (bollingerStatus) {
    const bSig = bollingerStatus.signal === 'buy' ? 'positive' : bollingerStatus.signal === 'sell' ? 'negative' : 'neutral';
    const bEmoji = bSig === 'positive' ? ' 🟢' : bSig === 'negative' ? ' 🔴' : ' 🟡';
    indicators.push({ name: '볼린저밴드', value: bollingerStatus.status + bEmoji, signal: bSig });
  }

  // MACD
  if (macdStatus) {
    const mSig = macdStatus.signal === 'buy' ? 'positive' : macdStatus.signal === 'sell' ? 'negative' : 'neutral';
    const mEmoji = mSig === 'positive' ? ' 🟢' : mSig === 'negative' ? ' 🔴' : ' 🟡';
    indicators.push({ name: 'MACD', value: macdStatus.status + mEmoji, signal: mSig });
  }

  // Volume
  let volSignal = 'neutral';
  let volLabel = `평균 대비 ${volRatio.toFixed(1)}배 🟡`;
  if (volRatio > 2) { volSignal = 'positive'; volLabel = `평균 대비 ${volRatio.toFixed(1)}배 (활발) 🟢`; }
  else if (volRatio < 0.5) { volSignal = 'negative'; volLabel = `평균 대비 ${volRatio.toFixed(1)}배 (한산) 🔴`; }
  indicators.push({ name: '거래량', value: volLabel, signal: volSignal });

  // Historical note (종목별 백테스트 통계가 아님 — RSI 일반 해석만 제공)
  // 기존엔 "5번 반등 평균 +12%" 같은 하드코딩 통계가 종목별 사실로 오인될 위험이 있었음.
  let historicalNote = '';
  if (rsiVal < 30) {
    historicalNote = 'RSI 30 이하는 단기적으로 많이 내린 구간으로 봐요. 종목마다 양상은 달라요.';
  } else if (rsiVal > 70) {
    historicalNote = 'RSI 70 이상은 단기적으로 많이 오른 구간으로 봐요. 종목마다 양상은 달라요.';
  } else {
    historicalNote = '현재 RSI는 중간 구간이에요.';
  }

  // Conclusion
  let conclusionLabel = '관망';
  let conclusionSignal = 'neutral';
  let conclusionDesc = '';

  const positiveCount = indicators.filter(i => i.signal === 'positive').length;
  const negativeCount = indicators.filter(i => i.signal === 'negative').length;

  if (positiveCount >= 3) {
    conclusionLabel = '지표 양호';
    conclusionSignal = 'positive';
    conclusionDesc = '여러 지표가 양호한 편이에요. 앞일은 아무도 알 수 없으니 참고로만 봐주세요.';
  } else if (negativeCount >= 3) {
    conclusionLabel = '주의';
    conclusionSignal = 'negative';
    conclusionDesc = '여러 지표가 약한 편이에요. 앞일은 아무도 알 수 없으니 참고로만 봐주세요.';
  } else if (rsiVal < 30 && (trend === 'down' || trend === 'strong_down')) {
    conclusionLabel = '관망';
    conclusionSignal = 'neutral';
    conclusionDesc = '많이 내린 구간이지만 MACD는 아직 아래쪽에 있어요.';
  } else if (rsiVal > 70 && (trend === 'up' || trend === 'strong_up')) {
    conclusionLabel = '관망';
    conclusionSignal = 'neutral';
    conclusionDesc = '최근 많이 올라 과열 구간이에요.';
  } else {
    conclusionDesc = '지표가 뚜렷한 방향을 보이지 않아요.';
  }

  return {
    currentStatus,
    indicators,
    historicalNote,
    conclusion: {
      label: conclusionLabel,
      signal: conclusionSignal,
      desc: conclusionDesc,
    },
  };
}

export function detectTrend(closes: number[], sma20: number[], sma60: number[]): TrendType {
  if (!sma20.length || !sma60.length) return 'unknown';
  const p = closes[closes.length - 1];
  const m20 = sma20[sma20.length - 1];
  const m60 = sma60[sma60.length - 1];
  if (p > m20 && m20 > m60) return 'strong_up';
  if (p > m20) return 'up';
  if (p < m20 && m20 < m60) return 'strong_down';
  if (p < m20) return 'down';
  return 'sideways';
}

export function detectCross(sma5: number[], sma20: number[]): 'golden' | 'death' | null {
  if (sma5.length < 2 || sma20.length < 2) return null;
  const s5a = sma5[sma5.length - 2], s5b = sma5[sma5.length - 1];
  const s20a = sma20[sma20.length - 2], s20b = sma20[sma20.length - 1];
  if (s5a <= s20a && s5b > s20b) return 'golden';
  if (s5a >= s20a && s5b < s20b) return 'death';
  return null;
}

export function detectPattern(closes: number[]): PatternResult | null {
  if (closes.length < 40) return null;
  const recent = closes.slice(-60);
  const peaks: { i: number; v: number }[] = [];
  const troughs: { i: number; v: number }[] = [];
  for (let i = 2; i < recent.length - 2; i++) {
    if (recent[i] > recent[i - 1] && recent[i] > recent[i - 2] && recent[i] > recent[i + 1] && recent[i] > recent[i + 2])
      peaks.push({ i, v: recent[i] });
    if (recent[i] < recent[i - 1] && recent[i] < recent[i - 2] && recent[i] < recent[i + 1] && recent[i] < recent[i + 2])
      troughs.push({ i, v: recent[i] });
  }
  if (troughs.length >= 2) {
    const t = troughs.slice(-2);
    if (Math.abs(t[0].v - t[1].v) / t[0].v < 0.03 && t[1].i > t[0].i)
      return { name: '더블바텀 (W자형)', type: 'bullish', desc: '바닥을 두 번 찍은 모양이에요(더블바텀이라고 불러요).' };
  }
  if (peaks.length >= 2 && troughs.length >= 2) {
    const pDown = peaks[peaks.length - 1].v < peaks[0].v;
    const tDown = troughs[troughs.length - 1].v < troughs[0].v;
    if (pDown && tDown)
      return { name: '하락 쐐기형', type: 'potentially_bullish', desc: '내려가지만 하락 폭이 점점 줄어드는 모양이에요(쐐기형이라고 불러요).' };
    if (pDown && !tDown)
      return { name: '하락 삼각형', type: 'bearish', desc: '고점은 낮아지는데 저점은 비슷하게 유지되고 있어요.' };
    if (!pDown && tDown)
      return { name: '상승 삼각형', type: 'bullish', desc: '저점이 점점 높아지고 있어요.' };
  }
  // Simple trend
  const first = closes.slice(-30, -20).reduce((a, b) => a + b, 0) / 10;
  const last = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  if (last > first * 1.05)
    return { name: '상승 흐름', type: 'bullish', desc: '최근 30일간 꾸준히 올라온 흐름이에요.' };
  if (last < first * 0.95)
    return { name: '하락 흐름', type: 'bearish', desc: '최근 30일간 내려온 흐름이에요.' };
  return { name: '횡보 (박스권)', type: 'neutral', desc: '일정 범위 안에서 오르내리는 모양이에요(박스권이라고 불러요).' };
}

export function generateSummary(
  closes: number[],
  rsi: number[],
  trend: TrendType,
  cross: 'golden' | 'death' | null,
  pattern: PatternResult | null
): SignalSummary {
  const r = rsi.length ? rsi[rsi.length - 1] : 50;
  let cls = 'signal-neutral', icon = '🟡', label = '관망';

  if (trend === 'strong_up' || (trend === 'up' && r < 70)) { cls = 'signal-positive'; icon = '🟢'; label = '긍정적'; }
  else if (trend === 'strong_down' || (trend === 'down' && r > 30)) { cls = 'signal-caution'; icon = '🔴'; label = '주의'; }
  if (cross === 'golden') { cls = 'signal-positive'; icon = '🟢'; label = '긍정적'; }
  if (cross === 'death') { cls = 'signal-caution'; icon = '🔴'; label = '주의'; }
  if (r < 30) { cls = 'signal-positive'; icon = '🟢'; label = '과매도 구간'; }
  if (r > 70) { cls = 'signal-caution'; icon = '🔴'; label = '과열 구간'; }

  let body = `현재 ${TREND_TEXT[trend] || '분석 중'}이에요. `;
  if (r < 30) body += `RSI가 ${r.toFixed(0)}으로 최근 많이 내린 과매도 구간이에요. `;
  else if (r > 70) body += `RSI가 ${r.toFixed(0)}으로 최근 많이 오른 과열 구간이에요. `;
  else body += `RSI ${r.toFixed(0)}으로 적정 수준이에요. `;
  if (cross === 'golden') body += '최근 골든크로스(단기선이 장기선을 위로 지남)가 발생했어요.';
  if (cross === 'death') body += '최근 데드크로스(단기선이 장기선을 아래로 지남)가 발생했어요.';

  return { cls, icon, label, body };
}
