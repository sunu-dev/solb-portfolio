'use client';

import { useEffect, useState } from 'react';
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
import JoobiLockup from '@/components/brand/JoobiLockup';

interface AgeEligibilityGateProps {
  userId: string;
  onSignOut: () => void;
}

type GateStatus = 'checking' | 'required' | 'saving' | 'eligible' | 'error';

async function readAdultConsent(userId: string): Promise<'required' | 'eligible' | 'error'> {
  const { data, error } = await supabase
    .from('user_consents')
    .select('id')
    .eq('user_id', userId)
    .eq('consent_type', AI_ADULT_CONSENT_TYPE)
    .eq('version', AGE_GATE_VERSION)
    .limit(1)
    .maybeSingle();
  if (error) return 'error';
  return data ? 'eligible' : 'required';
}

/**
 * 기존 로그인 세션도 현행 Gemini API 만 18세 요건에 다시 맞춘다.
 * 생년월일은 클라이언트 검증에만 사용하고 DB에는 동의 유형·버전·시각만 저장한다.
 */
export default function AgeEligibilityGate({ userId, onSignOut }: AgeEligibilityGateProps) {
  const [status, setStatus] = useState<GateStatus>('checking');
  const [birthDate, setBirthDate] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const age = getAgeFromBirthDate(birthDate);
  const isAdult = isAdultBirthDate(birthDate);
  const ageInvalid = birthDate.length === 10 && !isAdult;

  useEffect(() => {
    let active = true;
    void readAdultConsent(userId).then((nextStatus) => {
      if (active) setStatus(nextStatus);
    });
    return () => { active = false; };
  }, [userId]);

  const confirm = async () => {
    if (!isAdult || !agreeTerms || !agreePrivacy || status === 'saving') return;
    setStatus('saving');
    const agreedAt = new Date().toISOString();
    const { error } = await supabase.from('user_consents').upsert(
      [
        { user_id: userId, consent_type: AI_ADULT_CONSENT_TYPE, version: AGE_GATE_VERSION, agreed_at: agreedAt },
        { user_id: userId, consent_type: 'terms', version: TERMS_VERSION, agreed_at: agreedAt },
        { user_id: userId, consent_type: 'privacy', version: PRIVACY_VERSION, agreed_at: agreedAt },
      ],
      { onConflict: 'user_id,consent_type,version', ignoreDuplicates: true },
    );
    setStatus(error ? 'error' : 'eligible');
  };

  if (status === 'eligible') return null;

  const canConfirm = isAdult && agreeTerms && agreePrivacy && status !== 'saving';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="adult-gate-title"
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
      <div style={{ width: '100%', maxWidth: 420, padding: '28px 24px', borderRadius: 20, background: 'var(--bg, #FFFFFF)', boxShadow: '0 18px 60px rgba(15, 23, 42, 0.24)' }}>
        <div style={{ marginBottom: 18, textAlign: 'center' }}>
          <JoobiLockup variant="modal" />
        </div>

        {status === 'checking' ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary, #4E5968)', fontSize: 14 }}>
            이용 자격을 확인하고 있어요.
          </div>
        ) : status === 'error' ? (
          <>
            <h2 id="adult-gate-title" style={{ marginBottom: 8, textAlign: 'center', fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
              성인 확인 정보를 불러오지 못했어요
            </h2>
            <p style={{ marginBottom: 18, textAlign: 'center', fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary, #4E5968)' }}>
              개인정보 보호를 위해 확인이 끝날 때까지 서비스를 열지 않아요.
            </p>
            <button
              type="button"
              onClick={() => {
                setStatus('checking');
                void readAdultConsent(userId).then(setStatus);
              }}
              style={{ width: '100%', height: 46, border: 0, borderRadius: 12, background: 'var(--brand-primary, #0E7C7B)', color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              다시 확인하기
            </button>
          </>
        ) : (
          <>
            <h2 id="adult-gate-title" style={{ marginBottom: 8, textAlign: 'center', fontSize: 19, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
              만 18세 이상인지 확인해주세요
            </h2>
            <p style={{ marginBottom: 20, textAlign: 'center', fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary, #4E5968)' }}>
              AI 서비스 제공 조건에 따라 성인만 주비를 이용할 수 있어요.
            </p>

            <label style={{ display: 'block', marginBottom: 14, fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
              생년월일
              <input
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                style={{ display: 'block', width: '100%', height: 44, marginTop: 7, padding: '0 12px', border: `1px solid ${ageInvalid ? '#DC2626' : 'var(--border-light, #E5E8EB)'}`, borderRadius: 10, background: 'var(--bg, #FFFFFF)', color: 'var(--text-primary, #191F28)', font: 'inherit' }}
              />
            </label>
            <div style={{ minHeight: 34, marginBottom: 10, fontSize: 11.5, lineHeight: 1.5, color: ageInvalid ? '#DC2626' : 'var(--text-tertiary, #8B95A1)' }}>
              {isAdult && age !== null
                ? `✓ 만 ${age}세로 확인됐어요. 생년월일은 저장하거나 전송하지 않아요.`
                : ageInvalid
                  ? '만 18세 미만은 서비스를 이용할 수 없어요.'
                  : '생년월일은 브라우저에서 성인 여부 확인에만 사용해요.'}
            </div>

            <ConsentCheck checked={agreeTerms} onChange={setAgreeTerms}>
              <Link href="/terms" target="_blank">이용약관</Link>에 동의해요
            </ConsentCheck>
            <ConsentCheck checked={agreePrivacy} onChange={setAgreePrivacy}>
              <Link href="/privacy" target="_blank">개인정보처리방침</Link>에 동의해요
            </ConsentCheck>

            <button
              type="button"
              onClick={() => void confirm()}
              disabled={!canConfirm}
              style={{ width: '100%', height: 48, marginTop: 16, border: 0, borderRadius: 12, background: canConfirm ? 'var(--brand-primary, #0E7C7B)' : '#B0B8C1', color: '#FFFFFF', fontSize: 15, fontWeight: 700, cursor: canConfirm ? 'pointer' : 'not-allowed' }}
            >
              {status === 'saving' ? '확인 중...' : '확인하고 계속하기'}
            </button>
          </>
        )}

        <button type="button" onClick={onSignOut} style={{ width: '100%', marginTop: 12, padding: 8, border: 0, background: 'transparent', color: 'var(--text-tertiary, #8B95A1)', fontSize: 12, cursor: 'pointer' }}>
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
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 9, fontSize: 12.5, color: 'var(--text-secondary, #4E5968)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  );
}
