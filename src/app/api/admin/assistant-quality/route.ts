import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { requireServiceClient } from '@/lib/supabaseServer';
import { QUALITY_REASONS } from '@/lib/assistantQuality';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
export const GET = defineRoute({ name: '/api/admin/assistant-quality', auth: 'admin', handler: async ({ req }) => {
  const db = requireServiceClient();
  const before = req.nextUrl.searchParams.get('before');
  if (before && !Number.isFinite(Date.parse(before))) return json({ error: 'invalid_cursor' }, 400);
  let query = db.from('assistant_quality_cases').select('event_id, question, answer, created_at, expires_at, review_status, issue')
    .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(50);
  if (before) query = query.lt('created_at', before);
  const [summary, cases] = await Promise.all([db.rpc('assistant_quality_summary').abortSignal(AbortSignal.timeout(6000)), query.abortSignal(AbortSignal.timeout(6000))]);
  if (summary.error || cases.error) return json({ error: '검수 자료를 불러오지 못했어요. 다시 시도해 주세요.' }, 503);
  return json({ summary: summary.data, cases: cases.data, next: cases.data?.length === 50 ? cases.data.at(-1)?.created_at : null, enabled: process.env.JOOBI_QUESTION_QUALITY_ENABLED === 'true' });
} });
export const PATCH = defineRoute({ name: '/api/admin/assistant-quality', auth: 'admin', handler: async ({ req }) => {
  const body = await req.json().catch(() => null);
  if (!body || !/^[\da-f-]{36}$/.test(body.id) || !['new','reviewed','fixed'].includes(body.status) || (body.issue != null && !Object.hasOwn(QUALITY_REASONS, body.issue))) return json({ error: '검수 상태를 확인해 주세요.' }, 400);
  const { data, error } = await requireServiceClient().from('assistant_quality_cases').update({ review_status: body.status, issue: body.issue ?? null })
    .eq('event_id', body.id).gt('expires_at', new Date().toISOString()).select('event_id').abortSignal(AbortSignal.timeout(5000));
  if (error) return json({ error: '검수 상태를 저장하지 못했어요.' }, 503);
  if (!data?.length) return json({ error: '삭제되었거나 검수 기간이 끝난 사례예요.' }, 404);
  return json({ ok: true });
} });
