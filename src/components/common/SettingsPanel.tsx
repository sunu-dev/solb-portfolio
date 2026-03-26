'use client';

import { useState, useEffect } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useNotification } from '@/hooks/useNotification';
import { supabase } from '@/lib/supabase';
import { X } from 'lucide-react';

export default function SettingsPanel() {
  const {
    autoRefresh, setAutoRefresh,
    refreshInterval, setRefreshInterval,
  } = usePortfolioStore();
  const { requestPermission } = useNotification();

  const [isOpen, setIsOpen] = useState(false);
  const [intervalSec, setIntervalSec] = useState(String(refreshInterval / 1000));

  // Listen for toggle event from Header
  useEffect(() => {
    const handler = () => setIsOpen(prev => !prev);
    window.addEventListener('toggle-settings', handler);
    return () => window.removeEventListener('toggle-settings', handler);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleUpdateInterval = () => {
    const sec = parseInt(intervalSec);
    if (sec >= 10) {
      setRefreshInterval(sec * 1000);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('전체 초기화할까요? 모든 종목, 설정, 캐시 데이터가 삭제됩니다.')) return;

    // Supabase DB에서도 포트폴리오 삭제
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_portfolios').delete().eq('user_id', user.id);
      }
    } catch { /* 비로그인 사용자 무시 */ }

    // 로컬 데이터 전부 삭제 후 리로드
    localStorage.clear();
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.1)',
          backdropFilter: 'blur(2px)',
          zIndex: 50,
        }}
        onClick={() => setIsOpen(false)}
      />

      {/* Panel - slides from right */}
      <div
        data-settings-panel
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(360px, 100vw)',
          background: 'white',
          zIndex: 50,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #F2F4F6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: '#191F28' }}>설정</span>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F2F4F6')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X style={{ width: 20, height: 20, color: '#4E5968' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* Auto Refresh Toggle Section */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#191F28', marginBottom: 8 }}>
              자동 새로고침
            </div>
            <div style={{ fontSize: 12, color: '#8B95A1', marginBottom: 12 }}>
              활성화 시 주기적으로 시세를 업데이트합니다
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#4E5968' }}>
                {autoRefresh ? '활성' : '비활성'}
              </span>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                style={{
                  position: 'relative',
                  width: 44,
                  height: 24,
                  borderRadius: 9999,
                  border: 'none',
                  background: autoRefresh ? '#34C759' : '#E5E8EB',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: autoRefresh ? 22 : 2,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    transition: 'left 0.2s',
                  }}
                />
              </button>
            </div>
          </div>

          {/* Refresh Interval Section */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#191F28', marginBottom: 8 }}>
              새로고침 간격
            </div>
            <div style={{ fontSize: 12, color: '#8B95A1', marginBottom: 12 }}>
              자동 새로고침 주기를 설정합니다 (최소 10초)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                value={intervalSec}
                onChange={(e) => setIntervalSec(e.target.value)}
                min="10"
                style={{
                  width: 80,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #E5E8EB',
                  fontSize: 14,
                  textAlign: 'center',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: 13, color: '#4E5968' }}>초</span>
              <button
                onClick={handleUpdateInterval}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: 'rgba(49,130,246,0.1)',
                  color: '#3182F6',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(49,130,246,0.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(49,130,246,0.1)')}
              >
                적용
              </button>
            </div>
          </div>

          {/* 알림 설정 */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#191F28', marginBottom: 8 }}>
              알림
            </div>
            <div style={{ fontSize: 12, color: '#8B95A1', marginBottom: 12 }}>
              손절가, 목표가 도달 시 브라우저 알림을 받을 수 있어요.
            </div>
            <button
              onClick={async () => {
                const granted = await requestPermission();
                if (granted) alert('알림이 활성화되었습니다!');
                else alert('알림 권한이 거부되었습니다. 브라우저 설정에서 변경할 수 있어요.');
              }}
              style={{
                width: '100%',
                padding: 12,
                background: '#3182F6',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1B64DA')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#3182F6')}
            >
              알림 허용하기
            </button>
          </div>

          {/* Danger Zone */}
          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #F2F4F6' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#191F28', marginBottom: 8 }}>
              위험 구역
            </div>
            <div style={{ fontSize: 12, color: '#8B95A1', marginBottom: 12 }}>
              이 작업은 되돌릴 수 없습니다
            </div>
            <button
              onClick={handleClearAll}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 10,
                background: 'white',
                color: '#EF4452',
                fontSize: 14,
                fontWeight: 600,
                border: '1px solid #EF4452',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#FFF5F5')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
            >
              전체 데이터 초기화
            </button>
            <div style={{ fontSize: 11, color: '#B0B8C1', textAlign: 'center', marginTop: 8 }}>
              모든 종목, 설정, 캐시 데이터가 삭제됩니다
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
