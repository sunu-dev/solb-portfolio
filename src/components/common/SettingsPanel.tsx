'use client';

import appUI from '../ui/AppUI.module.css';
import styles from './SettingsPanel.module.css';

import { useState, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useModalViewport } from '@/hooks/useModalViewport';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useNotification } from '@/hooks/useNotification';
import { supabase } from '@/lib/supabase';
import { X } from 'lucide-react';
import InviteSection from './InviteSection';
import PwaInstallCard from './PwaInstallCard';
import { getSuppressedTypes, getSuppressedCategories, resetAlertLearning } from '@/utils/alertLearning';
import { getAlertPrefs, setAlertPrefs, CATEGORY_LABELS } from '@/utils/alertPrefs';
import type { AlertCategory } from '@/config/alertPolicy';
import InvestorTypePicker from '@/components/insights/InvestorTypePicker';
import { INVESTOR_TYPES } from '@/config/investorTypes';
import InvestorTypeIcon from '@/components/insights/InvestorTypeIcon';
import PortfolioDataTools from './PortfolioDataTools';
import JoobiCharacterSettings from './JoobiCharacterSettings';
import ArrivalPreferences from '../portfolio/ArrivalPreferences';

// ─── 이메일 구독 토글 (재사용) ─────────────────────────────────────────────
interface EmailToggleProps {
  endpoint: string;
  label: string;
  description: string;
  emoji: string;
}

function EmailSubscriptionToggle({ endpoint, label, description, emoji }: EmailToggleProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { if (!cancelled) setEnabled(false); return; }
        const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${session.access_token}` } });
        const json = await res.json();
        if (!cancelled) setEnabled(!!json.enabled);
      } catch {
        if (!cancelled) setEnabled(false);
      }
    })();
    return () => { cancelled = true; };
  }, [endpoint]);

  const toggle = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('로그인 후 이용 가능합니다.');
        return;
      }
      const method = enabled ? 'DELETE' : 'POST';
      const res = await fetch(endpoint, {
        method, headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setEnabled(!enabled);
      else alert('이메일 구독 변경에 실패했어요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <button className={appUI.switchRow}
        onClick={toggle}
        disabled={loading || enabled === null}
        aria-pressed={enabled === true}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left' }}
      >
        <span style={{ fontSize: 16 }}>{emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--type-label-size)', fontWeight: 550, color: 'var(--text-primary)' }}>
            {label}
          </div>
          <div style={{ fontSize: 'var(--type-caption-size)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {description}
          </div>
        </div>
        <span className={appUI.switchTrack} aria-hidden="true" />
      </button>
    </div>
  );
}

function EmailMorningBriefToggle() {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 'var(--type-group-size)', fontWeight: 650, color: 'var(--text-primary)', marginBottom: 4 }}>
        이메일 알림
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 12, lineHeight: 1.6 }}>
        아이폰 푸시가 안 와도 이메일로 안전하게 도달해요. 언제든 메일 본문 하단의 링크로 1-click 해제 가능.
      </div>
      <EmailSubscriptionToggle
        endpoint="/api/email/morning-brief"
        emoji="🌅"
        label="모닝 브리핑"
        description="매일 오전 7시 포트폴리오 요약"
      />
      <EmailSubscriptionToggle
        endpoint="/api/email/monthly-d3"
        emoji="📖"
        label="월말 D-3 리마인더"
        description="월말 3일 전 챕터 회고 안내"
      />
    </div>
  );
}

export default function SettingsPanel({ isLoggedIn }: { isLoggedIn: boolean }) {
  const {
    autoRefresh, setAutoRefresh,
    refreshInterval, setRefreshInterval,
    investorType, setInvestorType,
  } = usePortfolioStore(useShallow(state => ({
    autoRefresh: state.autoRefresh, setAutoRefresh: state.setAutoRefresh,
    refreshInterval: state.refreshInterval, setRefreshInterval: state.setRefreshInterval,
    investorType: state.investorType, setInvestorType: state.setInvestorType,
  })));
  const { requestPermission, pushEnabled, unsubscribePush } = useNotification();
  const [pushLoading, setPushLoading] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useModalViewport(isOpen, panelRef);
  useFocusTrap(isOpen, panelRef, () => setIsOpen(false));
  const [intervalSec, setIntervalSec] = useState(String(refreshInterval / 1000));
  const [suppressedTypes, setSuppressedTypes] = useState<Array<{ type: string; count: number }>>([]);
  const [suppressedCategories, setSuppressedCategories] = useState<Array<{ category: string; label: string; count: number }>>([]);
  const [alertPrefsState, setAlertPrefsState] = useState(() => getAlertPrefs());
  const [clearingAll, setClearingAll] = useState(false);
  const [clearAllError, setClearAllError] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    if (clearingAll || deletingAccount) return;
    if (!confirm('정말 계정을 삭제하시겠어요?\n\n포트폴리오, 분석 기록 등 모든 데이터가 영구 삭제되며 복구할 수 없어요.')) return;
    if (!confirm('마지막 확인: 계정 삭제 후에는 되돌릴 수 없어요. 계속하시겠어요?')) return;
    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('로그인 상태를 확인한 뒤 다시 시도해주세요.');

      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || '삭제 실패');
      }

      const { clearUserStorage } = await import('@/lib/userStorage');
      clearUserStorage();
      usePortfolioStore.getState().resetPortfolio();
      await supabase.auth.signOut();
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      alert(`계정 삭제에 실패했어요: ${message}`);
      setDeletingAccount(false);
    }
  };

  // 모달 열릴 때마다 현재 suppress 상태 새로고침
  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      setSuppressedTypes(getSuppressedTypes());
      setSuppressedCategories(getSuppressedCategories());
      setAlertPrefsState(getAlertPrefs());
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  const toggleCategory = (cat: AlertCategory) => {
    const next = { ...alertPrefsState.categories, [cat]: !alertPrefsState.categories[cat] };
    setAlertPrefs({ categories: next });
    setAlertPrefsState({ ...alertPrefsState, categories: next });
  };

  const toggleQuietHours = () => {
    const next = !alertPrefsState.quietHours;
    setAlertPrefs({ quietHours: next });
    setAlertPrefsState({ ...alertPrefsState, quietHours: next });
  };

  // Listen for toggle event from Header
  useEffect(() => {
    const handler = () => setIsOpen(prev => !prev);
    window.addEventListener('toggle-settings', handler);
    return () => window.removeEventListener('toggle-settings', handler);
  }, []);

  const handleUpdateInterval = () => {
    const sec = parseInt(intervalSec);
    if (sec >= 10) {
      setRefreshInterval(sec * 1000);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('전체 초기화할까요? 모든 종목, 설정, 캐시 데이터가 삭제돼요.')) return;
    setClearingAll(true);
    setClearAllError('');

    // Supabase DB에서도 포트폴리오 삭제
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (user) {
        const { error } = await supabase
          .from('user_portfolios')
          .delete()
          .eq('user_id', user.id);
        if (error) throw error;
      }
    } catch {
      setClearAllError('클라우드 기록을 삭제하지 못해 초기화를 멈췄어요. 연결을 확인한 뒤 다시 시도해주세요.');
      setClearingAll(false);
      return;
    }

    // 로컬 데이터 전부 삭제 후 리로드
    localStorage.clear();
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className={styles.overlay}
        onClick={() => setIsOpen(false)}
      />

      {/* Panel - slides from right */}
      <div
        data-settings-panel
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="설정"
        tabIndex={-1}
        className={styles.panel}
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>설정</h2>
          <button className={appUI.iconButton}
            onClick={() => setIsOpen(false)}
            aria-label="설정 닫기"
          >
            <X style={{ width: 20, height: 20, color: 'var(--text-secondary, #4E5968)' }} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          <JoobiCharacterSettings />

          {/* Auto Refresh Toggle Section */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 'var(--type-group-size)', fontWeight: 650, color: 'var(--text-primary)', marginBottom: 8 }}>
              자동 새로고침
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 12 }}>
              활성화 시 주기적으로 시세를 업데이트합니다
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)' }}>
                {autoRefresh ? '활성' : '비활성'}
              </span>
              <button className={appUI.switchButton}
                onClick={() => setAutoRefresh(!autoRefresh)}
                aria-label="자동 새로고침"
                aria-pressed={autoRefresh}
                style={{ position: 'relative', width: 44, flexShrink: 0 }}
              >
                <span className={appUI.switchTrack} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Refresh Interval Section */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 'var(--type-group-size)', fontWeight: 650, color: 'var(--text-primary)', marginBottom: 8 }}>
              새로고침 간격
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 12 }}>
              자동 새로고침 주기를 설정합니다 (최소 10초)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input className={appUI.field}
                type="number"
                aria-label="새로고침 간격(초)"
                value={intervalSec}
                onChange={(e) => setIntervalSec(e.target.value)}
                min="10"
                style={{ width: 80, textAlign: 'center', boxSizing: 'border-box' }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)' }}>초</span>
              <button className={appUI.secondaryButton}
                onClick={handleUpdateInterval}
                style={{ flexShrink: 0 }}

              >
                적용
              </button>
            </div>
          </div>

          <ArrivalPreferences />

          {/* 내 투자 유형 — AI 개인화 baseline */}
          <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
            <div style={{ fontSize: 'var(--type-group-size)', fontWeight: 650, color: 'var(--text-primary)', marginBottom: 4 }}>
              내 투자 유형
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 12, lineHeight: 1.6 }}>
              AI 분석이 이 유형에 맞춰 설명 방식과 용어 난이도를 조정해요. 종목 평가와 오늘 시장 흐름은 달라지지 않아요. 현재:{' '}
              <strong style={{ color: INVESTOR_TYPES[investorType].accentColor }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <InvestorTypeIcon type={investorType} size={14} color={INVESTOR_TYPES[investorType].accentColor} />
                  {INVESTOR_TYPES[investorType].nameKr}
                </span>
              </strong>
            </div>
            <InvestorTypePicker currentType={investorType} onSelect={setInvestorType} />
          </div>

          {/* PWA 설치 카드 — iOS/Android 미설치 시만 노출 */}
          <PwaInstallCard />

          {/* 알림 설정 */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 'var(--type-group-size)', fontWeight: 650, color: 'var(--text-primary)', marginBottom: 4 }}>
              푸시 알림
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 12, lineHeight: 1.6 }}>
              목표가·수익률 도달 시 앱이 꺼져있어도 알림을 받아요. 로그인 후 이용 가능 · iOS는 홈화면 추가 필요
            </div>

            {pushEnabled ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  flex: 1, padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.3)',
                  fontSize: 13, fontWeight: 600, color: '#34C759',
                }}>
                  ✓ 푸시 알림 켜짐
                </div>
                <button className={appUI.secondaryButton}
                  onClick={async () => {
                    setPushLoading(true);
                    await unsubscribePush();
                    setPushLoading(false);
                  }}
                  disabled={pushLoading}

                >
                  끄기
                </button>
              </div>
            ) : (
              <button className={appUI.primaryButton}
                onClick={async () => {
                  setPushLoading(true);
                  const result = await requestPermission();
                  setPushLoading(false);
                  if (result.permission === 'denied') {
                    alert('알림 권한이 차단됐어요. 브라우저 설정에서 허용해주세요.');
                  } else if (result.permission === 'unsupported') {
                    alert('이 브라우저에서는 푸시 알림을 지원하지 않아요.');
                  } else if (result.permission === 'granted' && !result.subscribed) {
                    alert('알림 권한은 허용됐지만 푸시 연결에 실패했어요. 잠시 후 다시 시도해주세요.');
                  }
                }}
                disabled={pushLoading}
                style={{ width: '100%' }}
              >
                {pushLoading ? '처리 중...' : '푸시 알림 켜기'}
              </button>
            )}
          </div>

          {/* 이메일 모닝브리프 — iOS Safari 푸시 미설치 보완 채널 (정책 §7) */}
          <EmailMorningBriefToggle />

          {/* 알림 카테고리 ON/OFF — 정책 SSOT: docs/NOTIFICATION_POLICY.md §5 */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 'var(--type-group-size)', fontWeight: 650, color: 'var(--text-primary)', marginBottom: 4 }}>
              🎚️ 알림 종류
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 12, lineHeight: 1.6 }}>
              꺼진 카테고리는 토스트·푸시 알림이 오지 않아요. 사이드바 알림 센터에는 계속 표시돼요.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(Object.keys(CATEGORY_LABELS) as AlertCategory[]).map(cat => {
                const meta = CATEGORY_LABELS[cat];
                const enabled = alertPrefsState.categories[cat];
                return (
                  <button className={appUI.switchRow}
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    aria-pressed={enabled}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
                  >
                    <span style={{ fontSize: 16 }}>{meta.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--type-label-size)', fontWeight: 550, color: 'var(--text-primary)' }}>
                        {meta.label}
                      </div>
                      <div style={{ fontSize: 'var(--type-caption-size)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {meta.desc}
                      </div>
                    </div>
                    <span className={appUI.switchTrack} aria-hidden="true" />
                  </button>
                );
              })}
            </div>

            {/* 무음 시간대 */}
            <button className={appUI.switchRow}
              onClick={toggleQuietHours}
              aria-pressed={alertPrefsState.quietHours}
              style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, textAlign: 'left', width: '100%' }}
            >
              <span style={{ fontSize: 16 }}>🌙</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--type-label-size)', fontWeight: 550, color: 'var(--text-primary)' }}>
                  무음 시간대
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
                  KST 22:00 ~ 07:00 토스트·푸시 끄기
                </div>
              </div>
              <span className={appUI.switchTrack} aria-hidden="true" />
            </button>
          </div>

          {/* 알림 학습 */}
          <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
            <div style={{ fontSize: 'var(--type-group-size)', fontWeight: 650, color: 'var(--text-primary)', marginBottom: 4 }}>
              알림 학습
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 12, lineHeight: 1.6 }}>
              자주 닫으신 알림 타입은 자동으로 덜 보여드려요. 최근 7일 내 3회 이상 해제된 타입이 숨김 대상이에요.
            </div>

            {suppressedTypes.length === 0 && suppressedCategories.length === 0 ? (
              <div style={{
                padding: '14px 16px', borderRadius: 10,
                background: 'var(--bg-subtle, #F2F4F6)',
                fontSize: 13, color: 'var(--text-tertiary, #B0B8C1)',
              }}>
                아직 학습된 내용이 없어요. 알림을 자연스럽게 관리해보세요.
              </div>
            ) : (
              <>
                {/* 카테고리 레벨 — 상위 개념 (예: RSI 전체) */}
                {suppressedCategories.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 6 }}>
                      지표 카테고리 전체 숨김
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                      {suppressedCategories.map(c => (
                        <div
                          key={c.category}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px', borderRadius: 10,
                            background: 'var(--color-danger-bg, rgba(239,68,82,0.06))',
                            border: '1px solid rgba(239,68,82,0.18)',
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                            🎯 {c.label}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--color-danger, #EF4452)', fontWeight: 700 }}>
                            {c.count}회 해제
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* 타입 레벨 — 개별 지표 */}
                {suppressedTypes.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary, #B0B8C1)', marginBottom: 6 }}>
                      개별 알림 타입
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                      {suppressedTypes.map(t => (
                        <div
                          key={t.type}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px', borderRadius: 10,
                            background: 'var(--color-warning-bg, rgba(255,149,0,0.06))',
                            border: '1px solid rgba(255,149,0,0.15)',
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
                            {t.type}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--color-warning, #FF9500)', fontWeight: 700 }}>
                            {t.count}회 해제
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <button className={appUI.secondaryButton}
                  onClick={() => {
                    resetAlertLearning();
                    setSuppressedTypes([]);
                    setSuppressedCategories([]);
                  }}
                  style={{ width: '100%' }}
                >
                  학습 기록 모두 초기화
                </button>
              </>
            )}
          </div>

          <PortfolioDataTools />

          {/* 친구 초대 */}
          <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
            <div style={{ fontSize: 'var(--type-group-size)', fontWeight: 650, color: 'var(--text-primary)', marginBottom: 4 }}>
              친구 초대
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 12 }}>
              초대 코드를 공유해 친구를 주비 베타에 초대하세요
            </div>
            <InviteSection />
          </div>

          {/* Danger Zone */}
          <div style={{ paddingTop: 24, borderTop: '1px solid var(--border-light, #F2F4F6)' }}>
            <div style={{ fontSize: 'var(--type-group-size)', fontWeight: 650, color: 'var(--text-primary)', marginBottom: 8 }}>
              위험 구역
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 12 }}>
              이 작업은 되돌릴 수 없어요
            </div>
            <button className={appUI.dangerButton}
              onClick={handleClearAll}
              disabled={clearingAll || deletingAccount}
              style={{ width: '100%', opacity: clearingAll ? 0.6 : 1 }}

            >
              {clearingAll ? '클라우드 삭제 확인 중...' : '전체 데이터 초기화'}
            </button>
            {clearAllError && (
              <div role="alert" style={{ marginTop: 9, color: '#EF4452', fontSize: 11, lineHeight: 1.5 }}>
                {clearAllError}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 8 }}>
              모든 종목, 설정, 캐시 데이터가 삭제돼요
            </div>
          </div>

          {isLoggedIn && (
            <section aria-labelledby="settings-account-title" style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--border-light, #F2F4F6)' }}>
              <h2 id="settings-account-title" style={{ fontSize: 'var(--type-group-size)', fontWeight: 650, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                계정
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 8px' }}>
                계정을 삭제하면 포트폴리오와 분석 기록 등이 영구 삭제되며 복구할 수 없어요.
              </p>
              <button className={appUI.textButton}
                type="button"
                onClick={handleDeleteAccount}
                disabled={clearingAll || deletingAccount}
                style={{ color: 'var(--color-danger)', border: 0 }}
              >
                {deletingAccount ? '삭제 중...' : '계정 삭제'}
              </button>
            </section>
          )}

        </div>
      </div>
    </>
  );
}
