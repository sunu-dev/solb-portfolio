// ==========================================
// ALERTS ENGINE -- Smart alert checks (pure functions)
// ==========================================

import type { PortfolioStocks, QuoteData, CandleRaw } from '@/config/constants';
import { STOCK_KR } from '@/config/constants';
import { calcSMA, calcRSI, detectCross, calcBollingerBands, calcMACD } from '@/utils/technical';

export interface Alert {
  id: string;           // unique: "symbol-type-condition"
  symbol: string;       // stock symbol
  type: 'urgent' | 'risk' | 'opportunity' | 'insight' | 'celebrate';
  message: string;      // Korean, beginner-friendly
  detail: string;       // one more line of context
  severity: number;     // 1=highest, 5=lowest (for sorting)
  timestamp: number;
}

function kr(symbol: string): string {
  return STOCK_KR[symbol] || symbol;
}

function makeAlert(
  symbol: string,
  condition: string,
  type: Alert['type'],
  severity: number,
  message: string,
  detail: string
): Alert {
  return {
    id: `${symbol}-${type}-${condition}`,
    symbol,
    type,
    message,
    detail,
    severity,
    timestamp: Date.now(),
  };
}

export function checkAllAlerts(
  stocks: PortfolioStocks,
  macroData: Record<string, any>,
  rawCandles: Record<string, CandleRaw>,
  candleCache: Record<string, Record<number, number>>
): Alert[] {
  const alerts: Alert[] = [];

  const investingStocks = stocks.investing || [];
  const watchingStocks = stocks.watching || [];
  const allStocks = [...investingStocks, ...watchingStocks];

  // --- Price-based checks ---
  for (const stock of allStocks) {
    const q = macroData[stock.symbol] as QuoteData | undefined;
    if (!q || !q.c) continue;

    const price = q.c;
    const dp = q.dp || 0;
    const name = kr(stock.symbol);
    const isInvesting = investingStocks.some(s => s.symbol === stock.symbol);

    // 1. Stop-loss reached
    if (stock.stopLoss && stock.stopLoss > 0 && price <= stock.stopLoss) {
      alerts.push(makeAlert(
        stock.symbol, 'stoploss-hit', 'urgent', 1,
        `${name} 손절가 도달!`,
        `현재가 $${price.toFixed(2)}이 손절가 $${stock.stopLoss.toFixed(2)}에 도달했어요. 즉시 확인하세요.`
      ));
    }
    // 2. Stop-loss approaching
    else if (stock.stopLoss && stock.stopLoss > 0 && price <= stock.stopLoss * 1.05) {
      alerts.push(makeAlert(
        stock.symbol, 'stoploss-near', 'risk', 2,
        `${name} 손절가 근접`,
        `현재가 $${price.toFixed(2)}이 손절가 $${stock.stopLoss.toFixed(2)}에 가까워지고 있어요.`
      ));
    }

    // 3. Target price reached
    if (stock.targetSell && stock.targetSell > 0 && price >= stock.targetSell) {
      alerts.push(makeAlert(
        stock.symbol, 'target-hit', 'celebrate', 1,
        `${name} 목표가 달성!`,
        `현재가 $${price.toFixed(2)}이 목표 매도가 $${stock.targetSell.toFixed(2)}에 도달했어요!`
      ));
    }
    // 4. Target price approaching
    else if (stock.targetSell && stock.targetSell > 0 && price >= stock.targetSell * 0.95) {
      alerts.push(makeAlert(
        stock.symbol, 'target-near', 'opportunity', 3,
        `${name} 목표가 근접`,
        `현재가 $${price.toFixed(2)}이 목표 매도가 $${stock.targetSell.toFixed(2)}의 95%에 도달했어요.`
      ));
    }

    // 5. Below avg cost (investing only)
    if (isInvesting && stock.avgCost > 0 && stock.shares > 0 && price < stock.avgCost) {
      const lossPct = ((price - stock.avgCost) / stock.avgCost * 100).toFixed(1);
      alerts.push(makeAlert(
        stock.symbol, 'below-avgcost', 'risk', 3,
        `${name} 평단가 하회`,
        `현재가 $${price.toFixed(2)}가 평단가 $${stock.avgCost.toFixed(2)}보다 낮아요 (${lossPct}%).`
      ));
    }

    // 6. Buy zone entered (watching only)
    if (!isInvesting && stock.buyBelow && stock.buyBelow > 0 && price <= stock.buyBelow) {
      alerts.push(makeAlert(
        stock.symbol, 'buy-zone', 'opportunity', 2,
        `${name} 매수 구간 진입!`,
        `현재가 $${price.toFixed(2)}이 목표 매수가 $${stock.buyBelow} 이하예요.`
      ));
    }

    // 7. Daily surge
    if (dp > 5) {
      alerts.push(makeAlert(
        stock.symbol, 'daily-surge', 'insight', 4,
        `${name} +${dp.toFixed(1)}% 급등`,
        `오늘 ${name}이(가) 큰 폭으로 상승했어요. 이유를 확인해보세요.`
      ));
    }

    // 8. Daily plunge
    if (dp < -5) {
      alerts.push(makeAlert(
        stock.symbol, 'daily-plunge', 'risk', 2,
        `${name} ${dp.toFixed(1)}% 급락`,
        `오늘 ${name}이(가) 큰 폭으로 하락했어요. 손절 라인을 점검하세요.`
      ));
    }

    // 9. Near 52-week low (using daily high/low from quote as proxy)
    // We use candle data for better 52-week range
    const candle = rawCandles[stock.symbol];
    if (candle && candle.l && candle.l.length > 0) {
      const low52 = Math.min(...candle.l);
      if (low52 > 0 && price <= low52 * 1.02) {
        alerts.push(makeAlert(
          stock.symbol, 'near-52w-low', 'risk', 3,
          `${name} 52주 최저가 근접`,
          `현재가 $${price.toFixed(2)}이 52주 최저가 $${low52.toFixed(2)}에 가까워요.`
        ));
      }
    }

    // 10. Near 52-week high
    if (candle && candle.h && candle.h.length > 0) {
      const high52 = Math.max(...candle.h);
      if (high52 > 0 && price >= high52 * 0.98) {
        alerts.push(makeAlert(
          stock.symbol, 'near-52w-high', 'insight', 4,
          `${name} 52주 최고가 근접`,
          `현재가 $${price.toFixed(2)}이 52주 최고가 $${high52.toFixed(2)}에 가까워요.`
        ));
      }
    }
  }

  // --- Technical checks ---
  for (const stock of allStocks) {
    const candle = rawCandles[stock.symbol];
    if (!candle || !candle.c || candle.c.length < 30) continue;

    const closes = candle.c;
    const name = kr(stock.symbol);
    const q = macroData[stock.symbol] as QuoteData | undefined;
    const price = q?.c || closes[closes.length - 1];

    // SMA cross checks
    const sma5 = calcSMA(closes, 5);
    const sma20 = calcSMA(closes, 20);

    // 11. Golden cross
    const cross = detectCross(sma5, sma20);
    if (cross === 'golden') {
      alerts.push(makeAlert(
        stock.symbol, 'golden-cross', 'insight', 3,
        `${name} 골든크로스 발생`,
        `단기선(5일)이 중기선(20일)을 상향 돌파했어요. 상승 전환 신호예요.`
      ));
    }

    // 12. Death cross
    if (cross === 'death') {
      alerts.push(makeAlert(
        stock.symbol, 'death-cross', 'risk', 3,
        `${name} 데드크로스 발생`,
        `단기선(5일)이 중기선(20일)을 하향 돌파했어요. 하락 주의 신호예요.`
      ));
    }

    // RSI checks
    const rsi = calcRSI(closes);
    if (rsi.length > 0) {
      const rsiVal = rsi[rsi.length - 1];

      // 13. RSI oversold
      if (rsiVal < 30) {
        alerts.push(makeAlert(
          stock.symbol, 'rsi-oversold', 'opportunity', 3,
          `${name} RSI ${rsiVal.toFixed(0)} 과매도`,
          `RSI가 30 이하로 과매도 구간이에요. 반등 가능성을 살펴보세요.`
        ));
      }

      // 14. RSI overbought
      if (rsiVal > 70) {
        alerts.push(makeAlert(
          stock.symbol, 'rsi-overbought', 'risk', 4,
          `${name} RSI ${rsiVal.toFixed(0)} 과매수`,
          `RSI가 70 이상으로 과열 구간이에요. 단기 조정 가능성이 있어요.`
        ));
      }
    }

    // Bollinger Bands checks
    const bb = calcBollingerBands(closes);
    if (bb.length > 0) {
      const lastBB = bb[bb.length - 1];

      // 15. Bollinger lower band
      if (price <= lastBB.lower) {
        alerts.push(makeAlert(
          stock.symbol, 'bb-lower', 'opportunity', 4,
          `${name} 볼린저 하단 이탈`,
          `가격이 볼린저밴드 하단($${lastBB.lower.toFixed(2)})을 벗어났어요. 반등 가능성이 있어요.`
        ));
      }

      // 16. Bollinger upper band
      if (price >= lastBB.upper) {
        alerts.push(makeAlert(
          stock.symbol, 'bb-upper', 'risk', 4,
          `${name} 볼린저 상단 이탈`,
          `가격이 볼린저밴드 상단($${lastBB.upper.toFixed(2)})을 벗어났어요. 과열 주의예요.`
        ));
      }
    }

    // MACD checks
    const macd = calcMACD(closes);
    if (macd.macd.length >= 2 && macd.signal.length >= 2) {
      const histLen = macd.histogram.length;
      if (histLen >= 2) {
        const prevHist = macd.histogram[histLen - 2];
        const lastHist = macd.histogram[histLen - 1];

        // 17. MACD bullish cross
        if (prevHist < 0 && lastHist >= 0) {
          alerts.push(makeAlert(
            stock.symbol, 'macd-bull', 'insight', 3,
            `${name} MACD 상향 교차`,
            `MACD가 시그널선을 상향 돌파했어요. 상승 모멘텀이 강해지고 있어요.`
          ));
        }

        // 18. MACD bearish cross
        if (prevHist > 0 && lastHist <= 0) {
          alerts.push(makeAlert(
            stock.symbol, 'macd-bear', 'risk', 3,
            `${name} MACD 하향 교차`,
            `MACD가 시그널선을 하향 돌파했어요. 하락 모멘텀이 강해지고 있어요.`
          ));
        }
      }
    }
  }

  // --- Composite alerts (Level 1.5) ---
  for (const stock of allStocks) {
    const quote = macroData[stock.symbol] as QuoteData;
    const candle = rawCandles[stock.symbol];
    if (quote?.c) checkCompositeAlerts(stock.symbol, quote, candle, alerts);
  }

  // --- Portfolio-wide checks ---

  // 19. Portfolio down >10%
  let totalValue = 0;
  let totalCost = 0;
  for (const stock of investingStocks) {
    const q = macroData[stock.symbol] as QuoteData | undefined;
    const price = q?.c || 0;
    if (stock.avgCost > 0 && stock.shares > 0 && price > 0) {
      totalValue += price * stock.shares;
      totalCost += stock.avgCost * stock.shares;
    }
  }
  if (totalCost > 0) {
    const totalPLPct = ((totalValue - totalCost) / totalCost) * 100;
    if (totalPLPct < -10) {
      alerts.push(makeAlert(
        'PORTFOLIO', 'portfolio-down', 'risk', 1,
        `포트폴리오 ${totalPLPct.toFixed(1)}% 하락`,
        `전체 포트폴리오가 10% 이상 손실 중이에요. 리밸런싱을 검토하세요.`
      ));
    }
  }

  // 20. Target return achieved
  for (const stock of investingStocks) {
    const q = macroData[stock.symbol] as QuoteData | undefined;
    const price = q?.c || 0;
    if (stock.avgCost > 0 && stock.shares > 0 && price > 0 && stock.targetReturn > 0) {
      const plPct = ((price - stock.avgCost) / stock.avgCost) * 100;
      if (plPct >= stock.targetReturn) {
        const name = kr(stock.symbol);
        alerts.push(makeAlert(
          stock.symbol, 'target-return', 'celebrate', 2,
          `${name} 목표 수익률 달성!`,
          `현재 수익률 ${plPct.toFixed(1)}%로 목표(${stock.targetReturn}%)를 달성했어요!`
        ));
      }
    }
  }

  // Sort by severity (lowest number = highest priority), then by timestamp
  alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity - b.severity;
    return b.timestamp - a.timestamp;
  });

  // Return top 10
  return alerts.slice(0, 10);
}

// ==========================================
// Composite alerts -- Level 1.5 compound conditions
// ==========================================

function checkCompositeAlerts(symbol: string, quote: QuoteData, candle: CandleRaw | undefined, alerts: Alert[]): void {
  if (!candle || !candle.c || candle.c.length < 30) return;

  const closes = candle.c;
  const sma20 = calcSMA(closes, 20);
  const rsi = calcRSI(closes);
  const bb = calcBollingerBands(closes);
  const macd = calcMACD(closes);
  const volumes = candle.v || [];
  const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const lastVol = volumes[volumes.length - 1] || 0;
  const volRatio = avgVol ? lastVol / avgVol : 1;
  const price = quote.c;
  const rsiVal = rsi.length ? rsi[rsi.length - 1] : 50;
  const lastBB = bb.length ? bb[bb.length - 1] : null;
  const macdLast = macd.macd.length ? macd.macd[macd.macd.length - 1] : 0;
  const sigLast = macd.signal.length ? macd.signal[macd.signal.length - 1] : 0;
  const cross = detectCross(calcSMA(closes, 5), sma20);
  const name = kr(symbol);

  // 1. RSI 과매도 + 볼린저 하단 + 거래량 증가 = 강한 반등 신호
  if (rsiVal < 30 && lastBB && price <= lastBB.lower * 1.02 && volRatio > 1.3) {
    alerts.push(makeAlert(symbol, 'composite-strong-bounce', 'opportunity', 2,
      `${name} 강한 반등 신호 감지!`,
      `RSI ${rsiVal.toFixed(0)}(과매도) + 볼린저 하단 근접 + 거래량 ${(volRatio * 100).toFixed(0)}% — 여러 지표가 동시에 반등을 가리키고 있어요.`));
  }

  // 2. 골든크로스 + MACD 상향 + 거래량 증가 = 강한 상승 전환
  if (cross === 'golden' && macdLast > sigLast && volRatio > 1.3) {
    alerts.push(makeAlert(symbol, 'composite-strong-uptrend', 'insight', 2,
      `${name} 강한 상승 전환 신호!`,
      `골든크로스 + MACD 상향 교차 + 거래량 증가 — 상승 추세 전환의 강한 신호예요.`));
  }

  // 3. RSI 과매수 + 볼린저 상단 + 거래량 감소 = 조정 가능성
  if (rsiVal > 70 && lastBB && price >= lastBB.upper * 0.98 && volRatio < 0.7) {
    alerts.push(makeAlert(symbol, 'composite-overheated', 'risk', 2,
      `${name} 과열 + 관심 감소 주의`,
      `RSI ${rsiVal.toFixed(0)}(과매수) + 볼린저 상단 + 거래량 감소 — 조정이 올 수 있어요.`));
  }

  // 4. 데드크로스 + MACD 하향 + 거래량 증가 = 강한 하락 전환
  if (cross === 'death' && macdLast < sigLast && volRatio > 1.3) {
    alerts.push(makeAlert(symbol, 'composite-strong-downtrend', 'risk', 2,
      `${name} 강한 하락 전환 신호`,
      `데드크로스 + MACD 하향 교차 + 거래량 증가 — 하락 추세 전환에 주의하세요.`));
  }

  // 5. 횡보 + 볼린저 밴드 수축 = 큰 움직임 예고
  if (lastBB) {
    const bbWidth = (lastBB.upper - lastBB.lower) / lastBB.middle;
    const prevBB = bb.length > 20 ? bb[bb.length - 20] : null;
    const prevWidth = prevBB ? (prevBB.upper - prevBB.lower) / prevBB.middle : bbWidth;
    if (bbWidth < prevWidth * 0.6 && rsiVal > 40 && rsiVal < 60) {
      alerts.push(makeAlert(symbol, 'composite-squeeze', 'insight', 3,
        `${name} 변동성 수축 — 큰 움직임 예고`,
        `볼린저 밴드가 좁아지고 RSI가 중립이에요. 곧 큰 방향이 정해질 수 있어요.`));
    }
  }
}