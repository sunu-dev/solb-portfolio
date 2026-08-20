import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseBojCsv, parseBojApiCsv, toJpPolicyRate, fetchJpPolicyRate, resetJpMacroCacheForTests } from '@/lib/jpMacro';

/** 실제 BOJ CSV 구조(헤더 9줄 + YYYY/MM/DD,값) 재현 */
const HEADER = [
  '主要時系列統計データ表',
  '2026/08/19 15:00',
  '"","コールレート（日次）"',
  '"系列名称","無担保コールＯ／Ｎ物レート／平均値 日次／金利"',
  `"データコード",FM01'STRDCLUCON`,
  '"単位",年％',
  '"収録開始期","1998/01/05"',
  '"収録終了期","2026/08/17"',
  '"最終更新日","2026/08/19"',
].join('\n');

const csvOf = (...rows: string[]) => `${HEADER}\n${rows.join('\n')}\n`;

describe('parseBojCsv', () => {
  it('헤더 9줄을 건너뛰고 데이터 행만 파싱한다', () => {
    const csv = csvOf('2026/08/14,0.977', '2026/08/17,0.977');
    expect(parseBojCsv(csv)).toEqual([
      { date: '2026-08-14', value: 0.977 },
      { date: '2026-08-17', value: 0.977 },
    ]);
  });

  /** 휴일·주말에 실제로 등장하는 표기 — 실측 확인 */
  it("결측 'NA'를 숫자로 읽지 않는다", () => {
    const csv = csvOf('2026/08/14,0.977', '2026/08/15,NA', '2026/08/16,NA');
    expect(parseBojCsv(csv)).toEqual([{ date: '2026-08-14', value: 0.977 }]);
  });

  it('빈 값·하이픈도 결측으로 본다 (1단계 FRED 빈 문자열 사고와 같은 계열)', () => {
    const csv = csvOf('2026/08/14,0.977', '2026/08/17,', '2026/08/18,-');
    expect(parseBojCsv(csv).map(p => p.date)).toEqual(['2026-08-14']);
  });

  it('날짜 형식이 아닌 줄은 전부 무시한다', () => {
    const csv = csvOf('합계,1.5', '2026/8/17,0.9', '2026/08/17,0.977');
    // 'YYYY/M/D'(한 자리)도 형식 불일치로 제외 — 느슨하게 받으면 정렬이 깨진다
    expect(parseBojCsv(csv)).toEqual([{ date: '2026-08-17', value: 0.977 }]);
  });

  it('음수 금리도 파싱한다 (일본은 마이너스 금리 이력이 있다)', () => {
    expect(parseBojCsv(csvOf('2016/02/16,-0.004'))).toEqual([{ date: '2016-02-16', value: -0.004 }]);
  });

  it('데이터가 없으면 빈 배열', () => {
    expect(parseBojCsv(HEADER)).toEqual([]);
  });
});

describe('toJpPolicyRate', () => {
  it('최신값과 직전 관측일 대비 변화', () => {
    const r = toJpPolicyRate([
      { date: '2026-07-30', value: 0.727 },
      { date: '2026-07-31', value: 0.977 },
    ]);
    expect(r).toEqual({ rate: 0.977, changePp: 0.25, asOfDate: '2026-07-31', prevDate: '2026-07-30' });
  });

  /**
   * 계산 자릿수 = 표시 자릿수 계약.
   * BOJ 원본은 소수 3자리라 0.001씩 흔히 움직이는데, 3자리로 계산하고 2자리로 찍으면
   * '전일 대비 -0.00%p'라는 자기모순 표기가 나온다(실측 41%). 2자리로 반올림하면 0이 되어
   * UI의 `changePp === 0` 필터에 걸려 자동으로 숨는다 (2026-08-20 재감사).
   */
  it.each([
    [0.228, 0.227],  // -0.001
    [0.077, 0.079],  // +0.002
    [0.98, 0.977],   // -0.003
  ])('소수 3자리 미세 변동(%s → %s)은 0으로 반올림돼 표시에서 숨는다', (prev, last) => {
    const r = toJpPolicyRate([{ date: '2026-08-14', value: prev }, { date: '2026-08-17', value: last }]);
    expect(r?.changePp).toBe(0);
  });

  it('실제 정책 변경(25bp)은 그대로 보인다', () => {
    const r = toJpPolicyRate([{ date: '2026-06-16', value: 0.727 }, { date: '2026-06-17', value: 0.977 }]);
    expect(r?.changePp).toBe(0.25);
  });

  it('changePp는 소수 2자리를 넘지 않는다 (표시 자릿수 계약)', () => {
    for (const [prev, last] of [[0.228, 0.227], [0.5, 0.5551], [1.0, 0.9449]] as const) {
      const cp = toJpPolicyRate([{ date: '2026-08-14', value: prev }, { date: '2026-08-17', value: last }])!.changePp!;
      expect(Number(cp.toFixed(2))).toBe(cp);
    }
  });

  it('비교 대상이 없으면 changePp는 null — 0으로 위장하지 않는다', () => {
    const r = toJpPolicyRate([{ date: '2026-08-17', value: 0.977 }]);
    expect(r?.changePp).toBeNull();
    expect(r?.prevDate).toBeNull();
  });

  it('빈 시계열은 null', () => {
    expect(toJpPolicyRate([])).toBeNull();
  });
});

describe('fetchJpPolicyRate — API 우선·폴백·캐시', () => {
  const isApi = (url: unknown) => String(url).includes('/api/v1/');

  beforeEach(() => { resetJpMacroCacheForTests(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-19T12:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); resetJpMacroCacheForTests(); });

  it('공식 API를 먼저 쓰고 폴백을 호출하지 않는다', async () => {
    const mock = vi.fn((url: string) =>
      Promise.resolve(new Response(isApi(url) ? apiCsv(['20260817', '0.977'], ['20260818', '0.977']) : 'SHOULD NOT BE USED')));
    vi.stubGlobal('fetch', mock);
    expect((await fetchJpPolicyRate())?.rate).toBe(0.977);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(isApi(mock.mock.calls[0][0])).toBe(true);
  });

  it('API 요청은 전월~당월 2개월 창(YYYYMM)으로 나간다', async () => {
    const mock = vi.fn((_url: string) => Promise.resolve(new Response(apiCsv(['20260818', '0.977']))));
    vi.stubGlobal('fetch', mock);
    await fetchJpPolicyRate();
    const url = String(mock.mock.calls[0][0]);
    expect(url).toContain('startDate=202607');
    expect(url).toContain('endDate=202608');
    expect(url).toContain('frequency=D');
  });

  it('API가 실패하면 폴백 CSV로 넘어간다', async () => {
    const mock = vi.fn((url: string) => isApi(url)
      ? Promise.reject(new Error('api down'))
      : Promise.resolve(new Response(csvOf('2026/08/14,0.977', '2026/08/17,0.977'))));
    vi.stubGlobal('fetch', mock);
    expect((await fetchJpPolicyRate())?.rate).toBe(0.977);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('API가 빈 결과를 주면(사양 변경 등) 폴백으로 넘어간다', async () => {
    const mock = vi.fn((url: string) => Promise.resolve(new Response(
      isApi(url) ? `${API_META}\n` : csvOf('2026/08/17,0.977'))));
    vi.stubGlobal('fetch', mock);
    expect((await fetchJpPolicyRate())?.rate).toBe(0.977);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('성공은 3시간 캐시', async () => {
    const mock = vi.fn((_url: string) => Promise.resolve(new Response(apiCsv(['20260817', '0.977'], ['20260818', '0.977']))));
    vi.stubGlobal('fetch', mock);
    expect((await fetchJpPolicyRate())?.rate).toBe(0.977);
    await fetchJpPolicyRate();
    expect(mock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3 * 60 * 60 * 1000 + 1000);
    await fetchJpPolicyRate();
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('둘 다 실패하면 null이며 캐시하지 않는다', async () => {
    let down = true;
    const mock = vi.fn((url: string) => down
      ? Promise.reject(new Error('down'))
      : Promise.resolve(new Response(isApi(url) ? apiCsv(['20260818', '0.977']) : '')));
    vi.stubGlobal('fetch', mock);
    expect(await fetchJpPolicyRate()).toBeNull();
    down = false;
    expect((await fetchJpPolicyRate())?.rate).toBe(0.977);
  });

  it('전 행이 결측이면 null (휴장 연휴)', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(
      isApi(url) ? apiCsv(['20260815', 'null'], ['20260816', 'null']) : csvOf('2026/08/15,NA')))));
    expect(await fetchJpPolicyRate()).toBeNull();
  });
});

/** 실제 API v1 응답 구조 재현 — 메타 11줄 + 헤더 + 데이터 */
const API_META = [
  'STATUS,200',
  'MESSAGEID,M181000I',
  'MESSAGE,Successfully completed',
  'DATE,2026-08-20T12:22:27.165+09:00',
  'PARAMETER,FORMAT,CSV',
  'PARAMETER,LANG,EN',
  'PARAMETER,DB,FM01',
  'PARAMETER,STARTDATE,202607',
  'PARAMETER,ENDDATE,202608',
  'PARAMETER,STARTPOSITION,',
  'NEXTPOSITION,',
  'SERIES_CODE,NAME_OF_TIME_SERIES,UNIT,FREQUENCY,CATEGORY,LAST_UPDATE,SURVEY_DATES,VALUES',
].join('\n');

/** NAME 필드는 따옴표 안에 쉼표를 포함한다 — 실제 응답 그대로 */
const apiRow = (date: string, value: string) =>
  `STRDCLUCON,"Call Rate, Uncollateralized Overnight, Average (Daily)",percent per annum,DAILY,Call Rate,20260820,${date},${value}`;

const apiCsv = (...rows: Array<[string, string]>) =>
  `${API_META}\n${rows.map(([d, v]) => apiRow(d, v)).join('\n')}\n`;

describe('parseBojApiCsv (공식 API v1)', () => {
  it('메타 11줄과 헤더를 건너뛰고 데이터만 파싱한다', () => {
    expect(parseBojApiCsv(apiCsv(['20260817', '0.977'], ['20260818', '0.977']))).toEqual([
      { date: '2026-08-17', value: 0.977 },
      { date: '2026-08-18', value: 0.977 },
    ]);
  });

  /**
   * NAME 필드가 따옴표 안에 쉼표 2개를 포함해 단순 split(',')이면 8컬럼이 10개로 밀린다.
   * 파서는 **끝에서부터** SURVEY_DATES·VALUES를 읽어 이 문제를 피한다.
   */
  it('따옴표 안 쉼표가 컬럼 인덱스를 밀지 않는다', () => {
    const row = apiRow('20260818', '0.977');
    expect(row.split(',').length).toBeGreaterThan(8);   // 전제: 단순 split은 밀린다
    expect(parseBojApiCsv(`${API_META}\n${row}`)).toEqual([{ date: '2026-08-18', value: 0.977 }]);
  });

  it("결측 'null'을 숫자로 읽지 않는다 (mtshtml의 'NA'와 다른 표기)", () => {
    expect(parseBojApiCsv(apiCsv(['20260817', '0.977'], ['20260818', 'null']))).toEqual([
      { date: '2026-08-17', value: 0.977 },
    ]);
  });

  it('STATUS가 200이 아니면 던진다 (조용한 빈 결과 금지)', () => {
    expect(() => parseBojApiCsv('STATUS,400\nMESSAGE,Invalid frequency')).toThrow();
    expect(() => parseBojApiCsv('')).toThrow();
  });

  it('날짜 역순 입력도 오름차순 정렬', () => {
    expect(parseBojApiCsv(apiCsv(['20260818', '0.977'], ['20260817', '0.9'])).map(p => p.date))
      .toEqual(['2026-08-17', '2026-08-18']);
  });

  it('음수 금리도 파싱한다', () => {
    expect(parseBojApiCsv(apiCsv(['20160216', '-0.004']))).toEqual([{ date: '2016-02-16', value: -0.004 }]);
  });
});
