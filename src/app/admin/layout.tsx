'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import AdminMfa from '@/components/admin/AdminMfa';
import ui from '@/components/ui/AppUI.module.css';

/** Children never mount (or fetch privileged data) before the server confirms AAL2. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { session, loading, signInWithKakao } = useAuth();
  const token = session?.access_token;
  const [check, setCheck] = useState<{ token: string; state: 'ready' | 'mfa' | 'denied' | 'error' } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetch('/api/me/admin', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { if (!controller.signal.aborted) setCheck({ token, state: !data.isAdmin ? 'denied' : data.mfaRequired === false ? 'ready' : 'mfa' }); })
      .catch(() => { if (!controller.signal.aborted) setCheck({ token, state: 'error' }); });
    return () => controller.abort();
  }, [token, attempt]);
  const state = check?.token === token ? check?.state : null;
  if (loading || (token && !state)) return <main style={{ padding: 32 }} aria-live="polite">관리자 인증을 확인하고 있어요.</main>;
  if (!token || state === 'denied') return <main style={{ padding: 32 }}><p>관리자 계정으로 로그인한 뒤 이용할 수 있어요.</p>{!token && <button className={ui.providerButton} onClick={() => void signInWithKakao('/admin')}>카카오로 관리자 로그인</button>}<Link href="/">홈으로</Link></main>;
  if (state === 'error') return <main style={{ padding: 32 }}><p>인증 상태를 확인하지 못했어요.</p><button className={ui.button} type="button" onClick={() => setAttempt(v => v + 1)}>다시 확인</button></main>;
  if (state === 'mfa') return <AdminMfa key={session.user.id} onVerified={async () => {
    // Verify uses the SDK to persist the new AAL2 session; recheck server authority.
    await supabase.auth.getSession();
    setAttempt(v => v + 1);
  }} />;
  return children;
}
