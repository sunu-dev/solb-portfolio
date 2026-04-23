/**
 * 알림 학습 — 유저가 반복 해제하는 알림 타입 추적 + 자동 suppress
 *
 * 로직:
 * 1. dismissAlert 호출 시 alertId에서 "type" 추출 (e.g., 'rsi-oversold', 'golden-cross')
 * 2. localStorage에 {type, timestamp} 기록 (14일 보존)
 * 3. 같은 타입 7일 내 3회+ 해제되면 해당 타입 새 알림 자동 숨김
 */

const STORAGE_KEY = 'solb_alert_dismissals';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const EXPIRY_MS = 14 * 24 * 60 * 60 * 1000;
const SUPPRESS_THRESHOLD = 3;

interface DismissalRecord {
  type: string;
  ts: number;
}

/**
 * alertId에서 condition 타입 추출.
 * ID 형식: `{symbol}-{alertType}-{condition...}` (alertsEngine.makeAlert)
 * 예: "AAPL-risk-rsi-oversold-30" → "rsi-oversold"
 *     "NVDA-opportunity-golden-cross" → "golden-cross"
 *     "TSLA-urgent-stoploss-hit" → "stoploss-hit"
 */
function extractAlertType(alertId: string): string | null {
  const parts = alertId.split('-');
  if (parts.length < 3) return null;
  // parts[0] = symbol (혹은 심볼에 . 이 있을 경우 여전히 그대로 첫 토큰)
  // parts[1] = alertType (urgent/risk/opportunity/insight/celebrate)
  // parts[2..] = condition
  // 끝에 숫자만 있으면(RSI 값 등) 제거
  const conditionParts = parts.slice(2);
  const last = conditionParts[conditionParts.length - 1];
  if (/^\d+$/.test(last)) conditionParts.pop();
  return conditionParts.join('-');
}

function loadDismissals(): DismissalRecord[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as DismissalRecord[];
    const cutoff = Date.now() - EXPIRY_MS;
    return Array.isArray(arr) ? arr.filter(r => r?.ts && r.ts > cutoff) : [];
  } catch {
    return [];
  }
}

function saveDismissals(records: DismissalRecord[]) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch { /* quota 등 silent */ }
}

/**
 * 유저가 알림을 해제할 때 호출 — 해당 타입 기록
 */
export function recordDismissal(alertId: string) {
  const type = extractAlertType(alertId);
  if (!type) return;
  const records = loadDismissals();
  records.push({ type, ts: Date.now() });
  // 메모리 보호: 최대 500개 유지
  const trimmed = records.slice(-500);
  saveDismissals(trimmed);
}

/**
 * 해당 alertId의 타입이 최근 7일간 임계치 이상 해제됐는지 체크.
 * true면 UI에서 숨김 대상.
 */
export function isAlertSuppressed(alertId: string): boolean {
  const type = extractAlertType(alertId);
  if (!type) return false;
  const cutoff = Date.now() - WEEK_MS;
  const records = loadDismissals();
  let count = 0;
  for (const r of records) {
    if (r.type === type && r.ts > cutoff) count++;
    if (count >= SUPPRESS_THRESHOLD) return true;
  }
  return false;
}

/**
 * 현재 suppress 상태인 타입 목록 (settings/admin 노출용)
 */
export function getSuppressedTypes(): Array<{ type: string; count: number }> {
  const cutoff = Date.now() - WEEK_MS;
  const records = loadDismissals();
  const counts: Record<string, number> = {};
  for (const r of records) {
    if (r.ts > cutoff) counts[r.type] = (counts[r.type] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, c]) => c >= SUPPRESS_THRESHOLD)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 학습 기록 전체 초기화
 */
export function resetAlertLearning() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* silent */ }
}
