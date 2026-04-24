/**
 * 알림 학습 — 유저가 반복 해제하는 알림 타입/카테고리 추적 + 자동 suppress
 *
 * 로직 (2계층):
 * 1. 타입 레벨: 'rsi-oversold' 같은 정확한 타입 (7일 3회+ → suppress)
 * 2. 카테고리 레벨: 'rsi' 같은 상위 개념 (7일 5회+ → 카테고리 전체 suppress)
 *    - 예: rsi-oversold 3회 + rsi-overbought 2회 = 카테고리 rsi 5회 → RSI 계열 전부 숨김
 */

const STORAGE_KEY = 'solb_alert_dismissals';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const EXPIRY_MS = 14 * 24 * 60 * 60 * 1000;
const SUPPRESS_THRESHOLD = 3;
const CATEGORY_SUPPRESS_THRESHOLD = 5;

interface DismissalRecord {
  type: string;
  ts: number;
}

/**
 * 타입 → 카테고리 매핑 (유사 지표 묶음)
 */
const TYPE_TO_CATEGORY: Record<string, string> = {
  // RSI 계열
  'rsi-oversold': 'rsi',
  'rsi-overbought': 'rsi',
  // MACD 계열
  'macd-bull': 'macd',
  'macd-bear': 'macd',
  // 볼린저 밴드 계열
  'bb-lower': 'bollinger',
  'bb-upper': 'bollinger',
  // 이동평균 계열
  'golden-cross': 'moving-avg',
  'death-cross': 'moving-avg',
  // 52주 고/저
  'near-52w-high': '52w',
  'near-52w-low': '52w',
  // 일간 변동
  'daily-surge': 'daily',
  'daily-plunge': 'daily',
  // 손절 계열
  'stoploss-hit': 'stoploss',
  'stoploss-near': 'stoploss',
  'stoploss-pct': 'stoploss',
  // 목표 계열
  'target-hit': 'target',
  'target-near': 'target',
  'target-return': 'target',
  'target-profit-usd': 'target',
  'target-profit-krw': 'target',
  // 복합 지표
  'composite-strong-bounce': 'composite',
  'composite-strong-uptrend': 'composite',
  'composite-overheated': 'composite',
  'composite-strong-downtrend': 'composite',
  'composite-squeeze': 'composite',
};

/**
 * 카테고리 한글 라벨 (Settings UI용)
 */
const CATEGORY_LABELS: Record<string, string> = {
  'rsi': 'RSI 지표 전체',
  'macd': 'MACD 지표 전체',
  'bollinger': '볼린저 밴드 전체',
  'moving-avg': '이동평균 교차 전체',
  '52w': '52주 고/저 근접 전체',
  'daily': '일간 급등락 전체',
  'stoploss': '손절 관련 전체',
  'target': '목표 관련 전체',
  'composite': '복합 지표 전체',
};

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category;
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
 * 해당 alertId가 suppress 대상인지 체크 (타입 OR 카테고리 레벨)
 * - 타입: 7일 3회+
 * - 카테고리: 7일 5회+ (타입 합산)
 */
export function isAlertSuppressed(alertId: string): boolean {
  const type = extractAlertType(alertId);
  if (!type) return false;
  const category = TYPE_TO_CATEGORY[type];
  const cutoff = Date.now() - WEEK_MS;
  const records = loadDismissals();

  let typeCount = 0;
  let categoryCount = 0;
  for (const r of records) {
    if (r.ts <= cutoff) continue;
    if (r.type === type) typeCount++;
    if (category && TYPE_TO_CATEGORY[r.type] === category) categoryCount++;
    // 조기 종료
    if (typeCount >= SUPPRESS_THRESHOLD) return true;
    if (categoryCount >= CATEGORY_SUPPRESS_THRESHOLD) return true;
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
 * 현재 suppress 상태인 카테고리 목록 (타입 합산 기준)
 */
export function getSuppressedCategories(): Array<{ category: string; label: string; count: number }> {
  const cutoff = Date.now() - WEEK_MS;
  const records = loadDismissals();
  const counts: Record<string, number> = {};
  for (const r of records) {
    if (r.ts <= cutoff) continue;
    const cat = TYPE_TO_CATEGORY[r.type];
    if (cat) counts[cat] = (counts[cat] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, c]) => c >= CATEGORY_SUPPRESS_THRESHOLD)
    .map(([category, count]) => ({ category, label: getCategoryLabel(category), count }))
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
