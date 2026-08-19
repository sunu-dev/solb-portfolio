const BLOCKED_KEYS = new Set([
  'userid',
  'prompt',
  'avgcost',
  'shares',
  'quantity',
  'targetreturn',
  'stoploss',
  'usernotes',
  'holdingscontext',
  'purchaseprice',
]);

const SENSITIVE_TEXT = /((?:평균\s*매수(?:가|단가)|평단|보유\s*수량|목표\s*수익률|손절(?:가|선)?)\s*[:：]?\s*)(?:[$₩]?\s*\d+(?:,\d{3})*(?:\.\d+)?%?)/gi;

function normalizedKey(key: string): string {
  return key.replace(/[_-]/g, '').toLowerCase();
}

export function redactAiAuditExport(value: unknown, depth = 0): unknown {
  if (depth > 10) return '[depth-limited]';
  if (typeof value === 'string') return value.replace(SENSITIVE_TEXT, '$1[REDACTED]');
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.map(item => redactAiAuditExport(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !BLOCKED_KEYS.has(normalizedKey(key)))
        .map(([key, item]) => [key, redactAiAuditExport(item, depth + 1)]),
    );
  }
  return String(value);
}
