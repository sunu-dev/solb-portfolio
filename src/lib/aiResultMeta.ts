import { isKoreanStockSymbol } from '@/utils/stockCurrency';

export interface AiResultMeta {
  generatedAt: string;
  dataSources: string[];
  sourceDetails?: Array<{
    name: string;
    provider: string;
    retrievedAt: string;
    note?: string;
  }>;
  aiProvider?: string;
  aiModel?: string;
}

export function createAiResultMeta(
  feature: 'ai-analysis' | 'ai-chok',
  opts: { symbol?: string; aiProvider?: string; aiModel?: string } = {},
): AiResultMeta {
  const generatedAt = new Date().toISOString();
  const isKr = !!opts.symbol && isKoreanStockSymbol(opts.symbol);
  const sourceDetails = feature === 'ai-analysis'
    ? [
        { name: '현재 시세', provider: isKr ? '한국거래소 연계 시세' : 'Finnhub', retrievedAt: generatedAt, note: 'AI 요청 직전 조회' },
        { name: '차트·기술 지표', provider: '주비 계산 엔진', retrievedAt: generatedAt, note: '클라이언트 보유 캔들 기준' },
        { name: '기업 기본정보', provider: 'Finnhub·종목 데이터', retrievedAt: generatedAt, note: '요청 시점 입력' },
        { name: '최근 뉴스', provider: 'Google News', retrievedAt: generatedAt, note: '최근 24시간 기사 조회' },
      ]
    : [
        { name: '종목 시세·변동률', provider: 'Finnhub', retrievedAt: generatedAt, note: 'AI 촉 생성 직전 서버 조회' },
        { name: '기업 기본정보', provider: 'Finnhub·주비 종목 데이터', retrievedAt: generatedAt, note: '캐시 포함' },
        { name: '시장 지표', provider: '주비 시장 데이터', retrievedAt: generatedAt, note: '요청 시점 입력' },
        { name: '관찰 유니버스', provider: '주비 선정 기준', retrievedAt: generatedAt },
      ];
  return {
    generatedAt,
    dataSources: sourceDetails.map(source => `${source.name}(${source.provider})`),
    sourceDetails,
    aiProvider: opts.aiProvider,
    aiModel: opts.aiModel,
  };
}

export function attachAiResultMeta<T extends object>(
  value: T,
  feature: 'ai-analysis' | 'ai-chok',
  opts: { symbol?: string; aiProvider?: string; aiModel?: string } = {},
): T & { _meta: AiResultMeta } {
  return { ...value, _meta: createAiResultMeta(feature, opts) };
}
