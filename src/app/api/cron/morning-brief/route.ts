import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import type { PortfolioStocks } from '@/config/constants';

/**
 * 모닝 브리핑 cron — E 항목 본격 구현.
 *
 * 동작:
 * - 매일 KST 7am (= UTC 22:00) 실행
 * - push_subscriptions에 등록된 유저에게 개인화 브리핑 푸시
 * - 푸시 본문: 어제 vs 오늘 자산 변화 + 가장 큰 움직임 종목
 * - 클릭 → 앱 열림 → 기존 MorningBriefing 컴포넌트가 상세 표시
 *
 * 등록: vercel.json crons에 "schedule": "0 22 * * *"
 *
 * 인프라 의존:
 * - SUPABASE_SERVICE_KEY: Service role for admin queries
 * - VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY: Web Push
 * - CRON_SECRET: Vercel Cron 인증
 *
 * 향후: Resend 이메일 또는 카카오 알림톡으로 확장.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

function verifyCronAuth(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false } },
  );
}

function initWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@solb.kr',
    process.env.VAPID_PUBLIC_KEY || '',
    process.env.VAPID_PRIVATE_KEY || '',
  );
}

async function fetchPrice(symbol: string): Promise<{ c: number; d: number; dp: number } | null> {
  try {
    const isKR = symbol.endsWith('.KS') || symbol.endsWith('.KQ');
    if (isKR) {
      const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/kr-quote?symbol=${symbol}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      const d = await res.json();
      if (typeof d?.c !== 'number') return null;
      return { c: d.c, d: d.d || 0, dp: d.dp || 0 };
    }
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) return null;
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const d = await res.json();
    if (typeof d?.c !== 'number' || d.c === 0) return null;
    return { c: d.c, d: d.d || 0, dp: d.dp || 0 };
  } catch {
    return null;
  }
}

function fmtWon(w: number): string {
  if (w >= 100_000_000) return `${(w / 100_000_000).toFixed(1)}억원`;
  if (w >= 10_000) return `${Math.round(w / 10_000)}만원`;
  return `${w.toLocaleString()}원`;
}

interface BriefData {
  todayDelta: number;       // 오늘 일일 변동 (KRW)
  todayPct: number;         // 오늘 변동률 (%)
  totalValue: number;       // 현재 평가금액 (KRW)
  biggestMover: { symbol: string; dp: number } | null;
}

async function buildBrief(
  stocks: PortfolioStocks,
  usdKrw: number,
): Promise<BriefData | null> {
  const investing = (stocks.investing || []).filter(s => s.shares > 0 && s.avgCost > 0);
  if (investing.length === 0) return null;

  // 현재 시세 fetch (병렬)
  const quotes = await Promise.all(
    investing.map(async s => ({ stock: s, q: await fetchPrice(s.symbol) }))
  );

  let totalValue = 0;
  let todayDelta = 0;
  let prevValue = 0;
  let biggestMover: { symbol: string; dp: number; absDp: number } | null = null;
  for (const { stock, q } of quotes) {
    if (!q) continue;
    const isKR = stock.symbol.endsWith('.KS') || stock.symbol.endsWith('.KQ');
    const rate = isKR ? 1 : usdKrw;
    totalValue += q.c * stock.shares * rate;
    todayDelta += q.d * stock.shares * rate;
    prevValue += (q.c - q.d) * stock.shares * rate;
    const absDp = Math.abs(q.dp);
    if (!biggestMover || absDp > biggestMover.absDp) {
      biggestMover = { symbol: stock.symbol, dp: q.dp, absDp };
    }
  }

  if (totalValue === 0) return null;
  const todayPct = prevValue > 0 ? (todayDelta / prevValue) * 100 : 0;

  return {
    todayDelta,
    todayPct,
    totalValue,
    biggestMover: biggestMover ? { symbol: biggestMover.symbol, dp: biggestMover.dp } : null,
  };
}

function buildPushPayload(brief: BriefData): { title: string; body: string } {
  const isUp = brief.todayDelta >= 0;
  const emoji = isUp ? '🌅' : '🌫️';

  let title: string;
  let body: string;

  if (Math.abs(brief.todayPct) >= 0.05) {
    title = `${emoji} 포트폴리오 ${isUp ? '+' : '-'}${fmtWon(Math.abs(brief.todayDelta))}`;
    const pctStr = `${isUp ? '+' : ''}${brief.todayPct.toFixed(2)}%`;
    body = brief.biggestMover
      ? `오늘 ${pctStr} · ${brief.biggestMover.symbol} ${brief.biggestMover.dp >= 0 ? '+' : ''}${brief.biggestMover.dp.toFixed(1)}%`
      : `오늘 ${pctStr}`;
  } else if (brief.biggestMover && Math.abs(brief.biggestMover.dp) >= 1) {
    title = `${emoji} 오늘 아침 브리핑`;
    const dp = brief.biggestMover.dp;
    body = `${brief.biggestMover.symbol} ${dp >= 0 ? '+' : ''}${dp.toFixed(2)}% — 가장 큰 움직임`;
  } else {
    title = `${emoji} 오늘 아침 브리핑`;
    body = '간밤 시장 조용한 편 · 앱에서 자세히 확인';
  }

  return { title, body };
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  initWebPush();
  const db = getAdmin();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://solb-portfolio.vercel.app';

  const stats = { totalUsers: 0, sent: 0, skipped: 0, errors: [] as string[] };

  try {
    const { data: subs } = await db
      .from('push_subscriptions')
      .select('user_id, subscription');
    if (!subs?.length) {
      return NextResponse.json({ ok: true, ...stats, note: '구독자 없음' });
    }
    stats.totalUsers = subs.length;

    const userIds = subs.map(s => s.user_id as string);
    const { data: portfolios } = await db
      .from('user_portfolios')
      .select('user_id, stocks')
      .in('user_id', userIds);
    if (!portfolios?.length) {
      return NextResponse.json({ ok: true, ...stats, note: '포트폴리오 없음' });
    }

    // USD/KRW 환율 — Finnhub forex 또는 fallback. 향후: macro 캐시 테이블에서 조회.
    const apiKey = process.env.FINNHUB_API_KEY;
    let usdKrw = 1400;
    try {
      if (apiKey) {
        const fx = await fetch(`https://finnhub.io/api/v1/forex/rates?base=USD&token=${apiKey}`, { cache: 'no-store' });
        const j = await fx.json();
        if (j?.quote?.KRW && typeof j.quote.KRW === 'number') usdKrw = j.quote.KRW;
      }
    } catch { /* fallback */ }

    for (const sub of subs) {
      const userId = sub.user_id as string;
      const port = portfolios.find(p => p.user_id === userId);
      if (!port) { stats.skipped++; continue; }

      const stocks = port.stocks as PortfolioStocks;

      const brief = await buildBrief(stocks, usdKrw);
      if (!brief) { stats.skipped++; continue; }

      const { title, body } = buildPushPayload(brief);
      const payload = JSON.stringify({
        title, body,
        url: appUrl,
        tag: 'solb-morning-brief', // 같은 tag → 직전 푸시 대체
      });

      try {
        await webpush.sendNotification(
          sub.subscription as webpush.PushSubscription,
          payload,
        );
        stats.sent++;
      } catch (e: unknown) {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 410 || status === 404) {
          await db.from('push_subscriptions').delete().eq('user_id', userId);
        } else {
          stats.errors.push(`${userId.slice(0, 8)}: ${(e as Error)?.message || 'unknown'}`);
        }
      }
    }

    return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), ...stats });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      ...stats,
    }, { status: 500 });
  }
}