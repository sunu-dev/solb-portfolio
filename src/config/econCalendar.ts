/**
 * 미국 주요 경제지표 발표 캘린더 — 정적 config SSOT.
 *
 * 왜 정적인가: 이 일정들은 기관이 연간 캘린더로 1년 전에 공개하며 거의 변하지 않는다.
 * 크롤링(BLS는 봇 차단)보다 연 1회 손 갱신이 안정적이다 — `marketHolidays.ts`와 같은 패턴.
 *
 * 출처 (2026-08-19 확인):
 *  - FOMC: federalreserve.gov/monetarypolicy/fomccalendars.htm (직접 확인, 결정 발표 14:00 ET)
 *  - CPI·고용보고서: BLS 공개 일정 (08:30 ET)
 *
 * 시각은 **UTC ISO**로 저장한다 — 미 동부는 서머타임(2026년은 11/1 종료)이 있어
 * "08:30 ET"를 그대로 저장하면 KST 환산이 애매해진다. UTC 고정이면 표시가 기계적이다.
 *
 * ⚠️ 연 1회 갱신 의무: 연도가 바뀌어 미래 일정이 비면 nextEconRelease()가 null을 돌려주고
 * UI는 발표 예고 줄을 숨긴다 — 낡은 일정을 보여주는 것보다 안 보여주는 게 낫다.
 */

export type EconReleaseId = 'fomc' | 'us-cpi' | 'us-jobs';

export interface EconRelease {
  id: EconReleaseId;
  /** 화면 라벨 */
  label: string;
  /** 발표 시각 (UTC ISO) */
  at: string;
}

/**
 * 배지용 축약 라벨 — 좁은 폭(320px)에서 전체 라벨은 카드를 넘친다.
 * '미국 FOMC 금리 결정'(≈207px)이 최장 케이스라 축약이 필요하다 (2026-08-19 재감사).
 */
export const ECON_SHORT_LABEL: Record<EconReleaseId, string> = {
  fomc: 'FOMC',
  'us-cpi': '미국 CPI',
  'us-jobs': '미국 고용',
};

// 2026년 잔여 일정 (과거분은 '다음 발표' 계산에 불필요해 미등재)
export const ECON_RELEASES: EconRelease[] = [
  // 고용보고서(실업률) — 08:30 ET (EDT=12:30Z, EST=13:30Z)
  { id: 'us-jobs', label: '미국 고용보고서', at: '2026-09-04T12:30:00Z' },
  { id: 'us-jobs', label: '미국 고용보고서', at: '2026-10-02T12:30:00Z' },
  { id: 'us-jobs', label: '미국 고용보고서', at: '2026-11-06T13:30:00Z' },
  { id: 'us-jobs', label: '미국 고용보고서', at: '2026-12-04T13:30:00Z' },
  // CPI — 08:30 ET
  { id: 'us-cpi', label: '미국 CPI', at: '2026-09-11T12:30:00Z' },
  { id: 'us-cpi', label: '미국 CPI', at: '2026-10-14T12:30:00Z' },
  { id: 'us-cpi', label: '미국 CPI', at: '2026-11-10T13:30:00Z' },
  { id: 'us-cpi', label: '미국 CPI', at: '2026-12-10T13:30:00Z' },
  // FOMC 금리 결정 — 회의 이틀째 14:00 ET (EDT=18:00Z, EST=19:00Z)
  { id: 'fomc', label: '미국 FOMC 금리 결정', at: '2026-09-16T18:00:00Z' },
  { id: 'fomc', label: '미국 FOMC 금리 결정', at: '2026-10-28T18:00:00Z' },
  { id: 'fomc', label: '미국 FOMC 금리 결정', at: '2026-12-09T19:00:00Z' },
];

/** 다음 발표 1건. 미래 일정이 없으면 null — 호출부는 줄 자체를 숨긴다. */
export function nextEconRelease(now: Date): EconRelease | null {
  const upcoming = ECON_RELEASES
    .filter(r => new Date(r.at).getTime() > now.getTime())
    .sort((a, b) => a.at.localeCompare(b.at));
  return upcoming[0] ?? null;
}

const KST_FMT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'numeric', day: 'numeric', weekday: 'short',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

/** "9.11(금) 21:30" 형태의 KST 표기 */
export function formatReleaseKst(release: EconRelease): string {
  const parts = KST_FMT.formatToParts(new Date(release.at));
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return `${get('month')}.${get('day')}(${get('weekday')}) ${get('hour')}:${get('minute')}`;
}
