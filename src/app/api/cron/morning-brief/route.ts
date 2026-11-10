import { privateNotificationsPaused, PRIVATE_NOTIFICATION_PAUSE_REASON } from '@/lib/privateNotificationPause';
import { NextRequest, NextResponse } from 'next/server';
import { requireServiceClient } from '@/lib/supabaseServer';
import { defineRoute } from '@/lib/apiRoute';
import type { PortfolioStocks } from '@/config/constants';
import { STOCK_KR } from '@/config/constants';
import type { DailySnapshot } from '@/utils/dailySnapshot';
import { queueDigest, processDigestQueue } from '@/lib/digestDelivery';
import { buildMorningBriefHtml } from '@/utils/emailTemplates';
import { sendCronAlert } from '@/lib/cronAlert';
import { DISCLAIMER_DIGEST } from '@/utils/alertCompliance';
import { buildMoverNote } from '@/lib/moverNote';
import { isKoreanStockSymbol } from '@/utils/stockCurrency';
import { SLOT_FRAMING, buildBrief, buildPushPayload, buildEmailBody, digestPriceQuote, fmtWon, type DigestSlot, type PriceCache } from '@/lib/digestBrief';

/**
 * 시차 인지 2슬롯 digest cron (구 모닝 브리핑) — docs/PERSONALIZED_DIGEST_SPEC.md.
 *
 * 동작:
 * - 국장 아침 슬롯: KST 07:00 (= UTC 22:00) — 간밤 미장 보유분 정리(미장 종목 주목)
 * - 국장 마감 슬롯: KST 16:00 (= UTC 07:00) — 오늘 국장 마감 정리(국장 종목 주목)
 * - push_subscriptions/email_subscriptions 옵트인 유저에게 개인화 digest 발송
 * - 본문: 어제/오늘 자산 변화 + 슬롯 시장의 가장 큰 움직임 종목 (+ 플래그 시 '왜 움직였나' 해설)
 * - 클릭 → 앱 열림 → 기존 MorningBriefing 컴포넌트가 상세 표시
 *
 * 등록: vercel.json crons에 같은 path 2개 ("0 22 * * *" + "0 7 * * *").
 *       슬롯은 핸들러가 UTC 시각으로 판정(쿼리스트링 cron path 미문서화 회피).
 *       멱등성 notification_type 슬롯별 분리(morning_brief / digest_kr_close).
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

// 키 해석은 `@/lib/supabaseServer` 한 곳이 SSOT다.
// 예전엔 여기서 `SUPABASE_SERVICE_KEY` **단독**으로 읽었다 — 비-cron 라우트는 전부
// `SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_KEY` 폴백을 갖고 있었기 때문에,
// 새 이름만 설정한 환경에서 **웹은 멀쩡하고 cron만 죽는** 부분 장애가 났다
// (알림·이메일 미발송은 사용자가 신고하기 전엔 드러나지 않는다).
function getAdmin() {
  return requireServiceClient();
}

async function fetchPrice(symbol: string, appUrl: string): Promise<{ c: number; d: number; dp: number } | null> {
  try {
    const isKR = isKoreanStockSymbol(symbol);
    if (isKR) {
      const url = `${appUrl}/api/kr-quote?symbol=${encodeURIComponent(symbol)}`;
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      return digestPriceQuote(await res.json());
    }
    // Match the server-side /api/quotes resolution while existing deployments still
    // use the legacy environment name. The value never enters this route's response.
    const apiKey = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!apiKey) return null;
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return digestPriceQuote(await res.json());
  } catch {
    return null;
  }
}

// 국장 아침 슬롯 (KST 07:00 = UTC 22:00). vercel.json "0 22 * * *".
export const GET = defineRoute({
  name: '/api/cron/morning-brief',
  auth: 'cron',
  rateLimit: false,
  handler: async ({ req }) => runDigest(req, 'morning'),
});

/**
 * digest 발송 본체. 슬롯은 호출 라우트가 결정론적으로 주입한다(defaultSlot).
 *
 * ⚠️ 슬롯을 wall-clock(UTC hour)으로 추정하지 않는다 — 22:00 morning cron이 자정(UTC)을
 * 넘겨 재시도되면(00:00~06:59) 슬롯이 close로 뒤집혀 notification_type이 바뀌고 멱등성이
 * 깨지기 때문(적대 리뷰 must-fix). 대신 morning 라우트(GET)와 close 라우트(../morning-brief-close)가
 * 각자 자기 슬롯을 고정 주입한다. ?slot=는 수동 테스트 override만.
 */
export async function runDigest(req: NextRequest, defaultSlot: DigestSlot) {
  if (privateNotificationsPaused()) return NextResponse.json({ ok: true, skipped: PRIVATE_NOTIFICATION_PAUSE_REASON });
  // 인증은 호출 라우트의 defineRoute({ auth: 'cron' })가 담당한다.
  // (morning-brief GET / morning-brief-close GET 둘 다 cron 가드를 통과한 뒤에만 여기 도달)
  const db = getAdmin();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://joobi.kr';

  const slotParam = req.nextUrl.searchParams.get('slot');
  const slot: DigestSlot = slotParam === 'close' ? 'close' : slotParam === 'morning' ? 'morning' : defaultSlot;
  const framing = SLOT_FRAMING[slot];

  // close 슬롯(국장 마감)은 옵트인 유저 전원의 알림을 2배로 만드는 UX 변화라, 코드는 배포하되
  // env 플래그로 활성화를 통제한다(기본 off). 파운더가 검토 후 DIGEST_CLOSE_SLOT_ENABLED='on'으로 켠다.
  // morning 슬롯(기존 모닝브리프)은 게이트 없이 정상 동작 → 배포해도 사용자 영향 0.
  if (slot === 'close' && process.env.DIGEST_CLOSE_SLOT_ENABLED !== 'on') {
    return NextResponse.json({ ok: true, slot, skipped: 'close-slot-disabled' });
  }

  const stats = { totalUsers: 0, queued: 0, skipped: 0, errors: [] as string[] };

  try {
    // 푸시 구독자
    const { data: subs, error: subscriptionError } = await db
      .from('push_subscriptions')
      .select('user_id');

    // 이메일 구독자 (모닝브리프 ON 유저만) — 정책 §7
    const { data: emailSubs, error: emailSubscriptionError } = await db
      .from('email_subscriptions')
      .select('user_id')
      .eq('morning_brief_enabled', true);
    if (subscriptionError || emailSubscriptionError) throw new Error('Could not read digest subscriptions');
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
    const { data: portfolios, error: portfolioError } = await db
      .from('user_portfolios')
      .select('user_id, stocks, daily_snapshots')
      .in('user_id', userIds);
    if (portfolioError) throw new Error('Could not read digest portfolios');
    if (!portfolios?.length) {
      return NextResponse.json({ ok: true, ...stats, note: '포트폴리오 없음' });
    }

    // 성능 최적화 — 모든 유저 보유 종목 unique 집합으로 dedup, 한 번에 병렬 fetch
    const allSymbols = new Set<string>();
    for (const port of portfolios) {
      const stocks = port.stocks as PortfolioStocks;
      for (const s of (stocks.investing || [])) {
        if (s.shares > 0 && s.avgCost > 0) allSymbols.add(s.symbol);
      }
    }

    // Missing FX remains unknown. It must never become an assumed portfolio value.
    let usdKrw: number | null = null;
    try {
      const fx = await fetch(`${appUrl}/api/kr-quote?symbol=USDKRW=X`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      const value = await fx.json();
      if (fx.ok && typeof value.c === 'number' && Number.isFinite(value.c) && value.c > 0
        && typeof value.t === 'number' && value.t * 1000 <= Date.now() + 300000
        && Date.now() - value.t * 1000 < 4 * 86400000) usdKrw = value.c;
    } catch { /* The brief displays unavailable valuations, while native price moves remain usable. */ }

    // 모든 unique 심볼 시세 병렬 fetch (cron 시간 절약 + Finnhub quota 절약)
    const priceCache: PriceCache = {};
    const symbols = Array.from(allSymbols);
    const fetchResults = await Promise.allSettled(symbols.map(s => fetchPrice(s, appUrl)));
    symbols.forEach((sym, i) => {
      const r = fetchResults[i];
      priceCache[sym] = r.status === 'fulfilled' ? r.value : null;
    });

    // user_id 기준 push subscription 매핑
    const pushUserIds = new Set((subs || []).map(s => s.user_id as string));

    // KST date — notification_log idempotency 키
    const todayKST = new Date(Date.now() + 9 * 3600_000).toISOString().split('T')[0];

    for (const userId of userIds) {
      try {
      const port = portfolios.find(p => p.user_id === userId);
      if (!port) { stats.skipped++; continue; }

      const stocks = port.stocks as PortfolioStocks;
      const snapshots = (Array.isArray(port.daily_snapshots) ? port.daily_snapshots : []) as DailySnapshot[];

      const brief = await buildBrief(stocks, snapshots, usdKrw, priceCache, slot);
      if (!brief) { stats.skipped++; continue; }

      const built = buildPushPayload(brief, slot);
      const title = built.title;
      let body = built.body;
      // '왜 움직였나' 사후 해설 (플래그 off면 null → 현행 델타-only 유지).
      // ⚠️ 한글명(STOCK_KR)이 있을 때만 질의 — 영문 심볼 폴백은 동일명 타사 뉴스 오노출
      //    위험이라 금지(spec §2(b), 토스 2026-01 사고 방어).
      if (brief.biggestMover) {
        const koreanName = STOCK_KR[brief.biggestMover.symbol];
        if (koreanName) {
          const note = await buildMoverNote(koreanName);
          if (note) body = `${body}\n${note}`;
        }
      }

      if (pushUserIds.has(userId)) {
        if (await queueDigest(db, { userId, type: framing.notificationType, date: todayKST, channel: 'push',
          payload: { push: { title, body, url: appUrl, tag: `joobi-digest-${slot}-${todayKST}` } } })) stats.queued++;
      }

      // ─ 이메일 발송 (구독자이고 이메일 알면) — 푸시 성공 여부와 독립
      // 사용자가 둘 다 ON 했으면 둘 다 받음 (각자 명시 옵트인이므로 OK)
      // 푸시 미구독 + 이메일 ON: 이메일이 유일한 채널 (iOS PWA 미설치 케이스)
      if (emailUserIds.has(userId)) {
        const recipient = await db.auth.admin.getUserById(userId);
        if (recipient.error) throw new Error('Could not resolve digest recipient');
        if (!recipient.data.user?.email) { stats.skipped++; continue; }
        const emailText = buildEmailBody(brief, title, body, appUrl);
        const totalValueFmt = brief.totalValue === null ? '미확인' : fmtWon(brief.totalValue);
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
          kicker: slot === 'close' ? 'MARKET CLOSE BRIEFING' : 'MORNING BRIEFING',
          greeting: slot === 'close' ? '오늘 국장 마감 정리예요 🌆' : '좋은 아침이에요 ☕',
          footerNote: `${slot === 'close' ? '국장 마감 후 발송 · KST 16:00' : '국장 시작 전 발송 · KST 07:00'} · ${brief.dataNote || '일일 변동액은 현재 환율로 환산한 주가 변화이며 환율 자체의 하루 변동은 포함하지 않아요.'}`,
          disclaimer: DISCLAIMER_DIGEST,
        });
        const queued = await queueDigest(db, { userId, type: framing.notificationType, date: todayKST, channel: 'email', payload: { email: {
          to: recipient.data.user.email,
          subject: title,
          text: emailText,
          html: emailHtml,
          // DISCLAIMER_DIGEST가 text·HTML 본문에 이미 포함(결과책임 문구 포함) → 글로벌 DISCLAIMER 이중 첨부 방지
          appendDisclaimer: false,
          unsubscribe: { userId, kind: 'morning_brief' }, // RFC 8058 1-click
        } } });
        if (queued) stats.queued++;
      }


      } catch {
        // One corrupt record or recipient lookup failure must not prevent every later
        // subscriber from being queued. Report counts only, without recipient identities.
        stats.errors.push('digest_user_failed');
      }
    }

    const deliveries = await processDigestQueue(db);
    if (stats.errors.length) await sendCronAlert({ jobName: 'morning-brief', stage: 'enqueue',
      error: 'Some subscriber digests could not be queued', context: { totalUsers: stats.totalUsers, queued: stats.queued, failedUsers: stats.errors.length } });
    return NextResponse.json({ ok: stats.errors.length === 0, ranAt: new Date().toISOString(), ...stats, deliveries },
      { status: stats.errors.length ? 500 : 200 });
  } catch (e) {
    await sendCronAlert({
      jobName: 'morning-brief',
      stage: 'main',
      error: e,
      context: { ...stats },
    });
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      ...stats,
    }, { status: 500 });
  }
}
