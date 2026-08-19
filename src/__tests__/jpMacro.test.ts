import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseBojCsv, toJpPolicyRate, fetchJpPolicyRate, resetJpMacroCacheForTests } from '@/lib/jpMacro';

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

  it('비교 대상이 없으면 changePp는 null — 0으로 위장하지 않는다', () => {
    const r = toJpPolicyRate([{ date: '2026-08-17', value: 0.977 }]);
    expect(r?.changePp).toBeNull();
    expect(r?.prevDate).toBeNull();
  });

  it('빈 시계열은 null', () => {
    expect(toJpPolicyRate([])).toBeNull();
  });
});

describe('fetchJpPolicyRate — 캐시', () => {
  beforeEach(() => { resetJpMacroCacheForTests(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-19T12:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); resetJpMacroCacheForTests(); });

  it('성공은 3시간 캐시', async () => {
    const mock = vi.fn().mockResolvedValue(new Response(csvOf('2026/08/14,0.977', '2026/08/17,0.977')));
    vi.stubGlobal('fetch', mock);
    expect((await fetchJpPolicyRate())?.rate).toBe(0.977);
    await fetchJpPolicyRate();
    expect(mock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3 * 60 * 60 * 1000 + 1000);
    await fetchJpPolicyRate();
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it('실패는 null이며 캐시하지 않는다', async () => {
    const mock = vi.fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue(new Response(csvOf('2026/08/17,0.977')));
    vi.stubGlobal('fetch', mock);
    expect(await fetchJpPolicyRate()).toBeNull();
    expect((await fetchJpPolicyRate())?.rate).toBe(0.977);
  });

  it('전 행이 결측이면 null (휴장 연휴)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(csvOf('2026/08/15,NA', '2026/08/16,NA'))));
    expect(await fetchJpPolicyRate()).toBeNull();
  });
});
