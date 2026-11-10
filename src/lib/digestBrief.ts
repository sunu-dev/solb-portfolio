import type { PortfolioStocks } from '@/config/constants';
import { STOCK_KR } from '@/config/constants';
import { findCanonicalSnapshotNearDate, getDateDaysAgo, getSnapshotKrwTotals, type DailySnapshot } from '@/utils/dailySnapshot';
import { isSingleStockLeverage } from '@/utils/leverageGuard';
import { DISCLAIMER_DIGEST } from '@/utils/alertCompliance';
import { getStockCurrency, summarizePortfolioCurrency, type StockCurrency } from '@/utils/stockCurrency';
export type DigestSlot = 'morning' | 'close';
export const SLOT_FRAMING = {
  morning: { upEmoji: '🌅', downEmoji: '🌫️', briefTitle: '오늘 아침 브리핑', todayFirst: false, notificationType: 'morning_brief' },
  close: { upEmoji: '📊', downEmoji: '🌆', briefTitle: '국장 마감 브리핑', todayFirst: true, notificationType: 'digest_kr_close' },
};

export function fmtWon(w: number): string {
  if (w >= 100_000_000) return `${(w / 100_000_000).toFixed(1)}억원`;
  if (w >= 10_000) return `${Math.round(w / 10_000)}만원`;
  return `${w.toLocaleString()}원`;
}

export interface BriefData {
  dataNote?: string;
  todayDelta: number | null;            // 오늘 일일 변동 (KRW)
  todayPct: number | null;              // 오늘 변동률 (%)
  totalValue: number | null;            // 현재 평가금액 (KRW)
  biggestMover: { symbol: string; dp: number } | null;
  yesterdayDelta: number | null; // 어제 스냅샷 대비 변동 (KRW)
  yesterdayPct: number | null;
}

export interface PriceCache {
  [symbol: string]: { c: number; d: number; dp: number } | null;
}

/** A stored provider value without a recent observation time is not a current quote. */
export function digestPriceQuote(value: unknown, now = Date.now()): PriceCache[string] {
  if (!value || typeof value !== 'object') return null;
  const quote = value as Record<string, unknown>;
  if (typeof quote.c !== 'number' || !Number.isFinite(quote.c) || quote.c <= 0
    || typeof quote.d !== 'number' || !Number.isFinite(quote.d)
    || typeof quote.dp !== 'number' || !Number.isFinite(quote.dp)
    || typeof quote.t !== 'number' || !Number.isFinite(quote.t)
    || quote.t * 1000 > now + 300000 || now - quote.t * 1000 >= 4 * 86400000) return null;
  return { c: quote.c, d: quote.d, dp: quote.dp };
}

export async function buildBrief(
  stocks: PortfolioStocks,
  snapshots: DailySnapshot[],
  usdKrw: number | null,
  priceCache: PriceCache,
  slot: DigestSlot,
): Promise<BriefData | null> {
  // '중간 옵션'(2026-05-29): 단일종목 레버리지 보유분도 포트폴리오 손익 계산엔 포함한다
  // (정확한 보유 현황 = 관리·확인 목적). 단 아래 biggestMover('오늘의 주목 종목')로는
  // 스포트라이트하지 않는다 — 음의 복리 종목이 매일 주목 종목으로 푸시되면 매수/매도
  // 유인으로 읽힐 수 있으므로.
  const investing = (stocks.investing || []).filter(s => s.shares > 0 && s.avgCost > 0);
  if (investing.length === 0) return null;

  const missingFx = investing.some(stock => getStockCurrency(stock.symbol, stock.currency) === 'USD')
    && !(typeof usdKrw === 'number' && Number.isFinite(usdKrw) && usdKrw > 0);
  const missingPrice = investing.some(stock => {
    const quote = priceCache[stock.symbol];
    return !quote || !Number.isFinite(quote.c) || quote.c <= 0 || !Number.isFinite(quote.d) || !Number.isFinite(quote.dp);
  });
  const complete = !missingFx && !missingPrice;
  // 캐시에서 시세 조회 (cron 시작 시 unique 심볼 한 번에 fetch했음)
  const summary = summarizePortfolioCurrency(
    investing.map((stock) => {
      const quote = priceCache[stock.symbol];
      return {
        symbol: stock.symbol,
        currency: stock.currency,
        avgCost: stock.avgCost,
        shares: stock.shares,
        currentPrice: quote?.c || 0,
        dayChange: quote?.d || 0,
        purchaseRate: stock.purchaseRate,
      };
    }),
    usdKrw ?? 0,
  );
  const totalValue = complete ? summary.totalValueKrw : null;
  const todayDelta = complete ? summary.todayChangeKrw : null;
  const prevValue = totalValue !== null && todayDelta !== null ? totalValue - todayDelta : null;
  // 주목 종목 후보: 슬롯 시장 매칭(close=국장 KR / morning=간밤 미장 US) 우선, 없으면 전체 fallback.
  type Mover = { symbol: string; dp: number; absDp: number };
  let biggestMatch: Mover | null = null;
  let biggestAny: Mover | null = null;
  for (const stock of investing) {
    const q = priceCache[stock.symbol];
    if (!q || !Number.isFinite(q.c) || q.c <= 0 || !Number.isFinite(q.d) || !Number.isFinite(q.dp)) continue;
    const isKR = getStockCurrency(stock.symbol, stock.currency) === 'KRW';
    // 레버리지는 손익엔 반영하되 '오늘의 주목 종목'으로는 띄우지 않음 (유인 억제).
    if (isSingleStockLeverage(stock.symbol, stock.name || STOCK_KR[stock.symbol])) continue;
    const absDp = Math.abs(q.dp);
    const cand: Mover = { symbol: stock.symbol, dp: q.dp, absDp };
    if (!biggestAny || absDp > biggestAny.absDp) biggestAny = cand;
    const slotMatch = slot === 'close' ? isKR : !isKR;
    if (slotMatch && (!biggestMatch || absDp > biggestMatch.absDp)) biggestMatch = cand;
  }
  const biggestMover = biggestMatch || biggestAny;

  if (totalValue === 0) return null;
  const todayPct = prevValue !== null && prevValue > 0 && todayDelta !== null ? (todayDelta / prevValue) * 100 : null;

  // 어제 스냅샷 vs 현재 — 정확히 전날의 기록만 비교한다.
  let yesterdayDelta: number | null = null;
  let yesterdayPct: number | null = null;
  if (totalValue !== null && snapshots.length > 0) {
    const yDate = getDateDaysAgo(1);
    const ySnap = findCanonicalSnapshotNearDate(snapshots, yDate, 0);
    const yTotals = ySnap ? getSnapshotKrwTotals(ySnap) : null;
    // A purchase/sale or changed holding set is not investment return.
    const positions = (rows: Array<{ symbol: string; shares: number; currency?: StockCurrency }>) => {
      const totals = new Map<string, number>();
      for (const row of rows) {
        const key = `${row.symbol}:${getStockCurrency(row.symbol, row.currency)}`;
        totals.set(key, (totals.get(key) || 0) + row.shares);
      }
      return totals;
    };
    const currentPositions = positions(investing);
    const previousPositions = positions(ySnap?.stocks || []);
    const sameHoldings = ySnap && currentPositions.size === previousPositions.size
      && [...currentPositions].every(([key, shares]) => previousPositions.get(key) === shares);
    if (sameHoldings && yTotals && yTotals.totalValueKrw > 0) {
      yesterdayDelta = totalValue - yTotals.totalValueKrw;
      yesterdayPct = (yesterdayDelta / yTotals.totalValueKrw) * 100;
    }
  }

  return {
    todayDelta, todayPct, totalValue,
    dataNote: !complete ? `${missingFx ? '환율' : '일부 종목 시세'}을 확인하지 못해 원화 평가액과 변동액을 계산하지 않았어요.` : undefined,
    biggestMover: biggestMover ? { symbol: biggestMover.symbol, dp: biggestMover.dp } : null,
    yesterdayDelta, yesterdayPct,
  };
}

export function buildPushPayload(brief: BriefData, slot: DigestSlot): { title: string; body: string } {
  const f = SLOT_FRAMING[slot];
  if (brief.totalValue === null || brief.todayDelta === null || brief.todayPct === null) {
    return { title: f.briefTitle, body: brief.dataNote || '자료를 확인하지 못해 평가금액을 계산하지 않았어요.' };
  }
  const { todayDelta, todayPct } = brief;
  const emoji = todayDelta >= 0 ? f.upEmoji : f.downEmoji;
  const moverStr = brief.biggestMover
    ? `${brief.biggestMover.symbol} ${brief.biggestMover.dp >= 0 ? '+' : ''}${brief.biggestMover.dp.toFixed(1)}%`
    : null;

  // 어제 대비 브랜치 (스냅샷 가용 시 가장 의미 있는 신호)
  const yesterdayBranch = (): { title: string; body: string } | null => {
    if (brief.yesterdayDelta === null || brief.yesterdayPct === null || Math.abs(brief.yesterdayPct) < 0.1) return null;
    const yIsUp = brief.yesterdayDelta >= 0;
    const pctStr = `${yIsUp ? '+' : ''}${brief.yesterdayPct.toFixed(2)}%`;
    return {
      title: `${emoji} 어제 대비 ${yIsUp ? '+' : '-'}${fmtWon(Math.abs(brief.yesterdayDelta))}`,
      body: moverStr ? `${pctStr} · ${moverStr}` : pctStr,
    };
  };

  // 오늘(국장 마감) 일일 변동 브랜치
  const todayBranch = (): { title: string; body: string } | null => {
    if (Math.abs(todayPct) < 0.05) return null;
    const isUp = todayDelta >= 0;
    const head = '내 포트폴리오';
    const lead = '내 종목 주가 변화';
    const pctStr = `${isUp ? '+' : ''}${todayPct.toFixed(2)}%`;
    return {
      title: `${emoji} ${head} ${isUp ? '+' : '-'}${fmtWon(Math.abs(todayDelta))}`,
      body: moverStr ? `${lead} ${pctStr} · ${moverStr}` : `${lead} ${pctStr}`,
    };
  };

  // 슬롯별 우선순위: close=오늘(국장 마감) 우선, morning=어제 대비 우선
  const ordered = f.todayFirst ? [todayBranch, yesterdayBranch] : [yesterdayBranch, todayBranch];
  for (const branch of ordered) {
    const r = branch();
    if (r) return r;
  }

  // biggestMover만 (변동이 작은 날)
  if (brief.biggestMover && Math.abs(brief.biggestMover.dp) >= 1) {
    const dp = brief.biggestMover.dp;
    return {
      title: `${emoji} ${f.briefTitle}`,
      body: `${brief.biggestMover.symbol} ${dp >= 0 ? '+' : ''}${dp.toFixed(2)}% — 가장 큰 움직임`,
    };
  }

  return {
    title: `${emoji} ${f.briefTitle}`,
    body: '보유 종목의 주가 변동이 작아요 · 앱에서 자세히 확인',
  };
}

// '왜 움직였나' 사후 해설(buildMoverNote)은 src/lib/moverNote.ts로 추출 — §6 게이트(DIGEST_RAG_EXPLANATION
// + gateDigestNote) SSOT를 사이드바 '오늘 한 줄'(/api/mover-note)과 한 곳에서 공유한다.

/** 이메일 본문 (정책 §4.3 면책은 sendEmail이 자동 첨부) */
export function buildEmailBody(brief: BriefData, title: string, body: string, appUrl: string): string {
  return [
    title,
    '',
    body,
    '',
    `현재 평가액: ${brief.totalValue === null ? '미확인' : fmtWon(brief.totalValue)}`,
    brief.yesterdayDelta !== null
      ? `어제 대비: ${brief.yesterdayDelta >= 0 ? '+' : ''}${fmtWon(brief.yesterdayDelta)}`
      : '',
    '',
    `자세히 보기: ${appUrl}`,
    '',
    brief.dataNote || '일일 변동액은 현재 환율로 환산한 주가 변화 기준이에요. 환율 자체의 하루 변동은 포함하지 않아요.',
    DISCLAIMER_DIGEST, // 자기한계 선언형 면책 (sendEmail이 결과책임 DISCLAIMER도 자동 첨부)
  ].filter(Boolean).join('\n');
}

