import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { requireServiceClient } from '@/lib/supabaseServer';
import { aggregateUsage, kstDay, shiftDay, type UsageRow } from '@/lib/usageMetrics';
import { readAllRows } from '@/lib/readAllRows';

export const GET = defineRoute({ name: '/api/admin/usage', auth: 'admin', handler: async ({ req }) => {
  const days = Number(req.nextUrl.searchParams.get('days') ?? 14);
  if (![7,14,30].includes(days)) return NextResponse.json({ error: '기간을 확인해주세요.' }, { status: 400 });
  const db = requireServiceClient();
  const today = kstDay(Date.now());
  const until = new Date().toISOString();
  const start = `${shiftDay(today, -29)}T00:00:00+09:00`;
  try {
    const rows = await readAllRows<UsageRow>(after => {
      let q = db.from('usage_samples').select('id,session_id,user_id,visitor_id,started_at,ended_at,active_ms,feature,event')
        .gte('started_at', start).lte('created_at', until).order('id').limit(1000);
      if (after) q = q.gt('id', after);
      return q;
    }, row => row.id);
    return NextResponse.json({ available: true, firstSampleAt: rows.reduce<string | null>((min,r) => !min || r.started_at < min ? r.started_at : min, null),
      retainedDays: 30, measuredAt: until, days, ...aggregateUsage(rows, today, days) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ available: false, error: '이용 기록을 읽지 못했어요. 저장소 연결과 마이그레이션을 확인해주세요.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
} });
