import { describe, expect, it } from 'vitest';
import { validateOcrUpload, OCR_MAX_BYTES } from '@/lib/ocrUploadValidation';
import { parsePortfolioImportCsv, reconcilePortfolioCsvImport, applyPortfolioCsvImport } from '@/utils/portfolioCsvImport';
import type { PortfolioStocks } from '@/config/constants';

describe('출시 전 가져오기 입력 경계', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp'])('%s 업로드 경계', type => {
    expect(validateOcrUpload({ size: OCR_MAX_BYTES, type })).toBeNull();
    expect(validateOcrUpload({ size: OCR_MAX_BYTES + 1, type })).toBe('too_large');
    expect(validateOcrUpload({ size: 0, type })).toBe('empty');
  });
  it.each(['image/heic', 'image/gif', 'application/pdf', 'text/html', ''])('지원하지 않는 %s', type => {
    expect(validateOcrUpload({ size: 100, type })).toBe('bad_type');
  });
  it('잘못된 코드·숫자 행을 제외하고 소수점 미국주식과 국내 코드를 보존한다', () => {
    const parsed = parsePortfolioImportCsv([
      '\uFEFF종목코드,수량,평균단가,증권사',
      'TSLL,.068422,12.25,토스증권',
      "'005930,2,70000,삼성증권",
      'BRK.B,0.5,400,키움증권',
      '=HYPERLINK(1),1,1,토스증권',
      '<script>,1,1,토스증권',
      'MSFT,0x10,100,토스증권',
      'AAPL,Infinity,100,토스증권',
      'NVDA,-1,100,토스증권',
    ].join('\r\n'));
    expect(parsed.issues).toHaveLength(5);
    expect(parsed.rows.map(r => r.draft.symbol)).toEqual(['TSLL', '005930', 'BRK.B']);
    expect(parsed.rows[0].draft.shares).toBe(.068422);
    expect(parsed.rows[1].draft.currency).toBe('KRW');
  });
  it('동일 파일 재등록은 수량을 다시 더하지 않는다', () => {
    const empty: PortfolioStocks = { investing: [], watching: [], sold: [] };
    const parsed = parsePortfolioImportCsv('종목코드,수량,평균단가,증권사\nAAPL,.25,100,토스증권');
    const rows = reconcilePortfolioCsvImport(parsed.rows, empty, '');
    const first = applyPortfolioCsvImport(empty, rows, new Set([0]));
    const again = reconcilePortfolioCsvImport(parsed.rows, first.stocks, '');
    expect(again[0].status).toBe('unchanged');
    expect(applyPortfolioCsvImport(first.stocks, again, new Set([0])).stocks.investing[0].shares).toBe(.25);
  });
  it('빈 파일과 과다 행을 거절한다', () => {
    expect(() => parsePortfolioImportCsv('')).toThrow();
    expect(() => parsePortfolioImportCsv('종목코드,수량,평균단가\n' + Array(101).fill('AAPL,1,100').join('\n'))).toThrow('100');
  });
});
