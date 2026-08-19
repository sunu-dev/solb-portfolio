/**
 * 미 국채 10년물 수익률 — 미 재무부 일별 수익률 곡선 XML 피드.
 *
 * 소스 선정 근거(docs/MARKET_RECAP_FEATURE_REVIEW_2026-08-19.md §3):
 *  - 퍼블릭 도메인(17 U.S.C. §105) · 무료 · API 키 불요 — 재배포 제약 없음
 *  - Yahoo ^TNX(비공식 API 회색지대)·Finnhub(Premium 전용)를 쓰지 않는 이유가 이것
 *  - 일별 데이터(영업일 장 마감 후 게시) — cron 불요, 요청 시점 fetch + 캐시로 충분
 *
 * ⚠️ 여기는 '사실 수집'까지만 한다. 해석·판정·방향 문구는 어디에도 만들지 않는다(§6).
 */

const FEED_BASE =
  'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve';

export interface TreasuryPoint {
  /** YYYY-MM-DD (미국 동부 기준 발표일) */
  date: string;
  /** 10년물 수익률 % */
  yield10y: number;
}

/**
 * OData Atom 피드 파싱. entry마다 <d:NEW_DATE>·<d:BC_10YEAR>를 뽑는다.
 * BC_10YEAR가 없거나 숫자가 아니면 그 entry는 버린다(휴일·결측 안전).
 */
export function parseTreasuryXml(xml: string): TreasuryPoint[] {
  const points: TreasuryPoint[] = [];
  for (const entry of xml.match(/<entry[\s\S]*?<\/entry>/g) ?? []) {
    const date = entry.match(/<d:NEW_DATE[^>]*>([^<]+)<\/d:NEW_DATE>/)?.[1];
    const raw = entry.match(/<d:BC_10YEAR[^>]*>([^<]+)<\/d:BC_10YEAR>/)?.[1];
    if (!date || !raw) continue;
    const yield10y = Number(raw);
    if (!Number.isFinite(yield10y)) continue;
    points.push({ date: date.slice(0, 10), yield10y });
  }
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

export interface UsTreasury10Y {
  /** 최신 영업일 수익률 % */
  yield10y: number;
  /** 전 영업일 대비 %p. 비교 대상이 없으면 null — 0으로 위장하지 않는다 */
  changePp: number | null;
  /** 수치의 기준일 — 화면은 이 날짜를 반드시 표시한다(전일 값을 오늘처럼 내보내지 않기) */
  asOfDate: string;
  prevDate: string | null;
}

/** 정렬된 시계열에서 최신·직전 영업일을 취해 표시용 값으로 변환 */
export function toUs10Y(points: TreasuryPoint[]): UsTreasury10Y | null {
  if (points.length === 0) return null;
  const last = points[points.length - 1];
  const prev = points.length >= 2 ? points[points.length - 2] : null;
  return {
    yield10y: last.yield10y,
    changePp: prev ? Number((last.yield10y - prev.yield10y).toFixed(2)) : null,
    asOfDate: last.date,
    prevDate: prev?.date ?? null,
  };
}

function monthParam(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function fetchMonth(month: string): Promise<TreasuryPoint[]> {
  const res = await fetch(`${FEED_BASE}&field_tdr_date_value_month=${month}`, {
    signal: AbortSignal.timeout(6000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`treasury status ${res.status}`);
  return parseTreasuryXml(await res.text());
}

// 성공 응답만 캐시(30분). 실패를 캐시하면 원천 복구 후에도 30분간 죽어 있게 된다
// — supabaseServer 팩토리의 'null 영구 캐시' 함정과 같은 계열.
let cache: { data: UsTreasury10Y; ts: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

export async function fetchUsTreasury10Y(): Promise<UsTreasury10Y | null> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.data;
  try {
    const now = new Date();
    let points = await fetchMonth(monthParam(now));
    // 월초에는 당월 데이터가 0~1건 — 전월을 합쳐 '전일 대비'를 살린다
    if (points.length < 2) {
      const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const merged = [...(await fetchMonth(monthParam(prevMonth))), ...points];
      merged.sort((a, b) => a.date.localeCompare(b.date));
      points = merged;
    }
    const data = toUs10Y(points);
    if (!data) return null;
    cache = { data, ts: Date.now() };
    return data;
  } catch {
    return null;
  }
}

export function resetUsTreasuryCacheForTests(): void {
  cache = null;
}
