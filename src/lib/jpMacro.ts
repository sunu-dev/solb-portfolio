/**
 * 일본 단기금리(무담보 콜 O/N **실현치**) — 일본은행(BOJ) 공식 시계열.
 *
 * ⚠️ 목표치가 아니다. 일본은행은 "콜금리를 1.0% 정도로 유도한다"처럼 목표를 정하고
 * (2026-07-31 성명서 실측: "around 1.0 percent"), 시장 실현치는 그 근처에서 움직인다
 * (같은 시점 0.977%). 목표치를 기계 판독 가능한 공식 시계열로 제공하는 경로가 없어
 * 실현치를 쓰되, **라벨을 '단기금리'로 두고 교육 카피가 차이를 설명한다**.
 * 기준대출이율(1.25%)에서 스프레드를 빼 목표를 역산하는 것은 공표된 규칙이 아니므로
 * 하지 않는다(근거 없는 수치 생성 금지).
 *
 * 시리즈 선정 (2026-08-19 실측):
 *  - `FM01'STRDCLUCON` 무담보 콜 O/N 물 레이트 평균값(일별) = **정책금리 실현치**.
 *    뉴스의 "일본은행 금리 인상"이 가리키는 지표가 이것이다.
 *  - 채택하지 않은 것: `IR01'MADR1Z@D` 기준대출이율(1.25%)은 대출 파실리티 금리로
 *    정책금리와 다른 값이다. 라벨만 '기준금리'로 붙이면 **다른 지표를 표시하는 셈**이라
 *    쓰지 않는다. OECD 월평균(IRSTCI)도 6주 지연 + 월평균이라 미채택.
 *
 * 형식: 헤더 9줄(SHIFT-JIS, 일본어) + 데이터 `YYYY/MM/DD,값` (데이터 행은 ASCII).
 * 결측은 **`NA`** — 휴일·주말에 등장한다(실측). 1단계 FRED 빈 문자열 사고와 같은 계열이라
 * 숫자 파싱 전에 명시적으로 거른다.
 *
 * ⚠️ '사실 수집'까지만. 해석·판정·방향 문구는 만들지 않는다(§6).
 */

const BOJ_CALL_RATE_CSV = 'https://www.stat-search.boj.or.jp/ssi/mtshtml/csv/fm01_d_1.csv';

export interface JpPolicyRate {
  /** 무담보 콜 O/N 금리 % */
  rate: number;
  /** 직전 관측일 대비 %p — 비교 대상 없으면 null */
  changePp: number | null;
  /** YYYY-MM-DD */
  asOfDate: string;
  prevDate: string | null;
}

/**
 * BOJ 시계열 CSV 파싱.
 * 헤더 줄(따옴표로 시작하거나 날짜 형식이 아닌 줄)은 건너뛰고,
 * `NA`·빈 값·비숫자는 결측으로 버린다.
 */
export function parseBojCsv(csv: string): Array<{ date: string; value: number }> {
  const out: Array<{ date: string; value: number }> = [];
  for (const line of csv.split('\n')) {
    const cols = line.trim().split(',');
    if (cols.length < 2) continue;
    const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(cols[0]);
    if (!m) continue;                       // 헤더·메타 줄
    const raw = cols[1]?.trim();
    if (!raw || raw === 'NA' || raw === '-') continue;   // 휴일·결측
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    out.push({ date: `${m[1]}-${m[2]}-${m[3]}`, value });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/**
 * `-0`을 `0`으로 정규화한다.
 * `(-0.001).toFixed(2)`는 `'-0.00'`이고 `Number('-0.00')`은 `-0`이다.
 * JS에서 `-0 === 0`이라 UI 필터는 통과하지만, 값 자체로 남으면 부정확하고
 * 직렬화·비교·테스트에서 혼란을 만든다.
 */
function normalizeZero(n: number): number {
  return n === 0 ? 0 : n;
}

/** 최신 관측치 + 직전 관측일 대비 변화 */
export function toJpPolicyRate(points: Array<{ date: string; value: number }>): JpPolicyRate | null {
  if (points.length === 0) return null;
  const last = points[points.length - 1];
  const prev = points.length >= 2 ? points[points.length - 2] : null;
  return {
    rate: last.value,
    // **표시 자릿수(2)와 같게 반올림한다.** BOJ 원본은 소수 3자리라 0.001씩 흔히 움직이는데,
    // 3자리로 계산하고 2자리로 찍으면 '전일 대비 -0.00%p'라는 자기모순 표기가 나온다
    // (실측: 최근 500관측의 인접 변화 중 41%가 이 경우, 그중 99건이 음수 -0.00).
    // 2자리로 반올림하면 그 값들이 0이 되어 buildRows의 `=== 0` 필터에 걸려 자동으로 숨는다.
    // usTreasury.ts도 표시 자릿수와 같은 2자리로 반올림한다 — 계약을 일치시킨다 (2026-08-20 재감사).
    changePp: prev ? normalizeZero(Number((last.value - prev.value).toFixed(2))) : null,
    asOfDate: last.date,
    prevDate: prev?.date ?? null,
  };
}

// 일별 갱신(영업일 1회) — 3시간 캐시로 충분. 성공만 캐시 + in-flight 공유.
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
let cache: { data: JpPolicyRate; ts: number } | null = null;
let inflight: Promise<JpPolicyRate | null> | null = null;

async function fetchJp(): Promise<JpPolicyRate | null> {
  const res = await fetch(BOJ_CALL_RATE_CSV, {
    signal: AbortSignal.timeout(6000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`boj status ${res.status}`);
  // 헤더는 SHIFT-JIS지만 데이터 행은 ASCII라 UTF-8 디코드로도 날짜·숫자는 안전하다.
  // (일본어 헤더는 깨질 수 있으나 파서가 날짜 형식으로만 데이터 행을 고르므로 무해)
  const points = parseBojCsv(await res.text());
  return toJpPolicyRate(points);
}

export async function fetchJpPolicyRate(): Promise<JpPolicyRate | null> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.data;
  try {
    inflight ??= fetchJp().finally(() => { inflight = null; });
    const data = await inflight;
    if (data) cache = { data, ts: Date.now() };
    return data;
  } catch {
    return null;
  }
}

export function resetJpMacroCacheForTests(): void {
  cache = null;
  inflight = null;
}
