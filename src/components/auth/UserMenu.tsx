'use client';

import appUI from '../ui/AppUI.module.css';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { usePortfolioStore } from '@/store/portfolioStore';

interface UserMenuProps {
  user: User;
  onSignOut: () => void;
}

export default function UserMenu({ user, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const portfolioSyncStatus = usePortfolioStore((state) => state.portfolioSyncStatus);

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
    const hasUnsyncedRecords = portfolioSyncStatus !== 'synced';
    const ok = window.confirm(
      hasUnsyncedRecords
        ? '아직 클라우드 동기화가 끝나지 않은 기록이 있어요.\n지금 로그아웃하면 이 기기의 미동기 기록을 잃을 수 있어요. 그래도 로그아웃할까요?'
        : '종목·일일 스냅샷·가져오기 복구 지점은 클라우드에 동기화됐어요.\n로그아웃하면 이 기기의 홈 설정과 기기 전용 기록은 초기화돼요. 로그아웃할까요?',
    );
    if (!ok) return;
    onSignOut();
  }, [onSignOut, portfolioSyncStatus]);

  return (
    <div ref={ref} style={{ position: 'relative', marginLeft: '8px' }}>
      {/* Avatar button */}
      <button className={appUI.iconButton}
        aria-label="계정 메뉴"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{ border: 'none', overflow: 'hidden', background: avatarUrl ? 'transparent' : 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ color: 'var(--text-primary)', fontSize: 'var(--type-label-size)', fontWeight: 650 }}>{initial}</span>
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
          <button className={appUI.textButton}
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent('toggle-settings'));
            }}
            style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', textAlign: 'left', paddingInline: 16 }}
          >
            설정
          </button>

          {/* Sign out */}
          <button className={appUI.textButton}
            onClick={handleSignOut}
            style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', textAlign: 'left', paddingInline: 16 }}
          >
            로그아웃
          </button>

        </div>
      )}
    </div>
  );
}
