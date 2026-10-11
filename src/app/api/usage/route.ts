import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { requireServiceClient } from '@/lib/supabaseServer';
import { parseUsagePayload } from '@/lib/usageMetrics';
import { getClientIp } from '@/lib/rateLimiter';

export const POST = defineRoute({
  name: '/api/usage', auth: 'optional', rateLimit: { windowSec: 60, maxAnon: 30, maxLoggedIn: 60 },
  handler: async ({ req, userId, isAdmin }) => {
    const origin = req.headers.get('origin');
    if (origin && origin !== req.nextUrl.origin) return NextResponse.json({ error: 'origin' }, { status: 403 });
    if (req.headers.get('authorization') && !userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (Number(req.headers.get('content-length') || 0) > 16000) return NextResponse.json({ error: 'payload' }, { status: 413 });
    const raw = await req.text();
    if (raw.length > 16000) return NextResponse.json({ error: 'payload' }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'payload' }, { status: 400 }); }
    const parsed = parseUsagePayload(body);
    if (!parsed) return NextResponse.json({ error: 'payload' }, { status: 400 });
    // Internal admin sessions are deliberately excluded from product usage.
    if (isAdmin) return new NextResponse(null, { status: 204 });
    const db = requireServiceClient();
    // Unlike the shared best-effort limiter, telemetry writes fail closed on storage errors.
    const limit = await db.from('api_calls').select('id', { count: 'exact', head: true })
      .eq('endpoint', '/api/usage').eq('user_key', userId || `ip:${getClientIp(req)}`)
      .gte('created_at', new Date(Date.now() - 60000).toISOString());
    if (limit.error) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
    if ((limit.count || 0) >= (userId ? 60 : 30)) return NextResponse.json({ error: 'rate_limit' }, { status: 429 });
    const { error } = await db.from('usage_samples').upsert(parsed.samples.map(s => ({ ...s,
      user_id: userId, visitor_id: userId ? null : parsed.visitorId,
    })), { onConflict: 'id', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: 'storage_unavailable' }, { status: 503 });
    return new NextResponse(null, { status: 204 });
  },
});
