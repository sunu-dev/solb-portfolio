'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import JoobiLockup from '@/components/brand/JoobiLockup';
import type { User } from '@supabase/supabase-js';
import styles from './InviteGate.module.css';

interface Props {
  user: User;
  onVerified: () => void;
}

export default function InviteGate({ user, onVerified }: Props) {
  const { signOut } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    requestRef.current?.abort();
    if (successTimer.current) clearTimeout(successTimer.current);
  }, [user.id]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim() || loading || success) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (controller.signal.aborted) return;
      const token = session?.access_token;
      if (!token || session.user.id !== user.id) {
        setError('로그인 상태를 확인할 수 없어요. 다시 로그인해주세요.');
        return;
      }
      const response = await fetch('/api/codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: code.trim(), context: 'signup' }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (response.ok && data.valid === true && data.applied === true) {
        setSuccess('초대가 확인됐어요. 주비로 이동해요.');
        successTimer.current = setTimeout(onVerified, 800);
      } else setError(data.error || '코드를 다시 확인해주세요.');
    } catch {
      if (!controller.signal.aborted) setError('초대를 확인하지 못했어요. 연결을 확인하고 다시 시도해주세요.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const leave = () => {
    requestRef.current?.abort();
    if (successTimer.current) clearTimeout(successTimer.current);
    void signOut();
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="invite-title">
        <JoobiLockup variant="modal" />
        <div className={styles.icon}><KeyRound size={24} aria-hidden="true" /></div>
        <h1 id="invite-title">초대 코드를 입력해주세요</h1>
        <p className={styles.intro}>주비는 현재 초대받은 분들과 함께 베타 서비스를 다듬고 있어요. 처음 한 번만 등록하면 돼요.</p>
        <form onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="invite-code">초대 코드</label>
          <input id="invite-code" className={styles.input} value={code}
            onChange={event => { setCode(event.target.value.toUpperCase()); setError(''); }}
            placeholder="받은 초대 코드를 입력해주세요" maxLength={20} disabled={loading || Boolean(success)}
            autoComplete="off" autoCapitalize="characters" spellCheck={false}
            aria-invalid={Boolean(error)} aria-describedby={error ? 'invite-error' : 'invite-help'} />
          <p id="invite-help" className={styles.help}>주비를 소개해준 분에게 받은 코드를 사용해주세요.</p>
          {error && <p id="invite-error" className={styles.error} role="alert">{error}</p>}
          {success && <p className={styles.success} role="status"><Check size={16} aria-hidden="true" />{success}</p>}
          <button className={styles.submit} type="submit" disabled={loading || !code.trim() || Boolean(success)}>
            {loading ? '초대 확인 중…' : success ? '주비로 이동 중…' : '초대 확인하고 시작하기'}
            {!loading && !success && <ArrowRight size={17} aria-hidden="true" />}
          </button>
        </form>
        <div className={styles.other}>
          <p>아직 코드가 없다면 로그인 없이 먼저 둘러볼 수 있어요.</p>
          <button type="button" onClick={leave}>로그아웃하고 둘러보기</button>
          <button type="button" className={styles.secondary} onClick={leave}>다른 계정으로 로그인</button>
        </div>
      </section>
    </main>
  );
}
