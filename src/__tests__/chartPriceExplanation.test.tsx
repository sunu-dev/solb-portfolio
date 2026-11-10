import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: vi.fn() } } }));
import { renderToStaticMarkup } from 'react-dom/server';
import ChartPriceExplanation, { type ChartQuota } from '@/components/analysis/ChartPriceExplanation';
import type { IntradayCandles } from '@/lib/intradayCandles';
const first = Date.parse('2026-11-03T00:00:00Z') / 1000;
const data: IntradayCandles = { s: 'ok', interval: '5m', sessionDate: '2026-11-03', timeZone: 'Asia/Seoul', asOf: first + 24 * 300,
  t: Array.from({ length: 25 }, (_, i) => first + i * 300), o: Array.from({ length: 25 }, (_, i) => 100 + i),
  h: Array.from({ length: 25 }, (_, i) => 102 + i), l: Array.from({ length: 25 }, (_, i) => 99 + i), c: Array.from({ length: 25 }, (_, i) => 101 + i), v: Array(25).fill(100) };
const render = (status: ChartQuota['status'], remaining: number | null) => renderToStaticMarkup(<ChartPriceExplanation symbol="340810.KQ" currency="KRW" data={data}
  quota={{ status, remaining, acceptResponse: () => null }} onData={() => {}} />);
describe('chart explanation entry', () => {
  it('shows login or exact shared remaining usage before a paid model request', () => {
    expect(render('signed-out', null)).toContain('로그인하고 이 차트 쉽게 풀어보기');
    expect(render('ready', 2)).toContain('AI 설명 1회 사용 · 오늘 2회 남았어요');
  });
  it('disables new requests while usage is unknown or exhausted', () => {
    expect(render('checking', null)).toContain('disabled');
    const exhausted = render('ready', 0); expect(exhausted).toContain('disabled'); expect(exhausted).toContain('모두 사용했어요');
  });
  it('does not offer a model explanation for an insufficient price series', () => {
    expect(renderToStaticMarkup(<ChartPriceExplanation symbol="MU" currency="USD" data={{ ...data, t: [first] }} quota={{ status: 'ready', remaining: 3, acceptResponse: () => null }} onData={() => {}} />)).toBe('');
  });
});
