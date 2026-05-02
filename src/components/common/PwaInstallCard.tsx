'use client';

import { useEffect, useState } from 'react';
import { Share, Plus, X } from 'lucide-react';
import { isStandalone, isIOSSafari, type BeforeInstallPromptEvent } from '@/utils/pwa';

/**
 * PWA 설치 유도 카드 — iOS는 수동 가이드, Android/Chrome은 자동 프롬프트.
 *
 * 정책 SSOT: docs/NOTIFICATION_POLICY.md §7
 * iOS Safari는 PWA 설치 후에만 push 알림 도달 → 한국 아이폰 유저(~50%)
 * 푸시 도달률 회복을 위해 명시 안내.
 *
 * - 이미 standalone(설치 완료)이면 렌더 X
 * - 사용자가 닫으면 7일간 다시 안 띄움
 */
export default function PwaInstallCard() {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [iosSafari, setIosSafari] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIosSafari(isIOSSafari());

    // 7일 dismiss 기억
    try {
      const dismissedAt = parseInt(localStorage.getItem('solb_pwa_card_dismissed') || '0', 10);
      if (dismissedAt && Date.now() - dismissedAt < 7 * 24 * 3600 * 1000) {
        setHidden(true);
      }
    } catch { /* silent */ }

    // Android/Chrome 자동 프롬프트 캡처
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleDismiss = () => {
    try { localStorage.setItem('solb_pwa_card_dismissed', String(Date.now())); } catch { /* silent */ }
    setHidden(true);
  };

  const handleAndroidInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  // 설치 완료 / dismiss / 환경 판단 미완 → 안 보임
  if (installed !== false || hidden) return null;
  // iOS Safari도 아니고 install prompt도 없으면 안 보임 (데스크탑 Chrome 등은 주소창에 아이콘 있음)
  if (!iosSafari && !installPrompt) return null;

  return (
    <div
      role="region"
      aria-label="PWA 설치 안내"
      style={{
        position: 'relative',
        padding: '14px 16px',
        borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(49,130,246,0.06), rgba(175,82,222,0.04))',
        border: '1px solid rgba(49,130,246,0.18)',
        marginBottom: 16,
      }}
    >
      <button
        onClick={handleDismiss}
        aria-label="안내 닫기"
        style={{
          position: 'absolute', top: 6, right: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 6, color: 'var(--text-tertiary, #B0B8C1)',
          minWidth: 28, minHeight: 28,
        }}
      >
        <X size={14} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>📲</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
          홈 화면에 추가하면 푸시 알림이 와요
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.6, marginBottom: 10 }}>
        {iosSafari
          ? '아이폰은 홈 화면에 추가해야 푸시 알림을 받을 수 있어요.'
          : '한 번 설치하면 앱처럼 빠르게 열 수 있고, 푸시 알림도 받아요.'}
      </div>

      {iosSafari && (
        <div style={{
          fontSize: 11, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.8,
          padding: '10px 12px', borderRadius: 8,
          background: 'var(--surface, white)',
          border: '1px solid var(--border-light, #F2F4F6)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: 'white',
              background: '#3182F6', borderRadius: 10, padding: '1px 7px',
            }}>1</span>
            <Share size={13} style={{ color: '#3182F6' }} />
            <span>Safari 하단 <b>공유</b> 버튼 누르기</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: 'white',
              background: '#3182F6', borderRadius: 10, padding: '1px 7px',
            }}>2</span>
            <Plus size={13} style={{ color: '#3182F6' }} />
            <span><b>홈 화면에 추가</b> 선택</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: 'white',
              background: '#3182F6', borderRadius: 10, padding: '1px 7px',
            }}>3</span>
            <span>홈 화면 아이콘으로 앱 열기 → 알림 켜기</span>
          </div>
        </div>
      )}

      {installPrompt && !iosSafari && (
        <button
          onClick={handleAndroidInstall}
          style={{
            width: '100%', padding: '10px', borderRadius: 10,
            background: '#3182F6', color: 'white', border: 'none',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          📥 앱으로 설치하기
        </button>
      )}
    </div>
  );
}
