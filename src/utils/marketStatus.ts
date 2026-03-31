/**
 * 미국 주식 장 상태 (한국시간 기준)
 * 서머타임(3월~11월): ET = KST - 13h
 * 동절기(11월~3월): ET = KST - 14h
 */

interface MarketStatus {
  status: 'open' | 'premarket' | 'afterhours' | 'closed';
  label: string;
  labelSimple: string;
  color: string;
  dot: string;
  nextEvent: string;
}

function isDST(): boolean {
  // 미국 서머타임: 3월 둘째 일요일 ~ 11월 첫째 일요일
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  if (month > 3 && month < 11) return true;
  if (month < 3 || month > 11) return false;
  // 3월: 둘째 일요일 이후면 DST
  if (month === 3) {
    const firstDay = new Date(now.getFullYear(), 2, 1).getDay();
    const secondSunday = firstDay === 0 ? 8 : 15 - firstDay;
    return now.getDate() >= secondSunday;
  }
  // 11월: 첫째 일요일 전이면 DST
  if (month === 11) {
    const firstDay = new Date(now.getFullYear(), 10, 1).getDay();
    const firstSunday = firstDay === 0 ? 1 : 8 - firstDay;
    return now.getDate() < firstSunday;
  }
  return false;
}

export function getMarketStatus(): MarketStatus {
  const now = new Date();
  const kstHour = now.getHours();
  const kstMin = now.getMinutes();
  const kstTime = kstHour * 60 + kstMin; // 분 단위

  const dst = isDST();
  // 한국시간 기준 장 시간 (분)
  const preOpen = dst ? 17 * 60 : 18 * 60;          // 17:00 or 18:00
  const marketOpen = dst ? 22 * 60 + 30 : 23 * 60 + 30; // 22:30 or 23:30
  const marketClose = dst ? 5 * 60 : 6 * 60;        // 05:00 or 06:00 (다음날)
  const afterClose = dst ? 9 * 60 : 10 * 60;        // 09:00 or 10:00 (다음날)

  // 주말 체크
  const day = now.getDay(); // 0=일, 6=토
  if (day === 0 || day === 6) {
    return { status: 'closed', label: '주말 휴장', labelSimple: '쉬는 날', color: '#8B95A1', dot: '⚪', nextEvent: '월요일 개장' };
  }

  // 시간대 판별 (자정을 넘기는 장 시간 처리)
  if (kstTime >= marketOpen || kstTime < marketClose) {
    // 본장 (22:30~05:00 또는 23:30~06:00)
    const closeHour = dst ? '05:00' : '06:00';
    return { status: 'open', label: '미국 장 운영 중', labelSimple: '장 열림', color: '#16A34A', dot: '🟢', nextEvent: `${closeHour} 마감` };
  }
  if (kstTime >= marketClose && kstTime < afterClose) {
    // 애프터마켓
    return { status: 'afterhours', label: '애프터마켓 (연장 거래)', labelSimple: '연장 거래', color: '#F59E0B', dot: '🟡', nextEvent: '곧 마감' };
  }
  if (kstTime >= preOpen && kstTime < marketOpen) {
    // 프리마켓
    const openHour = dst ? '22:30' : '23:30';
    return { status: 'premarket', label: '프리마켓 (사전 거래)', labelSimple: '사전 거래', color: '#F59E0B', dot: '🟡', nextEvent: `${openHour} 개장` };
  }

  // 장 마감 (09:00~17:00 또는 10:00~18:00)
  const openHour = dst ? '22:30' : '23:30';
  return { status: 'closed', label: '미국 장 마감', labelSimple: '장 닫힘', color: '#8B95A1', dot: '⚪', nextEvent: `오늘 ${openHour} 개장` };
}
