import { randomUUID } from 'node:crypto';
import webpush from 'web-push';
import { requireServiceClient } from './supabaseServer';
import { sendEmail, type SendEmailOpts } from '@/utils/email';
import { sendCronAlert } from './cronAlert';
import { privateNotificationsPaused, PRIVATE_NOTIFICATION_PAUSE_REASON } from './privateNotificationPause';

export type DigestPayload = { email: SendEmailOpts } | { push: { title: string; body: string; url: string; tag: string } };
export interface DigestDelivery {
  id: string; user_id: string; channel: 'email' | 'push'; payload: DigestPayload;
  attempts: number; deadline_at: string;
}
type Db = ReturnType<typeof requireServiceClient>;

// Bound read latency before attempting a provider send. A late read cannot send on its own.
async function lookup<T>(request: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve(request), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('delivery_lookup_timeout')), 5000);
    })]);
  } finally { clearTimeout(timer); }
}

export async function queueDigest(db: Db, input: {
  userId: string; type: string; date: string; channel: 'email' | 'push'; payload: DigestPayload;
}) {
  if (privateNotificationsPaused()) return false;
  // Rolling transition: an old worker may already have sent today's message.
  // Its legacy 'sending' outcome is unknown, so never replay it automatically.
  const legacy = await db.from('notification_log').select('user_id')
    .eq('user_id', input.userId).eq('notification_type', input.type).eq('sent_date', input.date).limit(1);
  if (legacy.error) throw new Error('Cannot verify previous digest delivery');
  if (legacy.data?.length) return false;
  if (privateNotificationsPaused()) return false;
  const inserted = await db.from('digest_deliveries').insert({
    user_id: input.userId, notification_type: input.type, sent_date: input.date,
    channel: input.channel, payload: input.payload,
  });
  if (inserted.error?.code === '23505') return false;
  if (inserted.error) throw new Error('Could not queue digest');
  return true;
}

/** Fresh consent and recipient checks also apply to retries, not only enqueue time. */
export async function attemptDigest(row: DigestDelivery, db: Db, beforeEmailSend?: () => Promise<void>): Promise<{
  status: 'sent' | 'retryable' | 'failed' | 'cancelled'; error?: string; providerId?: string;
}> {
  if (privateNotificationsPaused()) return { status: 'retryable', error: PRIVATE_NOTIFICATION_PAUSE_REASON };
  if (Date.parse(row.deadline_at) <= Date.now()) return { status: 'failed', error: 'expired' };
  if (row.channel === 'email' && 'email' in row.payload) {
    await beforeEmailSend?.();
    const consent = await lookup(db.from('email_subscriptions').select('morning_brief_enabled').eq('user_id', row.user_id).maybeSingle());
    if (consent.error) return { status: 'retryable', error: 'consent_lookup_failed' };
    if (!consent.data?.morning_brief_enabled) return { status: 'cancelled', error: 'unsubscribed' };
    const user = await lookup(db.auth.admin.getUserById(row.user_id));
    if (user.error) return { status: 'retryable', error: 'recipient_lookup_failed' };
    if (!user.data.user?.email || user.data.user.email !== row.payload.email.to) return { status: 'cancelled', error: 'recipient_changed' };
    if (Date.parse(row.deadline_at) <= Date.now()) return { status: 'failed', error: 'expired' };
    if (privateNotificationsPaused()) return { status: 'retryable', error: PRIVATE_NOTIFICATION_PAUSE_REASON };
    const sent = await sendEmail({ ...row.payload.email, idempotencyKey: `joobi-digest/${row.id}` });
    return sent.ok ? { status: 'sent', providerId: sent.id }
      : { status: sent.retryable ? 'retryable' : 'failed', error: sent.error };
  }
  if (row.channel === 'push' && 'push' in row.payload) {
    const sub = await lookup(db.from('push_subscriptions').select('subscription').eq('user_id', row.user_id).maybeSingle());
    if (sub.error) return { status: 'retryable', error: 'subscription_lookup_failed' };
    if (!sub.data?.subscription) return { status: 'cancelled', error: 'unsubscribed' };
    if (Date.parse(row.deadline_at) <= Date.now()) return { status: 'failed', error: 'expired' };
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return { status: 'failed', error: 'push_not_configured' };
    webpush.setVapidDetails(process.env.VAPID_EMAIL || 'mailto:admin@joobi.kr', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    try {
      if (privateNotificationsPaused()) return { status: 'retryable', error: PRIVATE_NOTIFICATION_PAUSE_REASON };
      await webpush.sendNotification(sub.data.subscription as webpush.PushSubscription, JSON.stringify(row.payload.push), { timeout: 10000, TTL: 3600 });
      return { status: 'sent' };
    } catch (error) {
      const code = (error as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        // A browser can replace its subscription while this request is in flight.
        // Remove only the exact expired endpoint, never a newer subscription for the user.
        const endpoint = (sub.data.subscription as { endpoint?: string }).endpoint;
        if (endpoint) {
          try { await lookup(db.from('push_subscriptions').delete().eq('user_id', row.user_id).contains('subscription', { endpoint })); }
          catch { /* The terminal outcome is still reported; a cleanup failure cannot justify a resend. */ }
        }
      }
      // Explicit rejection is retryable. An ambiguous timeout may already have delivered a push.
      return { status: code === 429 || (code !== undefined && code >= 500) ? 'retryable' : 'failed', error: code ? `push_${code}` : 'push_outcome_unknown' };
    }
  }
  return { status: 'failed', error: 'invalid_payload' };
}

export async function processDigestQueue(client?: Db) {
  if (privateNotificationsPaused()) return { sent: 0, retryable: 0, failed: 0, cancelled: 0, reportedFailures: 0, skipped: PRIVATE_NOTIFICATION_PAUSE_REASON };
  const db = client ?? requireServiceClient();
  const owner = randomUUID();
  const claimed = await lookup(db.rpc('claim_digest_deliveries', { p_owner: owner, p_limit: 10 }));
  if (claimed.error) throw new Error('Could not claim digest deliveries');
  const stats = { sent: 0, retryable: 0, failed: 0, cancelled: 0, reportedFailures: 0 };
  // Up to ten deliveries fit within the 60s route budget. Space email starts to avoid
  // turning a batch into a provider rate-limit burst; persisted 429 retries cover overlap.
  let nextEmailStart = Date.now();
  const beforeEmailSend = async () => {
    const delay = Math.max(0, nextEmailStart - Date.now());
    nextEmailStart = Math.max(nextEmailStart, Date.now()) + 600;
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
  };
  const results = await Promise.allSettled(((claimed.data || []) as DigestDelivery[]).map(async row => {
    let result;
    try { result = await attemptDigest(row, db, beforeEmailSend); }
    catch { result = { status: 'retryable' as const, error: 'delivery_check_failed' }; }
    const status = result.status === 'retryable' && row.attempts >= 3 ? 'failed' : result.status;
    const saved = await lookup(db.from('digest_deliveries').update({
      status, last_error: result.error || null, provider_id: result.providerId || null,
      next_attempt_at: new Date(Date.now() + (row.attempts === 1 ? 5 : 15) * 60000).toISOString(),
      updated_at: new Date().toISOString(), lease_owner: null, lease_until: null,
    }).eq('id', row.id).eq('lease_owner', owner).eq('status', 'sending').select('id'));
    if (saved.error || saved.data?.length !== 1) throw new Error('Could not finalize digest delivery');
    stats[status]++;
  }));
  // The SQL claim also terminalizes expired/abandoned messages. Include those failures,
  // even when no new row was claimed, and atomically report each terminal row once.
  const failures = await lookup(db.rpc('claim_digest_failure_report'));
  if (failures.error) throw new Error('Could not inspect digest terminal failures');
  stats.reportedFailures = Number(failures.data) || 0;
  if (stats.reportedFailures) await sendCronAlert({ jobName: 'digest-delivery', stage: 'terminal-failures', error: 'Delivery attempts exhausted, expired, or not retryable', context: stats });
  if (results.some(result => result.status === 'rejected')) throw new Error('Could not finalize digest delivery');
  return stats;
}
