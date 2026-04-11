/**
 * 국장 + 미장 장 상태 (한국시간 기준)
 * 3단계: 열림(🟢) / 준비중·연장(🟡) / 닫힘(⚪)
 */

export interface MarketStatus {
  status: 'open' | 'preparing' | 'extended' | 'closed';
  labelSimple: string;
  color: string;
  dot: string;
  nextEvent: string;
}

export interface DualMarketStatus {
  kr: MarketStatus;
  us: MarketStatus;
  isWeekend: boolean;
}

// 서머타임 판별
function isDST(): boolean {
  const now = new Date();
  const month = now.getMonth() + 1;
  if (month > 3 && month < 11) return true;
  if (month < 3 || month > 11) return false;
  if (month === 3) {
    const firstDay = new Date(now.getFullYear(), 2, 1).getDay();
    const secondSunday = firstDay === 0 ? 8 : 15 - firstDay;
    return now.getDate() >= secondSunday;
  }
  if (month === 11) {
    const firstDay = new Date(now.getFullYear(), 10, 1).getDay();
    const firstSunday = firstDay === 0 ? 1 : 8 - firstDay;
    return now.getDate() < firstSunday;
  }
  return false;
}

function getKRStatus(kstTime: number): MarketStatus {
  // 동시호가 08:30~09:00
  if (kstTime >= 510 && kstTime < 540) {
    return { status: 'preparing', labelSimple: '준비 중', color: '#F59E0B', dot: '🟡', nextEvent: '09:00 개장' };
  }
  // 본장 09:00~15:20
  if (kstTime >= 540 && kstTime < 920) {
    return { status: 'open', labelSimple: '열림', color: '#16A34A', dot: '🟢', nextEvent: '15:20 마감' };
  }
  // 종가 단일가 15:20~15:30
  if (kstTime >= 920 && kstTime < 930) {
    return { status: 'preparing', labelSimple: '마감 준비', color: '#F59E0B', dot: '🟡', nextEvent: '15:30 종료' };
  }
  // 시간외 종가 15:40~16:00
  if (kstTime >= 940 && kstTime < 960) {
    return { status: 'extended', labelSimple: '연장 거래', color: '#F59E0B', dot: '🟡', nextEvent: '16:00 종료' };
  }
  // 시간외 대량 16:00~18:00
  if (kstTime >= 960 && kstTime < 1080) {
    return { status: 'extended', labelSimple: '연장 거래', color: '#F59E0B', dot: '🟡', nextEvent: '18:00 종료' };
  }
  // 닫힘
  if (kstTime < 510) {
    return { status: 'closed', labelSimple: '닫힘', color: '#8B95A1', dot: '⚪', nextEvent: '08:30 준비' };
  }
  return { status: 'closed', labelSimple: '닫힘', color: '#8B95A1', dot: '⚪', nextEvent: '내일 09:00' };
}

function getUSStatus(kstTime: number, dst: boolean): MarketStatus {
  const preOpen = dst ? 17 * 60 : 18 * 60;
  const marketOpen = dst ? 22 * 60 + 30 : 23 * 60 + 30;
  const marketClose = dst ? 5 * 60 : 6 * 60;
  const afterClose = dst ? 9 * 60 : 10 * 60;

  // 본장 (자정 넘김)
  if (kstTime >= marketOpen || kstTime < marketClose) {
    const closeHour = dst ? '05:00' : '06:00';
    return { status: 'open', labelSimple: '본장', color: '#16A34A', dot: '🟢', nextEvent: `${closeHour} 마감` };
  }
  // 애프터마켓
  if (kstTime >= marketClose && kstTime < afterClose) {
    return { status: 'extended', labelSimple: '애프터', color: '#F59E0B', dot: '🟡', nextEvent: '곧 종료' };
  }
  // 프리마켓
  if (kstTime >= preOpen && kstTime < marketOpen) {
    const openHour = dst ? '22:30' : '23:30';
    return { status: 'preparing', labelSimple: '프리장', color: '#F59E0B', dot: '🟡', nextEvent: `${openHour} 개장` };
  }
  // 닫힘
  const openHour = dst ? '22:30' : '23:30';
  return { status: 'closed', labelSimple: '닫힘', color: '#8B95A1', dot: '⚪', nextEvent: `${openHour} 개장` };
}

export function isUSPreMarket(): boolean {
  const now = new Date();
  if (now.getDay() === 0 || now.getDay() === 6) return false;
  const kstTime = now.getHours() * 60 + now.getMinutes();
  const dst = isDST();
  return getUSStatus(kstTime, dst).labelSimple === '프리장';
}

export function getMarketStatus(): DualMarketStatus {
  const now = new Date();
  const day = now.getDay();
  const kstTime = now.getHours() * 60 + now.getMinutes();
  const dst = isDST();
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) {
    const closed: MarketStatus = { status: 'closed', labelSimple: '쉬는 날', color: '#8B95A1', dot: '⚪', nextEvent: '월요일' };
    return { kr: closed, us: closed, isWeekend: true };
  }

  return {
    kr: getKRStatus(kstTime),
    us: getUSStatus(kstTime, dst),
    isWeekend: false,
  };
}
