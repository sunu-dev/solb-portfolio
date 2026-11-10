import { getStockIdentityKey } from '@/utils/stockCurrency';

const flows: Record<string, readonly [string, string, string]> = {
  MSFT: ['개인·기업·기관', '업무 도구·클라우드', '구독료·사용료 등'],
  PLTR: ['정부기관·민간 기업', '데이터·AI 소프트웨어', '구독·운영·서비스'],
  ORCL: ['기업·기관', '데이터베이스·클라우드', '소프트웨어·서비스 매출'],
};
/** Reviewed schematic labels, not proportions or a real customer transaction. */
export function companyBusinessFlow(symbol: string) { return flows[getStockIdentityKey(symbol)]; }
