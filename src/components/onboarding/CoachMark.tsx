'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { logTourEvent } from '@/lib/tourTelemetry';
import { getChapterSteps, type TourStep, type TourChapterId } from '@/lib/tourRegistry';
import { markChapterDone } from '@/lib/tourProgress';
import { usePortfolioStore, type MainSection } from '@/store/portfolioStore';

/**
 * 챕터형 멀티섹션 코치마크 투어.
 *
 * 시작:
 * - localStorage 'solb_tour_pending'(온보딩 직후) → 'home' core 챕터 자동.
 * - window 'solb-tour-run' {chapter}(둘러보기 시트 선택) → 해당 챕터 재생.
 *   (둘러보기 메뉴의 'open-tour'는 TourChapterSheet가 받아 챕터 선택 시트를 띄움)
 *
 * 엔진: step.section ≠ 현재 탭이면 setCurrentSection으로 탭 전환 후 앵커를 폴링(탭 전환·lazy 마운트 대응).
 *   종료 시 원래 보던 탭으로 복원. 앵커 타임아웃 시 tour_anchor_missing 계측 후 다음 step.
 *   data-tour ↔ 레지스트리 anchor 일치는 lint:tour-anchors가 빌드에서 강제.
 */

const POLL_INTERVAL = 120;
const POLL_MAX_TRIES = 24;   // ~2.9s — 탭 전환 + lazy 마운트 여유
const SCROLL_SETTLE = 350;   // scrollIntoView 후 위치 측정 지연

export default function CoachMark() {
  const [active, setActive] = useState(false);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const originalSection = useRef<MainSection | null>(null);
  const chapterRef = useRef<TourChapterId | null>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  const start = useCallback((chapter: TourChapterId) => {
    // 재진입 가드 — 진행 중 투어가 있으면 무시(originalSection이 전환된 탭으로 덮여 복원 깨지는 것 방지)
    if (originalSection.current !== null) return;
    const chapterSteps = getChapterSteps(chapter);
    if (!chapterSteps.length) return;
    originalSection.current = usePortfolioStore.getState().currentSection;
    chapterRef.current = chapter;
    setSteps(chapterSteps);
    setStepIdx(0);
    setBox(null);
    setActive(true);
    logTourEvent('tour_started', { chapter });
  }, []);

  // 투어 시작 전 보던 탭으로 복원
  const restoreSection = useCallback(() => {
    const orig = originalSection.current;
    if (orig && usePortfolioStore.getState().currentSection !== orig) {
      usePortfolioStore.getState().setCurrentSection(orig);
    }
    originalSection.current = null;
  }, []);

  const finish = useCallback(() => {
    logTourEvent('tour_completed', { chapter: chapterRef.current ?? '' });
    if (chapterRef.current) markChapterDone(chapterRef.current);
    try { localStorage.setItem('solb_tour_done', '1'); } catch { /* ignore */ }
    setActive(false);
    setBox(null);
    restoreSection();
  }, [restoreSection]);

  const skip = useCallback(() => {
    logTourEvent('tour_skipped', { step: stepIdx, chapter: chapterRef.current ?? '' });
    try { localStorage.setItem('solb_tour_done', '1'); } catch { /* ignore */ }
    setActive(false);
    setBox(null);
    restoreSection();
  }, [stepIdx, restoreSection]);

  const next = useCallback(() => {
    logTourEvent('tour_step', { step: stepIdx, chapter: chapterRef.current ?? '' });
    if (stepIdx < steps.length - 1) setStepIdx(s => s + 1);
    else finish();
  }, [stepIdx, steps.length, finish]);

  // 온보딩 직후 자동 시작 (home core 챕터)
  useEffect(() => {
    try {
      if (localStorage.getItem('solb_tour_pending')) {
        localStorage.removeItem('solb_tour_pending');
        const t = setTimeout(() => start('home'), 600);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, [start]);

  // 둘러보기 시트에서 챕터 선택 → 해당 챕터 실행
  useEffect(() => {
    const handler = (e: Event) => {
      const chapter = (e as CustomEvent).detail?.chapter as TourChapterId | undefined;
      if (chapter) start(chapter);
    };
    window.addEventListener('solb-tour-run', handler);
    return () => window.removeEventListener('solb-tour-run', handler);
  }, [start]);

  // step 변경 시: 탭 전환 + 앵커 폴링 + 위치 계산
  useEffect(() => {
    if (!active) return;
    const step = steps[stepIdx];
    if (!step) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // 1) 필요 시 탭 전환 — 전환 중엔 이전 위치 숨김(백드롭만)
    const store = usePortfolioStore.getState();
    if (step.section !== store.currentSection) {
      store.setCurrentSection(step.section);
      setBox(null);
    }

    // 2) 앵커 폴링 (탭 전환·lazy 마운트 대응)
    let tries = 0;
    const poll = () => {
      if (cancelled) return;
      const el = document.querySelector(`[data-tour="${step.anchor}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        timer = setTimeout(() => { if (!cancelled) setBox(el.getBoundingClientRect()); }, SCROLL_SETTLE);
        return;
      }
      tries += 1;
      if (tries >= POLL_MAX_TRIES) {
        // 앵커 미마운트 — 무음 skip 대신 계측(이탈 vs 미마운트 구분)
        logTourEvent('tour_anchor_missing', { anchor: step.anchor, step: stepIdx });
        if (stepIdx < steps.length - 1) setStepIdx(s => s + 1);
        else finish();
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL);
    };
    timer = setTimeout(poll, 60); // 탭 전환 DOM 반영 여유

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [active, stepIdx, steps, finish]);

  // 윈도우 리사이즈/스크롤 시 위치 갱신
  useEffect(() => {
    if (!active) return;
    const update = () => {
      const step = steps[stepIdx];
      if (!step) return;
      const el = document.querySelector(`[data-tour="${step.anchor}"]`);
      if (el) setBox(el.getBoundingClientRect());
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
    };
  }, [active, stepIdx, steps]);

  // a11y: Esc로 종료
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') skip(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, skip]);

  // a11y: 스텝 준비되면 '다음' 버튼에 포커스
  useEffect(() => {
    if (active && box) nextBtnRef.current?.focus();
  }, [active, box, stepIdx]);

  if (!active) return null;

  const step = steps[stepIdx];
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
  const TOOLTIP_WIDTH = Math.min(320, vw - 32);

  // box·step 준비 전(탭 전환/폴링 중)엔 백드롭만 유지 — 화면 dim 상태로 로딩 신호
  const ready = !!box && !!step;
  const ttLeft = box ? Math.max(16, Math.min(vw - TOOLTIP_WIDTH - 16, box.left)) : 16;
  const ttStyle: React.CSSProperties = box && step?.position === 'top'
    ? { bottom: Math.max(16, vh - box.top + 12) }
    : { top: box ? Math.min(vh - 200, box.bottom + 12) : 16 };

  return (
    <>
      {/* Overlay — 준비됐을 때만 클릭=스킵(로딩 중 오탭으로 투어 중단 방지) */}
      <div
        onClick={ready ? skip : undefined}
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)' }}
        aria-hidden
      />
      {/* 로딩(탭 전환/폴링) 구간 — 빈 백드롭 대신 최소 안내 + 건너뛰기 */}
      {!ready && (
        <div
          role="status"
          style={{
            position: 'fixed', zIndex: 202, left: '50%', bottom: 28, transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px', borderRadius: 999, background: 'var(--surface)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>둘러보는 중…</span>
          <button
            onClick={skip}
            style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
          >
            건너뛰기
          </button>
        </div>
      )}
      {ready && box && step && (
        <>
          {/* Highlight ring */}
          <div
            style={{
              position: 'fixed', zIndex: 201, pointerEvents: 'none',
              top: box.top - 6, left: box.left - 6,
              width: box.width + 12, height: box.height + 12,
              borderRadius: 14,
              border: '3px solid var(--brand-primary)',
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
              transition: 'all 0.3s ease',
            }}
            aria-hidden
          />
          {/* Tooltip */}
          <div
            style={{
              position: 'fixed', zIndex: 202,
              left: ttLeft, ...ttStyle,
              width: TOOLTIP_WIDTH,
              padding: 18, borderRadius: 14, background: 'var(--surface)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.22)',
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="solb-tour-title"
            aria-describedby="solb-tour-desc"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {stepIdx + 1} / {steps.length}
              </span>
              <button
                onClick={skip}
                aria-label="투어 닫기"
                style={{ fontSize: 18, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <div id="solb-tour-title" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              {step.title}
            </div>
            <div id="solb-tour-desc" style={{ fontSize: 13, color: 'var(--text-body)', lineHeight: 1.6, marginBottom: 16 }}>
              {step.desc}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={skip}
                style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
              >
                건너뛰기
              </button>
              <button
                ref={nextBtnRef}
                onClick={next}
                style={{ padding: '9px 20px', borderRadius: 8, background: 'var(--brand-primary)', color: 'var(--on-brand-fg)', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {stepIdx < steps.length - 1 ? '다음 →' : '완료'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
