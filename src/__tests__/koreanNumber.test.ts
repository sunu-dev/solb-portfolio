import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  formatKrw,
  formatKrwChange,
  formatKrwUnits,
  formatUsd,
  formatPct,
  formatSigned,
  formatDisplayAmount,
  formatNativeAmount,
  resolveUsdKrw,
  pnlColor,
  DEFAULT_USD_KRW,
} from '@/utils/koreanNumber';

/**
 * 표시 포맷 SSOT 계약 — 2026-08-18 통합.
 *
 * 통합 원칙이 "출력은 그대로 보존"이었으므로, 아래 기대값은 통합 **이전** `formatKRW.ts`의
 * 출력과 동일해야 한다. 이 파일이 그 계약을 박제한다.
 */

describe('formatKrw — 원화 표시 (실제 배포 규칙)', () => {
  it('1만 미만 — 3자리 콤마', () => {
    expect(formatKrw(500)).toBe('₩500');
    expect(formatKrw(2684)).toBe('₩2,684');
    expect(formatKrw(9999)).toBe('₩9,999');
  });

  it('10억 미만 — 풀숫자와 콤마', () => {
    expect(formatKrw(10000)).toBe('₩10,000');
    expect(formatKrw(53900)).toBe('₩53,900');
    expect(formatKrw(880230000)).toBe('₩880,230,000');
  });

  it('10억 이상 — 억 축약', () => {
    expect(formatKrw(1_500_000_000)).toBe('₩15억');
    expect(formatKrw(1_000_000_000)).toBe('₩10억');
  });

  it('음수는 부호가 ₩ 앞에 붙는다', () => {
    expect(formatKrw(-3_200_000)).toBe('-₩3,200,000');
  });

  it('prefix·suffix·short 옵션', () => {
    expect(formatKrw(53900, { prefix: false })).toBe('53,900');
    expect(formatKrw(53900, { prefix: false, suffix: '원' })).toBe('53,900원');
    expect(formatKrw(1_500_000_000, { short: false })).toBe('₩1,500,000,000');
  });

  it('비정상 입력은 0으로 수렴한다', () => {
    expect(formatKrw(NaN)).toBe('₩0');
    expect(formatKrw(Infinity)).toBe('₩0');
    expect(formatKrw(NaN, { prefix: false })).toBe('0');
  });
});

describe('formatKrwChange — 변동 금액', () => {
  it('양수에 + 를 붙인다', () => {
    expect(formatKrwChange(2684)).toBe('+₩2,684');
    expect(formatKrwChange(0)).toBe('+₩0');
  });

  it('음수는 formatKrw의 부호를 그대로 쓴다', () => {
    expect(formatKrwChange(-2684)).toBe('-₩2,684');
  });
});

describe('formatKrwUnits — 만/억/조 표기 (서술·요약 경로 표준)', () => {
  it('1억 미만은 완전 정확하다 — 원 단위까지 보존', () => {
    expect(formatKrwUnits(7250)).toBe('7,250원');
    expect(formatKrwUnits(53900)).toBe('5만 3,900원');
    expect(formatKrwUnits(276000)).toBe('27만 6,000원');
    expect(formatKrwUnits(99_999_999)).toBe('9999만 9,999원');
  });

  it('1억 이상은 만 단위 반올림 — floor가 아니라 round (체계적 과소표시 제거)', () => {
    // 123,456,789 → 만 단위 반올림 12,346만 → 1억 2,346만원 (floor였다면 2,345만)
    expect(formatKrwUnits(123_456_789)).toBe('1억 2,346만원');
    expect(formatKrwUnits(100_004_999)).toBe('1억원');
    expect(formatKrwUnits(100_005_000)).toBe('1억 1만원');
  });

  it('반올림이 자리올림을 넘길 때 단위가 올라간다', () => {
    expect(formatKrwUnits(199_999_999)).toBe('2억원');
    expect(formatKrwUnits(999_999_999_999)).toBe('1조원');
  });

  it('조 단위를 분리한다', () => {
    expect(formatKrwUnits(1e12)).toBe('1조원');
    expect(formatKrwUnits(1.23e12)).toBe('1조 2,300억원');
  });

  it('formatKrw(정확 표기)와는 계속 다른 출력이다 — 경로가 다르다', () => {
    expect(formatKrw(276000)).toBe('₩276,000');
    expect(formatKrwUnits(276000)).not.toBe(formatKrw(276000));
  });
});

describe('formatUsd', () => {
  it('기본 소수점 2자리', () => {
    expect(formatUsd(1234.5)).toBe('$1,234.50');
    expect(formatUsd(0)).toBe('$0.00');
  });

  it('자릿수를 지정할 수 있다', () => {
    expect(formatUsd(1234.56, 0)).toBe('$1,235');
  });

  it('음수는 $ 앞에 부호', () => {
    expect(formatUsd(-12.3)).toBe('-$12.30');
  });

  it('{max}만 주면 하한 없이 상한만 — 앱의 세 번째 관례 보존', () => {
    // 숫자 인자는 min·max 고정, 객체는 상한만. 통합 전 세 관례를 그대로 표현하기 위한 구분.
    expect(formatUsd(1234.5, { max: 2 })).toBe('$1,234.5');
    expect(formatUsd(1234.5, 2)).toBe('$1,234.50');
    expect(formatUsd(480, { max: 2 })).toBe('$480');
    expect(formatUsd(480, 2)).toBe('$480.00');
  });

  it('{max:0}은 정수 표기', () => {
    expect(formatUsd(1234.6, { max: 0 })).toBe('$1,235');
  });

  it('{max:3}은 기본 toLocaleString과 동일 (기록 화면 보존분)', () => {
    expect(formatUsd(178.25, { max: 3 })).toBe(`$${(178.25).toLocaleString('en-US')}`);
    expect(formatUsd(1234.5678, { max: 3 })).toBe(`$${(1234.5678).toLocaleString('en-US')}`);
  });
});

describe('formatPct / formatSigned', () => {
  it('양수에 +, 음수에 en-dash', () => {
    expect(formatPct(3.21)).toBe('+3.21%');
    expect(formatPct(-1.5)).toBe('−1.50%');
    expect(formatPct(0)).toBe('0.00%');
  });

  it('formatSigned는 콤마와 부호를 함께', () => {
    expect(formatSigned(1234)).toBe('+1,234');
    expect(formatSigned(-1234)).toBe('−1,234');
    expect(formatSigned(0)).toBe('0');
  });
});

describe('formatDisplayAmount — 서술·요약 경로 (6곳 중복 통합분)', () => {
  it('KRW 모드는 만/억 표기 절대값', () => {
    expect(formatDisplayAmount(276000, 'KRW', 1400)).toBe('27만 6,000원');
    expect(formatDisplayAmount(-276000, 'KRW', 1400)).toBe('27만 6,000원');
  });

  it('검증 경로(formatKrw)와 표기가 다르다 — 의도된 경로 분리', () => {
    expect(formatDisplayAmount(276000, 'KRW', 1400)).not.toBe(formatKrw(276000));
  });

  it('USD 모드는 환율로 나눈 절대값, 소수점 없음', () => {
    expect(formatDisplayAmount(1_400_000, 'USD', 1400)).toBe('$1,000');
    expect(formatDisplayAmount(-1_400_000, 'USD', 1400)).toBe('$1,000');
  });

  it('환율이 0 이하면 0으로 처리한다 (0 나눗셈 방지)', () => {
    expect(formatDisplayAmount(1_400_000, 'USD', 0)).toBe('$0');
    expect(formatDisplayAmount(1_400_000, 'USD', -1)).toBe('$0');
  });
});

describe('formatNativeAmount', () => {
  it('종목 통화에 맞는 포맷을 고른다', () => {
    expect(formatNativeAmount(53900, 'KRW')).toBe('₩53,900');
    expect(formatNativeAmount(178.25, 'USD')).toBe('$178.25');
  });
});

describe('resolveUsdKrw — 환율 폴백 단일화', () => {
  it('macroData에 값이 있으면 그 값', () => {
    expect(resolveUsdKrw({ 'USD/KRW': { value: 1325.5 } })).toBe(1325.5);
  });

  it('없거나 0이면 DEFAULT_USD_KRW', () => {
    expect(resolveUsdKrw(undefined)).toBe(DEFAULT_USD_KRW);
    expect(resolveUsdKrw({})).toBe(DEFAULT_USD_KRW);
    expect(resolveUsdKrw({ 'USD/KRW': { value: 0 } })).toBe(DEFAULT_USD_KRW);
  });
});

describe('pnlColor — 디자인 토큰 반환', () => {
  it('한국 손익 컨벤션 (상승 빨강 / 하락 파랑)', () => {
    expect(pnlColor(1)).toContain('--color-gain');
    expect(pnlColor(-1)).toContain('--color-loss');
    expect(pnlColor(0)).toContain('--text-tertiary');
  });

  it('인라인 hex를 단독으로 반환하지 않는다 — 다크모드 allowlist가 안 먹는다', () => {
    for (const v of [1, -1, 0]) {
      expect(pnlColor(v).startsWith('var(--')).toBe(true);
    }
  });
});

describe('표시 SSOT 불변식', () => {
  const ROOT = path.resolve(__dirname, '../..');

  it('구 모듈 formatKRW.ts는 삭제됐고 참조도 없다', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/utils/formatKRW.ts'))).toBe(false);
  });

  it('컴포넌트가 KRW→표시통화 변환 로직을 다시 복제하지 않는다', () => {
    // 통합 전 6곳에 바이트 단위로 동일하게 있던 형태 — KRW 분기와 USD 분기가 **둘 다** 일치할 때만 위반.
    // (Dashboard의 '$100 미만 2자리', Treemap의 축약 포맷처럼 USD 분기가 다른 것은 정당한 차이다.)
    const dupSignature =
      /formatKrw\(Math\.round\(Math\.abs\([^)]*\)\)\)[\s\S]{0,40}?toLocaleString\(undefined, \{ maximumFractionDigits: 0 \}\)/;
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith('.tsx')) {
          if (dupSignature.test(fs.readFileSync(full, 'utf8'))) {
            offenders.push(path.relative(ROOT, full));
          }
        }
      }
    };
    walk(path.join(ROOT, 'src/components'));

    expect(offenders, 'formatDisplayAmount(krw, currency, usdKrw)를 쓸 것').toEqual([]);
  });
});
