import { describe, it, expect } from 'vitest';
import {
  WIDGET_META, NON_HIDEABLE_IDS,
  resolveHidden, resolveWidgetOrder, isWidgetHidden,
} from '@/lib/homeWidgetRegistry';
import { STOCK_KR } from '@/config/constants';

/**
 * §6 박제 — 홈 편집 위젯 id가 종목 티커/코드를 절대 담지 않음을 테스트로 고정.
 * (homeWidgetRegistry.ts §6 화이트리스트 원칙. 누출 시 빨갛게.)
 */
const TICKER_RE = /^[A-Z]{1,5}$|\.KS$|\.KQ$|^\d{6}$/;

describe('homeWidgetRegistry — §6 누출 박제', () => {
  it('모든 위젯 id는 티커/종목코드 패턴이 아니다', () => {
    for (const w of WIDGET_META) {
      expect(TICKER_RE.test(w.id), `위젯 id가 티커 패턴: ${w.id}`).toBe(false);
    }
  });

  it('위젯 id와 STOCK_KR 종목 키의 교집합은 공집합', () => {
    const stockKeys = new Set(Object.keys(STOCK_KR));
    for (const w of WIDGET_META) {
      expect(stockKeys.has(w.id), `위젯 id가 종목 키와 충돌: ${w.id}`).toBe(false);
    }
  });

  it('resolveHidden은 티커·미지 id를 drop하고 hideable만 남긴다', () => {
    const out = resolveHidden(['treemap', 'AAPL', '005930.KS', 'unknown-x', 'broker-block']);
    expect(out).toContain('treemap');
    expect(out).toContain('broker-block');
    expect(out).not.toContain('AAPL');
    expect(out).not.toContain('005930.KS');
    expect(out).not.toContain('unknown-x');
  });

  it('ai-hunch-link은 어떤 hiddenWidgets에도 숨겨지지 않는다 (§6 영구무료 AI촉 발견경로)', () => {
    expect(NON_HIDEABLE_IDS.has('ai-hunch-link')).toBe(true);
    expect(resolveHidden(['ai-hunch-link'])).not.toContain('ai-hunch-link');
    expect(isWidgetHidden('ai-hunch-link', ['ai-hunch-link'])).toBe(false);
  });

  it('resolveWidgetOrder는 티커·타zone를 drop하고 저장순서 우선 + 누락분 tail append', () => {
    const out = resolveWidgetOrder(['monthly-chapter', 'TSLA', 'treemap', 'broker-block'], 'below-core');
    expect(out).not.toContain('TSLA');
    expect(out).not.toContain('treemap'); // analysis zone → below-core에서 제외
    expect(out[0]).toBe('monthly-chapter'); // 저장 순서 우선
    expect(out).toContain('broker-block');
    expect(out).toContain('ai-hunch-link'); // 누락분 defaultOrder로 tail append
  });
});
