import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 신규 상장 종목 감지 cron — 매일 KST 09:00 (UTC 00:00)
 *
 * 동작:
 * 1. Finnhub /stock/symbol?exchange=US,KS,KQ 호출 (전체 상장 목록)
 * 2. 기존 stock_listings 와 diff
 *    - 신규 (Finnhub에 있고 DB에 없음) → insert status='watch'
 *    - 상폐 후보 (DB에 있고 Finnhub에 없음) → status='delisted' (universe인 종목은 알림만)
 *    - 기존 (둘 다 있음) → last_seen 갱신
 * 3. Slack 알림 (총 X개 신규, Y개 상폐 후보)
 *
 * 등록: vercel.json crons "schedule": "0 0 * * *" (UTC 00:00 = KST 09:00)
 *
 * 인프라:
 * - FINNHUB_API_KEY: 서버용 Finnhub 키
 * - SUPABASE_SERVICE_KEY: Service role
 * - SLACK_WEBHOOK_URL: 알림 (선택)
 * - CRON_SECRET: Vercel Cron 인증
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';

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

interface FinnhubSymbol {
  symbol: string;
  description: string;
  type?: string;
  mic?: string;
}

async function fetchExchangeSymbols(exchange: 'US' | 'KS' | 'KQ', apiKey: string): Promise<FinnhubSymbol[]> {
  try {
    const r = await fetch(
      `${FINNHUB_BASE}/stock/symbol?exchange=${exchange}&token=${apiKey}`,
      { signal: AbortSignal.timeout(20000) }
    );
    if (!r.ok) {
      console.error(`[sync-listings] ${exchange} fetch failed:`, r.status);
      return [];
    }
    const data = (await r.json()) as FinnhubSymbol[];
    // ETF는 별도 type 'ETP', 일반 주식 'Common Stock' 만 통과
    return (data || []).filter(s => {
      const t = s.type;
      return t === 'Common Stock' || t === 'ETP' || t === 'ETF';
    });
  } catch (e) {
    console.error(`[sync-listings] ${exchange} fetch error:`, e);
    return [];
  }
}

async function sendSlackAlert(title: string, body: string) {
  if (!SLACK_WEBHOOK_URL) return;
  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `*${title}*\n${body}` }),
    });
  } catch { /* silent */ }
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ error: 'FINNHUB_API_KEY not configured' }, { status: 500 });
  }

  const supabase = getAdmin();

  // 1. Finnhub에서 현재 상장 목록 받기 (병렬)
  const [us, ks, kq] = await Promise.all([
    fetchExchangeSymbols('US', apiKey),
    fetchExchangeSymbols('KS', apiKey),
    fetchExchangeSymbols('KQ', apiKey),
  ]);

  const incoming: Array<{ symbol: string; exchange: string; description: string }> = [
    ...us.map(s => ({ symbol: s.symbol, exchange: 'US', description: s.description || '' })),
    ...ks.map(s => ({ symbol: s.symbol, exchange: 'KS', description: s.description || '' })),
    ...kq.map(s => ({ symbol: s.symbol, exchange: 'KQ', description: s.description || '' })),
  ];

  if (incoming.length === 0) {
    return NextResponse.json({ error: 'no data from Finnhub' }, { status: 503 });
  }

  // 2. 기존 stock_listings 전체 조회
  const { data: existing, error: selErr } = await supabase
    .from('stock_listings')
    .select('symbol, status');
  if (selErr) {
    console.error('[sync-listings] select error:', selErr);
    return NextResponse.json({ error: 'db select failed' }, { status: 500 });
  }

  const existingMap = new Map<string, string>(
    (existing || []).map(r => [r.symbol as string, r.status as string])
  );
  const incomingSet = new Set(incoming.map(s => s.symbol));

  // 3. Diff 계산
  const newRows = incoming.filter(s => !existingMap.has(s.symbol));
  const delistedSymbols = (existing || [])
    .filter(r => !incomingSet.has(r.symbol as string))
    .filter(r => r.status !== 'delisted')   // 이미 상폐는 스킵
    .map(r => r.symbol as string);
  const stillActiveSymbols = (existing || [])
    .filter(r => incomingSet.has(r.symbol as string))
    .map(r => r.symbol as string);

  // 4. DB 반영 — 배치 처리
  const now = new Date().toISOString();

  // 4-1. 신규 종목 insert (1000개씩 청크)
  if (newRows.length > 0) {
    const CHUNK = 1000;
    for (let i = 0; i < newRows.length; i += CHUNK) {
      const chunk = newRows.slice(i, i + CHUNK).map(r => ({
        symbol: r.symbol,
        exchange: r.exchange,
        description: r.description,
        status: 'watch',
        first_seen: now,
        last_seen: now,
      }));
      const { error } = await supabase.from('stock_listings').insert(chunk);
      if (error) console.error('[sync-listings] insert chunk error:', error);
    }
  }

  // 4-2. 활성 종목 last_seen 갱신 (배치 update — 트리거가 자동으로 last_seen 처리)
  //      대량이라 chunk 별로 처리. last_seen 갱신은 정확성보다 상폐 감지용이므로 1000개 청크 OK.
  if (stillActiveSymbols.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < stillActiveSymbols.length; i += CHUNK) {
      const chunk = stillActiveSymbols.slice(i, i + CHUNK);
      // last_seen 트리거가 자동 → 빈 update만 호출
      const { error } = await supabase
        .from('stock_listings')
        .update({ last_seen: now })
        .in('symbol', chunk);
      if (error) console.error('[sync-listings] update last_seen error:', error);
    }
  }

  // 4-3. 상폐 후보 마킹 (universe인 경우는 별도 알림만, 상태 변경 X)
  let universeDelisted: string[] = [];
  if (delistedSymbols.length > 0) {
    // universe 상태 종목 찾기
    const { data: universeRows } = await supabase
      .from('stock_listings')
      .select('symbol')
      .in('symbol', delistedSymbols)
      .eq('status', 'universe');
    universeDelisted = (universeRows || []).map(r => r.symbol as string);

    // universe 외 종목만 'delisted' 로 마킹
    const toMarkDelisted = delistedSymbols.filter(s => !universeDelisted.includes(s));
    if (toMarkDelisted.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < toMarkDelisted.length; i += CHUNK) {
        const chunk = toMarkDelisted.slice(i, i + CHUNK);
        const { error } = await supabase
          .from('stock_listings')
          .update({ status: 'delisted' })
          .in('symbol', chunk);
        if (error) console.error('[sync-listings] mark delisted error:', error);
      }
    }
  }

  // 5. Slack 알림
  const newCount = newRows.length;
  const sampleNew = newRows.slice(0, 5).map(r => `${r.symbol} (${r.exchange})`).join(', ');
  const delistedCount = delistedSymbols.length;
  const alertLines: string[] = [];
  if (newCount > 0) {
    alertLines.push(`📈 신규 상장 ${newCount}건${newCount > 5 ? ` (예: ${sampleNew} 외)` : ` (${sampleNew})`}`);
  }
  if (delistedCount > 0) {
    alertLines.push(`📉 상폐/제거 감지 ${delistedCount}건`);
  }
  if (universeDelisted.length > 0) {
    alertLines.push(`🚨 *universe 종목 상폐 후보*: ${universeDelisted.join(', ')} — 즉시 검토 필요`);
  }
  if (alertLines.length > 0) {
    await sendSlackAlert('주비 종목 동기화', alertLines.join('\n'));
  }

  return NextResponse.json({
    ok: true,
    fetched: { us: us.length, ks: ks.length, kq: kq.length, total: incoming.length },
    diff: { newCount, delistedCount, universeDelisted },
  });
}
