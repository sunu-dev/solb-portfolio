import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import type { PortfolioStocks } from '@/config/constants';
import type { DailySnapshot } from '@/utils/dailySnapshot';
import { findSnapshotNearDate, getDateDaysAgo } from '@/utils/dailySnapshot';
import { sendEmail } from '@/utils/email';
import { buildMorningBriefHtml } from '@/utils/emailTemplates';

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
  todayDelta: number;            // 오늘 일일 변동 (KRW)
  todayPct: number;              // 오늘 변동률 (%)
  totalValue: number;            // 현재 평가금액 (KRW)
  biggestMover: { symbol: string; dp: number } | null;
  yesterdayDelta: number | null; // 어제 스냅샷 대비 변동 (KRW)
  yesterdayPct: number | null;
}

interface PriceCache {
  [symbol: string]: { c: number; d: number; dp: number } | null;
}

async function buildBrief(
  stocks: PortfolioStocks,
  snapshots: DailySnapshot[],
  usdKrw: number,
  priceCache: PriceCache,
): Promise<BriefData | null> {
  const investing = (stocks.investing || []).filter(s => s.shares > 0 && s.avgCost > 0);
  if (investing.length === 0) return null;

  // 캐시에서 시세 조회 (cron 시작 시 unique 심볼 한 번에 fetch했음)
  let totalValue = 0;
  let todayDelta = 0;
  let prevValue = 0;
  let biggestMover: { symbol: string; dp: number; absDp: number } | null = null;
  for (const stock of investing) {
    const q = priceCache[stock.symbol];
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

  // 어제 스냅샷 vs 현재 — DB 동기화된 dailySnapshots에서 1일 전 ±2일 매칭
  let yesterdayDelta: number | null = null;
  let yesterdayPct: number | null = null;
  if (snapshots.length > 0) {
    const yDate = getDateDaysAgo(1);
    const ySnap = findSnapshotNearDate(snapshots, yDate, 2);
    if (ySnap && ySnap.totalValue > 0) {
      // 스냅샷 totalValue는 캡처 시점 단위(USD 혼합 가능). 정확한 비교를 위해
      // 스냅샷 stocks를 다시 평가하면 좋지만 — MVP는 totalValue 직접 비교.
      // (Dashboard.tsx가 totalValueWon = KRW 누적으로 캡처하므로 KRW 가정 가능)
      yesterdayDelta = totalValue - ySnap.totalValue;
      yesterdayPct = (yesterdayDelta / ySnap.totalValue) * 100;
    }
  }

  return {
    todayDelta, todayPct, totalValue,
    biggestMover: biggestMover ? { symbol: biggestMover.symbol, dp: biggestMover.dp } : null,
    yesterdayDelta, yesterdayPct,
  };
}

function buildPushPayload(brief: BriefData): { title: string; body: string } {
  const emoji = brief.todayDelta >= 0 ? '🌅' : '🌫️';

  // 우선순위 1: 어제 vs 오늘 비교 (스냅샷 가용 시 가장 의미 있는 신호)
  if (brief.yesterdayDelta !== null && brief.yesterdayPct !== null && Math.abs(brief.yesterdayPct) >= 0.1) {
    const yIsUp = brief.yesterdayDelta >= 0;
    const title = `${emoji} 어제 대비 ${yIsUp ? '+' : '-'}${fmtWon(Math.abs(brief.yesterdayDelta))}`;
    const pctStr = `${yIsUp ? '+' : ''}${brief.yesterdayPct.toFixed(2)}%`;
    const body = brief.biggestMover
      ? `${pctStr} · ${brief.biggestMover.symbol} ${brief.biggestMover.dp >= 0 ? '+' : ''}${brief.biggestMover.dp.toFixed(1)}%`
      : pctStr;
    return { title, body };
  }

  // 우선순위 2: 오늘 일일 변동
  if (Math.abs(brief.todayPct) >= 0.05) {
    const isUp = brief.todayDelta >= 0;
    const title = `${emoji} 포트폴리오 ${isUp ? '+' : '-'}${fmtWon(Math.abs(brief.todayDelta))}`;
    const pctStr = `${isUp ? '+' : ''}${brief.todayPct.toFixed(2)}%`;
    const body = brief.biggestMover
      ? `오늘 ${pctStr} · ${brief.biggestMover.symbol} ${brief.biggestMover.dp >= 0 ? '+' : ''}${brief.biggestMover.dp.toFixed(1)}%`
      : `오늘 ${pctStr}`;
    return { title, body };
  }

  // 우선순위 3: biggestMover만
  if (brief.biggestMover && Math.abs(brief.biggestMover.dp) >= 1) {
    const dp = brief.biggestMover.dp;
    return {
      title: `${emoji} 오늘 아침 브리핑`,
      body: `${brief.biggestMover.symbol} ${dp >= 0 ? '+' : ''}${dp.toFixed(2)}% — 가장 큰 움직임`,
    };
  }

  return {
    title: `${emoji} 오늘 아침 브리핑`,
    body: '간밤 시장 조용한 편 · 앱에서 자세히 확인',
  };
}

/** 이메일 본문 (정책 §4.3 면책은 sendEmail이 자동 첨부) */
function buildEmailBody(brief: BriefData, title: string, body: string, appUrl: string): string {
  return [
    title,
    '',
    body,
    '',
    `현재 평가액: ${fmtWon(brief.totalValue)}`,
    brief.yesterdayDelta !== null
      ? `어제 대비: ${brief.yesterdayDelta >= 0 ? '+' : ''}${fmtWon(brief.yesterdayDelta)}`
      : '',
    '',
    `자세히 보기: ${appUrl}`,
  ].filter(Boolean).join('\n');
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  initWebPush();
  const db = getAdmin();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://solb-portfolio.vercel.app';

  const stats = { totalUsers: 0, sent: 0, emailed: 0, skipped: 0, errors: [] as string[] };

  try {
    // 푸시 구독자
    const { data: subs } = await db
      .from('push_subscriptions')
      .select('user_id, subscription');

    // 이메일 구독자 (모닝브리프 ON 유저만) — 정책 §7
    const { data: emailSubs } = await db
      .from('email_subscriptions')
      .select('user_id')
      .eq('morning_brief_enabled', true);
    const emailUserIds = new Set((emailSubs || []).map(e => e.user_id as string));

    // 두 채널 합쳐 unique user 집합
    const allUserIds = new Set<string>();
    (subs || []).forEach(s => allUserIds.add(s.user_id as string));
    emailUserIds.forEach(id => allUserIds.add(id));

    if (allUserIds.size === 0) {
      return NextResponse.json({ ok: true, ...stats, note: '구독자 없음' });
    }
    stats.totalUsers = allUserIds.size;

    const userIds = Array.from(allUserIds);
    const { data: portfolios } = await db
      .from('user_portfolios')
      .select('user_id, stocks, daily_snapshots')
      .in('user_id', userIds);
    if (!portfolios?.length) {
      return NextResponse.json({ ok: true, ...stats, note: '포트폴리오 없음' });
    }

    // 이메일 fallback용 — auth.users에서 email 조회
    let emailMap: Record<string, string> = {};
    if (emailUserIds.size > 0) {
      try {
        const { data: usersList } = await db.auth.admin.listUsers({ perPage: 1000 });
        emailMap = Object.fromEntries(
          (usersList?.users || [])
            .filter(u => emailUserIds.has(u.id) && u.email)
            .map(u => [u.id, u.email as string])
        );
      } catch (e) {
        stats.errors.push(`auth list: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    // 성능 최적화 — 모든 유저 보유 종목 unique 집합으로 dedup, 한 번에 병렬 fetch
    const allSymbols = new Set<string>();
    for (const port of portfolios) {
      const stocks = port.stocks as PortfolioStocks;
      for (const s of (stocks.investing || [])) {
        if (s.shares > 0 && s.avgCost > 0) allSymbols.add(s.symbol);
      }
    }

    // USD/KRW 환율
    const apiKey = process.env.FINNHUB_API_KEY;
    let usdKrw = 1400;
    try {
      if (apiKey) {
        const fx = await fetch(`https://finnhub.io/api/v1/forex/rates?base=USD&token=${apiKey}`, { cache: 'no-store' });
        const j = await fx.json();
        if (j?.quote?.KRW && typeof j.quote.KRW === 'number') usdKrw = j.quote.KRW;
      }
    } catch { /* fallback */ }

    // 모든 unique 심볼 시세 병렬 fetch (cron 시간 절약 + Finnhub quota 절약)
    const priceCache: PriceCache = {};
    const symbols = Array.from(allSymbols);
    const fetchResults = await Promise.allSettled(symbols.map(s => fetchPrice(s)));
    symbols.forEach((sym, i) => {
      const r = fetchResults[i];
      priceCache[sym] = r.status === 'fulfilled' ? r.value : null;
    });

    // user_id 기준 push subscription 매핑
    const subMap = Object.fromEntries((subs || []).map(s => [s.user_id as string, s.subscription]));

    for (const userId of userIds) {
      const port = portfolios.find(p => p.user_id === userId);
      if (!port) { stats.skipped++; continue; }

      const stocks = port.stocks as PortfolioStocks;
      const snapshots = (Array.isArray(port.daily_snapshots) ? port.daily_snapshots : []) as DailySnapshot[];

      const brief = await buildBrief(stocks, snapshots, usdKrw, priceCache);
      if (!brief) { stats.skipped++; continue; }

      const { title, body } = buildPushPayload(brief);

      // ─ 푸시 시도 (구독 있으면)
      const pushSub = subMap[userId];
      let pushSent = false;
      if (pushSub) {
        const payload = JSON.stringify({ title, body, url: appUrl, tag: 'solb-morning-brief' });
        try {
          await webpush.sendNotification(pushSub as webpush.PushSubscription, payload);
          stats.sent++;
          pushSent = true;
        } catch (e: unknown) {
          const status = (e as { statusCode?: number })?.statusCode;
          if (status === 410 || status === 404) {
            await db.from('push_subscriptions').delete().eq('user_id', userId);
          } else {
            stats.errors.push(`push ${userId.slice(0, 8)}: ${(e as Error)?.message || 'unknown'}`);
          }
        }
      }

      // ─ 이메일 발송 (구독자이고 이메일 알면) — 푸시 성공 여부와 독립
      // 사용자가 둘 다 ON 했으면 둘 다 받음 (각자 명시 옵트인이므로 OK)
      // 푸시 미구독 + 이메일 ON: 이메일이 유일한 채널 (iOS PWA 미설치 케이스)
      if (emailUserIds.has(userId) && emailMap[userId]) {
        const emailText = buildEmailBody(brief, title, body, appUrl);
        const totalValueFmt = fmtWon(brief.totalValue);
        const ydeltaFmt = brief.yesterdayDelta !== null
          ? `${brief.yesterdayDelta >= 0 ? '+' : '-'}${fmtWon(Math.abs(brief.yesterdayDelta))}${brief.yesterdayPct !== null ? ` (${brief.yesterdayPct >= 0 ? '+' : ''}${brief.yesterdayPct.toFixed(2)}%)` : ''}`
          : null;
        const emailHtml = buildMorningBriefHtml({
          title, body,
          totalValueFormatted: totalValueFmt,
          yesterdayDeltaFormatted: ydeltaFmt,
          yesterdayPct: brief.yesterdayPct,
          biggestMover: brief.biggestMover,
          appUrl,
        });
        const result = await sendEmail({
          to: emailMap[userId],
          subject: title,
          text: emailText,
          html: emailHtml,
          unsubscribe: { userId, kind: 'morning_brief' }, // RFC 8058 1-click
        });
        if (result.ok) stats.emailed++;
        else stats.errors.push(`email ${userId.slice(0, 8)}: ${result.error}`);
      }

      if (!pushSent && !emailUserIds.has(userId)) stats.skipped++;
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