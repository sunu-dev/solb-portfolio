'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { adminMfaSetup, adminMfaError } from '@/lib/adminMfaSetup';
import { supabase } from '@/lib/supabase';
import ui from '@/components/ui/AppUI.module.css';
import styles from './AdminMfa.module.css';

type Factor = { id: string; friendly_name?: string };
export default function AdminMfa({ onVerified }: { onVerified: () => Promise<void> }) {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState('');
  const [enrollment, setEnrollment] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [emailReady, setEmailReady] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.user) { setError('인증 앱 정보를 불러오지 못했어요. 다시 확인해 주세요.'); return; }
      setProfileLoaded(true);
      const setup = adminMfaSetup(data.user);
      setFactors(setup.factors);
      setFactorId(setup.factors[0]?.id ?? '');
      setEmailReady(setup.emailReady);
      setEmailSent(Boolean(setup.pendingEmail));
      if (setup.pendingEmail) setEmail(setup.pendingEmail);
      setError('');
    }).catch(() => { if (active) setError('인증 서버에 연결하지 못했어요.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  async function connectEmail(event: FormEvent) {
    event.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true); setError('');
    try {
      const result = await supabase.auth.updateUser({ email: email.trim() }, {
        emailRedirectTo: new URL('/admin', window.location.origin).toString(),
      });
      if (result.error) throw result.error;
      setEmailSent(true);
    } catch (cause) {
      setError(adminMfaError(cause, '확인 메일을 보내지 못했어요. 주소를 확인하고 잠시 후 다시 시도해 주세요.'));
    } finally { setBusy(false); }
  }

  async function enroll() {
    setBusy(true); setError('');
    try {
      const profile = await supabase.auth.getUser();
      if (profile.error) throw profile.error;
      if (!profile.data.user || !adminMfaSetup(profile.data.user).emailReady) {
        setEmailReady(false);
        setError('이메일 주소를 먼저 확인한 뒤 인증 앱을 등록할 수 있어요.');
        return;
      }
      // Clean only abandoned enrollments owned by this UI, never verified factors.
      const listed = await supabase.auth.mfa.listFactors();
      if (listed.error) throw listed.error;
      if (listed.data.totp.length) { setFactors(listed.data.totp); setFactorId(listed.data.totp[0].id); return; }
      for (const factor of listed.data.all) {
        if (factor.factor_type === 'totp' && factor.status === 'unverified' && ['Joobi admin', '주비 관리자'].includes(factor.friendly_name ?? '')) {
          const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
          if (removed.error) throw removed.error;
        }
      }
      const result = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: '주비 관리자', issuer: '주비 관리자' });
      if (result.error) throw result.error;
      setFactorId(result.data.id);
      setEnrollment({ qr: result.data.totp.qr_code, secret: result.data.totp.secret });
    } catch (cause) { setError(adminMfaError(cause, '인증 앱 등록을 시작하지 못했어요. 다시 확인한 뒤 시도해 주세요.')); }
    finally { setBusy(false); }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (busy || !factorId || !/^\d{6}$/.test(code)) return;
    setBusy(true); setError('');
    try {
      const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (result.error) throw result.error;
      setCode(''); setEnrollment(null);
      await onVerified();
    } catch { setCode(''); setError('인증하지 못했어요. 앱의 새 6자리 코드와 기기 시간을 확인한 뒤 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }

  return <main className={styles.shell}>
    <section className={styles.card} aria-labelledby="admin-mfa-title">
      <p className={styles.eyebrow}>주비 관리자 보안</p>
      <h1 id="admin-mfa-title">2단계 인증</h1>
      <p>관리자 기능을 사용하려면 인증 앱으로 한 번 더 확인해 주세요.</p>
      {loading ? <p role="status">인증 앱 정보를 확인하고 있어요.</p> : <>
        {!factorId && profileLoaded && !emailReady && <>
          <h2>이메일을 먼저 연결해 주세요</h2>
          <p>카카오 계정에 확인된 이메일이 없어 인증 앱용 QR 코드를 만들지 못했어요. 현재 계정에 본인 이메일을 연결하면 계속할 수 있어요.</p>
          <p className={styles.help}>카카오 로그인과 보유 데이터는 그대로 유지돼요. 다른 주비 계정에서 사용하지 않는 이메일을 입력해 주세요.</p>
          <p className={styles.help}>현재 확인 메일은 Supabase 프로젝트 팀 계정의 이메일로만 받을 수 있어요. 다른 주소를 쓰려면 운영 메일 설정이 먼저 필요해요.</p>
          <form onSubmit={connectEmail} className={styles.form}>
            <label htmlFor="admin-mfa-email">본인 이메일</label>
            <input id="admin-mfa-email" className={ui.field} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} required />
            <button className={ui.primaryButton} disabled={busy || !email.trim()}>{busy ? '요청하고 있어요' : emailSent ? '확인 메일 다시 보내기' : '확인 메일 보내기'}</button>
          </form>
          {emailSent && <p role="status">메일의 확인 링크를 누른 뒤 돌아와 아래 버튼을 눌러 주세요.</p>}
          <button className={ui.button} disabled={busy} onClick={() => { setLoading(true); setAttempt(v => v + 1); }}>이메일 확인했어요</button>
        </>}
        {!factorId && emailReady && !error && <>
          <p>Google Authenticator나 비슷한 인증 앱을 준비한 뒤 등록을 시작해 주세요.</p>
          <button className={`${ui.button} ${ui.primaryButton}`} disabled={busy} onClick={enroll}>인증 앱 등록하기</button>
        </>}
        {enrollment && <>
          <p>인증 앱에서 QR 코드를 스캔하고, 앱에 표시된 6자리 코드를 입력해 주세요.</p>
          {/* The SDK supplies a data-URL image; never insert SVG as HTML or log the secret. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.qr} src={enrollment.qr} alt="관리자 인증 앱 등록용 QR 코드" width={224} height={224} />
          <details><summary className={ui.disclosure}>QR 코드를 읽을 수 없나요?</summary><p>앱에서 설정 키를 직접 입력할 수 있어요. 다른 사람에게 공유하지 마세요.</p><code className={styles.secret}>{enrollment.secret}</code></details>
        </>}
        {factorId && <form onSubmit={verify} className={styles.form}>
          {factors.length > 1 && <label>인증 앱<select className={ui.field} value={factorId} onChange={e => { setFactorId(e.target.value); setCode(''); }} disabled={busy}>{factors.map((f, i) => <option key={f.id} value={f.id}>{f.friendly_name || `인증 앱 ${i + 1}`}</option>)}</select></label>}
          <label htmlFor="admin-mfa-code">6자리 인증 코드</label>
          <input id="admin-mfa-code" className={ui.field} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy} required aria-describedby={error ? 'admin-mfa-error' : undefined} />
          <button className={`${ui.button} ${ui.primaryButton}`} disabled={busy || code.length !== 6}>{busy ? '확인하고 있어요' : '인증하고 계속하기'}</button>
        </form>}
      </>}
      {error && <div><p id="admin-mfa-error" role="alert">{error}</p>{!factorId && <button className={ui.button} disabled={busy} onClick={() => { setLoading(true); setAttempt(v => v + 1); }}>다시 확인</button>}</div>}
      <p className={styles.help}>인증 앱을 잃어버렸다면 프로젝트 소유자가 Supabase에서 본인 확인 후 인증 수단을 복구해야 해요. 이 화면에서는 인증을 건너뛸 수 없어요.</p>
      <Link href="/">홈으로 돌아가기</Link>
    </section>
  </main>;
}
