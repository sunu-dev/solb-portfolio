'use client';

import { useState, useEffect } from 'react';
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

// ─── 이메일 모닝브리프 구독 토글 ──────────────────────────────────────────
function EmailMorningBriefToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          if (!cancelled) setEnabled(false);
          return;
        }
        const res = await fetch('/api/email/morning-brief', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (!cancelled) setEnabled(!!json.enabled);
      } catch {
        if (!cancelled) setEnabled(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('로그인 후 이용 가능합니다.');
        setLoading(false);
        return;
      }
      const method = enabled ? 'DELETE' : 'POST';
      const res = await fetch('/api/email/morning-brief', {
        method,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setEnabled(!enabled);
      else alert('이메일 구독 변경에 실패했어요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #191F28)', marginBottom: 4 }}>
        ✉️ 이메일 모닝브리프
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 12, lineHeight: 1.6 }}>
        매일 오전 7시 포트폴리오 요약을 이메일로도 받아요.<br />
        아이폰 푸시가 안 와도 안전하게 도달.
      </div>
      <button
        onClick={toggle}
        disabled={loading || enabled === null}
        aria-pressed={enabled === true}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 10, width: '100%',
          background: enabled ? 'rgba(0,198,190,0.06)' : 'var(--bg-subtle, #F2F4F6)',
          border: enabled ? '1px solid rgba(0,198,190,0.18)' : '1px solid transparent',
          cursor: loading ? 'default' : 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
          {enabled === null ? '확인 중…' : enabled ? '이메일 받는 중' : '이메일 받기'}
        </span>
        <span style={{
          width: 36, height: 20, borderRadius: 12, position: 'relative',
          background: enabled ? '#00C6BE' : '#D1D6DB',
          transition: 'background 0.2s', flexShrink: 0,
        }}>
          <span style={{
            position: 'absolute', top: 2, left: enabled ? 18 : 2,
            width: 16, height: 16, borderRadius: '50%', background: 'white',
            transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          }} />
        </span>
      </button>
    </div>
  );
}

export default function SettingsPanel() {
  const {
    autoRefresh, setAutoRefresh,
    refreshInterval, setRefreshInterval,
    investorType, setInvestorType,
  } = usePortfolioStore();
  const { requestPermission, pushEnabled, unsubscribePush } = useNotification();
  const [pushLoading, setPushLoading] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  const [intervalSec, setIntervalSec] = useState(String(refreshInterval / 1000));
  const [suppressedTypes, setSuppressedTypes] = useState<Array<{ type: string; count: number }>>([]);
  const [suppressedCategories, setSuppressedCategories] = useState<Array<{ category: string; label: string; count: number }>>([]);
  const [alertPrefsState, setAlertPrefsState] = useState(() => getAlertPrefs());

  // 모달 열릴 때마다 현재 suppress 상태 새로고침
  useEffect(() => {
    if (isOpen) {
      setSuppressedTypes(getSuppressedTypes());
      setSuppressedCategories(getSuppressedCategories());
      setAlertPrefsState(getAlertPrefs());
    }
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

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleUpdateInterval = () => {
    const sec = parseInt(intervalSec);
    if (sec >= 10) {
      setRefreshInterval(sec * 1000);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('전체 초기화할까요? 모든 종목, 설정, 캐시 데이터가 삭제됩니다.')) return;

    // Supabase DB에서도 포트폴리오 삭제
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_portfolios').delete().eq('user_id', user.id);
      }
    } catch { /* 비로그인 사용자 무시 */ }

    // 로컬 데이터 전부 삭제 후 리로드
    localStorage.clear();
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.1)',
          backdropFilter: 'blur(2px)',
          zIndex: 50,
        }}
        onClick={() => setIsOpen(false)}
      />

      {/* Panel - slides from right */}
      <div
        data-settings-panel
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(360px, 100vw)',
          background: 'var(--surface, white)',
          zIndex: 50,
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-light, #F2F4F6)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>설정</span>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover, #F2F4F6)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X style={{ width: 20, height: 20, color: 'var(--text-secondary, #4E5968)' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* Auto Refresh Toggle Section */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #191F28)', marginBottom: 8 }}>
              자동 새로고침
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 12 }}>
              활성화 시 주기적으로 시세를 업데이트합니다
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)' }}>
                {autoRefresh ? '활성' : '비활성'}
              </span>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                style={{
                  position: 'relative',
                  width: 44,
                  height: 24,
                  borderRadius: 9999,
                  border: 'none',
                  background: autoRefresh ? '#34C759' : 'var(--border-light, #E5E8EB)',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: autoRefresh ? 22 : 2,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    transition: 'left 0.2s',
                  }}
                />
              </button>
            </div>
          </div>

          {/* Refresh Interval Section */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #191F28)', marginBottom: 8 }}>
              새로고침 간격
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 12 }}>
              자동 새로고침 주기를 설정합니다 (최소 10초)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                value={intervalSec}
                onChange={(e) => setIntervalSec(e.target.value)}
                min="10"
                style={{
                  width: 80,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-light, #E5E8EB)',
                  fontSize: 16,
                  textAlign: 'center',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-secondary, #4E5968)' }}>초</span>
              <button
                onClick={handleUpdateInterval}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: 'rgba(49,130,246,0.1)',
                  color: '#3182F6',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(49,130,246,0.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(49,130,246,0.1)')}
              >
                적용
              </button>
            </div>
          </div>

          {/* 내 투자 유형 — AI 개인화 baseline */}
          <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #191F28)', marginBottom: 4 }}>
              🎯 내 투자 유형
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 12, lineHeight: 1.6 }}>
              AI 촉·분석이 이 유형에 맞춰 톤과 추천 기준을 조정해요.<br />
              현재: <strong style={{ color: INVESTOR_TYPES[investorType].accentColor }}>
                {INVESTOR_TYPES[investorType].emoji} {INVESTOR_TYPES[investorType].nameKr}
              </strong>
            </div>
            <InvestorTypePicker currentType={investorType} onSelect={setInvestorType} />
          </div>

          {/* PWA 설치 카드 — iOS/Android 미설치 시만 노출 */}
          <PwaInstallCard />

          {/* 알림 설정 */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #191F28)', marginBottom: 4 }}>
              🔔 푸시 알림
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 12 }}>
              목표가·수익률 도달 시 앱이 꺼져있어도 알림을 받아요.<br />
              로그인 후 이용 가능 · iOS는 홈화면 추가 필요
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
                <button
                  onClick={async () => {
                    setPushLoading(true);
                    await unsubscribePush();
                    setPushLoading(false);
                  }}
                  disabled={pushLoading}
                  style={{
                    padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    color: '#8B95A1', background: 'var(--bg-subtle, #F2F4F6)',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  끄기
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  setPushLoading(true);
                  const granted = await requestPermission();
                  setPushLoading(false);
                  if (!granted) alert('알림 권한이 거부됐어요. 브라우저 설정에서 허용해주세요.');
                }}
                disabled={pushLoading}
                style={{
                  width: '100%', padding: 12,
                  background: pushLoading ? '#8B95A1' : '#3182F6',
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontSize: 14, fontWeight: 600, cursor: pushLoading ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {pushLoading ? '처리 중...' : '📱 푸시 알림 켜기'}
              </button>
            )}
          </div>

          {/* 이메일 모닝브리프 — iOS Safari 푸시 미설치 보완 채널 (정책 §7) */}
          <EmailMorningBriefToggle />

          {/* 알림 카테고리 ON/OFF — 정책 SSOT: docs/NOTIFICATION_POLICY.md §5 */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #191F28)', marginBottom: 4 }}>
              🎚️ 알림 종류
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 12, lineHeight: 1.6 }}>
              꺼진 카테고리는 토스트·푸시 알림이 오지 않아요.<br />
              사이드바 알림 센터에는 계속 표시됩니다.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(Object.keys(CATEGORY_LABELS) as AlertCategory[]).map(cat => {
                const meta = CATEGORY_LABELS[cat];
                const enabled = alertPrefsState.categories[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    aria-pressed={enabled}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 10,
                      background: enabled ? 'rgba(49,130,246,0.06)' : 'var(--bg-subtle, #F2F4F6)',
                      border: enabled ? '1px solid rgba(49,130,246,0.18)' : '1px solid transparent',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{meta.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
                        {meta.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {meta.desc}
                      </div>
                    </div>
                    <span style={{
                      width: 36, height: 20, borderRadius: 12, position: 'relative',
                      background: enabled ? '#3182F6' : '#D1D6DB',
                      transition: 'background 0.2s', flexShrink: 0,
                    }}>
                      <span style={{
                        position: 'absolute', top: 2, left: enabled ? 18 : 2,
                        width: 16, height: 16, borderRadius: '50%', background: 'white',
                        transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                      }} />
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 무음 시간대 */}
            <button
              onClick={toggleQuietHours}
              aria-pressed={alertPrefsState.quietHours}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 10, marginTop: 10,
                background: alertPrefsState.quietHours ? 'rgba(175,82,222,0.06)' : 'var(--bg-subtle, #F2F4F6)',
                border: alertPrefsState.quietHours ? '1px solid rgba(175,82,222,0.18)' : '1px solid transparent',
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}
            >
              <span style={{ fontSize: 16 }}>🌙</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
                  무음 시간대
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)' }}>
                  KST 22:00 ~ 07:00 토스트·푸시 끄기
                </div>
              </div>
              <span style={{
                width: 36, height: 20, borderRadius: 12, position: 'relative',
                background: alertPrefsState.quietHours ? '#AF52DE' : '#D1D6DB',
                transition: 'background 0.2s', flexShrink: 0,
              }}>
                <span style={{
                  position: 'absolute', top: 2, left: alertPrefsState.quietHours ? 18 : 2,
                  width: 16, height: 16, borderRadius: '50%', background: 'white',
                  transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                }} />
              </span>
            </button>
          </div>

          {/* 알림 학습 */}
          <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #191F28)', marginBottom: 4 }}>
              🧠 알림 학습
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 12, lineHeight: 1.6 }}>
              자주 닫으신 알림 타입은 자동으로 덜 보여드려요.<br />
              최근 7일 내 3회 이상 해제된 타입이 숨김 대상입니다.
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

                <button
                  onClick={() => {
                    resetAlertLearning();
                    setSuppressedTypes([]);
                    setSuppressedCategories([]);
                  }}
                  style={{
                    width: '100%', padding: '10px 0', borderRadius: 10,
                    fontSize: 13, fontWeight: 600,
                    color: 'var(--text-secondary, #4E5968)',
                    background: 'var(--surface, #FFFFFF)',
                    border: '1px solid var(--border-strong, #E5E8EB)',
                    cursor: 'pointer',
                  }}
                >
                  학습 기록 모두 초기화
                </button>
              </>
            )}
          </div>

          {/* 친구 초대 */}
          <div style={{ marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid var(--border-light, #F2F4F6)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #191F28)', marginBottom: 4 }}>
              친구 초대
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 12 }}>
              초대 코드를 공유해 친구를 주비 베타에 초대하세요
            </div>
            <InviteSection />
          </div>

          {/* Danger Zone */}
          <div style={{ paddingTop: 24, borderTop: '1px solid var(--border-light, #F2F4F6)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #191F28)', marginBottom: 8 }}>
              위험 구역
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginBottom: 12 }}>
              이 작업은 되돌릴 수 없습니다
            </div>
            <button
              onClick={handleClearAll}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 10,
                background: 'var(--surface, white)',
                color: '#EF4452',
                fontSize: 14,
                fontWeight: 600,
                border: '1px solid #EF4452',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover, #FFF5F5)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface, white)')}
            >
              전체 데이터 초기화
            </button>
            <div style={{ fontSize: 11, color: '#B0B8C1', textAlign: 'center', marginTop: 8 }}>
              모든 종목, 설정, 캐시 데이터가 삭제됩니다
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
