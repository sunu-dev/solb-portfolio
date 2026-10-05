import { getServiceClient } from '@/lib/supabaseServer';
import { getAnalysisDay } from '@/utils/analysisQuota';

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

  try {
    const [total, user] = await Promise.all([
      client.from('ai_usage').select('*', { count: 'exact', head: true }).eq('date', day),
      client.from('ai_usage').select('*', { count: 'exact', head: true })
        .eq('date', day).eq('user_id', userId).or(ANALYSIS_USAGE_FILTER),
    ]);
    if (total.error || user.error || !validCount(total.count) || !validCount(user.count)) {
      console.error('[AI analysis] daily usage lookup unavailable');
      return unavailable;
    }
    return { available: true, day, userCount: user.count, totalCount: total.count };
  } catch {
    return unavailable;
  }
}
