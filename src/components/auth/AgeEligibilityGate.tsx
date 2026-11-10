'use client';

import appUI from '../ui/AppUI.module.css';
import readingUI from '../ui/ReadingUI.module.css';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  AGE_GATE_VERSION,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from '@/config/legalVersions';
import {
  AI_ADULT_CONSENT_TYPE,
  getAgeFromBirthDate,
  isAdultBirthDate,
} from '@/lib/aiAgeGate';
import AccountAccessStatus from './AccountAccessStatus';
import JoobiLockup from '@/components/brand/JoobiLockup';
import { withDeadline } from '@/lib/withDeadline';
import { resolveSignupRequirements, type SignupRequirements } from '@/lib/signupEligibility';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface AgeEligibilityGateProps {
  userId: string;
  onSignOut: () => void;
  children?: React.ReactNode;
}

type GateStatus = 'checking' | 'required' | 'saving' | 'eligible' | 'error';

async function readSignupRequirements(userId: string): Promise<SignupRequirements> {
  const controller = new AbortController();
  try {
    return await withDeadline(resolveSignupRequirements(supabase, userId, sessionStorage, controller.signal), 6000);
  } catch {
    return { status: 'error', missing: [] };
  } finally { controller.abort(); }
}

/**
 * 기존 로그인 세션도 현행 Gemini API 만 18세 요건에 다시 맞춘다.
 * 생년월일은 클라이언트 검증에만 사용하고 DB에는 동의 유형·버전·시각만 저장한다.
 */
export default function AgeEligibilityGate(props: AgeEligibilityGateProps) {
  return <AccountEligibilityGate key={props.userId} {...props} />;
}

function AccountEligibilityGate({ userId, onSignOut, children }: AgeEligibilityGateProps) {
  const [{ status, missing }, setGate] = useState<{ status: GateStatus; missing: SignupRequirements['missing'] }>({ status: 'checking', missing: [] });
  const [birthDate, setBirthDate] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(status === 'required' || status === 'saving', dialogRef);
  const age = getAgeFromBirthDate(birthDate);
  const isAdult = isAdultBirthDate(birthDate);
  const ageInvalid = birthDate.length === 8 && !isAdult;
  const needsAdult = missing.includes(AI_ADULT_CONSENT_TYPE);
  const needsTerms = missing.includes('terms');
  const needsPrivacy = missing.includes('privacy');
  const canConfirm = (!needsAdult || isAdult) && (!needsTerms || agreeTerms)
    && (!needsPrivacy || agreePrivacy) && status === 'required' && missing.length > 0;

  useEffect(() => {
    let active = true;
    void readSignupRequirements(userId).then((nextGate) => {
      if (active) setGate(nextGate);
    });
    return () => { active = false; };
  }, [userId]);

  const confirm = async () => {
    if (!canConfirm) return;
    setGate(previous => ({ ...previous, status: 'saving' }));
    const agreedAt = new Date().toISOString();
    try {
      const confirmations = [
        { user_id: userId, consent_type: AI_ADULT_CONSENT_TYPE, version: AGE_GATE_VERSION, agreed_at: agreedAt },
        { user_id: userId, consent_type: 'terms', version: TERMS_VERSION, agreed_at: agreedAt },
        { user_id: userId, consent_type: 'privacy', version: PRIVACY_VERSION, agreed_at: agreedAt },
      ].filter(row => missing.some(type => type === row.consent_type));
      const { error } = await withDeadline(Promise.resolve(supabase.from('user_consents').upsert(
        confirmations,
        { onConflict: 'user_id,consent_type,version', ignoreDuplicates: true },
      ).abortSignal(AbortSignal.timeout(6000))), 6000);
      setGate(error ? { status: 'error', missing: [] } : await readSignupRequirements(userId));
    } catch {
      setGate({ status: 'error', missing: [] });
    }
  };

  if (status === 'eligible') return children ?? null;

  if (status === 'checking' || status === 'error') return <AccountAccessStatus
    phase="consent" error={status === 'error'} onSwitchAccount={onSignOut} onRetry={() => {
      setGate({ status: 'checking', missing: [] });
      void readSignupRequirements(userId).then(setGate);
    }} />;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="adult-gate-title"
      tabIndex={-1}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(15, 23, 42, 0.58)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420, maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', padding: '28px 24px', borderRadius: 20, background: 'var(--bg, #FFFFFF)', boxShadow: '0 18px 60px rgba(15, 23, 42, 0.24)' }}>
        <div style={{ marginBottom: 18, textAlign: 'center' }}>
          <JoobiLockup variant="modal" />
        </div>

        {
          <>
            <h2 className={readingUI.sectionTitle} id="adult-gate-title" style={{ marginBottom: 8, textAlign: 'center', color: 'var(--text-primary, #191F28)' }}>
              {needsAdult ? '만 18세 이상인지 확인해주세요' : '이용 안내를 확인해주세요'}
            </h2>
            <p style={{ marginBottom: 20, textAlign: 'center', fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary, #4E5968)' }}>
              {needsAdult ? 'AI 서비스 제공 조건에 따라 성인만 주비를 이용할 수 있어요.'
                : '아직 확인되지 않은 항목에 동의하면 계속 이용할 수 있어요.'}
            </p>

            {needsAdult && <><label style={{ display: 'block', marginBottom: 14, fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
              생년월일
              <input className={appUI.field}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={8}
                placeholder="예: 19950123"
                aria-invalid={ageInvalid}
                aria-describedby="adult-birth-hint"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value.replace(/\D/g, '').slice(0, 8))}
                style={{ display: 'block', width: '100%', height: 44, marginTop: 7 }}
              />
            </label>
            <div id="adult-birth-hint" aria-live="polite" style={{ minHeight: 34, marginBottom: 10, fontSize: 11.5, lineHeight: 1.5, color: ageInvalid ? '#DC2626' : 'var(--text-tertiary, #8B95A1)' }}>
              {isAdult && age !== null
                ? `✓ 만 ${age}세로 확인됐어요. 생년월일은 저장하거나 전송하지 않아요.`
                : ageInvalid
                  ? age === null ? '올바른 생년월일을 입력해주세요.' : '만 18세 미만은 서비스를 이용할 수 없어요.'
                  : '연·월·일 숫자 8자리를 입력해주세요. 생년월일은 저장하거나 전송하지 않아요.'}
            </div></>}

            {needsTerms && <ConsentCheck checked={agreeTerms} onChange={setAgreeTerms}>
              <Link href="/terms" target="_blank">이용약관</Link>에 동의해요
            </ConsentCheck>}
            {needsPrivacy && <ConsentCheck checked={agreePrivacy} onChange={setAgreePrivacy}>
              <Link href="/privacy" target="_blank">개인정보처리방침</Link>에 동의해요
            </ConsentCheck>}

            <button className={appUI.primaryButton}
              type="button"
              onClick={() => void confirm()}
              disabled={!canConfirm}
              style={{ width: '100%', marginTop: 16, border: 0, background: canConfirm ? 'var(--brand-fill)' : 'var(--text-secondary)', color: 'var(--on-brand-fg)' }}
            >
              {status === 'saving' ? '확인 중...' : '확인하고 계속하기'}
            </button>
          </>
        }

        <button className={appUI.textButton} type="button" onClick={onSignOut} style={{ width: '100%', marginTop: 12 }}>
          다른 계정으로 로그인
        </button>
      </div>
    </div>
  );
}

function ConsentCheck({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', minHeight: 44, alignItems: 'center', gap: 9, marginTop: 2, fontSize: 13, color: 'var(--text-body)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--brand-fill)' }} />
      <span>{children}</span>
    </label>
  );
}
