import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { requireServiceClient } from '@/lib/supabaseServer';

export const GET = defineRoute({ name: '/api/cron/assistant-quality-retention', auth: 'cron', rateLimit: false, handler: async () => {
  // Cascades remove associated ratings and opted-in examples; expired rows are also excluded from reads.
  const { count, error } = await requireServiceClient().from('assistant_quality_events').delete({ count: 'exact' })
    .lt('created_at', new Date(Date.now() - 30 * 86400_000).toISOString()).abortSignal(AbortSignal.timeout(10000));
  return NextResponse.json(error ? { ok: false, code: 'quality_retention_failed' } : { ok: true, deleted: count }, { status: error ? 503 : 200 });
} });
