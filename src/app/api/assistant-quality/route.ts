import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/apiRoute';
import { requireServiceClient } from '@/lib/supabaseServer';
import { parseQualityCase, QUALITY_REASONS } from '@/lib/assistantQuality';
import { persistQualityEvent, verifyQualityReceipt } from '@/lib/assistantQualityServer';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
const timeout = () => AbortSignal.timeout(5000);
const unavailable = () => json({ error: '저장 내용을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.' }, 503);
export const POST = defineRoute({ name: '/api/assistant-quality', auth: 'user', deferLog: true, handler: async ({ req, userId }) => {
  if (process.env.JOOBI_QUESTION_QUALITY_ENABLED !== 'true') return unavailable();
  // Limit actual bytes as well as Content-Length (which clients may omit).
  const reader = req.body?.getReader(); if (!reader) return json({ error: '요청 내용을 확인해 주세요.' }, 400);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const next = await reader.read(); if (next.done) break; size += next.value.length; if (size > 24000) { await reader.cancel(); return json({ error: '내용이 너무 길어요.' }, 413); } chunks.push(next.value); }
  let body; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json({ error: '요청 내용을 확인해 주세요.' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: '요청 내용을 확인해 주세요.' }, 400);
  const event = verifyQualityReceipt(body.receipt, userId!);
  if (!event || event.outcome !== 'ready') return json({ error: '이 답변의 평가 기간이 끝났어요.' }, 400);
  const db = requireServiceClient();
  if (!['received','rating','case'].includes(body.action)) return json({ error: '요청 내용을 확인해 주세요.' }, 400);
  if (body.action === 'rating' && ((body.rating !== 1 && body.rating !== -1) || (body.reason != null && !Object.hasOwn(QUALITY_REASONS, body.reason)))) return json({ error: '평가를 다시 선택해 주세요.' }, 400);
  const example = body.action === 'case' ? parseQualityCase(body) : null;
  if (body.action === 'case' && !example) return json({ error: '개인정보를 지우고 질문·답변과 제공 동의를 확인해 주세요.' }, 400);
  if (!await persistQualityEvent(event)) return unavailable();
  if (body.action === 'received') {
    const { error } = await db.from('assistant_quality_events').update({ received: true }).eq('id', event.id).abortSignal(timeout());
    return error ? unavailable() : json({ ok: true });
  }
  if (body.action === 'rating') {
    const { error } = await db.from('assistant_quality_feedback').upsert({ event_id: event.id, user_id: userId, rating: body.rating, reason: body.rating === -1 ? body.reason ?? null : null, updated_at: new Date().toISOString() }).abortSignal(timeout());
    return error ? unavailable() : json({ ok: true });
  }
  // No history or portfolio fields are accepted. Client-edited examples are not ground truth.
  const expiresAt = new Date(Date.parse(event.created_at) + 30 * 86400_000).toISOString();
  const { error } = await db.from('assistant_quality_cases').upsert({ event_id: event.id, user_id: userId, ...example, expires_at: expiresAt, review_status: 'new', issue: null }).abortSignal(timeout());
  return error ? unavailable() : json({ ok: true, id: event.id, expiresAt });
} });

export const GET = defineRoute({ name: '/api/assistant-quality', auth: 'user', deferLog: true, handler: async ({ req, userId }) => {
  const before = req.nextUrl.searchParams.get('before');
  if (before && !Number.isFinite(Date.parse(before))) return json({ error: '조회 위치를 확인해 주세요.' }, 400);
  let query = requireServiceClient().from('assistant_quality_cases').select('event_id, question, answer, created_at, expires_at')
    .eq('user_id', userId!).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(100);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query.abortSignal(timeout());
  return error ? unavailable() : json({ cases: data, next: data?.length === 100 ? data.at(-1)?.created_at : null });
} });
export const DELETE = defineRoute({ name: '/api/assistant-quality', auth: 'user', deferLog: true, handler: async ({ req, userId }) => {
  const id = req.nextUrl.searchParams.get('id');
  if (!id || !/^[\da-f-]{36}$/.test(id)) return json({ error: '삭제할 사례를 선택해 주세요.' }, 400);
  const { error } = await requireServiceClient().from('assistant_quality_cases').delete().eq('event_id', id).eq('user_id', userId!).abortSignal(timeout());
  return error ? unavailable() : json({ ok: true });
} });
