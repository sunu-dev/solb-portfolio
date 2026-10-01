import { describe, expect, it, vi } from 'vitest';
import snapshot from '../../public/stock-catalog.json';
vi.mock('@/lib/stockCatalog', () => ({ getStockCatalog: async () => snapshot }));
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/kr-quote/route';

async function search(query: string) {
  const response = await POST(new NextRequest('http://localhost/api/kr-quote', {
    method: 'POST', body: JSON.stringify({ query }),
    headers: { 'Content-Type': 'application/json' },
  }));
  return (await response.json()).results as { symbol: string; name: string }[];
}

describe('국내 종목 검색 API', () => {
  it('띄어 쓴 SFA반도체도 반환한다', async () => {
    expect(await search('SFA 반도체')).toContainEqual({
      symbol: '036540.KQ', name: 'SFA반도체', yahoo: '036540.KQ',
    });
  });
  it('기존 종목의 띄어쓰기를 허용하고 중복을 제거한다', async () => {
    const results = await search('삼성 전자');
    expect(results.filter(item => item.symbol === '005930.KS')).toHaveLength(1);
    expect(results.some(item => item.symbol === '005935.KS')).toBe(true);
  });
  it('공백만 입력하면 결과가 없다', async () => {
    expect(await search('  ')).toEqual([]);
  });
});
