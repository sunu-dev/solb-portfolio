'use client';

import { useState, useEffect, useCallback } from 'react';
import { logApiCall } from '@/lib/apiLogger';

/**
 * 본 화면 진입 후 핵심 기능 위치를 안내하는 코치마크 투어.
 *
 * 작동:
 * - localStorage 'solb_tour_pending' 있으면 자동 시작 (온보딩 완료 직후)
 * - window 'open-tour' 이벤트로 수동 시작 (도움말 버튼)
 * - 완료/스킵 시 'solb_tour_done' 기록
 *
 * 타겟 요소는 컴포넌트에 data-tour="key" 속성으로 마킹.
 */

interface TourStep {
  target: string;
  title: string;
  desc: string;
  position?: 'top' | 'bottom';
}

const TOUR_STEPS: TourStep[] = [
  { target: 'macro-strip',       title: '오늘의 시장',       desc: '미국·한국 주요 지수와 환율, 공포지수를 한 번에 확인할 수 있어요.', position: 'bottom' },
  { target: 'portfolio-section', title: '내 종목 한 줄 요약', desc: '오늘 가장 큰 움직임, 52주 위치, 멘토 점수까지 한 줄로 요약해드려요.', position: 'bottom' },
  { target: 'ai-chok',           title: 'AI 촉 — 매일 새 종목', desc: '매일 1번 새 종목 3개를 추천받을 수 있어요. 로그인 사용자 무료.', position: 'top' },
  { target: 'help-button',       title: '도움말',           desc: '언제든 ❓ 버튼으로 가이드를 다시 볼 수 있어요.', position: 'bottom' },
];

const TARGET_NOT_FOUND_DELAY = 600; // 타겟 못 찾으면 다음 step으로 (lazy 마운트 컴포넌트 대응)

export default function CoachMark() {
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);

  const start = useCallback(() => {
    setStepIdx(0);
    setActive(true);
    logApiCall('tour_started');
  }, []);

  const finish = useCallback(() => {
    logApiCall('tour_completed');
    try { localStorage.setItem('solb_tour_done', '1'); } catch { /* ignore */ }
    setActive(false);
    setBox(null);
  }, []);

  const skip = useCallback(() => {
    logApiCall('tour_skipped', String(stepIdx));
    try { localStorage.setItem('solb_tour_done', '1'); } catch { /* ignore */ }
    setActive(false);
    setBox(null);
  }, [stepIdx]);

  const next = useCallback(() => {
    logApiCall('tour_step', String(stepIdx));
    if (stepIdx < TOUR_STEPS.length - 1) {
      setStepIdx(s => s + 1);
    } else {
      finish();
    }
  }, [stepIdx, finish]);

  // 마운트 시 자동 시작 + 'open-tour' 리스너
  useEffect(() => {
    try {
      const pending = localStorage.getItem('solb_tour_pending');
      if (pending) {
        localStorage.removeItem('solb_tour_pending');
        const t = setTimeout(start, 600);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, [start]);

  useEffect(() => {
    const handler = () => start();
    window.addEventListener('open-tour', handler);
    return () => window.removeEventListener('open-tour', handler);
  }, [start]);

  // step 변경 시 target element 위치 계산
  useEffect(() => {
    if (!active) return;
    const step = TOUR_STEPS[stepIdx];
    let cancelled = false;

    const locate = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (!el) {
        // 타겟 없으면 다음 step (helper 보장)
        const t = setTimeout(() => {
          if (cancelled) return;
          if (stepIdx < TOUR_STEPS.length - 1) setStepIdx(s => s + 1);
          else finish();
        }, TARGET_NOT_FOUND_DELAY);
        return () => clearTimeout(t);
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      // 스크롤 끝난 후 위치 계산
      const t = setTimeout(() => {
        if (cancelled) return;
        setBox(el.getBoundingClientRect());
      }, 450);
      return () => clearTimeout(t);
    };

    const cleanup = locate();
    return () => { cancelled = true; cleanup?.(); };
  }, [active, stepIdx, finish]);

  // 윈도우 리사이즈/스크롤 시 위치 갱신
  useEffect(() => {
    if (!active) return;
    const update = () => {
      const step = TOUR_STEPS[stepIdx];
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) setBox(el.getBoundingClientRect());
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
    };
  }, [active, stepIdx]);

  if (!active || !box) return null;

  const step = TOUR_STEPS[stepIdx];
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
  const TOOLTIP_WIDTH = Math.min(320, vw - 32);
  const ttLeft = Math.max(16, Math.min(vw - TOOLTIP_WIDTH - 16, box.left));

  // position: top 이면 box.top 위, 아니면 box.bottom 아래
  const ttStyle: React.CSSProperties = step.position === 'top'
    ? { bottom: Math.max(16, vh - box.top + 12) }
    : { top: Math.min(vh - 200, box.bottom + 12) };

  return (
    <>
      {/* Overlay (클릭 시 스킵) */}
      <div
        onClick={skip}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.45)',
        }}
        aria-hidden
      />
      {/* Highlight ring */}
      <div
        style={{
          position: 'fixed', zIndex: 201, pointerEvents: 'none',
          top: box.top - 6, left: box.left - 6,
          width: box.width + 12, height: box.height + 12,
          borderRadius: 14,
          border: '3px solid #3182F6',
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
          padding: 18, borderRadius: 14, background: '#fff',
          boxShadow: '0 16px 40px rgba(0,0,0,0.22)',
        }}
        role="dialog"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#8B95A1' }}>
            {stepIdx + 1} / {TOUR_STEPS.length}
          </span>
          <button
            onClick={skip}
            aria-label="투어 닫기"
            style={{ fontSize: 18, color: '#B0B8C1', background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#191F28', marginBottom: 8 }}>
          {step.title}
        </div>
        <div style={{ fontSize: 13, color: '#4E5968', lineHeight: 1.6, marginBottom: 16 }}>
          {step.desc}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={skip}
            style={{ fontSize: 12, color: '#8B95A1', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
          >
            건너뛰기
          </button>
          <button
            onClick={next}
            style={{ padding: '9px 20px', borderRadius: 8, background: '#3182F6', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            {stepIdx < TOUR_STEPS.length - 1 ? '다음 →' : '완료'}
          </button>
        </div>
      </div>
    </>
  );
}
