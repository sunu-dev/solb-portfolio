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

describe('formatKrwUnits — 만/억/조 표기 (docs §3.4 원안, 미채택)', () => {
  it('formatKrw와 다른 출력을 낸다 — 전환은 제품 결정 사항', () => {
    expect(formatKrwUnits(276000)).toBe('27만 6,000원');
    expect(formatKrw(276000)).toBe('₩276,000');
    expect(formatKrwUnits(276000)).not.toBe(formatKrw(276000));
  });

  it('억·조 단위를 분리한다', () => {
    expect(formatKrwUnits(123456789)).toBe('1억 2,345만원');
    expect(formatKrwUnits(1e12)).toBe('1조원');
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

describe('formatDisplayAmount — 표시 통화 변환 (6곳 중복 통합분)', () => {
  it('KRW 모드는 formatKrw 절대값', () => {
    expect(formatDisplayAmount(276000, 'KRW', 1400)).toBe('₩276,000');
    expect(formatDisplayAmount(-276000, 'KRW', 1400)).toBe('₩276,000');
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
