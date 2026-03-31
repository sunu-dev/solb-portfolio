'use client';

import { useState, useEffect } from 'react';

export default function OfflineNotice() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    // 초기 상태 확인
    if (!navigator.onLine) setIsOffline(true);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 48,
        left: 0,
        right: 0,
        zIndex: 45,
        background: '#FF9500',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        textAlign: 'center',
        padding: '6px 16px',
      }}
    >
      📡 네트워크 연결이 끊겼어요. 캐시된 데이터를 표시하고 있습니다.
    </div>
  );
}
