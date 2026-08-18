/**
 * 표시 포맷 SSOT — 금액·비율·부호·손익색.
 *
 * 정책: docs/KOREAN_UI_SYSTEM.md §3.4
 *
 * ## 왜 이 파일이 이렇게 생겼나 (2026-08-18 통합)
 *
 * 이 모듈은 원래 "한국어 숫자·통화 포맷 SSOT"로 선언돼 있었지만 **import가 0건**이었다.
 * 실제로 화면에 쓰이던 것은 규칙이 다른 `src/utils/formatKRW.ts`(15곳)였고,
 * 그 위에 컴포넌트 로컬 래퍼 12개와 raw `toLocaleString` 82곳이 얹혀 있었다.
 * 즉 표시 규칙이 3계층으로 갈라진 채 "SSOT가 있다"고 문서에만 적혀 있었다.
 *
 * 통합 원칙: **실제 배포된 표기를 정답으로 삼는다.** 화면에 보이는 숫자를 바꾸는 것은
 * 리팩터가 아니라 제품 결정이므로, 여기서는 구조만 합치고 출력은 그대로 보존했다.
 * 문서 §3.4의 만/억/조 표기안은 `formatKrwUnits()`로 살려뒀다(미채택 상태).
 */

// ─── 금액 (KRW) ─────────────────────────────────────────────────────────────

export interface FormatKrwOptions {
  /** ₩ 접두어 (기본 true) */
  prefix?: boolean;
  /** 접미어 (예: "원") */
  suffix?: string;
  /** 10억 이상 억 축약 (기본 true). false면 항상 풀숫자 */
  short?: boolean;
}

/**
 * 원화 표시 — **현재 서비스가 실제로 쓰는 규칙**.
 *
 * - 10억 미만: 풀숫자 + 콤마 (`₩276,000`)
 * - 10억 이상: 억 축약 (`₩15억`)
 * - 음수: `-₩3,200,000`
 */
export function formatKrw(val: number, opts?: FormatKrwOptions): string {
  if (!isFinite(val) || isNaN(val)) return opts?.prefix !== false ? '₩0' : '0';

  const prefix = opts?.prefix !== false ? '₩' : '';
  const suffix = opts?.suffix || '';
  const short = opts?.short !== false;
  const sign = val < 0 ? '-' : '';
  const abs = Math.abs(val);

  if (short && abs >= 1_000_000_000) {
    const v = Math.abs(val / 100_000_000);
    const formatted = v >= 10 ? Math.round(v).toLocaleString() : v.toFixed(1);
    return `${sign}${prefix}${formatted}억${suffix}`;
  }

  return `${sign}${prefix}${Math.round(abs).toLocaleString()}${suffix}`;
}

/** 공간 제약 표시용(히트맵·테이블 셀). 현재는 formatKrw와 동일 규칙. */
export function formatKrwShort(val: number): string {
  return formatKrw(val, { prefix: true });
}

/** 변동 금액 — 양수에 `+` 부착 (`+₩2,684` / `-₩1,200`) */
export function formatKrwChange(val: number): string {
  const sign = val >= 0 ? '+' : '';
  return `${sign}${formatKrw(val)}`;
}

/**
 * 만/억/조 한국어 단위 표기 — **서술·요약 경로의 표준** (2026-08-18 채택).
 *
 * `₩123,456,789`에서 자릿수를 세어 "1억 2천만원대"를 파악하는 인지 부하가 실재한다.
 * 한국 개인투자자 대상이면 만/억 표기가 확실히 빠르게 읽힌다.
 *
 * **정밀도**: 1억 미만은 완전 정확(`5만 3,900원` = 53,900). 1억 이상은 만 단위로 **반올림**한다
 * (원래 구현은 `Math.floor`라 항상 실제보다 작게 표시되는 체계적 편향이 있었다).
 * 참고로 현행 `formatKrw`의 10억 축약(`₩12억`)은 3,456만원을 버리므로, 이쪽이 오히려 더 정확하다.
 *
 * **어디에 쓰나**: `formatDisplayAmount`를 통해 이야기·회고·브리핑·차트 요약에만 적용된다.
 * 사용자가 숫자를 **검증**하는 화면(보유 테이블·평단·편집 모달·알림 detail)은 `formatKrw` 정확 표기를 쓴다.
 */
export function formatKrwUnits(value: number): string {
  if (!Number.isFinite(value)) return '0원';
  const sign = value < 0 ? '−' : '';
  const abs0 = Math.abs(Math.round(value));

  if (abs0 >= 1e12) {
    // 억 단위 반올림 후 분해 — 나눠서 반올림하면 자리올림(9999억→1조)이 자연히 처리된다.
    const abs = Math.round(abs0 / 1e8) * 1e8;
    const jo = Math.floor(abs / 1e12);
    const eok = Math.floor((abs % 1e12) / 1e8);
    return eok > 0 ? `${sign}${jo}조 ${eok.toLocaleString('ko-KR')}억원` : `${sign}${jo}조원`;
  }
  if (abs0 >= 1e8) {
    // 만 단위 반올림 후 분해
    const abs = Math.round(abs0 / 1e4) * 1e4;
    const jo = Math.floor(abs / 1e12);
    if (jo > 0) {
      const eok = Math.floor((abs % 1e12) / 1e8);
      return eok > 0 ? `${sign}${jo}조 ${eok.toLocaleString('ko-KR')}억원` : `${sign}${jo}조원`;
    }
    const eok = Math.floor(abs / 1e8);
    const man = Math.floor((abs % 1e8) / 1e4);
    return man > 0 ? `${sign}${eok}억 ${man.toLocaleString('ko-KR')}만원` : `${sign}${eok}억원`;
  }
  if (abs0 >= 1e4) {
    const man = Math.floor(abs0 / 1e4);
    const won = abs0 % 1e4;
    return won > 0 ? `${sign}${man}만 ${won.toLocaleString('ko-KR')}원` : `${sign}${man}만원`;
  }
  return `${sign}${abs0.toLocaleString('ko-KR')}원`;
}

// ─── 금액 (USD) ─────────────────────────────────────────────────────────────

/**
 * 달러 표시 — 콤마 + 소수점 자릿수.
 *
 * 숫자를 주면 min·max를 그 값으로 **고정**한다(`formatUsd(1234.5)` → `$1,234.50`).
 * `{ max }` 만 주면 하한 없이 상한만 건다(`formatUsd(1234.5, { max: 2 })` → `$1,234.5`).
 *
 * 왜 두 형태가 필요한가: 앱에 USD 자릿수 관례가 실제로 셋 있다 —
 * 가격/평단은 2자리 고정, 목표가·수량 표시는 상한만, 합계는 0자리.
 * 통합하면서 표기를 바꾸지 않으려고 셋 다 표현 가능하게 뒀다.
 * (하나로 통일할지는 별도 제품 결정 — TODO 등재.)
 */
export function formatUsd(
  value: number,
  fractionDigits: number | { min?: number; max?: number } = 2,
): string {
  if (!Number.isFinite(value)) return '$0';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const opts = typeof fractionDigits === 'number'
    ? { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }
    : {
      ...(fractionDigits.min !== undefined ? { minimumFractionDigits: fractionDigits.min } : {}),
      ...(fractionDigits.max !== undefined ? { maximumFractionDigits: fractionDigits.max } : {}),
    };
  return `${sign}$${abs.toLocaleString('en-US', opts)}`;
}

// ─── 표시 통화 변환 ─────────────────────────────────────────────────────────

/**
 * USD/KRW 미확인 시 쓰는 임시 환율.
 *
 * ⚠️ 알려진 결함: 환율을 못 받은 상태와 "1,400원"이 구분되지 않아, USD 보유의 원화 평가액이
 * 조용히 틀린 값으로 표시된다. 예전엔 이 상수가 여러 컴포넌트에 흩어져 있어 손댈 수조차 없었다.
 * 여기 한 곳으로 모았으니 "환율 미확인" 상태 표시로 바꾸는 것은 이제 한 군데 수정이다.
 * (감사 후속 TODO — 부분 데이터를 확정 숫자로 렌더하지 않기)
 */
export const DEFAULT_USD_KRW = 1400;

/** macroData에서 USD/KRW를 꺼낸다. 없으면 `DEFAULT_USD_KRW`. */
export function resolveUsdKrw(macroData: Record<string, unknown> | undefined): number {
  const entry = macroData?.['USD/KRW'] as { value?: number } | undefined;
  return entry?.value || DEFAULT_USD_KRW;
}

export type DisplayCurrency = 'KRW' | 'USD';

/**
 * 원화 기준 금액을 **현재 표시 통화**로 렌더한다 — **서술·요약 경로 전용**.
 *
 * 절대값으로 표시한다 — 부호는 호출부가 색·화살표로 표현하는 것이 이 앱의 관례라서다.
 * 통합 전에는 이 로직이 ConversationalTimeline·MonthlyChapter·MorningBriefing·
 * PortfolioValueChart·MonthlyWrapped·ThrowbackCard에 **바이트 단위로 동일하게** 복제돼 있었다.
 *
 * KRW는 만/억 표기(`27만 6,000원`)를 쓴다 — 이야기·회고·브리핑처럼 **훑어보는** 문맥에서
 * `₩276,000`보다 빠르게 읽히기 때문. 사용자가 숫자를 **검증**하는 화면
 * (보유 테이블·평단·편집 모달·알림 detail)은 이 함수를 쓰지 말고 `formatKrw`를 직접 쓴다.
 */
export function formatDisplayAmount(
  krw: number,
  currency: DisplayCurrency,
  usdKrw: number,
): string {
  if (currency === 'KRW') return formatKrwUnits(Math.abs(krw));
  const usd = Math.abs(usdKrw > 0 ? krw / usdKrw : 0);
  return `$${usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** 종목 고유 통화로 가격을 표시 (한국 종목=원화, 그 외=달러) */
export function formatNativeAmount(value: number, nativeCurrency: DisplayCurrency): string {
  return nativeCurrency === 'KRW' ? formatKrw(value) : formatUsd(value);
}

// ─── 비율·부호 ──────────────────────────────────────────────────────────────

/** 퍼센트 — 양수에 `+` 명시 (`+3.21%` / `−1.50%`). 마이너스는 가독성 위해 en-dash. */
export function formatPct(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return '0%';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(fractionDigits)}%`;
}

/** 부호 포함 정수 — 손익·증감 표시 */
export function formatSigned(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toLocaleString('ko-KR')}`;
}

// ─── 손익 색 ────────────────────────────────────────────────────────────────

/**
 * 한국 손익 컬러 (한국 컨벤션: 빨강↑ 파랑↓). docs/KOREAN_UI_SYSTEM.md §3.7
 *
 * **디자인 토큰을 반환한다.** 예전 구현은 `#DC2626`/`#2563EB` 리터럴이었는데
 * 이는 실제 서비스 색(`--color-gain #EF4452` / `--color-loss #3182F6`)과 달랐고,
 * 인라인 hex는 다크모드 allowlist가 적용되지 않는다.
 */
export function pnlColor(value: number): string {
  if (value > 0) return 'var(--color-gain, #EF4452)';
  if (value < 0) return 'var(--color-loss, #3182F6)';
  return 'var(--text-tertiary, #8B95A1)';
}
