import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import type { PortfolioStocks } from '@/config/constants';
import type { DailySnapshot } from '@/utils/dailySnapshot';

/**
 * Monthly Chapter D-3 Reminder cron — Phase 6.
 *
 * 동작:
 * - 매일 KST 8pm (= UTC 11:00) 실행
 * - 월말 D-3 (= 남은 일수 3일) 인 날만 푸시 발송
 * - 본문: 챕터 곧 마감 + 이번 달 누적 손익% + 회고 CTA
 * - 클릭 → 앱 열림 → MonthlyChapter 카드/Wrapped 모달로 유도
 *
 * 등록: vercel.json crons에 "schedule": "0 11 * * *"
 *
 * 인프라 의존:
 * - SUPABASE_SERVICE_KEY: Service role
 * - VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY: Web Push
 * - CRON_SECRET: Vercel Cron 인증
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

/**
 * KST 기준 D-카운트다운. cron이 UTC로 돌아가도 한국 사용자 기준 날짜로 판정.
 */
function computeKstDaysRemaining(): { dayOfMonth: number; lastDay: number; daysRemaining: number; monthLabel: string } {
  const now = new Date();
  // KST = UTC+9
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const dayOfMonth = kst.getUTCDate();
  const lastDay = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() + 1, 0)).getUTCDate();
  const monthLabel = `${kst.getUTCMonth() + 1}월`;
  return { dayOfMonth, lastDay, daysRemaining: lastDay - dayOfMonth, monthLabel };
}

interface ChapterBrief {
  totalPctReturn: number;
  hasData: boolean;
}

function buildChapterBrief(
  stocks: PortfolioStocks,
  snapshots: DailySnapshot[],
): ChapterBrief {
  // 이번 달 시작 스냅샷 vs 가장 최근 스냅샷 — 누적 수익률
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);

  const investing = (stocks.investing || []).filter(s => s.shares > 0 && s.avgCost > 0);
  if (investing.length === 0) return { totalPctReturn: 0, hasData: false };

  if (snapshots.length < 2) return { totalPctReturn: 0, hasData: false };

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const monthSnaps = sorted.filter(s => new Date(s.date).getTime() >= monthStart.getTime());
  if (monthSnaps.length < 2) return { totalPctReturn: 0, hasData: false };

  const start = monthSnaps[0];
  const latest = monthSnaps[monthSnaps.length - 1];
  if (start.totalValue <= 0) return { totalPctReturn: 0, hasData: false };

  const pct = ((latest.totalValue - start.totalValue) / start.totalValue) * 100;
  return { totalPctReturn: pct, hasData: true };
}

function buildPushPayload(brief: ChapterBrief, monthLabel: string, daysRemaining: number): { title: string; body: string } {
  const title = `📖 ${monthLabel} 챕터 D-${daysRemaining}`;
  if (!brief.hasData) {
    return {
      title,
      body: `이번 달 챕터가 곧 마감돼요 — 회고 한 줄 적어보세요`,
    };
  }
  const sign = brief.totalPctReturn >= 0 ? '+' : '';
  const pctStr = `${sign}${brief.totalPctReturn.toFixed(2)}%`;
  return {
    title,
    body: `이번 달 누적 ${pctStr} · 챕터 마감 ${daysRemaining}일 남음`,
  };
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const time = computeKstDaysRemaining();
  // D-3만 발송 (운영 안정성: 월말 D-3 ±0)
  if (time.daysRemaining !== 3) {
    return NextResponse.json({
      ok: true, skipped: true,
      reason: `Not D-3 (today is D-${time.daysRemaining})`,
      day: time.dayOfMonth, lastDay: time.lastDay,
    });
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
      .select('user_id, stocks, daily_snapshots')
      .in('user_id', userIds);
    if (!portfolios?.length) {
      return NextResponse.json({ ok: true, ...stats, note: '포트폴리오 없음' });
    }

    for (const sub of subs) {
      const userId = sub.user_id as string;
      const port = portfolios.find(p => p.user_id === userId);
      if (!port) { stats.skipped++; continue; }

      const stocks = port.stocks as PortfolioStocks;
      const snapshots = (Array.isArray(port.daily_snapshots) ? port.daily_snapshots : []) as DailySnapshot[];

      const investing = (stocks.investing || []).filter(s => s.shares > 0 && s.avgCost > 0);
      if (investing.length === 0) { stats.skipped++; continue; }

      const brief = buildChapterBrief(stocks, snapshots);
      const { title, body } = buildPushPayload(brief, time.monthLabel, time.daysRemaining);
      const payload = JSON.stringify({
        title, body,
        url: `${appUrl}/?openWrapped=1`,
        tag: 'solb-chapter-d3',
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

    return NextResponse.json({
      ok: true, ranAt: new Date().toISOString(),
      day: time.dayOfMonth, daysRemaining: time.daysRemaining,
      ...stats,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      ...stats,
    }, { status: 500 });
  }
}
