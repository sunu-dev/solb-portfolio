import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import type { PortfolioStocks } from '@/config/constants';
import { STOCK_KR } from '@/config/constants';
import type { DailySnapshot } from '@/utils/dailySnapshot';
import { findSnapshotNearDate, getDateDaysAgo } from '@/utils/dailySnapshot';
import { sendEmail } from '@/utils/email';
import { buildMorningBriefHtml } from '@/utils/emailTemplates';
import { sendCronAlert } from '@/lib/cronAlert';
import { isSingleStockLeverage } from '@/utils/leverageGuard';
import { DISCLAIMER_DIGEST, gateDigestNote } from '@/utils/alertCompliance';

// ─── 시차 인지 2슬롯 digest (docs/PERSONALIZED_DIGEST_SPEC.md) ───────────────
// 같은 route를 ?slot= 쿼리로 분기. 국장 07:00(간밤 미장 보유분) / 국장 마감 16:00(오늘 국장).
type DigestSlot = 'morning' | 'close';

interface SlotFraming {
  upEmoji: string;
  downEmoji: string;
  briefTitle: string;     // 기본(조용한 날) 제목
  /** close 슬롯은 '오늘(국장 마감) 변동'을 먼저, morning은 '어제 대비'를 먼저 */
  todayFirst: boolean;
  /** 멱등성 notification_type — 슬롯별 분리(단일 타입이면 둘째 슬롯 UNIQUE 위반 silent skip) */
  notificationType: string;
}

const SLOT_FRAMING: Record<DigestSlot, SlotFraming> = {
  morning: { upEmoji: '🌅', downEmoji: '🌫️', briefTitle: '오늘 아침 브리핑', todayFirst: false, notificationType: 'morning_brief' },
  close:   { upEmoji: '📊', downEmoji: '🌆', briefTitle: '국장 마감 브리핑', todayFirst: true,  notificationType: 'digest_kr_close' },
};

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
  slot: DigestSlot,
): Promise<BriefData | null> {
  // '중간 옵션'(2026-05-29): 단일종목 레버리지 보유분도 포트폴리오 손익 계산엔 포함한다
  // (정확한 보유 현황 = 관리·확인 목적). 단 아래 biggestMover('오늘의 주목 종목')로는
  // 스포트라이트하지 않는다 — 음의 복리 종목이 매일 주목 종목으로 푸시되면 매수/매도
  // 유인으로 읽힐 수 있으므로.
  const investing = (stocks.investing || []).filter(s => s.shares > 0 && s.avgCost > 0);
  if (investing.length === 0) return null;

  // 캐시에서 시세 조회 (cron 시작 시 unique 심볼 한 번에 fetch했음)
  let totalValue = 0;
  let todayDelta = 0;
  let prevValue = 0;
  // 주목 종목 후보: 슬롯 시장 매칭(close=국장 KR / morning=간밤 미장 US) 우선, 없으면 전체 fallback.
  type Mover = { symbol: string; dp: number; absDp: number };
  let biggestMatch: Mover | null = null;
  let biggestAny: Mover | null = null;
  for (const stock of investing) {
    const q = priceCache[stock.symbol];
    if (!q) continue;
    const isKR = stock.symbol.endsWith('.KS') || stock.symbol.endsWith('.KQ');
    const rate = isKR ? 1 : usdKrw;
    totalValue += q.c * stock.shares * rate;
    todayDelta += q.d * stock.shares * rate;
    prevValue += (q.c - q.d) * stock.shares * rate;
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

function buildPushPayload(brief: BriefData, slot: DigestSlot): { title: string; body: string } {
  const f = SLOT_FRAMING[slot];
  const emoji = brief.todayDelta >= 0 ? f.upEmoji : f.downEmoji;
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
    if (Math.abs(brief.todayPct) < 0.05) return null;
    const isUp = brief.todayDelta >= 0;
    const head = slot === 'close' ? '국장 마감' : '포트폴리오';
    const lead = slot === 'close' ? '오늘 국장' : '오늘';
    const pctStr = `${isUp ? '+' : ''}${brief.todayPct.toFixed(2)}%`;
    return {
      title: `${emoji} ${head} ${isUp ? '+' : '-'}${fmtWon(Math.abs(brief.todayDelta))}`,
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
    body: slot === 'close' ? '오늘 국장 조용한 편 · 앱에서 자세히 확인' : '간밤 시장 조용한 편 · 앱에서 자세히 확인',
  };
}

/**
 * '왜 움직였나' 사후 해설 — biggestMover 종목 최근 헤드라인을 비단정 서술로 첨부.
 *
 * ⚠️ 환각·§6 위험의 유일한 지점이라 env 플래그로 게이트한다. 기본 off → null(현행 델타-only).
 * - DIGEST_RAG_EXPLANATION='on'일 때만 동작. 약관 v4 변호사 검토 후 on.
 * - LLM '생성'이 아니라 실제 헤드라인 '인용'(RAG-grounded 사실) — 토스 2026-01 동일티커
 *   환각사고 방어를 위해 한글명으로만 질의.
 * - gateDigestNote()로 인과·방향·미래 단정 검출 시 드롭(omit) — 잘못된 인과보다 무가 안전.
 */
async function buildMoverNote(symbol: string, name: string): Promise<string | null> {
  if (process.env.DIGEST_RAG_EXPLANATION !== 'on') return null;
  if (!name) return null; // 한글명 없으면 질의 안 함 (영문 심볼 폴백 금지 — 동일명 환각 방어)
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) return null;
    const res = await fetch(`${appUrl}/api/news?q=${encodeURIComponent(name)}&maxHours=24&locale=ko`, { cache: 'no-store' });
    if (!res.ok) {
      console.warn(`[cron/morning-brief] buildMoverNote 뉴스 fetch 실패: ${symbol} status=${res.status}`);
      return null;
    }
    const d = await res.json();
    const headline: string | undefined = d?.items?.[0]?.title;
    if (!headline) return null;
    const { note, droppedFor } = gateDigestNote(`관련 소식: ${headline}`);
    if (droppedFor) console.warn(`[cron/morning-brief] buildMoverNote §6 게이트 드롭: ${symbol} (${droppedFor})`);
    return note;
  } catch (e) {
    console.warn(`[cron/morning-brief] buildMoverNote 예외: ${symbol} — ${e instanceof Error ? e.message : 'unknown'}`);
    return null;
  }
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
    '',
    DISCLAIMER_DIGEST, // 자기한계 선언형 면책 (sendEmail이 결과책임 DISCLAIMER도 자동 첨부)
  ].filter(Boolean).join('\n');
}

// 국장 아침 슬롯 (KST 07:00 = UTC 22:00). vercel.json "0 22 * * *".
export async function GET(req: NextRequest) {
  return runDigest(req, 'morning');
}

/**
 * digest 발송 본체. 슬롯은 호출 라우트가 결정론적으로 주입한다(defaultSlot).
 *
 * ⚠️ 슬롯을 wall-clock(UTC hour)으로 추정하지 않는다 — 22:00 morning cron이 자정(UTC)을
 * 넘겨 재시도되면(00:00~06:59) 슬롯이 close로 뒤집혀 notification_type이 바뀌고 멱등성이
 * 깨지기 때문(적대 리뷰 must-fix). 대신 morning 라우트(GET)와 close 라우트(../morning-brief-close)가
 * 각자 자기 슬롯을 고정 주입한다. ?slot=는 수동 테스트 override만.
 */
export async function runDigest(req: NextRequest, defaultSlot: DigestSlot) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  initWebPush();
  const db = getAdmin();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://solb-portfolio.vercel.app';

  const slotParam = req.nextUrl.searchParams.get('slot');
  const slot: DigestSlot = slotParam === 'close' ? 'close' : slotParam === 'morning' ? 'morning' : defaultSlot;
  const framing = SLOT_FRAMING[slot];

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

    // USD/KRW 환율 — fallback 1400 사용 시 거짓 KRW 손익 위험 → Sentry/운영 모니터링 필수
    const apiKey = process.env.FINNHUB_API_KEY;
    let usdKrw = 1400;
    let usdKrwIsStale = true;
    try {
      if (apiKey) {
        const fx = await fetch(`https://finnhub.io/api/v1/forex/rates?base=USD&token=${apiKey}`, { cache: 'no-store' });
        const j = await fx.json();
        if (j?.quote?.KRW && typeof j.quote.KRW === 'number') {
          usdKrw = j.quote.KRW;
          usdKrwIsStale = false;
        }
      }
    } catch (e) {
      console.error('[cron/morning-brief] USD/KRW fetch failed — using 1400 fallback', e);
    }
    if (usdKrwIsStale) {
      console.error('[cron/morning-brief] USD/KRW unavailable — using 1400 fallback. KRW 환산 손익은 부정확할 수 있음.');
    }

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

    // KST date — notification_log idempotency 키
    const todayKST = new Date(Date.now() + 9 * 3600_000).toISOString().split('T')[0];

    for (const userId of userIds) {
      const port = portfolios.find(p => p.user_id === userId);
      if (!port) { stats.skipped++; continue; }

      const stocks = port.stocks as PortfolioStocks;
      const snapshots = (Array.isArray(port.daily_snapshots) ? port.daily_snapshots : []) as DailySnapshot[];

      const brief = await buildBrief(stocks, snapshots, usdKrw, priceCache, slot);
      if (!brief) { stats.skipped++; continue; }

      // 멱등성 가드 — 같은 KST 일자에 같은 사용자·같은 슬롯에 한 번만 발송.
      // ⚠️ notification_type을 슬롯별로 분리(morning_brief / digest_kr_close)해야
      //    두 슬롯이 같은 날 UNIQUE(user, type, sent_date) 충돌로 둘째가 silent skip되지 않는다.
      // INSERT가 UNIQUE 위반하면 이미 발송된 상태 → skip (cron retry 중복 차단).
      const { error: idemErr } = await db.from('notification_log').insert({
        user_id: userId,
        notification_type: framing.notificationType,
        sent_date: todayKST,
        channel: 'pending',
        status: 'sending',
      });
      if (idemErr) {
        // 정상 멱등성(UNIQUE 위반, code 23505)은 조용히 skip. 그 외(테이블 미적용·RLS·스키마
        // 오류)는 silent fail이면 전체 cron이 sent:0인데 ok처럼 보이므로 감시 대상으로 올린다.
        const isDup = idemErr.code === '23505' || /duplicate|unique/i.test(idemErr.message || '');
        if (!isDup) {
          stats.errors.push(`idem ${userId.slice(0, 8)}: ${idemErr.code || ''} ${idemErr.message || 'unknown'}`);
          console.error('[cron/morning-brief] notification_log insert error (스키마/RLS 의심)', { code: idemErr.code, msg: idemErr.message });
        }
        stats.skipped++;
        continue;
      }

      const built = buildPushPayload(brief, slot);
      const title = built.title;
      let body = built.body;
      // '왜 움직였나' 사후 해설 (플래그 off면 null → 현행 델타-only 유지).
      // ⚠️ 한글명(STOCK_KR)이 있을 때만 질의 — 영문 심볼 폴백은 동일명 타사 뉴스 오노출
      //    위험이라 금지(spec §2(b), 토스 2026-01 사고 방어).
      if (brief.biggestMover) {
        const koreanName = STOCK_KR[brief.biggestMover.symbol];
        if (koreanName) {
          const note = await buildMoverNote(brief.biggestMover.symbol, koreanName);
          if (note) body = `${body}\n${note}`;
        }
      }

      // ─ 푸시 시도 (구독 있으면)
      const pushSub = subMap[userId];
      let pushSent = false;
      if (pushSub) {
        const payload = JSON.stringify({ title, body, url: appUrl, tag: `solb-digest-${slot}` });
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
          kicker: slot === 'close' ? 'MARKET CLOSE BRIEFING' : 'MORNING BRIEFING',
          greeting: slot === 'close' ? '오늘 국장 마감 정리예요 🌆' : '좋은 아침이에요 ☕',
          footerNote: slot === 'close' ? '국장 마감 후 발송 · KST 16:00' : '국장 시작 전 발송 · KST 07:00',
          disclaimer: DISCLAIMER_DIGEST,
        });
        const result = await sendEmail({
          to: emailMap[userId],
          subject: title,
          text: emailText,
          html: emailHtml,
          // DISCLAIMER_DIGEST가 text·HTML 본문에 이미 포함(결과책임 문구 포함) → 글로벌 DISCLAIMER 이중 첨부 방지
          appendDisclaimer: false,
          unsubscribe: { userId, kind: 'morning_brief' }, // RFC 8058 1-click
        });
        if (result.ok) stats.emailed++;
        else stats.errors.push(`email ${userId.slice(0, 8)}: ${result.error}`);
      }

      if (!pushSent && !emailUserIds.has(userId)) stats.skipped++;
    }

    return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), ...stats });
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