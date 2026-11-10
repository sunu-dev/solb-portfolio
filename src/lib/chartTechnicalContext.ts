import type { IntradayCandles } from './intradayCandles';
import { calcSMA, calcBollingerBands, calcRSI, calcMACD, detectCross } from '@/utils/technical';
import { euroRo } from '@/utils/koreanJosa';

export const CHART_VIEWS = ['trend', 'levels', 'volume', 'bollinger', 'rsi', 'macd', 'candles'] as const;
export type ChartView = typeof CHART_VIEWS[number];
export const CHART_VIEW_LABEL: Record<ChartView, string> = { trend: '추세와 평균선', levels: '가격이 돌아섰던 곳', volume: '거래량', bollinger: '가격 변동 폭', rsi: '최근 상승·하락의 크기', macd: '평균선 사이의 변화', candles: '5분봉의 모양' };
export interface ChartObservation { view: ChartView; title: string; observed: string; meaning: string; watchNext: string }
const average = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const last = (a: number[]) => a.at(-1)!;
const round = (n: number) => Math.round(n * 10000) / 10000;
const compare = (a: number, b: number) => a > b ? 'above' : a < b ? 'below' : 'equal';
const comparePrice = (a: number, b: number) => compare(Math.round(a * 100), Math.round(b * 100));

/** Numerical observations, shared with the plot. No buy/sell score or forced pattern name. */
export function chartTechnicalContext(data: IntradayCandles) {
  const { c, t, v } = data;
  if (c.length < 5 || c.length !== t.length || c.some(n => !Number.isFinite(n) || n <= 0)) return null;
  const sma5 = calcSMA(c, 5), sma20 = calcSMA(c, 20), sma60 = calcSMA(c, 60);
  const bands = calcBollingerBands(c), rsi = calcRSI(c), macd = calcMACD(c);
  const b = bands.at(-1)!, previousBand = bands.at(-6), width = b ? b.upper - b.lower : 0;
  const time = (index: number) => new Intl.DateTimeFormat('ko-KR', { timeZone: data.timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(t[index] * 1000));
  const peaks: { index: number; at: string; price: number }[] = [], troughs: typeof peaks = [];
  // Only confirmed local turns: two received observations on either side, all contiguous.
  for (let i = Math.max(2, c.length - 60); i < c.length - 2; i++) {
    if ([i - 1, i, i + 1, i + 2].some(j => t[j] - t[j - 1] !== 300)) continue;
    const neighbors = [c[i - 2], c[i - 1], c[i + 1], c[i + 2]];
    if (neighbors.every(n => c[i] > n)) peaks.push({ index: i, at: time(i), price: c[i] });
    if (neighbors.every(n => c[i] < n)) troughs.push({ index: i, at: time(i), price: c[i] });
  }
  const recentPeaks = peaks.slice(-2), recentTroughs = troughs.slice(-2);
  const turns = [...peaks, ...troughs].sort((a, b) => a.index - b.index);
  const above = turns.filter(p => p.price > last(c)).sort((a, b) => a.price - b.price)[0] ?? null;
  const below = turns.filter(p => p.price < last(c)).sort((a, b) => b.price - a.price)[0] ?? null;
  const shape = recentPeaks.length === 2 && recentTroughs.length === 2
    ? { highs: compare(recentPeaks[1].price, recentPeaks[0].price), lows: compare(recentTroughs[1].price, recentTroughs[0].price) } : null;
  let belowMean = 0, aboveMean = 0;
  for (let i = c.length - 1; i >= 19; i--) {
    if (c[i] < sma20[i - 19] && aboveMean === 0) belowMean++;
    else if (c[i] > sma20[i - 19] && belowMean === 0) aboveMean++;
    else break;
  }
  const volumesValid = v.length === c.length && v.every(n => Number.isFinite(n) && n >= 0) && v.some(n => n > 0);
  const volume = volumesValid && v.length >= 10 && average(v.slice(-25, -5)) > 0
    ? { recentFiveAverage: round(average(v.slice(-5))), precedingTwentyAverage: round(average(v.slice(-25, -5))), precedingObservations: v.slice(-25, -5).length,
      ratio: round(average(v.slice(-5)) / average(v.slice(-25, -5))), recentFivePriceChangePercent: round((last(c) / c.at(-6)! - 1) * 100),
      note: '같은 거래일 내 최근5개 평균과 그 앞 최대20개 평균 비교. 시간대별 평소 거래량이나 매수·매도 주체는 알 수 없음.' } : null;
  const flat = c.slice(-15).every(n => n === last(c));
  const rsiFacts = !flat && rsi.length >= 2 ? { period: 14, value: round(last(rsi)), fiveObservationsAgo: rsi.length >= 6 ? round(rsi.at(-6)!) : null } : null;
  const macdFacts = macd.signal.length >= 2 ? { fast: 12, slow: 26, signalPeriod: 9, value: round(last(macd.macd)), signal: round(last(macd.signal)),
    histogram: round(last(macd.histogram)), previousHistogram: round(macd.histogram.at(-2)!),
    fiveObservationsAgo: macd.histogram.length >= 6 ? round(macd.histogram.at(-6)!) : null } : null;
  const candles = c.slice(-3).map((close, n) => {
    const i = c.length - 3 + n, range = data.h[i] - data.l[i], body = Math.abs(close - data.o[i]);
    return { at: time(i), open: data.o[i], high: data.h[i], low: data.l[i], close,
      bodyShare: range > 0 ? round(body / range) : 0, upperWickShare: range > 0 ? round((data.h[i] - Math.max(close, data.o[i])) / range) : 0,
      lowerWickShare: range > 0 ? round((Math.min(close, data.o[i]) - data.l[i]) / range) : 0 };
  });
  const facts = {
    basis: { interval: '5m', observations: c.length, averagePeriod: 20, bandDeviations: 2, windowFirstAt: time(Math.max(0, c.length - 20)), windowLastAt: time(c.length - 1),
      gapsInLatestTwenty: t.slice(Math.max(0, t.length - 20) + 1).filter((n, i) => n - t[Math.max(0, t.length - 20) + i] > 300).length,
      note: '같은 거래일에 받은 구간만 사용. 20일선이 아닌 5분봉20개 평균. 빈 구간은 채우지 않고 받은 관측값으로 계산. 5분봉의 시작 시각이며 정확한 체결 순간은 아님.' },
    trend: { lastPrice: last(c), average5: round(last(sma5)), average20: sma20.length ? round(last(sma20)) : null, average60: sma60.length ? round(last(sma60)) : null,
      priceVs20: sma20.length ? compare(last(c), last(sma20)) : null, average5Vs20: sma20.length ? compare(last(sma5), last(sma20)) : null, latest5vs20Cross: detectCross(sma5, sma20),
      priceVs5: compare(last(c), last(sma5)), priceVs60: sma60.length ? compare(last(c), last(sma60)) : null,
      average20FiveObservationsAgo: sma20.length >= 6 ? round(sma20.at(-6)!) : null, consecutiveBelow20: belowMean, consecutiveAbove20: aboveMean },
    levels: { recentPeaks, recentTroughs, highLowSequence: shape, nearestPreviousTurnAbove: above, nearestPreviousTurnBelow: below,
      sequenceDescription: shape ? `확인된 두 고점은 ${shape.highs === 'above' ? '높아졌고' : shape.highs === 'below' ? '낮아졌고' : '같고'}, 두 저점은 ${shape.lows === 'above' ? '높아졌음' : shape.lows === 'below' ? '낮아졌음' : '같음'}. 고점·저점 방향이 다르면 한 방향의 추세로 단정하지 않음.` : '확인된 고점·저점 쌍이 부족함',
      lastPriceVsLatestTrough: recentTroughs.length ? comparePrice(last(c), recentTroughs.at(-1)!.price) : null,
      lastPriceVsLatestPeak: recentPeaks.length ? comparePrice(last(c), recentPeaks.at(-1)!.price) : null,
      lastPriceDistanceFromLatestTroughPercent: recentTroughs.length ? round((last(c) / recentTroughs.at(-1)!.price - 1) * 100) : null,
      note: '양옆2개 가격보다 높거나 낮은 지점. 고점·저점 순서는 모양 관찰이며 쐐기·삼각형·W완성이나 향후 지지·저항을 확정하지 않음.' },
    volume,
    bollinger: width > 0 ? { period: 20, deviations: 2, lower: round(b.lower), middle: round(b.middle), upper: round(b.upper),
      relativePosition: round((last(c) - b.lower) / width), bandwidthPercent: round(width / b.middle * 100),
      bandwidthFiveObservationsAgoPercent: previousBand ? round((previousBand.upper - previousBand.lower) / previousBand.middle * 100) : null } : null,
    rsi: rsiFacts, macd: macdFacts, candles,
  };
  const availableViews = CHART_VIEWS.filter(view => view === 'levels' ? turns.length >= 2 : facts[view] !== null);
  return { facts, availableViews, overlays: { sma5, sma20, sma60, bands, rsi: rsiFacts ? rsi : [], macd: macdFacts ? macd : undefined } };
}

/** Facts rendered from arithmetic, rather than asking a model to copy numbers or reverse relations. */
export function chartObservationText(f: NonNullable<ReturnType<typeof chartTechnicalContext>>['facts'], currency: 'KRW' | 'USD'): Record<ChartView, string> {
  const num = (n: number) => (Math.abs(n) < .005 ? 0 : n).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  const money = (n: number) => num(n) + (currency === 'KRW' ? '원' : '달러');
  const position = (p: string) => p === 'above' ? '위' : p === 'below' ? '아래' : '같은 높이';
  const trend = f.trend, levels = f.levels, bb = f.bollinger, vol = f.volume, macd = f.macd;
  const turns = (points: typeof levels.recentPeaks, name: string) => points.length >= 2 ? `${name}은 ${money(points[0].price)}에서 ${money(points[1].price)}${euroRo(money(points[1].price))} 바뀌었어요.` : '';
  const lastCandle = f.candles.at(-1)!;
  return {
    trend: `마지막 가격: ${money(trend.lastPrice)}. ${trend.average20 !== null ? `20개 평균: ${money(trend.average20)}. 가격은 20개 평균 ${position(trend.priceVs20!)}에 있어요. ` : '20개 평균을 계산할 자료는 아직 쌓이지 않았어요. '}5개 평균: ${money(trend.average5)}${trend.average60 !== null ? `, 60개 평균: ${money(trend.average60)}` : ''}.`,
    levels: [turns(levels.recentPeaks, '이전 두 고점'), turns(levels.recentTroughs, '이전 두 저점'), levels.lastPriceVsLatestTrough ? `마지막 가격은 최근 확인된 저점 ${position(levels.lastPriceVsLatestTrough)}에 있어요.` : ''].filter(Boolean).join(' '),
    volume: vol ? `최근 5개 구간의 평균 거래량 ${num(vol.recentFiveAverage)}주는 그 앞 ${vol.precedingObservations}개 평균 ${num(vol.precedingTwentyAverage)}주의 ${num(vol.ratio)}배예요. 같은 5개 구간의 가격 변화는 ${num(vol.recentFivePriceChangePercent)}%예요.` : '',
    bollinger: bb ? `마지막 가격은 밴드 ${bb.relativePosition < 0 ? '아래 경계 밖' : bb.relativePosition > 1 ? '위 경계 밖' : bb.relativePosition < .5 ? '안쪽의 아래 절반' : '안쪽의 위 절반'}에 있어요. 아래 경계 ${money(bb.lower)}, 가운데 평균 ${money(bb.middle)}, 위 경계 ${money(bb.upper)}예요.${bb.bandwidthFiveObservationsAgoPercent !== null ? ` 평균 대비 폭은 5개 구간 전 ${num(bb.bandwidthFiveObservationsAgoPercent)}%에서 ${num(bb.bandwidthPercent)}%로 바뀌었어요.` : ''}` : '',
    rsi: f.rsi ? `14개 구간 기준 RSI는 ${num(f.rsi.value)}예요.${f.rsi.fiveObservationsAgo !== null ? ` 5개 구간 전에는 ${num(f.rsi.fiveObservationsAgo)}였어요.` : ''}` : '',
    macd: macd ? `MACD는 ${num(macd.value)}, 그 값의 9개 평균은 ${num(macd.signal)}이에요. MACD는 그 평균 ${position(compare(macd.value, macd.signal))}에 있고, 두 값 사이 거리는 직전 구간보다 ${Math.abs(macd.histogram) > Math.abs(macd.previousHistogram) ? '커졌어요' : Math.abs(macd.histogram) < Math.abs(macd.previousHistogram) ? '줄었어요' : '같아요'}.` : '',
    candles: lastCandle.high === lastCandle.low ? '마지막 구간은 높은 가격과 낮은 가격이 같아, 그 봉 하나의 몸통과 꼬리로 모양을 읽기 어려워요.' : `마지막 5분봉은 첫 가격 ${money(lastCandle.open)}, 마지막 가격 ${money(lastCandle.close)}예요. 전체 높이에서 몸통은 ${num(lastCandle.bodyShare * 100)}%, 위꼬리는 ${num(lastCandle.upperWickShare * 100)}%, 아래꼬리는 ${num(lastCandle.lowerWickShare * 100)}%예요.`,
  };
}
