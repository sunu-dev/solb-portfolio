import { describe, it, expect } from 'vitest';
import {
  TOUR_STEPS, TOUR_ANCHORS, TOUR_CHAPTERS,
  getChapterSteps, getTourStep,
} from '@/lib/tourRegistry';

/**
 * §6 박제 — 투어 카피에 prescriptive('추천/약점 분석') 누출 금지 + 무결성 불변식.
 * (tourRegistry.ts SSOT. scripts/lint-alerts.mjs ONBOARDING_FORBIDDEN과 같은 어휘를 테스트로도 고정.)
 */
const SEC6_FORBIDDEN = ['새 종목 추천', '종목 추천', '추천해드', '추천받', '약점을 분석', '약점 분석']; // lint-alerts-ignore — §6 테스트 픽스처(금지어를 검사 대상으로 의도 보유)
const TICKER_RE = /^[A-Z]{1,5}$|\.KS$|\.KQ$|^\d{6}$/;

describe('tourRegistry — §6 누출 박제 + 무결성', () => {
  it('모든 스텝 title/desc는 prescriptive 금지어를 담지 않는다 (§6)', () => {
    for (const s of TOUR_STEPS) {
      const text = `${s.title} ${s.desc}`;
      for (const p of SEC6_FORBIDDEN) {
        expect(text.includes(p), `스텝 "${s.id}" 카피에 §6 금지어 "${p}"`).toBe(false);
      }
    }
  });

  it('모든 anchor는 티커/종목코드 패턴이 아니다 (§6)', () => {
    for (const s of TOUR_STEPS) {
      expect(TICKER_RE.test(s.anchor), `anchor가 티커 패턴: ${s.anchor}`).toBe(false);
    }
  });

  it('스텝 id는 유일하다', () => {
    const ids = TOUR_STEPS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('anchor는 유일하다 (TOUR_ANCHORS 크기 = 스텝 수)', () => {
    expect(TOUR_ANCHORS.size).toBe(TOUR_STEPS.length);
  });

  it('모든 스텝의 chapter는 TOUR_CHAPTERS에 정의돼 있다', () => {
    const chapterIds = new Set(TOUR_CHAPTERS.map(c => c.id));
    for (const s of TOUR_STEPS) {
      expect(chapterIds.has(s.chapter), `스텝 "${s.id}"의 chapter "${s.chapter}" 미정의`).toBe(true);
    }
  });

  it('헬퍼(getChapterSteps/getTourStep)가 일관된다', () => {
    expect(getChapterSteps('home').length).toBe(TOUR_STEPS.filter(s => s.chapter === 'home').length);
    expect(getTourStep('ai-hunch')?.anchor).toBe('ai-chok');
    expect(getTourStep('nonexistent')).toBeUndefined();
  });
});
