import { describe, expect, it } from 'vitest';
import { parseStockMaster } from '@/lib/stockMasterParser';

describe('공식 종목 마스터 파싱', () => {
  it('국내 6자리 코드를 보존하고 ELW는 제외한다', () => {
    const line = (code: string, group: string) => code.padEnd(9) + 'KR1234567890' + 'Sample'.padEnd(40) + group;
    const input = [line('036540', 'ST'), line('0193W0', 'EF'), line('999999', 'EW')].join('\r\n');
    expect(parseStockMaster(new TextEncoder().encode(input), 'KQ').map(s => s.symbol)).toEqual(['036540.KQ', '0193W0.KQ']);
  });
  it('미국 주식/ETP만 읽고 클래스 심볼을 변환한다', () => {
    const row = (symbol: string, type: string, currency: string) => ['US', '22', 'NAS', 'NASDAQ', symbol, 'REAL', 'Name', 'English', type, currency].join('\t');
    const input = [row('BRK.B', '2', 'USD'), row('QQQ', '3', 'USD'), row('XYZW', '4', 'USD'), row('OTHER', '2', 'JPY')].join('\n');
    expect(parseStockMaster(new TextEncoder().encode(input), 'US').map(s => s.symbol)).toEqual(['BRK-B', 'QQQ']);
  });
});
