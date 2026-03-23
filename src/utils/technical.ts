// ==========================================
// TECHNICAL -- Pure analysis functions (TypeScript)
// ==========================================

import type { TrendType, PatternResult, SignalSummary } from '@/config/constants';
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
      return { name: '\uB354\uBE14\uBC14\uD140 (W\uC790\uD615)', type: 'bullish', desc: '\uB450 \uBC88 \uBC14\uB2E5\uC744 \uCC0D\uACE0 \uBC18\uB4F1\uC744 \uC2DC\uB3C4\uD558\uB294 \uBAA8\uC591\uC774\uC5D0\uC694. \uBCF4\uD1B5 \uC0C1\uC2B9 \uC804\uD658\uC758 \uC2E0\uD638\uB85C \uBD10\uC694.' };
  }
  if (peaks.length >= 2 && troughs.length >= 2) {
    const pDown = peaks[peaks.length - 1].v < peaks[0].v;
    const tDown = troughs[troughs.length - 1].v < troughs[0].v;
    if (pDown && tDown)
      return { name: '\uD558\uB77D \uC1C4\uAE30\uD615', type: 'potentially_bullish', desc: '\uAC00\uACA9\uC774 \uC810\uC810 \uC88B\uC544\uC9C0\uBA70 \uB0B4\uB824\uAC00\uACE0 \uC788\uC5B4\uC694. \uC774 \uD328\uD134\uC740 \uBC18\uB4F1\uC73C\uB85C \uB05D\uB098\uB294 \uACBD\uC6B0\uAC00 \uB9CE\uC544\uC694.' };
    if (pDown && !tDown)
      return { name: '\uD558\uB77D \uC0BC\uAC01\uD615', type: 'bearish', desc: '\uACE0\uC810\uC740 \uB0AE\uC544\uC9C0\uB294\uB370 \uC800\uC810\uC740 \uC720\uC9C0 \uC911\uC774\uC5D0\uC694. \uC9C0\uC9C0\uC120 \uC774\uD0C8 \uC2DC \uCD94\uAC00 \uD558\uB77D \uAC00\uB2A5\uC131\uC774 \uC788\uC5B4\uC694.' };
    if (!pDown && tDown)
      return { name: '\uC0C1\uC2B9 \uC0BC\uAC01\uD615', type: 'bullish', desc: '\uC800\uC810\uC774 \uB192\uC544\uC9C0\uACE0 \uC788\uC5B4\uC694. \uC800\uD56D\uC120\uC744 \uB3CC\uD30C\uD558\uBA74 \uD070 \uC0C1\uC2B9\uC774 \uC62C \uC218 \uC788\uC5B4\uC694.' };
  }
  // Simple trend
  const first = closes.slice(-30, -20).reduce((a, b) => a + b, 0) / 10;
  const last = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  if (last > first * 1.05)
    return { name: '\uC0C1\uC2B9 \uCD94\uC138', type: 'bullish', desc: '\uCD5C\uADFC 30\uC77C\uAC04 \uAFB8\uC900\uD788 \uC62C\uB77C\uAC00\uB294 \uD750\uB984\uC774\uC5D0\uC694. \uC0C1\uC2B9 \uCD94\uC138\uAC00 \uC774\uC5B4\uC9C8 \uC218 \uC788\uC5B4\uC694.' };
  if (last < first * 0.95)
    return { name: '\uD558\uB77D \uCD94\uC138', type: 'bearish', desc: '\uCD5C\uADFC 30\uC77C\uAC04 \uB0B4\uB824\uAC00\uB294 \uD750\uB984\uC774\uC5D0\uC694. \uBC18\uB4F1 \uC2E0\uD638\uAC00 \uB098\uC62C \uB54C\uAE4C\uC9C0 \uAD00\uB9DD\uC774 \uC88B\uC744 \uC218 \uC788\uC5B4\uC694.' };
  return { name: '\uD6A1\uBCF4 (\uBC15\uC2A4\uAD8C)', type: 'neutral', desc: '\uC77C\uC815 \uBC94\uC704 \uC548\uC5D0\uC11C \uC624\uB974\uB0B4\uB9AC\uACE0 \uC788\uC5B4\uC694. \uBC29\uD5A5\uC774 \uC815\uD574\uC9C0\uAE30 \uC804\uAE4C\uC9C0 \uC9C0\uCF1C\uBCF4\uC138\uC694.' };
}

export function generateSummary(
  closes: number[],
  rsi: number[],
  trend: TrendType,
  cross: 'golden' | 'death' | null,
  pattern: PatternResult | null
): SignalSummary {
  const r = rsi.length ? rsi[rsi.length - 1] : 50;
  let cls = 'signal-neutral', icon = '\uD83D\uDFE1', label = '\uAD00\uB9DD';

  if (trend === 'strong_up' || (trend === 'up' && r < 70)) { cls = 'signal-positive'; icon = '\uD83D\uDFE2'; label = '\uAE0D\uC815\uC801'; }
  else if (trend === 'strong_down' || (trend === 'down' && r > 30)) { cls = 'signal-caution'; icon = '\uD83D\uDD34'; label = '\uC8FC\uC758'; }
  if (cross === 'golden') { cls = 'signal-positive'; icon = '\uD83D\uDFE2'; label = '\uAE0D\uC815\uC801'; }
  if (cross === 'death') { cls = 'signal-caution'; icon = '\uD83D\uDD34'; label = '\uC8FC\uC758'; }
  if (r < 30) { cls = 'signal-positive'; icon = '\uD83D\uDFE2'; label = '\uB9E4\uC218 \uAD00\uC810 \uAE0D\uC815\uC801'; }
  if (r > 70) { cls = 'signal-caution'; icon = '\uD83D\uDD34'; label = '\uACFC\uC5F4 \uC8FC\uC758'; }

  let body = `\uD604\uC7AC ${TREND_TEXT[trend] || '\uBD84\uC11D \uC911'}\uC774\uC5D0\uC694. `;
  if (r < 30) body += `RSI\uAC00 ${r.toFixed(0)}\uC73C\uB85C \uACFC\uB9E4\uB3C4 \uAD6C\uAC04\uC774\uC5D0\uC694. \uC5ED\uC0AC\uC801\uC73C\uB85C \uC774 \uC218\uC900\uC5D0\uC11C \uBC18\uB4F1\uC774 \uC790\uC8FC \uB098\uD0C0\uB0AC\uC5B4\uC694. `;
  else if (r > 70) body += `RSI\uAC00 ${r.toFixed(0)}\uC73C\uB85C \uACFC\uC5F4 \uAD6C\uAC04\uC774\uC5D0\uC694. \uB2E8\uAE30 \uC870\uC815\uC774 \uC62C \uC218 \uC788\uC5B4\uC694. `;
  else body += `RSI ${r.toFixed(0)}\uC73C\uB85C \uC801\uC815 \uC218\uC900\uC774\uC5D0\uC694. `;
  if (cross === 'golden') body += '\uCD5C\uADFC \uACE8\uB4E0\uD06C\uB85C\uC2A4(\uB2E8\uAE30\uC120\uC774 \uC7A5\uAE30\uC120\uC744 \uC0C1\uD5A5 \uB3CC\uD30C)\uAC00 \uBC1C\uC0DD\uD588\uC5B4\uC694. \uC0C1\uC2B9 \uC2E0\uD638\uB85C \uBCFC \uC218 \uC788\uC5B4\uC694.';
  if (cross === 'death') body += '\uCD5C\uADFC \uB370\uB4DC\uD06C\uB85C\uC2A4(\uB2E8\uAE30\uC120\uC774 \uC7A5\uAE30\uC120\uC744 \uD558\uD5A5 \uB3CC\uD30C)\uAC00 \uBC1C\uC0DD\uD588\uC5B4\uC694. \uCD94\uAC00 \uD558\uB77D\uC5D0 \uC8FC\uC758\uD558\uC138\uC694.';

  return { cls, icon, label, body };
}
