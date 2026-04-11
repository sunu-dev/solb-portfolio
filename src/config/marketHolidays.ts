/**
 * 2026 한국(KRX) + 미국(NYSE) 휴장일
 * 형식: 'MM-DD'
 */

export interface MarketHoliday {
  date: string;   // 'YYYY-MM-DD'
  label: string;
  market: 'KR' | 'US' | 'BOTH';
}

export const MARKET_HOLIDAYS_2026: MarketHoliday[] = [
  // === 미국 (NYSE) ===
  { date: '2026-01-01', label: '신정', market: 'US' },
  { date: '2026-01-19', label: 'MLK Day', market: 'US' },
  { date: '2026-02-16', label: 'Presidents Day', market: 'US' },
  { date: '2026-04-03', label: 'Good Friday', market: 'US' },
  { date: '2026-05-25', label: 'Memorial Day', market: 'US' },
  { date: '2026-06-19', label: 'Juneteenth', market: 'US' },
  { date: '2026-07-03', label: '독립기념일', market: 'US' },
  { date: '2026-09-07', label: 'Labor Day', market: 'US' },
  { date: '2026-11-26', label: 'Thanksgiving', market: 'US' },
  { date: '2026-12-25', label: '크리스마스', market: 'BOTH' },

  // === 한국 (KRX) ===
  { date: '2026-01-01', label: '신정', market: 'KR' },
  { date: '2026-01-28', label: '설날 연휴', market: 'KR' },
  { date: '2026-01-29', label: '설날', market: 'KR' },
  { date: '2026-01-30', label: '설날 연휴', market: 'KR' },
  { date: '2026-03-01', label: '삼일절', market: 'KR' },
  { date: '2026-05-05', label: '어린이날', market: 'KR' },
  { date: '2026-05-25', label: '부처님오신날', market: 'KR' },
  { date: '2026-06-06', label: '현충일', market: 'KR' },
  { date: '2026-08-17', label: '광복절 대체', market: 'KR' },
  { date: '2026-09-24', label: '추석 연휴', market: 'KR' },
  { date: '2026-09-25', label: '추석', market: 'KR' },
  { date: '2026-09-26', label: '추석 연휴', market: 'KR' },
  { date: '2026-10-03', label: '개천절', market: 'KR' },
  { date: '2026-10-09', label: '한글날', market: 'KR' },
  { date: '2026-12-25', label: '크리스마스', market: 'KR' },
  { date: '2026-12-31', label: '연말 휴장', market: 'KR' },
];

/**
 * 오늘 또는 이후 N일 내 휴장일 반환
 */
export function getUpcomingHolidays(days = 7): MarketHoliday[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + days);

  return MARKET_HOLIDAYS_2026.filter(h => {
    const d = new Date(h.date);
    return d >= today && d <= end;
  });
}

/**
 * 오늘이 특정 시장 휴장일인지 확인
 */
export function isTodayHoliday(market: 'KR' | 'US'): MarketHoliday | null {
  const today = new Date().toISOString().split('T')[0];
  return MARKET_HOLIDAYS_2026.find(h =>
    h.date === today && (h.market === market || h.market === 'BOTH')
  ) || null;
}
