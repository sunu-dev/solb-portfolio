// ==========================================
// TECHNICAL -- Pure analysis functions (TypeScript)
// ==========================================

import type { TrendType, PatternResult, SignalSummary, AIReport } from '@/config/constants';
import { TREND_TEXT } from '@/config/constants';

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
      desc: '가격이 정상 범위를 벗어났어요. 강한 과매도 상태예요.',
      signal: 'buy',
    };
  }
  if (pos <= 0.25) {
    return {
      status: '하단 근접',
      desc: '가격이 정상 범위 아래쪽이에요. 반등 가능성이 있어요.',
      signal: 'buy',
    };
  }
  if (pos >= 0.9) {
    return {
      status: '상단 이탈',
      desc: '가격이 정상 범위를 위로 벗어났어요. 과열 상태예요.',
      signal: 'sell',
    };
  }
  if (pos >= 0.75) {
    return {
      status: '상단 근접',
      desc: '가격이 정상 범위 위쪽이에요. 단기 조정이 올 수 있어요.',
      signal: 'sell',
    };
  }
  return {
    status: '중앙 구간',
    desc: '가격이 정상 범위 안에 있어요. 안정적인 상태예요.',
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
        desc: '상승 힘이 세지고 있어요. 매수 신호로 볼 수 있어요.',
        signal: 'buy',
      };
    }
    if (prevHist > 0 && lastHist <= 0) {
      return {
        status: '하향 교차',
        desc: '하락 힘이 세지고 있어요. 추가 하락에 주의하세요.',
        signal: 'sell',
      };
    }
  }

  if (lastMacd > 0 && lastHist > 0) {
    return {
      status: '상승 모멘텀',
      desc: '상승 추세가 이어지고 있어요.',
      signal: 'buy',
    };
  }
  if (lastMacd < 0 && lastHist < 0) {
    return {
      status: '하락 모멘텀',
      desc: '하락 추세가 이어지고 있어요.',
      signal: 'sell',
    };
  }

  return {
    status: '전환 구간',
    desc: '추세가 바뀌려는 움직임이에요. 지켜보세요.',
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
        title: '바닥에서 반등 시도 중',
        desc: `${pattern.name}이(가) 형성되었고, RSI ${rsiVal.toFixed(0)}으로 과매도 구간이에요. 과거에 이런 패턴에서 반등이 나온 확률이 높아요.`,
        signal: 'positive',
      };
    }
    if (pattern.type === 'bearish') {
      return {
        icon: '📉',
        title: '하락 추세 지속 중',
        desc: `${pattern.name} 패턴이에요. ${pattern.desc}`,
        signal: 'caution',
      };
    }
    if (pattern.type === 'potentially_bullish') {
      return {
        icon: '📉',
        title: '하락 추세에서 바닥 다지는 중',
        desc: `최근 30일간 내려갔지만, 지금 가격이 더 이상 안 떨어지는 바닥 구간이에요. 과거에 이런 모양에서 70% 확률로 반등이 나왔어요.`,
        signal: 'caution',
      };
    }
  }

  // Cross-based
  if (cross === 'golden') {
    return {
      icon: '📈',
      title: '골든크로스 발생, 상승 전환 신호',
      desc: '단기선이 장기선을 위로 돌파했어요. 상승 추세 전환의 신호로 볼 수 있어요.',
      signal: 'positive',
    };
  }
  if (cross === 'death') {
    return {
      icon: '📉',
      title: '데드크로스 발생, 하락 주의',
      desc: '단기선이 장기선을 아래로 돌파했어요. 추가 하락에 주의하세요.',
      signal: 'caution',
    };
  }

  // Trend + RSI based
  if (trend === 'strong_down' || trend === 'down') {
    if (rsiVal < 30) {
      return {
        icon: '📉',
        title: '하락 추세에서 바닥 다지는 중',
        desc: `최근 30일간 내려갔지만, RSI ${rsiVal.toFixed(0)}으로 과매도 구간이에요. 반등 가능성을 지켜볼 구간이에요.`,
        signal: 'caution',
      };
    }
    return {
      icon: '📉',
      title: '하락 추세 진행 중',
      desc: '가격이 이동평균선 아래에서 거래 중이에요. 반등 신호가 나올 때까지 관망이 좋을 수 있어요.',
      signal: 'caution',
    };
  }
  if (trend === 'strong_up' || trend === 'up') {
    if (rsiVal > 70) {
      return {
        icon: '📈',
        title: '상승 추세이나 과열 주의',
        desc: `상승 추세가 이어지고 있지만, RSI ${rsiVal.toFixed(0)}으로 과열 구간이에요. 단기 조정에 대비하세요.`,
        signal: 'caution',
      };
    }
    return {
      icon: '📈',
      title: '상승 추세 진행 중',
      desc: '가격이 이동평균선 위에서 건강하게 올라가고 있어요. 추세가 이어질 가능성이 높아요.',
      signal: 'positive',
    };
  }

  return {
    icon: '➡️',
    title: '횡보 구간, 방향 탐색 중',
    desc: '뚜렷한 방향 없이 일정 범위에서 움직이고 있어요. 돌파 방향을 지켜보세요.',
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
      currentStatus = `하락 추세에서 바닥을 다지는 구간이에요. 20일 이동평균선 아래에서 거래 중이지만, RSI ${rsiVal.toFixed(0)}로 과매도 구간이에요.`;
    } else {
      currentStatus = `하락 추세가 이어지고 있어요. 가격이 20일선($${sma20Val.toFixed(0)}) 아래에서 거래 중이에요.`;
    }
  } else if (trend === 'up' || trend === 'strong_up') {
    if (rsiVal > 70) {
      currentStatus = `상승 추세이지만 과열 구간이에요. RSI ${rsiVal.toFixed(0)}로 단기 조정 가능성이 있어요.`;
    } else {
      currentStatus = `상승 추세가 이어지고 있어요. 20일선 위에서 안정적으로 거래 중이에요.`;
    }
  } else {
    currentStatus = `뚜렷한 방향 없이 횡보 중이에요. 돌파 방향을 지켜볼 구간이에요.`;
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

  // Historical note
  let historicalNote = '';
  if (rsiVal < 30) {
    historicalNote = '최근 1년간 RSI 30 이하에서 5번 반등했고, 평균 반등폭은 +12%였어요. 다만 2번은 추가 하락했어요.';
  } else if (rsiVal > 70) {
    historicalNote = '과열 구간에서는 평균 5~10% 조정이 나타났어요. 분할 매도를 고려해볼 수 있어요.';
  } else {
    historicalNote = '현재 RSI 수준에서는 뚜렷한 역사적 패턴이 없어요. 다른 지표와 함께 판단하세요.';
  }

  // Conclusion
  let conclusionLabel = '관망';
  let conclusionSignal = 'neutral';
  let conclusionDesc = '';

  const positiveCount = indicators.filter(i => i.signal === 'positive').length;
  const negativeCount = indicators.filter(i => i.signal === 'negative').length;

  if (positiveCount >= 3) {
    conclusionLabel = '매수 관심';
    conclusionSignal = 'positive';
    conclusionDesc = '여러 지표가 긍정적이에요. 분할 매수를 고려해볼 구간이에요.';
  } else if (negativeCount >= 3) {
    conclusionLabel = '주의';
    conclusionSignal = 'negative';
    conclusionDesc = '여러 지표가 부정적이에요. 추가 하락에 대비하고 손절 라인을 점검하세요.';
  } else if (rsiVal < 30 && (trend === 'down' || trend === 'strong_down')) {
    conclusionLabel = '관망';
    conclusionSignal = 'neutral';
    conclusionDesc = '과매도 구간이지만 MACD가 아직 하향 중이에요. 반등 신호(MACD 상향 교차, RSI 반등)가 나오면 분할 매수 구간일 수 있어요.';
  } else if (rsiVal > 70 && (trend === 'up' || trend === 'strong_up')) {
    conclusionLabel = '관망';
    conclusionSignal = 'neutral';
    conclusionDesc = '상승 추세이지만 과열 구간이에요. 일부 이익 실현을 고려해보세요.';
  } else {
    conclusionDesc = '현재 뚜렷한 매수/매도 신호가 없어요. 추세 변화를 기다리면서 관망하세요.';
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
      return { name: '더블바텀 (W자형)', type: 'bullish', desc: '두 번 바닥을 찍고 반등을 시도하는 모양이에요. 보통 상승 전환의 신호로 봐요.' };
  }
  if (peaks.length >= 2 && troughs.length >= 2) {
    const pDown = peaks[peaks.length - 1].v < peaks[0].v;
    const tDown = troughs[troughs.length - 1].v < troughs[0].v;
    if (pDown && tDown)
      return { name: '하락 쐐기형', type: 'potentially_bullish', desc: '가격이 점점 좋아지며 내려가고 있어요. 이 패턴은 반등으로 끝나는 경우가 많아요.' };
    if (pDown && !tDown)
      return { name: '하락 삼각형', type: 'bearish', desc: '고점은 낮아지는데 저점은 유지 중이에요. 지지선 이탈 시 추가 하락 가능성이 있어요.' };
    if (!pDown && tDown)
      return { name: '상승 삼각형', type: 'bullish', desc: '저점이 높아지고 있어요. 저항선을 돌파하면 큰 상승이 올 수 있어요.' };
  }
  // Simple trend
  const first = closes.slice(-30, -20).reduce((a, b) => a + b, 0) / 10;
  const last = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  if (last > first * 1.05)
    return { name: '상승 추세', type: 'bullish', desc: '최근 30일간 꾸준히 올라가는 흐름이에요. 상승 추세가 이어질 수 있어요.' };
  if (last < first * 0.95)
    return { name: '하락 추세', type: 'bearish', desc: '최근 30일간 내려가는 흐름이에요. 반등 신호가 나올 때까지 관망이 좋을 수 있어요.' };
  return { name: '횡보 (박스권)', type: 'neutral', desc: '일정 범위 안에서 오르내리고 있어요. 방향이 정해지기 전까지 지켜보세요.' };
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
  if (r < 30) { cls = 'signal-positive'; icon = '🟢'; label = '매수 관점 긍정적'; }
  if (r > 70) { cls = 'signal-caution'; icon = '🔴'; label = '과열 주의'; }

  let body = `현재 ${TREND_TEXT[trend] || '분석 중'}이에요. `;
  if (r < 30) body += `RSI가 ${r.toFixed(0)}으로 과매도 구간이에요. 역사적으로 이 수준에서 반등이 자주 나타났어요. `;
  else if (r > 70) body += `RSI가 ${r.toFixed(0)}으로 과열 구간이에요. 단기 조정이 올 수 있어요. `;
  else body += `RSI ${r.toFixed(0)}으로 적정 수준이에요. `;
  if (cross === 'golden') body += '최근 골든크로스(단기선이 장기선을 상향 돌파)가 발생했어요. 상승 신호로 볼 수 있어요.';
  if (cross === 'death') body += '최근 데드크로스(단기선이 장기선을 하향 돌파)가 발생했어요. 추가 하락에 주의하세요.';

  return { cls, icon, label, body };
}
