import { createHmac, timingSafeEqual } from 'node:crypto';
import { getServiceClient } from './supabaseServer';
import type { QualityEvent } from './assistantQuality';

function key() { return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY; }
function signature(payload: string, userId: string, secret: string) {
  return createHmac('sha256', secret).update(`joobi-quality-v1:${userId}:${payload}`).digest('base64url');
}
// Bound to the authenticated account, without putting that account into the metrics row/token.
export function signQualityReceipt(event: QualityEvent, userId: string): string | undefined {
  const secret = key(); if (!secret) return undefined;
  const payload = Buffer.from(JSON.stringify(event)).toString('base64url');
  return `${payload}.${signature(payload, userId, secret)}`;
}
export function verifyQualityReceipt(receipt: unknown, userId: string, now = Date.now()): QualityEvent | null {
  const secret = key();
  if (!secret || typeof receipt !== 'string' || receipt.length > 3000) return null;
  const [payload, mac, extra] = receipt.split('.');
  if (!payload || !mac || extra) return null;
  const expected = Buffer.from(signature(payload, userId, secret)), actual = Buffer.from(mac);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const event = JSON.parse(Buffer.from(payload, 'base64url').toString()) as QualityEvent;
    const age = now - Date.parse(event.created_at);
    if (!Number.isFinite(age) || age < -60_000 || age >= 30 * 86400_000 || !/^[\da-f-]{36}$/.test(event.id)) return null;
    return event;
  } catch { return null; }
}
export async function persistQualityEvent(event: QualityEvent): Promise<boolean> {
  try {
    const db = getServiceClient(); if (!db) return false;
    // Immutable upsert: delivery acknowledgement may reach the DB before after().
    const { error } = await db.from('assistant_quality_events').upsert(event, { onConflict: 'id', ignoreDuplicates: true }).abortSignal(AbortSignal.timeout(3000));
    if (error) { console.warn('[assistant-quality] metric_write_failed'); return false; }
    return true;
  } catch { console.warn('[assistant-quality] metric_write_failed'); return false; }
}
