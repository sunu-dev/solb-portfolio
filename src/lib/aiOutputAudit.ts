import { createClient } from '@supabase/supabase-js';
import { FORBIDDEN_PHRASES } from '@/utils/alertCompliance';

export type AiAuditFeature = 'ai-analysis' | 'ai-chok';
export type AiAuditSeverity = 'none' | 'review' | 'high';

export interface AiAuditFinding {
  flags: string[];
  severity: AiAuditSeverity;
}

const DIRECTION_PATTERNS = [
  /(?:비중|포지션).{0,8}(?:늘리|줄이|확대|축소)/,
  /(?:매수|매도|진입|청산).{0,8}(?:권장|유리|적기|고려)/,
];
const TARGET_PRICE_PATTERN = /(?:목표가|적정가|손절가)\s*[:：]?\s*(?:[$₩]\s*)?[\d,.]+/;
const GUARANTEE_PATTERN = /(?:무조건|확실히|반드시).{0,12}(?:수익|상승|하락|오른|떨어)/;

export function inspectAiOutput(output: unknown): AiAuditFinding {
  const text = JSON.stringify(output);
  const flags = new Set<string>();

  if (FORBIDDEN_PHRASES.some(phrase => text.includes(phrase))) flags.add('forbidden_phrase');
  if (DIRECTION_PATTERNS.some(pattern => pattern.test(text))) flags.add('trade_direction');
  if (TARGET_PRICE_PATTERN.test(text)) flags.add('target_price');
  if (GUARANTEE_PATTERN.test(text)) flags.add('guaranteed_outcome');

  const list = Array.from(flags);
  const severity: AiAuditSeverity = list.some(flag =>
    flag === 'forbidden_phrase' || flag === 'guaranteed_outcome'
  ) ? 'high' : list.length ? 'review' : 'none';
  return { flags: list, severity };
}

function sampleRate(): number {
  const value = Number(process.env.AI_AUDIT_SAMPLE_RATE || '0');
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function pruneOutput(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[depth-limited]';
  if (typeof value === 'string') return value.slice(0, 2000);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 30).map(item => pruneOutput(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 60)
        .map(([key, item]) => [key.slice(0, 100), pruneOutput(item, depth + 1)]),
    );
  }
  return String(value).slice(0, 2000);
}

/** 표본율이 0이면 아무것도 저장하지 않는 best-effort 익명 감사 기록. */
export async function sampleAiOutput(opts: {
  feature: AiAuditFeature;
  symbol?: string;
  output: unknown;
  /** 공개 시장 데이터만 허용. 사용자 보유·목표·메모는 전달하지 않는다. */
  sourceSnapshot?: Record<string, unknown>;
}): Promise<void> {
  const rate = sampleRate();
  if (rate <= 0 || Math.random() >= rate) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
  if (!url || !key) return;

  const safeOutput = pruneOutput(opts.output);
  const finding = inspectAiOutput(safeOutput);
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await supabase.from('ai_output_audits').insert({
      feature: opts.feature,
      symbol: opts.symbol?.slice(0, 30) || null,
      output: safeOutput,
      source_snapshot: opts.sourceSnapshot ? pruneOutput(opts.sourceSnapshot) : null,
      flags: finding.flags,
      severity: finding.severity,
    });
    if (error) console.error('[AI audit] insert failed:', error.message);
  } catch (error) {
    console.error('[AI audit] unexpected error:', error instanceof Error ? error.message : error);
  }
}
