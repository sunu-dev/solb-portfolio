'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { usePortfolioStore } from '@/store/portfolioStore';

interface UserMenuProps {
  user: User;
  onSignOut: () => void;
}

export default function UserMenu({ user, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { resetPortfolio } = usePortfolioStore();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handler);
    }
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const avatarUrl = user.user_metadata?.avatar_url;
  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'User';
  const email = user.email || '';
  const initial = (name as string).charAt(0).toUpperCase();

  const handleSignOut = useCallback(() => {
    setOpen(false);
    const ok = window.confirm('로그아웃하면 로컬 데이터가 초기화됩니다.\n데이터는 계정에 안전하게 저장되어 있어 다시 로그인하면 복원돼요.');
    if (!ok) return;
    onSignOut();
  }, [onSignOut]);

  return (
    <div ref={ref} style={{ position: 'relative', marginLeft: '8px' }}>
      {/* Avatar button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          overflow: 'hidden',
          background: avatarUrl ? 'transparent' : '#3182F6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ color: '#fff', fontSize: '13px', fontWeight: 700 }}>{initial}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            background: 'var(--surface, #fff)',
            borderRadius: '12px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
            padding: '8px 0',
            minWidth: '200px',
            zIndex: 60,
          }}
        >
          {/* User info */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>{name}</div>
            {email && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #8B95A1)', marginTop: '2px' }}>{email}</div>
            )}
          </div>

          {/* Settings */}
          <button
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent('toggle-settings'));
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              fontSize: '13px',
              color: 'var(--text-primary, #333D4B)',
              padding: '10px 16px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover, #F9FAFB)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            설정
          </button>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              fontSize: '13px',
              color: 'var(--text-primary, #333D4B)',
              padding: '10px 16px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover, #F9FAFB)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            로그아웃
          </button>

          {/* Account delete */}
          <button
            disabled={deletingAccount}
            onClick={async () => {
              if (!confirm('정말 계정을 삭제하시겠어요?\n\n포트폴리오, 분석 기록 등 모든 데이터가 영구 삭제되며 복구할 수 없습니다.')) return;
              if (!confirm('마지막 확인: 계정 삭제 후에는 되돌릴 수 없어요. 계속하시겠어요?')) return;
              setDeletingAccount(true);
              setOpen(false);
              try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                if (!token) throw new Error('no session');

                const res = await fetch('/api/account/delete', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}` },
                });
                if (!res.ok) {
                  const d = await res.json() as { error?: string };
                  throw new Error(d.error || '삭제 실패');
                }

                // 로컬 상태 초기화 — 중앙화된 헬퍼 사용
                const { clearUserStorage } = await import('@/lib/userStorage');
                clearUserStorage();
                resetPortfolio();
                await supabase.auth.signOut();
                window.location.reload();
              } catch (e) {
                const msg = e instanceof Error ? e.message : '알 수 없는 오류';
                alert(`계정 삭제에 실패했어요: ${msg}`);
                setDeletingAccount(false);
              }
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              fontSize: '13px',
              color: '#EF4452',
              padding: '10px 16px',
              cursor: 'pointer',
              borderTop: '1px solid var(--border-light, #F2F4F6)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover, #FFF0F0)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {deletingAccount ? '삭제 중...' : '계정 삭제'}
          </button>
        </div>
      )}
    </div>
  );
}