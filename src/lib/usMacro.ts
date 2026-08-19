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
 * 결측 파싱 — **빈 문자열을 명시적으로 거부한다.**
 *
 * `Number('')`는 0이고 `Number.isFinite(0)`는 true라, 빈 칸을 그냥 Number로 넘기면
 * 결측이 **0.00%로 표시**된다("기준금리 0.00~3.50%"). fredgraph의 실제 결측 표기가
 * 빈 문자열임을 실측으로 확인했다(`2008-12-16,,0.00`) — '.'만 막던 초판은
 * 원천의 실제 포맷에서 작동하지 않는 가드였다 (2026-08-19 적대 재감사).
 */
function parseNum(raw: string | undefined): number {
  const s = raw?.trim();
  if (!s || s === '.') return NaN;
  return Number(s);
}

/**
 * fredgraph 단일 시리즈 CSV 파싱 — `observation_date,<SERIES_ID>` 형태.
 * 마지막 유효 행의 값을 돌려준다. 결측·형식 이탈 행은 건너뛴다.
 *
 * 단일 시리즈로 받는 이유: `id=A,B` 다중 요청은 **cosd(시작일)를 무시**해
 * 매번 2008년부터 6,400여 행이 오고(실측), 시리즈 시작일이 다르면 결측 칸이 생긴다.
 */
export function parseFredSeriesCsv(csv: string, seriesId: string): { value: number; date: string } | null {
  const lines = csv.trim().split('\n');
  const header = (lines[0] ?? '').split(',');
  const idx = header.indexOf(seriesId);
  if (idx < 0) return null;
  for (let i = lines.length - 1; i >= 1; i--) {
    const cols = lines[i].split(',');
    const date = cols[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const value = parseNum(cols[idx]);
    if (!Number.isFinite(value)) continue;
    return { value, date };
  }
  return null;
}

/**
 * 두 시리즈(목표 상단·하단)를 합쳐 목표 범위로. 한쪽이라도 없으면 null —
 * 반쪽 범위(0.00~3.50)를 만들지 않는다.
 * 기준일은 **둘 중 이른 쪽**을 쓴다(더 오래된 값이 섞였음을 숨기지 않는다).
 */
export function toFedTarget(
  upper: { value: number; date: string } | null,
  lower: { value: number; date: string } | null,
): FedTarget | null {
  if (!upper || !lower) return null;
  if (upper.value < lower.value) return null; // 상단<하단이면 데이터 이상 — 표시 거부
  return {
    upper: upper.value,
    lower: lower.value,
    asOfDate: upper.date < lower.date ? upper.date : lower.date,
  };
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

async function fetchFredSeries(seriesId: string, cosd: string) {
  const res = await fetch(
    `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=${cosd}`,
    { signal: AbortSignal.timeout(6000), cache: 'no-store' },
  );
  if (!res.ok) throw new Error(`fred ${seriesId} status ${res.status}`);
  return parseFredSeriesCsv(await res.text(), seriesId);
}

async function fetchFed(): Promise<FedTarget | null> {
  // 최근 400일만 — 단일 시리즈 요청에서는 cosd가 유효하다(다중 요청에서는 무시됨을 실측 확인).
  // 전체 히스토리 ~150KB → ~1KB.
  const cosd = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const [upper, lower] = await Promise.all([
    fetchFredSeries('DFEDTARU', cosd),
    fetchFredSeries('DFEDTARL', cosd),
  ]);
  return toFedTarget(upper, lower);
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

/**
 * 캐시 정책 — 소스별 개별 캐시(한쪽 장애가 다른 쪽을 무효화하지 않는다).
 *
 * BLS만 TTL이 긴 이유: 무등록 API v1은 **일 25회(IP 기준)** 제한이 있는데,
 * 이 모듈 캐시는 서버리스 인스턴스별이라 콜드스타트마다 증발하고 CDN 재검증도
 * PoP별로 독립이다. CDN s-maxage 30분이면 리전 하나만으로도 하루 48회 재검증이
 * 가능해 산술적으로 한도를 넘는다(2026-08-19 재감사). CPI·실업률은 **월 1회 발표**라
 * 6시간 TTL로도 신선도 손실이 없다 — 발표 당일에도 그날 안에 반영된다.
 */
const FED_TTL_MS = 3 * 60 * 60 * 1000;
const BLS_TTL_MS = 6 * 60 * 60 * 1000;
let fedCache: { data: FedTarget; ts: number } | null = null;
let blsCache: { data: { cpi: CpiYoY | null; jobs: UnemploymentRate | null }; ts: number } | null = null;
// in-flight 공유 — 동시 미스가 외부 API 호출로 그대로 번지는 것을 막는다(BLS 한도 보호)
let fedInflight: Promise<FedTarget | null> | null = null;
let blsInflight: Promise<{ cpi: CpiYoY | null; jobs: UnemploymentRate | null }> | null = null;

export async function fetchUsMacro(): Promise<UsMacroData> {
  const now = Date.now();

  let fed: FedTarget | null = null;
  if (fedCache && now - fedCache.ts < FED_TTL_MS) {
    fed = fedCache.data;
  } else {
    try {
      fedInflight ??= fetchFed().finally(() => { fedInflight = null; });
      fed = await fedInflight;
      if (fed) fedCache = { data: fed, ts: Date.now() };
    } catch { /* 소스 개별 실패 — 나머지 지표는 계속 서빙 */ }
  }

  let cpi: CpiYoY | null = null;
  let jobs: UnemploymentRate | null = null;
  if (blsCache && now - blsCache.ts < BLS_TTL_MS) {
    ({ cpi, jobs } = blsCache.data);
  } else {
    try {
      blsInflight ??= fetchBls().finally(() => { blsInflight = null; });
      const bls = await blsInflight;
      // 둘 다 있을 때만 캐시 — 반쪽 성공을 캐시하면 실패한 쪽의 재시도가 TTL 내내 막힌다
      if (bls.cpi && bls.jobs) blsCache = { data: bls, ts: Date.now() };
      ({ cpi, jobs } = bls);
    } catch { /* 동일 */ }
  }

  return { fed, cpi, jobs };
}

export function resetUsMacroCacheForTests(): void {
  fedCache = null;
  blsCache = null;
  fedInflight = null;
  blsInflight = null;
}
