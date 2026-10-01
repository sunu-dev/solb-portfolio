import { describe, expect, it } from 'vitest';
import { searchKnownStocks } from '@/config/stockSearchAliases';

describe('한국 사용자 중심 종목 검색 별칭', () => {
  it.each(['SFA반도체', 'SFA 반도체', 'sfa반도체', '에스에프에이반도체', '036540', 'SFA Semicon'])('%s로 SFA반도체를 찾는다', query => {
    expect(searchKnownStocks(query)[0]).toEqual({ symbol: '036540.KQ', description: 'SFA반도체' });
  });
  it('알파벳 검색은 클래스 A와 클래스 C를 함께 보여준다', () => {
    expect(searchKnownStocks('알파벳').slice(0, 2)).toEqual([
      { symbol: 'GOOGL', description: '알파벳 A' },
      { symbol: 'GOOG', description: '알파벳 C' },
    ]);
  });

  it('알파벳 A처럼 클래스를 지정하면 해당 종목을 먼저 보여준다', () => {
    expect(searchKnownStocks('알파벳 A')[0]).toEqual({ symbol: 'GOOGL', description: '알파벳 A' });
    expect(searchKnownStocks('알파벳 C')[0]).toEqual({ symbol: 'GOOG', description: '알파벳 C' });
  });

  it.each(['블룸에너지', '블룸 에너지', 'Bloom Energy', 'BE'])('%s로 블룸에너지를 찾는다', query => {
    expect(searchKnownStocks(query)[0]).toEqual({ symbol: 'BE', description: '블룸에너지' });
  });

  it('기존 한글 종목명 검색도 유지한다', () => {
    expect(searchKnownStocks('삼성전자')[0]).toEqual({ symbol: '005930.KS', description: '삼성전자' });
  });
});
