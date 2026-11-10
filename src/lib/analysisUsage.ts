import { getServiceClient } from '@/lib/supabaseServer';
import { getAnalysisDay } from '@/utils/analysisQuota';
import { withAbortDeadline } from '@/lib/withAbortDeadline';

export interface AnalysisUsage {
  available: boolean;
  day: string;
  userCount: number;
  totalCount: number;
}

// Market observation and image import each have their own individual limits.
// Preserve null/general and older analysis tags so historical usage still counts.
const ANALYSIS_USAGE_FILTER = 'mentor_id.is.null,mentor_id.not.in.(ai-chok,ocr-import)';
const validCount = (count: unknown): count is number =>
  typeof count === 'number' && Number.isSafeInteger(count) && count >= 0;

/** The same read-only ledger view is used before a request and by POST enforcement. */
export async function getAnalysisUsage(userId: string): Promise<AnalysisUsage> {
  const day = getAnalysisDay();
  const unavailable: AnalysisUsage = { available: false, day, userCount: 0, totalCount: 0 };
  const client = getServiceClient();
  if (!client) return unavailable;

  const started = Date.now();
  // Retry the two idempotent reads together so both counts are fresh. Never
  // return a previous count, cache permissions, or retry a usage insert here.
  for (let attempt = 0; attempt < 2; attempt++) {
    let transient = false;
    let reason = 'database';
    try {
      const [total, user] = await withAbortDeadline(signal => Promise.all([
        client.from('ai_usage').select('*', { count: 'exact', head: true }).eq('date', day).abortSignal(signal),
        client.from('ai_usage').select('*', { count: 'exact', head: true })
          .eq('date', day).eq('user_id', userId).or(ANALYSIS_USAGE_FILTER).abortSignal(signal),
      ]), attempt === 0 ? 3000 : Math.max(1, Math.min(1500, 4500 - (Date.now() - started))));
      if (!total.error && !user.error && validCount(total.count) && validCount(user.count)) {
        if (attempt) console.info('[ai-usage-read]', JSON.stringify({ outcome: 'recovered', attempts: 2, durationMs: Date.now() - started }));
        return { available: true, day, userCount: user.count, totalCount: total.count };
      }
      const failures = [total, user].filter(result => result.error);
      transient = failures.length > 0 && failures.every(result => {
        const code = result.error?.code ?? '';
        return /^08|^53|^57P0|^PGRST00[0-3]$|^57014$/.test(code) || (!code && (result.status === 0 || result.status >= 500));
      });
      // Invalid counts are not a network failure and must not become zero usage.
      if ((!total.error && !validCount(total.count)) || (!user.error && !validCount(user.count))) transient = false;
      reason = transient ? 'temporary_database' : 'database';
    } catch (error) {
      const failure = error instanceof Error ? error : undefined;
      const timeout = failure?.message === 'Request deadline exceeded' || failure?.name === 'AbortError' || failure?.name === 'TimeoutError';
      transient = timeout || failure instanceof TypeError;
      reason = timeout ? 'timeout' : transient ? 'network' : 'unexpected';
    }
    console.warn('[ai-usage-read]', JSON.stringify({ outcome: 'unavailable', reason, attempt: attempt + 1, durationMs: Date.now() - started }));
    if (!transient || attempt === 1 || Date.now() - started >= 4500) break;
  }
  return unavailable;
}
