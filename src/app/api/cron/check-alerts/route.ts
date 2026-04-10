import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import type { PortfolioStocks, StockItem } from '@/config/constants';

// ─── clients ────────────────────────────────────────────────────────────────
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!, // service role — auth.users 접근용
);
const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM_EMAIL = 'SOLB <alerts@solb.kr>';

// ─── types ──────────────────────────────────────────────────────────────────
interface TriggeredAlert {
  symbol: string;
  krName: string;
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
    const yahooSymbol = symbol.endsWith('.KS') || symbol.endsWith('.KQ')
      ? symbol
      : symbol;
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`,
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
  if (stock.avgCost <= 0 || price <= 0) return alerts;

  const isKR = stock.symbol.endsWith('.KS') || stock.symbol.endsWith('.KQ');
  const plPct = ((price - stock.avgCost) / stock.avgCost) * 100;
  const plUSD = (price - stock.avgCost) * (stock.shares || 1);
  const plKRW = isKR ? plUSD : plUSD * usdKrw;
  const sym = stock.symbol;

  // 목표 수익률 %
  if (stock.targetReturn > 0 && plPct >= stock.targetReturn) {
    alerts.push({ symbol: sym, krName: sym, alertType: 'target-return',
      emoji: '🎉', message: `목표 수익률 달성!`,
      detail: `수익률 ${plPct.toFixed(1)}% ≥ 목표 ${stock.targetReturn}%` });
  }

  // 목표 수익금 $
  if (!isKR && (stock.targetProfitUSD ?? 0) > 0 && plUSD >= (stock.targetProfitUSD ?? 0)) {
    alerts.push({ symbol: sym, krName: sym, alertType: 'target-profit-usd',
      emoji: '💵', message: `목표 수익금($) 달성!`,
      detail: `수익 $${plUSD.toFixed(0)} ≥ 목표 $${stock.targetProfitUSD}` });
  }

  // 목표 수익금 ₩
  if ((stock.targetProfitKRW ?? 0) > 0 && plKRW >= (stock.targetProfitKRW ?? 0)) {
    alerts.push({ symbol: sym, krName: sym, alertType: 'target-profit-krw',
      emoji: '💰', message: `목표 수익금(₩) 달성!`,
      detail: `수익 ₩${fmtWon(plKRW)} ≥ 목표 ₩${fmtWon(stock.targetProfitKRW ?? 0)}` });
  }

  // 목표 매도가
  if ((stock.targetSell ?? 0) > 0 && price >= (stock.targetSell ?? 0)) {
    alerts.push({ symbol: sym, krName: sym, alertType: 'target-sell',
      emoji: '🎯', message: `목표가 도달!`,
      detail: `현재가 ${isKR ? '₩' : '$'}${price.toLocaleString()} ≥ 목표 ${isKR ? '₩' : '$'}${stock.targetSell}` });
  }

  // 손절가
  if ((stock.stopLoss ?? 0) > 0 && price <= (stock.stopLoss ?? 0)) {
    alerts.push({ symbol: sym, krName: sym, alertType: 'stoploss-price',
      emoji: '🚨', message: `손절가 도달!`,
      detail: `현재가 ${isKR ? '₩' : '$'}${price.toLocaleString()} ≤ 손절가 ${isKR ? '₩' : '$'}${stock.stopLoss}` });
  }

  // 손절률 %
  if ((stock.stopLossPct ?? 0) > 0 && plPct <= -(stock.stopLossPct ?? 0)) {
    alerts.push({ symbol: sym, krName: sym, alertType: 'stoploss-pct',
      emoji: '🚨', message: `손절률 도달!`,
      detail: `손실 ${plPct.toFixed(1)}% ≤ 기준 -${stock.stopLossPct}%` });
  }

  // 관심종목 매수 목표가
  if ((stock.buyBelow ?? 0) > 0 && price <= (stock.buyBelow ?? 0)) {
    alerts.push({ symbol: sym, krName: sym, alertType: 'buy-zone',
      emoji: '🛒', message: `관심 매수가 도달!`,
      detail: `현재가 ${isKR ? '₩' : '$'}${price.toLocaleString()} ≤ 목표 ${isKR ? '₩' : '$'}${stock.buyBelow}` });
  }

  return alerts;
}

function buildEmailHtml(alerts: TriggeredAlert[], appUrl: string): string {
  const rows = alerts.map(a => `
    <tr>
      <td style="padding:12px 16px; border-bottom:1px solid #F2F4F6;">
        <span style="font-size:20px;">${a.emoji}</span>
      </td>
      <td style="padding:12px 16px; border-bottom:1px solid #F2F4F6;">
        <div style="font-weight:700;color:#191F28;">${a.symbol}</div>
        <div style="font-size:13px;color:#4E5968;margin-top:2px;">${a.message}</div>
        <div style="font-size:12px;color:#8B95A1;margin-top:2px;">${a.detail}</div>
      </td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="padding:28px 24px 20px;background:linear-gradient(135deg,#191F28 0%,#3182F6 100%);">
      <div style="font-size:22px;font-weight:800;color:#fff;">SOLB 알림</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:4px;">설정한 목표가 ${alerts.length}건 달성됐어요</div>
    </div>
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
    <div style="padding:20px 24px;text-align:center;">
      <a href="${appUrl}" style="display:inline-block;padding:12px 32px;background:#3182F6;color:#fff;font-weight:700;font-size:14px;border-radius:12px;text-decoration:none;">
        SOLB에서 확인하기
      </a>
    </div>
    <div style="padding:16px 24px;text-align:center;font-size:11px;color:#B0B8C1;border-top:1px solid #F2F4F6;">
      이 알림은 투자 권유가 아닙니다. 투자 판단은 본인이 하세요.<br>
      <a href="${appUrl}/settings" style="color:#B0B8C1;">알림 설정 변경</a>
    </div>
  </div>
</body>
</html>`;
}

// ─── already-sent dedup (Supabase) ──────────────────────────────────────────
async function filterUnsent(userId: string, alerts: TriggeredAlert[]): Promise<TriggeredAlert[]> {
  const todayKST = new Date(Date.now() + 9 * 3600_000).toISOString().split('T')[0];
  try {
    const keys = alerts.map(a => `${a.symbol}:${a.alertType}`);
    const { data } = await supabaseAdmin
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
    await supabaseAdmin.from('sent_alerts').upsert(
      alerts.map(a => ({ user_id: userId, symbol: a.symbol, alert_type: a.alertType, sent_date: todayKST })),
      { onConflict: 'user_id,symbol,alert_type,sent_date', ignoreDuplicates: true }
    );
  } catch { /* silent */ }
}

// ─── main handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // Vercel cron secret 검증
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY || !process.env.SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 503 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://solb.kr';

  // 1. 모든 유저 포트폴리오 조회
  const { data: portfolios, error: dbErr } = await supabaseAdmin
    .from('user_portfolios')
    .select('user_id, stocks');

  if (dbErr || !portfolios?.length) {
    return NextResponse.json({ checked: 0, sent: 0 });
  }

  // 2. 필요한 심볼 수집 + 가격 fetch
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

  // 3. 유저별 알림 체크
  for (const row of portfolios) {
    const userId: string = row.user_id;
    const s = row.stocks as PortfolioStocks;
    const allStocks = [...(s.investing || []), ...(s.watching || [])];

    const triggered: TriggeredAlert[] = [];
    for (const stock of allStocks) {
      const price = priceMap[stock.symbol];
      if (!price) continue;
      triggered.push(...checkStockAlerts(stock, price, usdKrw));
    }
    if (!triggered.length) continue;

    // 4. 오늘 이미 보낸 알림 제거
    const unsent = await filterUnsent(userId, triggered);
    if (!unsent.length) continue;

    // 5. 유저 이메일 조회 (service role)
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = authUser?.user?.email;
    if (!email) continue;

    // 6. 이메일 발송
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `[SOLB] ${unsent[0].emoji} ${unsent[0].message} — ${unsent[0].symbol}${unsent.length > 1 ? ` 외 ${unsent.length - 1}건` : ''}`,
        html: buildEmailHtml(unsent, appUrl),
      });
      await markSent(userId, unsent);
      totalSent++;
    } catch (e) {
      console.error('[cron/check-alerts] email send failed:', e);
    }
  }

  return NextResponse.json({ checked: portfolios.length, sent: totalSent, ts: new Date().toISOString() });
}
