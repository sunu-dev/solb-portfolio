'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';

interface UserMenuProps {
  user: User;
  onSignOut: () => void;
}

export default function UserMenu({ user, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
            padding: '8px 0',
            minWidth: '200px',
            zIndex: 60,
          }}
        >
          {/* User info */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F2F4F6' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#191F28' }}>{name}</div>
            {email && (
              <div style={{ fontSize: '12px', color: '#8B95A1', marginTop: '2px' }}>{email}</div>
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
              color: '#333D4B',
              padding: '10px 16px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
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
              color: '#333D4B',
              padding: '10px 16px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}