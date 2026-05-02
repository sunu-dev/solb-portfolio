// ==========================================
// ALERTS ENGINE -- Smart alert checks (pure functions)
// ==========================================
//
// 정책 SSOT: docs/NOTIFICATION_POLICY.md
// 채널·카테고리는 각 알림에 박혀있고, 라우터(푸시/토스트/사이드바)가
// channels 필드를 보고 분기한다. ALERT_POLICY 맵을 단일 진실 원천으로 둔다.

import type { PortfolioStocks, QuoteData, CandleRaw } from '@/config/constants';
import { STOCK_KR } from '@/config/constants';
import { calcSMA, calcRSI, detectCross, calcBollingerBands, calcMACD } from '@/utils/technical';
import { computeVolBaseline, computeZScore } from '@/utils/volatility';
import { validateAlertMessage } from '@/utils/alertCompliance';

/** 알림 노출 채널 — 정책 SSOT: docs/NOTIFICATION_POLICY.md §2 */
export type AlertChannel = 'push' | 'toast' | 'inapp';

/** 알림 카테고리 — Settings ON/OFF 단위 */
export type AlertCategory = 'price' | 'indicator' | 'market' | 'portfolio' | 'celebrate';

export interface Alert {
  id: string;           // unique: "symbol-type-condition"
  symbol: string;       // stock symbol
  type: 'urgent' | 'risk' | 'opportunity' | 'insight' | 'celebrate';
  message: string;      // Korean, beginner-friendly
  detail: string;       // one more line of context
  severity: number;     // 1=highest, 5=lowest (for sorting)
  timestamp: number;
  channels: AlertChannel[]; // 정책에 따라 라우팅
  category: AlertCategory;  // 사용자 ON/OFF 단위
}

/**
 * 알림 condition별 채널·카테고리 정책 맵.
 * 변경 시 docs/NOTIFICATION_POLICY.md §2 표도 함께 갱신할 것.
 */
const ALERT_POLICY: Record<string, { channels: AlertChannel[]; category: AlertCategory }> = {
  // 가격 도달 — 행동 요구, 푸시 포함
  'stoploss-hit':       { channels: ['push', 'toast', 'inapp'], category: 'price' },
  'stoploss-pct':       { channels: ['push', 'toast', 'inapp'], category: 'price' },
  'target-hit':         { channels: ['push', 'toast', 'inapp'], category: 'price' },
  'target-return':      { channels: ['push', 'toast', 'inapp'], category: 'price' },
  'target-profit-usd':  { channels: ['push', 'toast', 'inapp'], category: 'price' },
  'target-profit-krw':  { channels: ['push', 'toast', 'inapp'], category: 'price' },

  // 가격 근접 — 토스트만, 푸시 없음
  'stoploss-near':      { channels: ['toast', 'inapp'],         category: 'price' },
  'target-near':        { channels: ['toast', 'inapp'],         category: 'price' },
  'buy-zone':           { channels: ['toast', 'inapp'],         category: 'price' },

  // 시장/포트폴리오 — 큰 손실은 푸시
  'portfolio-down':     { channels: ['push', 'toast', 'inapp'], category: 'portfolio' },
  'daily-plunge':       { channels: ['push', 'toast', 'inapp'], category: 'market' },
  'daily-surge':        { channels: ['toast', 'inapp'],         category: 'market' },
  'zscore-extreme':     { channels: ['toast', 'inapp'],         category: 'market' },
  'below-avgcost':      { channels: ['inapp'],                  category: 'portfolio' },

  // 기술지표·52주 — 인앱 한정 (자문업 회피 + 알림 피로 방지)
  'near-52w-low':       { channels: ['inapp'],                  category: 'indicator' },
  'near-52w-high':      { channels: ['inapp'],                  category: 'indicator' },
  'golden-cross':       { channels: ['inapp'],                  category: 'indicator' },
  'death-cross':        { channels: ['inapp'],                  category: 'indicator' },
  'rsi-oversold':       { channels: ['inapp'],                  category: 'indicator' },
  'rsi-overbought':     { channels: ['inapp'],                  category: 'indicator' },
  'bb-lower':           { channels: ['inapp'],                  category: 'indicator' },
  'bb-upper':           { channels: ['inapp'],                  category: 'indicator' },
  'macd-bull':          { channels: ['inapp'],                  category: 'indicator' },
  'macd-bear':          { channels: ['inapp'],                  category: 'indicator' },

  // 복합 신호 — 토스트 + 인앱
  'composite-strong-bounce':    { channels: ['toast', 'inapp'], category: 'indicator' },
  'composite-strong-uptrend':   { channels: ['toast', 'inapp'], category: 'indicator' },
  'composite-overheated':       { channels: ['toast', 'inapp'], category: 'indicator' },
  'composite-strong-downtrend': { channels: ['toast', 'inapp'], category: 'indicator' },
  'composite-squeeze':          { channels: ['toast', 'inapp'], category: 'indicator' },
};

/** 알 수 없는 condition — 보수적으로 inapp만 (푸시 절대 X) */
const DEFAULT_POLICY = { channels: ['inapp'] as AlertChannel[], category: 'indicator' as AlertCategory };

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
  // 정책 SSOT 조회 — 매핑 누락 시 가장 보수적인 채널만
  const policy = ALERT_POLICY[condition] ?? DEFAULT_POLICY;

  // 컴플라이언스 검사 — dev에서 console.warn, prod silent (라우터에서도 별도 검사)
  validateAlertMessage(message, detail);

  return {
    id: `${symbol}-${type}-${condition}`,
    symbol,
    type,
    message,
    detail,
    severity,
    timestamp: Date.now(),
    channels: policy.channels,
    category: policy.category,
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
        `${name} 관심 가격 도달`,
        `현재가 $${price.toFixed(2)}이 설정 가격 $${stock.buyBelow} 이하예요.`
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

  // --- Z-score adaptive alerts (P3) ---
  // 종목별 변동성 베이스라인 대비 이례적 일일 변동 감지.
  // 절대값 기반 RSI/52주 알림이 놓치는 "이 종목엔 이상한 움직임" 잡아냄.
  // 안정주 1.5σ도 신호로 / 변동주 3% 변동도 노이즈면 무시.
  for (const stock of allStocks) {
    const candle = rawCandles[stock.symbol];
    const q = macroData[stock.symbol] as QuoteData | undefined;
    if (!candle?.c?.length || !q?.c || q.dp == null) continue;

    const baseline = computeVolBaseline(candle);
    const z = computeZScore(q.dp, baseline);
    if (z === null) continue; // 표본 < 20 → 신뢰 불가

    const name = kr(stock.symbol);
    const absZ = Math.abs(z);

    // |z| ≥ 2.5: 이례적 (99% 이상치) — severity 2
    // |z| ≥ 3.0: 극단치 — severity 1
    if (absZ >= 2.5) {
      const isUp = z > 0;
      const emoji = isUp ? '🔥' : '🧊';
      const direction = isUp ? '급등' : '급락';
      const severity = absZ >= 3 ? 1 : 2;
      const alertType: Alert['type'] = isUp ? 'opportunity' : 'risk';
      alerts.push(makeAlert(
        stock.symbol, 'zscore-extreme', alertType, severity,
        `${name} ${emoji} 평소 ${absZ.toFixed(1)}σ ${direction}`,
        `오늘 ${q.dp >= 0 ? '+' : ''}${q.dp.toFixed(2)}% — 30일 변동성(σ ${baseline.stdReturn.toFixed(1)}%) 대비 ${absZ.toFixed(1)}배. 평소와 다른 움직임이에요.`
      ));
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
        `${name} 평균 가격이 위로 교차했어요`,
        `단기 평균(5일)이 장기 평균(20일)을 넘었어요. 상승 방향으로 바뀌는 신호일 수 있어요.`
      ));
    }

    // 12. Death cross
    if (cross === 'death') {
      alerts.push(makeAlert(
        stock.symbol, 'death-cross', 'risk', 3,
        `${name} 평균 가격이 아래로 교차했어요`,
        `단기 평균(5일)이 장기 평균(20일)을 내려갔어요. 하락 방향으로 바뀌는 신호일 수 있어요.`
      ));
    }

    // RSI checks
    const rsi = calcRSI(closes);
    if (rsi.length > 0) {
      const rsiVal = rsi[rsi.length - 1];

      // 13. RSI oversold
      if (rsiVal < 30) {
        alerts.push(makeAlert(
          stock.symbol, 'rsi-oversold', 'insight', 3,
          `${name} RSI ${rsiVal.toFixed(0)} — 많이 떨어진 상태`,
          `RSI가 30 이하로 많이 떨어진 구간이에요. 과매도 구간에 해당해요.`
        ));
      }

      // 14. RSI overbought
      if (rsiVal > 70) {
        alerts.push(makeAlert(
          stock.symbol, 'rsi-overbought', 'risk', 4,
          `${name} RSI ${rsiVal.toFixed(0)} — 많이 오른 상태`,
          `RSI가 70 이상으로 많이 오른 구간이에요. 단기 조정 가능성이 있어요.`
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
          stock.symbol, 'bb-lower', 'insight', 4,
          `${name} 가격이 평소 범위 아래로 내려갔어요`,
          `가격이 평소 움직이는 범위(하단 $${lastBB.lower.toFixed(2)})를 벗어났어요.`
        ));
      }

      // 16. Bollinger upper band
      if (price >= lastBB.upper) {
        alerts.push(makeAlert(
          stock.symbol, 'bb-upper', 'risk', 4,
          `${name} 가격이 평소 범위 위로 올라갔어요`,
          `가격이 평소 움직이는 범위(상단 $${lastBB.upper.toFixed(2)})를 벗어났어요. 과열 구간일 수 있어요.`
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
            `${name} 상승 힘이 세지는 신호 (MACD 상향 교차)`,
            `MACD가 시그널선을 상향 돌파했어요. 상승 모멘텀이 강해지고 있어요.`
          ));
        }

        // 18. MACD bearish cross
        if (prevHist > 0 && lastHist <= 0) {
          alerts.push(makeAlert(
            stock.symbol, 'macd-bear', 'risk', 3,
            `${name} 하락 힘이 세지는 신호 (MACD 하향 교차)`,
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

  // 20. Target return / profit / stop-loss% achieved
  // 정합성 결함 H2-calc 수정 — 환율 미수신 시 1400 fallback이 KRW 임계 거짓 트리거 유발
  // null 사용 후 KRW 검사에서 skip 처리
  const usdKrwRaw = (macroData['USD/KRW'] as { value?: number } | undefined)?.value;
  const usdKrw: number | null = usdKrwRaw && usdKrwRaw > 0 ? Number(usdKrwRaw) : null;
  for (const stock of investingStocks) {
    const q = macroData[stock.symbol] as QuoteData | undefined;
    const price = q?.c || 0;
    if (stock.avgCost <= 0 || stock.shares <= 0 || price <= 0) continue;

    const plPct = ((price - stock.avgCost) / stock.avgCost) * 100;
    const plUSD = (price - stock.avgCost) * stock.shares;
    const name = kr(stock.symbol);
    const isKR = stock.symbol.endsWith('.KS') || stock.symbol.endsWith('.KQ');

    // 20a. Target return %
    if (stock.targetReturn > 0 && plPct >= stock.targetReturn) {
      alerts.push(makeAlert(
        stock.symbol, 'target-return', 'celebrate', 2,
        `${name} 목표 수익률 달성!`,
        `현재 수익률 ${plPct.toFixed(1)}%로 목표(${stock.targetReturn}%)를 달성했어요!`
      ));
    }

    // 20b. Target profit USD
    if (!isKR && (stock.targetProfitUSD ?? 0) > 0 && plUSD >= (stock.targetProfitUSD ?? 0)) {
      alerts.push(makeAlert(
        stock.symbol, 'target-profit-usd', 'celebrate', 2,
        `${name} 목표 수익금 달성!`,
        `현재 수익 $${plUSD.toFixed(0)}로 목표($${stock.targetProfitUSD})를 달성했어요!`
      ));
    }

    // 20c. Target profit KRW — 환율 미수신(usdKrw=null) 시 미국 종목 KRW 평가 보류
    if ((stock.targetProfitKRW ?? 0) > 0 && (isKR || usdKrw !== null)) {
      const plKRW = isKR ? plUSD : plUSD * (usdKrw as number);
      if (plKRW >= (stock.targetProfitKRW ?? 0)) {
        const fmtWon = (w: number) => w >= 100_000_000
          ? `${(w / 100_000_000).toFixed(1)}억원`
          : `${Math.round(w / 10_000)}만원`;
        alerts.push(makeAlert(
          stock.symbol, 'target-profit-krw', 'celebrate', 2,
          `${name} 목표 수익금 달성!`,
          `현재 수익 ₩${fmtWon(plKRW)}으로 목표(₩${fmtWon(stock.targetProfitKRW ?? 0)})를 달성했어요!`
        ));
      }
    }

    // 20d. Stop loss %
    if ((stock.stopLossPct ?? 0) > 0 && plPct <= -(stock.stopLossPct ?? 0)) {
      alerts.push(makeAlert(
        stock.symbol, 'stoploss-pct', 'urgent', 1,
        `${name} 손절률 도달!`,
        `현재 손실 ${plPct.toFixed(1)}%로 손절 기준(-${stock.stopLossPct}%)에 도달했어요.`
      ));
    }
  }

  // Sort by severity (lowest number = highest priority), then by timestamp
  alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity - b.severity;
    return b.timestamp - a.timestamp;
  });

  // 동적 임계치: severity 1~2 (urgent/risk)는 모두 보장, 나머지는 한도 내 top N
  // 총 상한 25개 — 이보다 많이 나오면 UI 폭주 가능
  const urgentAndRisk = alerts.filter(a => a.severity <= 2);
  const lower = alerts.filter(a => a.severity > 2);
  const lowerBudget = Math.max(0, 25 - urgentAndRisk.length);
  return [...urgentAndRisk, ...lower.slice(0, lowerBudget)];
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
    alerts.push(makeAlert(symbol, 'composite-strong-bounce', 'insight', 2,
      `${name} 여러 지표가 동시에 변하고 있어요`,
      `RSI ${rsiVal.toFixed(0)}(과매도 구간) + 볼린저 하단 근접 + 거래량 ${(volRatio * 100).toFixed(0)}% — 주요 지표를 함께 확인해보세요.`));
  }

  // 2. 골든크로스 + MACD 상향 + 거래량 증가 = 강한 상승 전환
  if (cross === 'golden' && macdLast > sigLast && volRatio > 1.3) {
    alerts.push(makeAlert(symbol, 'composite-strong-uptrend', 'insight', 2,
      `${name} 상승 방향 지표 동시 변화`,
      `골든크로스 + MACD 상향 교차 + 거래량 증가 — 여러 지표가 상승 방향으로 전환되고 있어요.`));
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
      `${name} 하락 방향 지표 동시 변화`,
      `데드크로스 + MACD 하향 교차 + 거래량 증가 — 여러 지표가 하락 방향으로 전환되고 있어요.`));
  }

  // 5. 횡보 + 볼린저 밴드 수축 = 큰 움직임 예고
  if (lastBB) {
    const bbWidth = (lastBB.upper - lastBB.lower) / lastBB.middle;
    const prevBB = bb.length > 20 ? bb[bb.length - 20] : null;
    const prevWidth = prevBB ? (prevBB.upper - prevBB.lower) / prevBB.middle : bbWidth;
    if (bbWidth < prevWidth * 0.6 && rsiVal > 40 && rsiVal < 60) {
      alerts.push(makeAlert(symbol, 'composite-squeeze', 'insight', 3,
        `${name} 변동성이 줄어들고 있어요`,
        `볼린저 밴드가 좁아지고 RSI가 중립이에요. 향후 변동폭이 커질 수 있어요.`));
    }
  }
}