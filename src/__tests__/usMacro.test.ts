import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseFredSeriesCsv, toFedTarget, toCpiYoY, toUnemployment, fetchUsMacro, resetUsMacroCacheForTests,
} from '@/lib/usMacro';

describe('parseFredSeriesCsv', () => {
  it('마지막 유효 행의 값과 날짜를 뽑는다', () => {
    const csv = 'observation_date,DFEDTARU\n2026-08-18,3.75\n2026-08-19,3.75';
    expect(parseFredSeriesCsv(csv, 'DFEDTARU')).toEqual({ value: 3.75, date: '2026-08-19' });
  });

  /**
   * 적대 재감사(2026-08-19)가 잡은 결함의 회귀 박제.
   * fredgraph의 실제 결측 표기는 **빈 문자열**이고(`2008-12-16,,0.00` 실측),
   * `Number('')===0`이라 초판 가드는 결측을 0.00%로 통과시켰다.
   */
  it("빈 문자열 결측을 0으로 읽지 않는다 (실제 FRED 결측 포맷)", () => {
    const csv = 'observation_date,DFEDTARU\n2026-08-18,3.75\n2026-08-20,';
    expect(parseFredSeriesCsv(csv, 'DFEDTARU')).toEqual({ value: 3.75, date: '2026-08-18' });
  });

  it("공백만 있는 칸도 결측으로 본다", () => {
    const csv = 'observation_date,DFEDTARU\n2026-08-18,3.75\n2026-08-20,   ';
    expect(parseFredSeriesCsv(csv, 'DFEDTARU')?.date).toBe('2026-08-18');
  });

  it("'.' 결측·형식 이탈 행도 건너뛴다", () => {
    const csv = 'observation_date,DFEDTARU\n2026-08-18,3.75\nbad-row,9\n2026-08-19,.';
    expect(parseFredSeriesCsv(csv, 'DFEDTARU')?.date).toBe('2026-08-18');
  });

  it('전 행이 결측이면 null', () => {
    expect(parseFredSeriesCsv('observation_date,DFEDTARU\n2026-08-19,', 'DFEDTARU')).toBeNull();
  });

  it('기대 시리즈 컬럼이 없으면 null', () => {
    expect(parseFredSeriesCsv('observation_date,OTHER\n2026-08-19,1', 'DFEDTARU')).toBeNull();
  });
});

describe('toFedTarget', () => {
  it('두 시리즈를 목표 범위로 합친다', () => {
    expect(toFedTarget({ value: 3.75, date: '2026-08-19' }, { value: 3.5, date: '2026-08-19' }))
      .toEqual({ upper: 3.75, lower: 3.5, asOfDate: '2026-08-19' });
  });

  it('한쪽이 없으면 null — 반쪽 범위(0.00~3.50)를 만들지 않는다', () => {
    expect(toFedTarget(null, { value: 3.5, date: '2026-08-19' })).toBeNull();
    expect(toFedTarget({ value: 3.75, date: '2026-08-19' }, null)).toBeNull();
  });

  it('기준일이 다르면 이른 쪽을 쓴다 (오래된 값 섞임을 숨기지 않는다)', () => {
    expect(toFedTarget({ value: 3.75, date: '2026-08-19' }, { value: 3.5, date: '2026-08-15' })?.asOfDate)
      .toBe('2026-08-15');
  });

  it('상단 < 하단이면 데이터 이상으로 보고 표시를 거부한다', () => {
    expect(toFedTarget({ value: 1.0, date: '2026-08-19' }, { value: 3.5, date: '2026-08-19' })).toBeNull();
  });
});

const blsSeries = (id: string, data: Array<[string, string, string]>) => ({
  seriesID: id,
  data: data.map(([year, period, value]) => ({ year, period, value })),
});

describe('toCpiYoY', () => {
  it('전년 동월 대비 %와 직전 월 YoY를 계산한다', () => {
    const s = blsSeries('CUUR0000SA0', [
      ['2026', 'M07', '333.918'], ['2026', 'M06', '332.500'],
      ['2025', 'M07', '323.048'], ['2025', 'M06', '322.560'],
    ]);
    const r = toCpiYoY(s);
    expect(r?.refMonth).toBe('2026-07');
    expect(r?.yoy).toBe(3.4);      // 333.918/323.048 - 1 = 3.36% → 3.4
    expect(r?.prevYoy).toBe(3.1);  // 332.5/322.56 - 1 = 3.08% → 3.1
  });

  it('M13(연평균 집계)은 월 시계열에서 제외한다', () => {
    const s = blsSeries('CUUR0000SA0', [
      ['2026', 'M13', '999'], ['2026', 'M07', '333.918'], ['2025', 'M07', '323.048'],
    ]);
    expect(toCpiYoY(s)?.refMonth).toBe('2026-07');
  });

  it('전년 동월이 없으면 그 달은 건너뛴다 — 틀린 YoY를 만들지 않는다', () => {
    const s = blsSeries('CUUR0000SA0', [
      ['2026', 'M07', '333.918'], ['2026', 'M06', '332.500'], ['2025', 'M06', '322.560'],
    ]);
    // 2026-07은 전년 동월 부재 → 2026-06으로 강등
    expect(toCpiYoY(s)?.refMonth).toBe('2026-06');
  });

  it('계산 가능한 달이 없으면 null', () => {
    expect(toCpiYoY(blsSeries('CUUR0000SA0', [['2026', 'M07', '333.918']]))).toBeNull();
  });
});

describe('toUnemployment', () => {
  it('최신 월과 직전 월', () => {
    const s = blsSeries('LNS14000000', [['2026', 'M07', '4.1'], ['2026', 'M06', '4.2']]);
    expect(toUnemployment(s)).toEqual({ rate: 4.1, prevRate: 4.2, refMonth: '2026-07' });
  });

  it('한 달뿐이면 prevRate null', () => {
    const s = blsSeries('LNS14000000', [['2026', 'M07', '4.1']]);
    expect(toUnemployment(s)?.prevRate).toBeNull();
  });
});

describe('fetchUsMacro — 소스 개별 실패·캐시', () => {
  const fedCsv = (id: string, v: string) => `observation_date,${id}\n2026-08-19,${v}`;
  const BLS_OK = JSON.stringify({
    status: 'REQUEST_SUCCEEDED',
    Results: { series: [
      blsSeries('CUUR0000SA0', [['2026', 'M07', '333.918'], ['2025', 'M07', '323.048']]),
      blsSeries('LNS14000000', [['2026', 'M07', '4.1'], ['2026', 'M06', '4.2']]),
    ] },
  });
  const route = (impl: { fred?: () => Promise<Response> | Response; bls?: () => Promise<Response> | Response }) =>
    vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('fred')) {
        if (impl.fred) return Promise.resolve(impl.fred());
        // 단일 시리즈 2회 요청 — 상단/하단을 각각 돌려준다
        return Promise.resolve(new Response(u.includes('DFEDTARU') ? fedCsv('DFEDTARU', '3.75') : fedCsv('DFEDTARL', '3.50')));
      }
      return Promise.resolve(impl.bls ? impl.bls() : new Response(BLS_OK));
    });

  beforeEach(() => { resetUsMacroCacheForTests(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-19T12:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); resetUsMacroCacheForTests(); });

  it('정상 경로 — 3지표 전부', async () => {
    vi.stubGlobal('fetch', route({}));
    const r = await fetchUsMacro();
    expect(r.fed?.upper).toBe(3.75);
    expect(r.cpi?.yoy).toBe(3.4);
    expect(r.jobs?.rate).toBe(4.1);
  });

  it('BLS 실패해도 Fed는 서빙된다 (소스 개별 격리)', async () => {
    vi.stubGlobal('fetch', route({ bls: () => { throw new Error('down'); } }));
    const r = await fetchUsMacro();
    expect(r.fed?.upper).toBe(3.75);
    expect(r.cpi).toBeNull();
    expect(r.jobs).toBeNull();
  });

  it('성공은 소스별 캐시, 실패한 소스는 재시도된다', async () => {
    let blsFail = true;
    const mock = route({ bls: () => { if (blsFail) throw new Error('down'); return new Response(BLS_OK); } });
    vi.stubGlobal('fetch', mock);
    await fetchUsMacro();                       // fed 성공(캐시), bls 실패(미캐시)
    blsFail = false;
    const r2 = await fetchUsMacro();            // fed 캐시 히트, bls 재시도 성공
    expect(r2.cpi?.yoy).toBe(3.4);
    // fed는 첫 호출에서만 나간다(시리즈 2개 = 2요청), 이후 캐시 히트
    const fredCalls = mock.mock.calls.filter(c => String(c[0]).includes('fred')).length;
    expect(fredCalls).toBe(2);
  });
});
