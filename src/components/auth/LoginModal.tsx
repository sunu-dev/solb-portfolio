'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronRight, ShieldCheck } from 'lucide-react';
import styles from './LoginModal.module.css';
import JoobiLockup from '@/components/brand/JoobiLockup';
import { TERMS_VERSION, PRIVACY_VERSION } from '@/config/legalVersions';
import { getAgeFromBirthDate, isAdultBirthDate } from '@/lib/aiAgeGate';

export const CONSENT_STORAGE_KEY = 'solb_consent_pending';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKakaoLogin: () => void;
}

export default function LoginModal({ isOpen, onClose, onKakaoLogin }: LoginModalProps) {
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  // Gemini API 약관에 맞춰 만 18세 이상만 가입 가능. 생년월일은 브라우저에서
  // 성인 여부 계산에만 쓰고 sessionStorage·DB·외부 서비스로 보내지 않는다.
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [birthDate, setBirthDate] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [inviteMode, setInviteMode] = useState<'loading' | 'required' | 'open' | 'unknown'>('loading');
  const age = getAgeFromBirthDate(birthDate);
  const isAge18Plus = isAdultBirthDate(birthDate);
  const ageInvalid = birthDate.length === 8 && !isAge18Plus;
  const allChecked = isAge18Plus && agreeTerms && agreePrivacy;

  const persistConsent = useCallback(() => {
    try {
      sessionStorage.setItem(
        CONSENT_STORAGE_KEY,
        JSON.stringify({
          age_18_plus: true,
          terms: TERMS_VERSION,
          privacy: PRIVACY_VERSION,
          ts: new Date().toISOString(),
        }),
      );
    } catch {
      // sessionStorage 실패 시 동의 INSERT는 누락되지만 OAuth는 계속 — 베타 사용자 차단보다 우선
    }
  }, []);

  const handleKakao = useCallback(() => {
    if (!allChecked) return;
    persistConsent();
    onKakaoLogin();
  }, [allChecked, onKakaoLogin, persistConsent]);


  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    void fetch('/api/config', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('config unavailable');
      const { config } = await response.json();
      if (controller.signal.aborted) return;
      if (typeof config?.service_mode !== 'string') setInviteMode('unknown');
      else if (config.service_mode !== 'beta' || config.invite_required === 'false') setInviteMode('open');
      else setInviteMode(config.invite_required === 'true' ? 'required' : 'unknown');
    }).catch(() => {
      if (!controller.signal.aborted) setInviteMode('unknown');
    });
    return () => controller.abort();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="login-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={handleOverlayClick}>
      <div className={styles.card}>
        <header className={styles.header}>
          <JoobiLockup variant="modal" />
          <button type="button" className={styles.close} onClick={onClose} aria-label="로그인 닫기" autoFocus><X size={21} aria-hidden="true" /></button>
        </header>
        <div className={styles.intro}>
          <h1 id="login-title">내 주식,<br />오늘은 어때요?</h1>
          <p>가격과 소식을 한곳에서 확인해요.</p>
        </div>
        {inviteMode !== 'open' && <aside className={styles.inviteNote} aria-live="polite">
          <strong>{inviteMode === 'required' ? '새로 가입하려면 초대 코드가 필요해요' : '가입 안내'}</strong>
          <p>{inviteMode === 'required'
            ? '카카오 인증 후 초대 코드를 입력해요. 이미 초대를 등록한 계정은 바로 이용할 수 있어요.'
            : inviteMode === 'loading' ? '가입 조건을 확인하고 있어요. 현재 운영 방식에 따라 초대 코드가 필요할 수 있어요.'
              : '가입 조건을 확인하지 못했어요. 카카오 인증 후 초대 코드가 필요할 수 있어요.'}</p>
          <button type="button" onClick={onClose}>코드 없이 먼저 둘러보기 <ChevronRight size={14} aria-hidden="true" /></button>
        </aside>}
        <section aria-label="이용 연령 확인">
          <div className={styles.labelRow}>
            <label htmlFor="login-birth">생년월일</label><span>만 18세 이상 이용 가능</span>
          </div>
          <input id="login-birth" className={styles.birthInput} type="text" inputMode="numeric"
            autoComplete="off" maxLength={8} placeholder="예: 19950123" value={birthDate}
            onChange={(event) => setBirthDate(event.target.value.replace(/\D/g, '').slice(0, 8))}
            aria-invalid={ageInvalid} aria-describedby="login-birth-hint login-birth-status" />
          <div id="login-birth-status" className={ageInvalid ? styles.error : styles.status} aria-live="polite">
            {ageInvalid ? age === null ? '올바른 생년월일 8자리를 입력해주세요.' : '만 18세 미만은 가입할 수 없어요.'
              : isAge18Plus && age !== null ? `만 ${age}세로 확인됐어요` : '연도 4자리 · 월 2자리 · 일 2자리'}
          </div>
          <p id="login-birth-hint" className={styles.privacyNote}><ShieldCheck size={15} aria-hidden="true" />생년월일은 저장하거나 전송하지 않아요.</p>
        </section>
        <fieldset className={styles.consents}>
          <legend className={styles.srOnly}>필수 약관 동의</legend>
          <label className={styles.allConsent}>
            <input type="checkbox" checked={agreeTerms && agreePrivacy}
              onChange={(event) => { setAgreeTerms(event.target.checked); setAgreePrivacy(event.target.checked); }} />
            <span>필수 항목 모두 동의</span>
          </label>
          <div className={styles.consentRow}>
            <label><input type="checkbox" checked={agreeTerms} onChange={(event) => setAgreeTerms(event.target.checked)} />
              <span><span className={styles.required}>[필수]</span> 이용약관 동의</span></label>
            <a href="/terms" target="_blank" rel="noopener noreferrer" aria-label="이용약관 보기 (새 창)"><ChevronRight size={18} /></a>
          </div>
          <div className={styles.consentRow}>
            <label><input type="checkbox" checked={agreePrivacy} onChange={(event) => setAgreePrivacy(event.target.checked)} />
              <span><span className={styles.required}>[필수]</span> 개인정보처리방침 동의<br /><small>국외이전 포함</small></span></label>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" aria-label="개인정보처리방침 보기 (새 창)"><ChevronRight size={18} /></a>
          </div>
        </fieldset>
        <div className={styles.actions}>
          <p className={styles.actionHint}>{allChecked ? '카카오 인증 후 주비로 돌아와요.' : '생년월일과 필수 동의를 확인해주세요.'}</p>
          <button type="button" className={styles.kakao} onClick={handleKakao} disabled={!allChecked}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M9 0.6C4.029 0.6 0 3.726 0 7.554c0 2.467 1.639 4.632 4.104 5.862l-1.04 3.822c-.092.337.293.605.584.407l4.574-3.03c.257.02.517.03.778.03 4.971 0 9-3.126 9-6.954C18 3.726 13.971 0.6 9 0.6z"
              fill="#191F28"
            />
          </svg>카카오로 시작하기
          </button>
          <button type="button" className={styles.guest} onClick={onClose}>로그인 없이 둘러보기 <ChevronRight size={14} aria-hidden="true" /></button>
        </div>
        <footer className={styles.footer}>베타 무료 제공 중<span>·</span>투자 판단과 책임은 본인에게 있어요.</footer>
      </div>
    </dialog>
  );
}
