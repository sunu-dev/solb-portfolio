'use client';

import { useSyncExternalStore } from 'react';

function subscribeToConnection(onStoreChange: () => void) {
  window.addEventListener('offline', onStoreChange);
  window.addEventListener('online', onStoreChange);
  return () => {
    window.removeEventListener('offline', onStoreChange);
    window.removeEventListener('online', onStoreChange);
  };
}

const getOfflineSnapshot = () => !navigator.onLine;
const getServerOfflineSnapshot = () => false;

export default function OfflineNotice() {
  const isOffline = useSyncExternalStore(
    subscribeToConnection,
    getOfflineSnapshot,
    getServerOfflineSnapshot,
  );

  if (!isOffline) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '48px',
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
      📡 네트워크 연결이 끊겼어요. 캐시된 데이터를 표시하고 있어요.
    </div>
  );
}
