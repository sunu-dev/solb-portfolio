import { NextResponse } from 'next/server';
import { requireServiceClient } from '@/lib/supabaseServer';
import { defineRoute } from '@/lib/apiRoute';
import {
  countUnsupportedFinnhubSecurityTypes,
  isSupportedFinnhubSecurityType,
} from '@/utils/securityTypePolicy';

/**
 * 신규 상장 종목 감지 cron — 매일 KST 09:00 (UTC 00:00)
 *
 * 동작:
 * 1. Finnhub /stock/symbol?exchange=US,KS,KQ 호출 (전체 상장 목록)
 * 2. 기존 stock_listings 와 diff
 *    - 신규 (Finnhub에 있고 DB에 없음) → insert status='watch'
 *    - 상폐 후보 (DB에 있고 Finnhub에 없음) → status='delisted' (universe인 종목은 알림만)
 *    - 기존 (둘 다 있음) → 쓰기 생략 (상폐 판정은 목록 차이로 수행)
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

// 키 해석은 `@/lib/supabaseServer` 한 곳이 SSOT다.
// 예전엔 여기서 `SUPABASE_SERVICE_KEY` **단독**으로 읽었다 — 비-cron 라우트는 전부
// `SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_KEY` 폴백을 갖고 있었기 때문에,
// 새 이름만 설정한 환경에서 **웹은 멀쩡하고 cron만 죽는** 부분 장애가 났다
// (알림·이메일 미발송은 사용자가 신고하기 전엔 드러나지 않는다).
function getAdmin() {
  return requireServiceClient();
}

interface FinnhubSymbol {
  symbol: string;
  description: string;
  type?: string;
  mic?: string;
}

interface ExchangeSymbolResult {
  symbols: FinnhubSymbol[];
  excludedTypes: Record<string, number>;
  complete: boolean;
}

async function fetchExchangeSymbols(exchange: 'US' | 'KS' | 'KQ', apiKey: string): Promise<ExchangeSymbolResult> {
  try {
    const r = await fetch(
      `${FINNHUB_BASE}/stock/symbol?exchange=${exchange}&token=${apiKey}`,
      { signal: AbortSignal.timeout(20000) }
    );
    if (!r.ok) {
      console.error(`[sync-listings] ${exchange} fetch failed:`, r.status);
      return { symbols: [], excludedTypes: {}, complete: false };
    }
    const data = (await r.json()) as FinnhubSymbol[];
    // Empty/malformed snapshots cannot establish that an entire market delisted.
    if (!Array.isArray(data) || data.length === 0 || data.some(row =>
      !row || typeof row.symbol !== 'string' || !row.symbol.trim()
    )) return { symbols: [], excludedTypes: {}, complete: false };
    const rows = data;
    return {
      symbols: rows.filter(s => isSupportedFinnhubSecurityType(s.type)),
      excludedTypes: countUnsupportedFinnhubSecurityTypes(rows),
      complete: rows.some(s => isSupportedFinnhubSecurityType(s.type)),
    };
  } catch (e) {
    console.error(`[sync-listings] ${exchange} fetch error:`, e);
    return { symbols: [], excludedTypes: {}, complete: false };
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

export const GET = defineRoute({
  name: '/api/cron/sync-listings',
  auth: 'cron',
  rateLimit: false,
  handler: async () => {
  const startedAt = Date.now();

  const apiKey = process.env.FINNHUB_API_KEY || process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ error: 'FINNHUB_API_KEY not configured' }, { status: 500 });
  }

  const supabase = getAdmin();

  // 1. Finnhub에서 현재 상장 목록 받기 (병렬)
  const [usResult, ksResult, kqResult] = await Promise.all([
    fetchExchangeSymbols('US', apiKey),
    fetchExchangeSymbols('KS', apiKey),
    fetchExchangeSymbols('KQ', apiKey),
  ]);
  const us = usResult.symbols;
  const ks = ksResult.symbols;
  const kq = kqResult.symbols;
  const exchangeResults: [string, ExchangeSymbolResult][] = [['US', usResult], ['KS', ksResult], ['KQ', kqResult]];
  const completeExchanges = new Set(exchangeResults.filter(([, result]) => result.complete).map(([exchange]) => exchange));
  const skippedExchanges = ['US', 'KS', 'KQ'].filter(exchange => !completeExchanges.has(exchange));
  const excludedTypes = {
    US: usResult.excludedTypes,
    KS: ksResult.excludedTypes,
    KQ: kqResult.excludedTypes,
  };

  if (Object.values(excludedTypes).some(counts => Object.keys(counts).length > 0)) {
    console.info('[sync-listings] excluded Finnhub security types:', excludedTypes);
  }

  const incoming: Array<{ symbol: string; exchange: string; description: string }> = [
    ...us.map(s => ({ symbol: s.symbol, exchange: 'US', description: s.description || '' })),
    ...ks.map(s => ({ symbol: s.symbol, exchange: 'KS', description: s.description || '' })),
    ...kq.map(s => ({ symbol: s.symbol, exchange: 'KQ', description: s.description || '' })),
  ];

  if (incoming.length === 0) {
    return NextResponse.json({ error: 'no data from Finnhub' }, { status: 503 });
  }

  // 2. 기존 stock_listings 전체 조회
  // Supabase JS 기본 limit이 1000건이라 페이지네이션 필수.
  // 24,400+ 종목을 한 번에 못 가져오면 매 cron마다 23,000건이 '신규'로 오탐 (2026-05-15 발견).
  const PAGE = 1000;
  const allExisting: { symbol: string; status: string; exchange: string }[] = [];
  let cursor: string | undefined;
  let readBatches = 0;
  for (;;) {
    // Primary-key cursor avoids repeatedly walking OFFSET rows as the catalog grows.
    let query = supabase
      .from('stock_listings')
      .select('symbol, status, exchange')
      .order('symbol', { ascending: true })
      .limit(PAGE);
    if (cursor !== undefined) query = query.gt('symbol', cursor);
    const { data: page, error: selErr } = await query;
    readBatches++;
    if (selErr) {
      console.error('[sync-listings] select error:', selErr);
      return NextResponse.json({ error: 'db select failed' }, { status: 500 });
    }
    if (!page || page.length === 0) break;
    allExisting.push(...page);
    if (page.length < PAGE) break; // 마지막 페이지
    cursor = page[page.length - 1].symbol;
  }
  const existing = allExisting;

  const existingMap = new Map<string, string>(
    (existing || []).map(r => [r.symbol as string, r.status as string])
  );
  const incomingSet = new Set(incoming.map(s => s.symbol));

  // 3. Diff 계산
  const newRows = incoming.filter(s => !existingMap.has(s.symbol));
  const delistedSymbols = (existing || [])
    .filter(r => completeExchanges.has(r.exchange))
    .filter(r => !incomingSet.has(r.symbol as string))
    .filter(r => r.status !== 'delisted')   // 이미 상폐는 스킵
    .map(r => r.symbol as string);
  const unchangedCount = existing.filter(r => incomingSet.has(r.symbol)).length;
  let writeBatches = 0;

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
      if (error) return NextResponse.json({ error: 'db insert failed' }, { status: 500 });
      writeBatches++;
    }
  }

  // last_seen is retained for legacy compatibility; it is not a scan heartbeat.
  // Unchanged rows require no UPDATE, WAL, or later dead-tuple cleanup.

  // 4-3. 상폐 후보 마킹 (universe인 경우는 별도 알림만, 상태 변경 X)
  let universeDelisted: string[] = [];
  if (delistedSymbols.length > 0) {
    universeDelisted = delistedSymbols.filter(symbol => existingMap.get(symbol) === 'universe');

    // universe 외 종목만 'delisted' 로 마킹
    const toMarkDelisted = delistedSymbols.filter(s => existingMap.get(s) !== 'universe');
    if (toMarkDelisted.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < toMarkDelisted.length; i += CHUNK) {
        const chunk = toMarkDelisted.slice(i, i + CHUNK);
        const { error } = await supabase
          .from('stock_listings')
          .update({ status: 'delisted' })
          .in('symbol', chunk)
          .neq('status', 'universe')
          .neq('status', 'delisted');
        if (error) return NextResponse.json({ error: 'db delist update failed' }, { status: 500 });
        writeBatches++;
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

  const diagnostics = {
    excludedTypes, skippedExchanges, readBatches, writeBatches, unchangedCount,
    durationMs: Date.now() - startedAt,
  };
  console.info('[sync-listings] completed', { ...diagnostics, newCount, delistedCount });
  return NextResponse.json({
    ok: true,
    fetched: { us: us.length, ks: ks.length, kq: kq.length, total: incoming.length },
    diagnostics,
    diff: { newCount, delistedCount, universeDelisted },
  });
},
});
