import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { Receiver } from '@upstash/qstash';
import type { PortfolioStocks, StockItem } from '@/config/constants';

// ─── clients (lazy — avoid module-level crash during build) ─────────────────
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

function initWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@solb.kr',
    process.env.VAPID_PUBLIC_KEY || '',
    process.env.VAPID_PRIVATE_KEY || '',
  );
}

// ─── types ──────────────────────────────────────────────────────────────────
interface TriggeredAlert {
  symbol: string;
  alertType: string;
  message: string;
  detail: string;
  emoji: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────
function fmtWon(w: number): string {
  if (w >= 100_000_000) return `${(w / 100_000_000).toFixed(1)}억원`;
  if (w >= 10_000) return `${Math.round(w / 10_000)}만원`;
  return `${w.toLocaleString()}원`;
}

async function fetchPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const json = await res.json() as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
    };
    return json.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch { return null; }
}

async function fetchUsdKrw(): Promise<number> {
  try {
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/USDKRW=X?interval=1d&range=1d',
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return 1400;
    const json = await res.json() as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
    };
    return json.chart?.result?.[0]?.meta?.regularMarketPrice ?? 1400;
  } catch { return 1400; }
}

function checkStockAlerts(stock: StockItem, price: number, usdKrw: number): TriggeredAlert[] {
  const alerts: TriggeredAlert[] = [];
  if (stock.avgCost <= 0 || stock.shares <= 0 || price <= 0) return alerts;

  const isKR = stock.symbol.endsWith('.KS') || stock.symbol.endsWith('.KQ');
  const plPct = ((price - stock.avgCost) / stock.avgCost) * 100;
  const plUSD = (price - stock.avgCost) * stock.shares;
  const plKRW = isKR ? plUSD : plUSD * usdKrw;
  const sym = stock.symbol;
  const cur = isKR ? '₩' : '$';

  if (stock.targetReturn > 0 && plPct >= stock.targetReturn)
    alerts.push({ symbol: sym, alertType: 'target-return', emoji: '🎉',
      message: `${sym} 목표 수익률 달성!`,
      detail: `수익률 ${plPct.toFixed(1)}% ≥ 목표 ${stock.targetReturn}%` });

  if (!isKR && (stock.targetProfitUSD ?? 0) > 0 && plUSD >= (stock.targetProfitUSD ?? 0))
    alerts.push({ symbol: sym, alertType: 'target-profit-usd', emoji: '💵',
      message: `${sym} 수익금 $${(stock.targetProfitUSD ?? 0).toLocaleString()} 달성!`,
      detail: `현재 수익 $${plUSD.toFixed(0)}` });

  if ((stock.targetProfitKRW ?? 0) > 0 && plKRW >= (stock.targetProfitKRW ?? 0))
    alerts.push({ symbol: sym, alertType: 'target-profit-krw', emoji: '💰',
      message: `${sym} 수익금 ₩${fmtWon(stock.targetProfitKRW ?? 0)} 달성!`,
      detail: `현재 수익 ₩${fmtWon(plKRW)}` });

  if ((stock.targetSell ?? 0) > 0 && price >= (stock.targetSell ?? 0))
    alerts.push({ symbol: sym, alertType: 'target-sell', emoji: '🎯',
      message: `${sym} 목표가 도달!`,
      detail: `현재가 ${cur}${price.toLocaleString()} ≥ 목표 ${cur}${stock.targetSell}` });

  if ((stock.stopLoss ?? 0) > 0 && price <= (stock.stopLoss ?? 0))
    alerts.push({ symbol: sym, alertType: 'stoploss-price', emoji: '🚨',
      message: `${sym} 손절가 도달!`,
      detail: `현재가 ${cur}${price.toLocaleString()} ≤ 손절가 ${cur}${stock.stopLoss}` });

  if ((stock.stopLossPct ?? 0) > 0 && plPct <= -(stock.stopLossPct ?? 0))
    alerts.push({ symbol: sym, alertType: 'stoploss-pct', emoji: '🚨',
      message: `${sym} 손절률 도달!`,
      detail: `손실 ${plPct.toFixed(1)}% ≤ 기준 -${stock.stopLossPct}%` });

  if ((stock.buyBelow ?? 0) > 0 && price <= (stock.buyBelow ?? 0))
    alerts.push({ symbol: sym, alertType: 'buy-zone', emoji: '🛒',
      message: `${sym} 관심 매수가 도달!`,
      detail: `현재가 ${cur}${price.toLocaleString()} ≤ 목표 ${cur}${stock.buyBelow}` });

  return alerts;
}

// ─── dedup ───────────────────────────────────────────────────────────────────
async function filterUnsent(userId: string, alerts: TriggeredAlert[]): Promise<TriggeredAlert[]> {
  const todayKST = new Date(Date.now() + 9 * 3600_000).toISOString().split('T')[0];
  try {
    const { data } = await getSupabaseAdmin()
      .from('sent_alerts')
      .select('symbol, alert_type')
      .eq('user_id', userId)
      .eq('sent_date', todayKST)
      .in('alert_type', alerts.map(a => a.alertType));
    const sent = new Set((data || []).map((r: { symbol: string; alert_type: string }) => `${r.symbol}:${r.alert_type}`));
    return alerts.filter(a => !sent.has(`${a.symbol}:${a.alertType}`));
  } catch { return alerts; }
}

async function markSent(userId: string, alerts: TriggeredAlert[]) {
  if (!alerts.length) return;
  const todayKST = new Date(Date.now() + 9 * 3600_000).toISOString().split('T')[0];
  try {
    await getSupabaseAdmin().from('sent_alerts').upsert(
      alerts.map(a => ({ user_id: userId, symbol: a.symbol, alert_type: a.alertType, sent_date: todayKST })),
      { onConflict: 'user_id,symbol,alert_type,sent_date', ignoreDuplicates: true }
    );
  } catch { /* silent */ }
}

// ─── main handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // QStash 서명 검증
  if (process.env.QSTASH_CURRENT_SIGNING_KEY) {
    const receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
    });
    const body = await req.text();
    const signature = req.headers.get('upstash-signature') ?? '';
    const isValid = await receiver.verify({ signature, body }).catch(() => false);
    if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } else {
    // fallback: CRON_SECRET Bearer 인증 (Vercel Pro Cron 또는 수동 테스트용)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 503 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://solb-portfolio.vercel.app';

  // 1. 푸시 구독이 있는 유저의 포트폴리오만 조회
  initWebPush();
  const db = getSupabaseAdmin();

  const { data: subs } = await db
    .from('push_subscriptions')
    .select('user_id, subscription');

  if (!subs?.length) return NextResponse.json({ checked: 0, sent: 0 });

  const userIds = subs.map(s => s.user_id as string);

  const { data: portfolios } = await db
    .from('user_portfolios')
    .select('user_id, stocks')
    .in('user_id', userIds);

  if (!portfolios?.length) return NextResponse.json({ checked: 0, sent: 0 });

  // 2. 심볼 수집 + 가격 fetch
  const symbolSet = new Set<string>();
  for (const row of portfolios) {
    const s = row.stocks as PortfolioStocks;
    [...(s.investing || []), ...(s.watching || [])].forEach(st => symbolSet.add(st.symbol));
  }
  const [priceMap, usdKrw] = await Promise.all([
    (async () => {
      const m: Record<string, number> = {};
      await Promise.allSettled([...symbolSet].map(async sym => {
        const p = await fetchPrice(sym);
        if (p) m[sym] = p;
      }));
      return m;
    })(),
    fetchUsdKrw(),
  ]);

  let totalSent = 0;
  const subMap = Object.fromEntries(subs.map(s => [s.user_id as string, s.subscription]));

  // 3. 유저별 알림 체크 + 푸시 발송
  for (const row of portfolios) {
    const userId: string = row.user_id;
    const pushSub = subMap[userId];
    if (!pushSub) continue;

    const s = row.stocks as PortfolioStocks;
    const allStocks = [...(s.investing || []), ...(s.watching || [])];

    const triggered: TriggeredAlert[] = [];
    for (const stock of allStocks) {
      const price = priceMap[stock.symbol];
      if (!price) continue;
      triggered.push(...checkStockAlerts(stock, price, usdKrw));
    }
    if (!triggered.length) continue;

    const unsent = await filterUnsent(userId, triggered);
    if (!unsent.length) continue;

    // 가장 중요한 알림 1개로 푸시 (나머지는 body에 요약)
    const first = unsent[0];
    const payload = JSON.stringify({
      title: `${first.emoji} ${first.message}`,
      body: unsent.length > 1
        ? `${first.detail} 외 ${unsent.length - 1}건`
        : first.detail,
      url: appUrl,
      tag: `solb-${first.alertType}`,
    });

    try {
      await webpush.sendNotification(
        pushSub as webpush.PushSubscription,
        payload,
      );
      await markSent(userId, unsent);
      totalSent++;
    } catch (e: unknown) {
      // 구독 만료(410) 시 자동 삭제
      const status = (e as { statusCode?: number })?.statusCode;
      if (status === 410 || status === 404) {
        await db.from('push_subscriptions').delete().eq('user_id', userId);
      } else {
        console.error('[cron/check-alerts] push failed:', e);
      }
    }
  }

  return NextResponse.json({ checked: portfolios.length, sent: totalSent, ts: new Date().toISOString() });
}
