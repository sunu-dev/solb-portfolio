'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

/**
 * 관리자 여부를 **서버에 물어본다**.
 *
 * 예전에는 관리자 화면들이 `ADMIN_EMAILS`/`ADMIN_IDS` 리터럴을 컴포넌트 안에 직접 들고
 * 비교했다. 클라이언트 컴포넌트라 그 값이 빌드 산출물 청크에 실려 **모든 방문자에게
 * 파운더 이메일과 UUID가 노출**됐다(2026-08-18 감사 확인).
 *
 * 이제 목록은 서버(`@/lib/adminAuth`)만 알고, 클라이언트는 결과 boolean만 받는다.
 * 이건 **UI 게이팅용**이다 — 실제 데이터 접근 권한은 각 API 라우트가 서버에서 다시 판정한다.
 */
export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setIsAdmin(false); setLoading(false); return; }

    let cancelled = false;
    (async () => {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        if (!token) { if (!cancelled) { setIsAdmin(false); setLoading(false); } return; }
        const r = await fetch('/api/me/admin', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await r.json().catch(() => ({}));
        if (!cancelled) setIsAdmin(!!json?.isAdmin);
      } catch {
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { isAdmin, loading: loading || authLoading };
}
