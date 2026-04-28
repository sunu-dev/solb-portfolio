import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClaudeUsageToday, getProviderStatus } from '@/lib/aiProvider';

const ADMIN_IDS = ['8d5fc5d7-978c-4365-a647-af90c237222b'];
const ADMIN_EMAILS = ['soonooya@gmail.com', 'sunu.develop@gmail.com'];

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

interface ApiCallRow {
  endpoint: string;
  user_key: string;
  user_id: string | null;
  ip: string | null;
  status: number;
  latency_ms: number | null;
  error_code: string | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  // 관리자 인증
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const isAdmin = ADMIN_EMAILS.includes(user.email || '') || ADMIN_IDS.includes(user.id);
  if (!isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const hours = parseInt(req.nextUrl.searchParams.get('hours') || '24');
  const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  try {
    // 전체 호출 로드 (최근 N시간)
    const { data } = await supabaseAdmin
      .from('api_calls')
      .select('endpoint, user_key, user_id, ip, status, latency_ms, error_code, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(50000); // 안전장치

    const rows = (data || []) as ApiCallRow[];
    const total = rows.length;
    const successes = rows.filter(r => r.status >= 200 && r.status < 400).length;
    const errors = total - successes;
    const successRate = total > 0 ? (successes / total) * 100 : 100;

    // 엔드포인트별 집계
    const byEndpoint: Record<string, { count: number; errors: number; latencies: number[] }> = {};
    for (const r of rows) {
      const e = r.endpoint;
      if (!byEndpoint[e]) byEndpoint[e] = { count: 0, errors: 0, latencies: [] };
      byEndpoint[e].count++;
      if (r.status >= 400) byEndpoint[e].errors++;
      if (r.latency_ms != null) byEndpoint[e].latencies.push(r.latency_ms);
    }
    const endpoints = Object.entries(byEndpoint).map(([endpoint, v]) => {
      const lats = v.latencies.slice().sort((a, b) => a - b);
      const p50 = lats.length ? lats[Math.floor(lats.length * 0.5)] : null;
      const p95 = lats.length ? lats[Math.floor(lats.length * 0.95)] : null;
      const avg = lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : null;
      return {
        endpoint,
        count: v.count,
        errors: v.errors,
        errorRate: v.count > 0 ? (v.errors / v.count) * 100 : 0,
        p50, p95, avg,
      };
    }).sort((a, b) => b.count - a.count);

    // Top user_keys
    const byUser: Record<string, number> = {};
    for (const r of rows) {
      byUser[r.user_key] = (byUser[r.user_key] || 0) + 1;
    }
    const topUsers = Object.entries(byUser)
      .map(([userKey, count]) => ({
        userKey,
        count,
        isAnon: userKey.startsWith('ip:'),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 에러 코드 분포
    const errorCodes: Record<string, number> = {};
    for (const r of rows) {
      if (r.error_code) errorCodes[r.error_code] = (errorCodes[r.error_code] || 0) + 1;
    }
    const errorDist = Object.entries(errorCodes)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);

    // 시간별 히스토그램 (버킷 = 1시간)
    const buckets: Record<number, { total: number; errors: number }> = {};
    for (let i = 0; i < hours; i++) buckets[i] = { total: 0, errors: 0 };
    const now = Date.now();
    for (const r of rows) {
      const ageMs = now - new Date(r.created_at).getTime();
      const bucket = Math.floor(ageMs / (60 * 60 * 1000));
      if (bucket < 0 || bucket >= hours) continue;
      buckets[bucket].total++;
      if (r.status >= 400) buckets[bucket].errors++;
    }
    // 최근 → 과거 순으로 반환 (UI는 뒤집어 과거→최근)
    const timeline = Array.from({ length: hours }, (_, i) => {
      const b = buckets[i];
      const at = new Date(now - i * 60 * 60 * 1000);
      return {
        hoursAgo: i,
        label: `${at.getMonth() + 1}/${at.getDate()} ${String(at.getHours()).padStart(2, '0')}시`,
        total: b.total,
        errors: b.errors,
      };
    }).reverse();

    // Claude fallback 사용량
    const providerStatus = getProviderStatus();
    const claudeUsage = await getClaudeUsageToday();

    return NextResponse.json({
      hours,
      total,
      successes,
      errors,
      successRate: Math.round(successRate * 10) / 10,
      endpoints,
      topUsers,
      errorDist,
      timeline,
      provider: {
        gemini: { keys: providerStatus.geminiKeys },
        claude: {
          available: providerStatus.claudeAvailable,
          used: claudeUsage.used,
          limit: claudeUsage.limit,
          remaining: claudeUsage.remaining,
          estimatedCostUsd: claudeUsage.estimatedCostUsd,
        },
      },
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    console.error('API stats error:', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}