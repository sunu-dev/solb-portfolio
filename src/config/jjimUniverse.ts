// ==========================================
// JJIM UNIVERSE — AI 찜 종목 유니버스
// ==========================================
// 이 목록에서만 AI가 찜 종목을 선택합니다.
// Hallucination 방지 + 법적 리스크 관리

export interface JjimStock {
  symbol: string;
  krName: string;
  sector: string;
}

export const JJIM_UNIVERSE: JjimStock[] = [
  // Tech / 빅테크
  { symbol: 'AAPL',  krName: '애플',           sector: 'tech' },
  { symbol: 'MSFT',  krName: '마이크로소프트',  sector: 'tech' },
  { symbol: 'GOOGL', krName: '구글',            sector: 'tech' },
  { symbol: 'META',  krName: '메타',            sector: 'tech' },
  { symbol: 'AMZN',  krName: '아마존',          sector: 'tech' },
  { symbol: 'NFLX',  krName: '넷플릭스',        sector: 'streaming' },
  { symbol: 'CRM',   krName: '세일즈포스',      sector: 'tech' },
  { symbol: 'ORCL',  krName: '오라클',          sector: 'tech' },

  // Semiconductor
  { symbol: 'NVDA',  krName: '엔비디아',        sector: 'semiconductor' },
  { symbol: 'AMD',   krName: 'AMD',             sector: 'semiconductor' },
  { symbol: 'AVGO',  krName: '브로드컴',        sector: 'semiconductor' },
  { symbol: 'QCOM',  krName: '퀄컴',            sector: 'semiconductor' },
  { symbol: 'INTC',  krName: '인텔',            sector: 'semiconductor' },
  { symbol: 'MU',    krName: '마이크론',        sector: 'semiconductor' },
  { symbol: 'TSM',   krName: 'TSMC',            sector: 'semiconductor' },
  { symbol: 'ASML',  krName: 'ASML',            sector: 'semiconductor' },
  { symbol: 'AMAT',  krName: '어플라이드 머티리얼즈', sector: 'semiconductor' },

  // EV / Mobility
  { symbol: 'TSLA',  krName: '테슬라',          sector: 'ev' },
  { symbol: 'GM',    krName: 'GM',              sector: 'ev' },
  { symbol: 'F',     krName: '포드',            sector: 'ev' },

  // Finance
  { symbol: 'JPM',   krName: 'JP모건',          sector: 'finance' },
  { symbol: 'GS',    krName: '골드만삭스',      sector: 'finance' },
  { symbol: 'V',     krName: '비자',            sector: 'finance' },
  { symbol: 'MA',    krName: '마스터카드',      sector: 'finance' },
  { symbol: 'BAC',   krName: '뱅크오브아메리카', sector: 'finance' },
  { symbol: 'COIN',  krName: '코인베이스',      sector: 'crypto' },

  // Healthcare / Bio
  { symbol: 'LLY',   krName: '일라이 릴리',     sector: 'healthcare' },
  { symbol: 'JNJ',   krName: '존슨앤존슨',      sector: 'healthcare' },
  { symbol: 'PFE',   krName: '화이자',          sector: 'healthcare' },
  { symbol: 'ABBV',  krName: '애브비',          sector: 'healthcare' },
  { symbol: 'UNH',   krName: '유나이티드헬스',  sector: 'healthcare' },
  { symbol: 'MRNA',  krName: '모더나',          sector: 'healthcare' },

  // Consumer / Retail
  { symbol: 'WMT',   krName: '월마트',          sector: 'consumer' },
  { symbol: 'COST',  krName: '코스트코',        sector: 'consumer' },
  { symbol: 'NKE',   krName: '나이키',          sector: 'consumer' },
  { symbol: 'SBUX',  krName: '스타벅스',        sector: 'consumer' },
  { symbol: 'MCD',   krName: '맥도날드',        sector: 'consumer' },

  // Energy
  { symbol: 'XOM',   krName: '엑슨모빌',        sector: 'energy' },
  { symbol: 'CVX',   krName: '셰브런',          sector: 'energy' },

  // ETF
  { symbol: 'SPY',   krName: 'S&P500 ETF',      sector: 'etf' },
  { symbol: 'QQQ',   krName: '나스닥100 ETF',   sector: 'etf' },
  { symbol: 'SOXX',  krName: '반도체 ETF',      sector: 'etf' },
  { symbol: 'VGT',   krName: 'IT섹터 ETF',      sector: 'etf' },
  { symbol: 'SCHD',  krName: '배당성장 ETF',    sector: 'etf' },
];

// symbol → krName 빠른 조회
export const JJIM_KR_MAP: Record<string, string> = Object.fromEntries(
  JJIM_UNIVERSE.map(s => [s.symbol, s.krName])
);
