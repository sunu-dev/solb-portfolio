/** Fixed public-source identities; never supplied by a model or a public request. */
export const COMPANY_REGISTRY = {
  INTC: { cik: '0000050863', name: '인텔' }, NVDA: { cik: '0001045810', name: '엔비디아' },
  AMD: { cik: '0000002488', name: 'AMD' }, AMZN: { cik: '0001018724', name: '아마존' },
  GOOGL: { cik: '0001652044', name: '알파벳' }, MSFT: { cik: '0000789019', name: '마이크로소프트' },
  META: { cik: '0001326801', name: '메타' }, AAPL: { cik: '0000320193', name: '애플' },
} as const;
export type CompanySymbol = keyof typeof COMPANY_REGISTRY;
