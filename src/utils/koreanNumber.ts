/**
 * 한국어 숫자·통화 포맷 SSOT
 *
 * 정책: docs/KOREAN_UI_SYSTEM.md §3.4
 *
 * 한국 통화(KRW)는 만/억/조 단위 한국어 표기, 미국 통화(USD)는 표준 콤마 포맷.
 * 컴포넌트마다 따로 구현하던 산발 포맷을 통합 (Dashboard·MergedHoldingsCard·MorningBriefing 등).
 *
 * 손익 부호: 양수 "+", 음수 "−" (en-dash 가독성), 0 부호 없음.
 *
 * 사용 예:
 *   formatKrw(123456789)  // "1억 2,346만원"
 *   formatKrw(45000)      // "4만 5,000원"
 *   formatUsd(1234.56)    // "$1,234.56"
 *   formatPct(3.21)       // "+3.21%"
 *   formatPct(-1.5)       // "−1.50%"
 *   formatSigned(1234)    // "+1,234"
 */

/** 한국어 원화 포맷 — 만/억/조 단위 자동 분리.
 *
 * 1조 = 10^12, 1억 = 10^8, 1만 = 10^4.
 * 1000만원 미만은 단순 콤마 표기 ("9,876원"), 1000만 이상은 한국어 단위.
 */
export function formatKrw(value: number): string {
  if (!Number.isFinite(value)) return '0원';
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(Math.round(value));

  // 1조 이상
  if (abs >= 1e12) {
    const jo = Math.floor(abs / 1e12);
    const eok = Math.floor((abs % 1e12) / 1e8);
    return eok > 0 ? `${sign}${jo}조 ${eok.toLocaleString('ko-KR')}억원` : `${sign}${jo}조원`;
  }
  // 1억 이상
  if (abs >= 1e8) {
    const eok = Math.floor(abs / 1e8);
    const man = Math.floor((abs % 1e8) / 1e4);
    return man > 0 ? `${sign}${eok}억 ${man.toLocaleString('ko-KR')}만원` : `${sign}${eok}억원`;
  }
  // 1만 이상
  if (abs >= 1e4) {
    const man = Math.floor(abs / 1e4);
    const won = abs % 1e4;
    return won > 0 ? `${sign}${man}만 ${won.toLocaleString('ko-KR')}원` : `${sign}${man}만원`;
  }
  // 1만 미만
  return `${sign}${abs.toLocaleString('ko-KR')}원`;
}

/** 미국 달러 포맷 — 콤마 + 소수점 2자리.
 *
 * fractionDigits 옵션으로 0~2 가변 (큰 금액 1234567 → "$1,234,567" 가능).
 */
export function formatUsd(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return '$0';
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${sign}$${formatted}`;
}

/** 퍼센트 포맷 — 부호 + 소수점 2자리.
 *
 * 양수면 "+" 명시 (손익 부호 일관성).
 */
export function formatPct(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return '0%';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const abs = Math.abs(value);
  return `${sign}${abs.toFixed(fractionDigits)}%`;
}

/** 부호 포함 숫자 — 손익·증감 표시 (en-dash 마이너스). */
export function formatSigned(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const abs = Math.abs(value);
  return `${sign}${abs.toLocaleString('ko-KR')}`;
}

/** 한국 손익 컬러 (한국 컨벤션: 빨강↑ 파랑↓).
 *
 * docs/KOREAN_UI_SYSTEM.md §3.7
 */
export function pnlColor(value: number): string {
  if (value > 0) return '#DC2626'; // 빨강 ↑
  if (value < 0) return '#2563EB'; // 파랑 ↓
  return '#8B95A1';                // 회색 (0 변동)
}
