'use client';

import { useState, useEffect } from 'react';
import { Compass, X } from 'lucide-react';
import { logTourEvent } from '@/lib/tourTelemetry';

/**
 * 비로그인 방문자용 둘러보기 진입 배너 (목표 B).
 *
 * 전략회의 결정 #5: 강제 모달 금지 → 홈 상단 1줄 디스미스 가능 배너만. 클릭 시 home 챕터 게스트 투어 실행.
 * page.tsx에서 {!user && <GuestTourBanner />}로 게스트일 때만 렌더. 디스미스는 sessionStorage(세션 한정).
 */

const DISMISS_KEY = 'solb_guest_banner_dismissed';

export default function GuestTourBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(DISMISS_KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const startTour = () => {
    logTourEvent('demo_started', { from: 'banner' });
    window.dispatchEvent(new CustomEvent('solb-tour-run', { detail: { chapter: 'home' } }));
  };

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setShow(false);
  };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 12, marginBottom: 16,
        background: 'var(--brand-primary-light)', border: '1px solid var(--brand-primary-bg)',
      }}
    >
      <Compass size={18} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
      <button
        onClick={startTour}
        style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>주비 처음이세요? </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-primary)' }}>주요 기능 60초 둘러보기 ▶</span>
      </button>
      <button
        onClick={dismiss}
        aria-label="둘러보기 배너 닫기"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 8, flexShrink: 0, lineHeight: 1 }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
