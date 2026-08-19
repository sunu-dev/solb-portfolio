/**
 * 미국 매크로 지표 수집 — 기준금리(연준) · CPI · 실업률(노동통계국).
 *
 * 소스 선정 (docs/MARKET_RECAP_FEATURE_REVIEW_2026-08-19.md의 권리 원칙 연장):
 *  - 기준금리: FRED 공개 CSV(fredgraph) — 연준 원천 공공 데이터, 키 불요.
 *    DFEDTARU/DFEDTARL(목표 상단·하단) 두 시리즈를 한 요청으로 받는다.
 *  - CPI·실업률: BLS 공식 API v1 — 미 정부 퍼블릭 도메인, 키 불요.
 *    일 25회 제한이 있으나 두 시리즈를 POST 한 번에 받고 서버 캐시 + CDN이 흡수한다.
 *
 * ⚠️ '사실 수집'까지만. 해석·판정·방향 문구는 만들지 않는다(§6).
 */

export interface FedTarget {
  /** 목표 범위 상단 % */
  upper: number;
  /** 목표 범위 하단 % */
  lower: number;
  /** YYYY-MM-DD */
  asOfDate: string;
}

export interface CpiYoY {
  /** 전년 동월 대비 % (소수 1자리) */
  yoy: number;
  /** 직전 월의 전년 동월 대비 % — 비교 대상 없으면 null */
  prevYoy: number | null;
  /** 기준월 'YYYY-MM' */
  refMonth: string;
}

export interface UnemploymentRate {
  /** 실업률 % */
  rate: number;
  /** 직전 월 % — 없으면 null */
  prevRate: number | null;
  refMonth: string;
}

export interface UsMacroData {
  fed: FedTarget | null;
  cpi: CpiYoY | null;
  jobs: UnemploymentRate | null;
}

/**
 * fredgraph CSV 파싱 — `observation_date,DFEDTARU,DFEDTARL` 형태.
 * 결측값('.')이나 형식 이탈 행은 버리고, 마지막 유효 행을 목표 범위로 쓴다.
 */
export function parseFedTargetCsv(csv: string): FedTarget | null {
  const lines = csv.trim().split('\n');
  const header = (lines[0] ?? '').split(',');
  const iUpper = header.indexOf('DFEDTARU');
  const iLower = header.indexOf('DFEDTARL');
  if (iUpper < 0 || iLower < 0) return null;
  for (let i = lines.length - 1; i >= 1; i--) {
    const cols = lines[i].split(',');
    const date = cols[0];
    const upper = Number(cols[iUpper]);
    const lower = Number(cols[iLower]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!Number.isFinite(upper) || !Number.isFinite(lower)) continue;
    return { upper, lower, asOfDate: date };
  }
  return null;
}

interface BlsDatum { year: string; period: string; value: string }
interface BlsSeries { seriesID: string; data: BlsDatum[] }

/** M01~M12만 (M13=연평균 집계는 월 시계열이 아니다) + 숫자 검증 */
function monthlyPoints(series: BlsSeries): Array<{ year: number; month: number; value: number }> {
  return series.data
    .filter(d => /^M(0[1-9]|1[0-2])$/.test(d.period) && Number.isFinite(Number(d.value)))
    .map(d => ({ year: Number(d.year), month: Number(d.period.slice(1)), value: Number(d.value) }))
    .sort((a, b) => a.year - b.year || a.month - b.month);
}

const refMonthOf = (p: { year: number; month: number }) =>
  `${p.year}-${String(p.month).padStart(2, '0')}`;

/** CPI 지수 → 전년 동월 대비 %. 전년 동월이 없으면 그 달은 계산 불가로 건너뛴다. */
export function toCpiYoY(series: BlsSeries): CpiYoY | null {
  const pts = monthlyPoints(series);
  const byKey = new Map(pts.map(p => [`${p.year}-${p.month}`, p.value]));
  const yoyAt = (p: { year: number; month: number; value: number }): number | null => {
    const yearAgo = byKey.get(`${p.year - 1}-${p.month}`);
    return yearAgo ? Number(((p.value / yearAgo - 1) * 100).toFixed(1)) : null;
  };
  for (let i = pts.length - 1; i >= 0; i--) {
    const yoy = yoyAt(pts[i]);
    if (yoy == null) continue;
    const prev = i >= 1 ? yoyAt(pts[i - 1]) : null;
    return { yoy, prevYoy: prev, refMonth: refMonthOf(pts[i]) };
  }
  return null;
}

export function toUnemployment(series: BlsSeries): UnemploymentRate | null {
  const pts = monthlyPoints(series);
  if (pts.length === 0) return null;
  const last = pts[pts.length - 1];
  const prev = pts.length >= 2 ? pts[pts.length - 2] : null;
  return { rate: last.value, prevRate: prev?.value ?? null, refMonth: refMonthOf(last) };
}

const CPI_SERIES = 'CUUR0000SA0';
const JOBS_SERIES = 'LNS14000000';

async function fetchFed(): Promise<FedTarget | null> {
  // cosd로 최근 1년만 — 전체 히스토리(2008~)를 매번 받을 이유가 없다
  const cosd = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const res = await fetch(
    `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFEDTARU,DFEDTARL&cosd=${cosd}`,
    { signal: AbortSignal.timeout(6000), cache: 'no-store' },
  );
  if (!res.ok) throw new Error(`fred status ${res.status}`);
  return parseFedTargetCsv(await res.text());
}

async function fetchBls(): Promise<{ cpi: CpiYoY | null; jobs: UnemploymentRate | null }> {
  const res = await fetch('https://api.bls.gov/publicAPI/v1/timeseries/data/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seriesid: [CPI_SERIES, JOBS_SERIES] }),
    signal: AbortSignal.timeout(6000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`bls status ${res.status}`);
  const json = await res.json() as { status?: string; Results?: { series?: BlsSeries[] } };
  if (json.status !== 'REQUEST_SUCCEEDED') throw new Error(`bls ${json.status}`);
  const series = json.Results?.series ?? [];
  const cpiSeries = series.find(s => s.seriesID === CPI_SERIES);
  const jobsSeries = series.find(s => s.seriesID === JOBS_SERIES);
  return {
    cpi: cpiSeries ? toCpiYoY(cpiSeries) : null,
    jobs: jobsSeries ? toUnemployment(jobsSeries) : null,
  };
}

// 성공 부분만 캐시(3시간). 발표일(21~22시 KST)에도 다음 날 아침이면 갱신돼 있다.
// 소스별 개별 캐시 — 한쪽 장애가 다른 쪽 캐시를 무효화하지 않는다.
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
let fedCache: { data: FedTarget; ts: number } | null = null;
let blsCache: { data: { cpi: CpiYoY | null; jobs: UnemploymentRate | null }; ts: number } | null = null;

export async function fetchUsMacro(): Promise<UsMacroData> {
  const now = Date.now();

  let fed: FedTarget | null = null;
  if (fedCache && now - fedCache.ts < CACHE_TTL_MS) {
    fed = fedCache.data;
  } else {
    try {
      fed = await fetchFed();
      if (fed) fedCache = { data: fed, ts: now };
    } catch { /* 소스 개별 실패 — 나머지 지표는 계속 서빙 */ }
  }

  let cpi: CpiYoY | null = null;
  let jobs: UnemploymentRate | null = null;
  if (blsCache && now - blsCache.ts < CACHE_TTL_MS) {
    ({ cpi, jobs } = blsCache.data);
  } else {
    try {
      const bls = await fetchBls();
      if (bls.cpi || bls.jobs) blsCache = { data: bls, ts: now };
      ({ cpi, jobs } = bls);
    } catch { /* 동일 */ }
  }

  return { fed, cpi, jobs };
}

export function resetUsMacroCacheForTests(): void {
  fedCache = null;
  blsCache = null;
}
