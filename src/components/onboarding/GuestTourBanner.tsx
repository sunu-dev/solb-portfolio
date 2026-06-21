'use client';

import { useState, useEffect } from 'react';
import { Compass, X } from 'lucide-react';
import { logTourEvent } from '@/lib/tourTelemetry';
import { usePortfolioStore } from '@/store/portfolioStore';

/**
 * 비로그인 방문자 둘러보기 진입 + 체험 모드 인디케이터 (목표 B).
 *
 * 2상태:
 * - 진입(데모 없음): "샘플로 둘러보기" → loadGuestDemo(샘플 보유 주입)+demo_started/sample_loaded+home 게스트 투어.
 * - 체험 모드(데모 활성): "체험 모드 · 로그인하면 내 종목으로" + 로그인 CTA. ×=clearGuestDemo(체험 종료).
 *
 * 데모는 demo:true라 partialize 제외(세션 한정)·서버 미동기화·로그인 시 clearGuestDemo. page.tsx에서 {!user && !authLoading}.
 */

const DISMISS_KEY = 'solb_guest_banner_dismissed';

const bannerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '10px 14px', borderRadius: 12, marginBottom: 16,
  background: 'var(--brand-primary-light)', border: '1px solid var(--brand-primary-bg)',
};

const closeBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 8, flexShrink: 0, lineHeight: 1,
};

export default function GuestTourBanner() {
  const demoActive = usePortfolioStore(s => s.stocks.investing.some(st => st.demo));
  const loadGuestDemo = usePortfolioStore(s => s.loadGuestDemo);
  const clearGuestDemo = usePortfolioStore(s => s.clearGuestDemo);
  const [checked, setChecked] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try { setDismissed(!!sessionStorage.getItem(DISMISS_KEY)); } catch { /* ignore */ }
    setChecked(true);
  }, []);

  if (!checked) return null;
  // 체험 모드 중엔 디스미스와 무관하게 항상 표시(데모 상태 명시). 아니면 디스미스 전까지 진입 배너.
  if (!demoActive && dismissed) return null;

  const startDemo = () => {
    logTourEvent('demo_started', { from: 'banner' });
    loadGuestDemo();
    logTourEvent('demo_sample_loaded');
    window.dispatchEvent(new CustomEvent('solb-tour-run', { detail: { chapter: 'home' } }));
  };

  if (demoActive) {
    return (
      <div style={bannerStyle}>
        <span style={{ fontSize: 17, flexShrink: 0 }}>🧪</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>체험 모드 · 샘플 데이터예요. </span>
          <button
            onClick={() => { logTourEvent('demo_to_login', { from: 'demo-banner' }); window.dispatchEvent(new CustomEvent('open-login')); }}
            style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            로그인하면 내 종목으로 시작 →
          </button>
        </div>
        <button onClick={() => clearGuestDemo()} aria-label="체험 모드 종료" style={closeBtnStyle}>
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div style={bannerStyle}>
      <Compass size={18} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
      <button
        onClick={startDemo}
        style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>주비 처음이세요? </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-primary)' }}>샘플로 60초 둘러보기 ▶</span>
      </button>
      <button
        onClick={() => { try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ } setDismissed(true); }}
        aria-label="둘러보기 배너 닫기"
        style={closeBtnStyle}
      >
        <X size={16} />
      </button>
    </div>
  );
}
