import { describe, expect, it } from 'vitest';
import snapshot from '../../public/stock-catalog.json';
import { createStockSearchIndex, searchStockIndex } from '@/lib/stockSearchIndex';
const index = createStockSearchIndex(snapshot.stocks);
const symbols = (query: string) => searchStockIndex(index, query).map(item => item.symbol);

describe('전체 종목 한글 검색', () => {
  it.each(['SFA 반도체', 'sfa반도체', '에스에프에이반도체', '036540', 'ＳＦＡ 반도체'])('%s', query => {
    expect(symbols(query)[0]).toBe('036540.KQ');
  });
  it.each(['알파벳', '구글', 'Alphabet'])('%s는 두 클래스를 모두 반환한다', query => {
    expect(symbols(query).slice(0, 2)).toEqual(expect.arrayContaining(['GOOG', 'GOOGL']));
  });
  it('부분 이름, 초성, 분해된 한글을 찾는다', () => {
    expect(symbols('블룸 에너지')[0]).toBe('BE');
    expect(symbols('ㅅㅅㅈㅈ')).toContain('005930.KS');
    expect(symbols('삼성전자'.normalize('NFD'))[0]).toBe('005930.KS');
    expect(symbols('알파벳 C')[0]).toBe('GOOG');
  });
  it('기존 수동 목록 밖의 국내·미국 한글명을 찾는다', () => {
    expect(symbols('하나마이크론')[0]).toBe('067310.KQ');
    expect(symbols('네패스')[0]).toBe('033640.KQ');
    const stock = snapshot.stocks.find(item => item.symbol === 'DUOL')!;
    expect(symbols(stock.description)[0]).toBe('DUOL');
  });
  it('정확한 ETF 코드와 이름은 다른 종목보다 우선한다', () => {
    expect(symbols('069500')[0]).toBe('069500.KS');
    expect(symbols('KODEX 200')[0]).toBe('069500.KS');
  });
  it('유효한 전체 목록에 없는 과거 수동 종목을 재삽입하지 않는다', () => {
    expect(searchStockIndex(createStockSearchIndex([{ symbol: 'ZZZ', description: '테스트' }]), '삼성')).toEqual([]);
    expect(symbols('   ')).toEqual([]);
  });
});
