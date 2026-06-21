'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolioStore, type MainSection } from '@/store/portfolioStore';
import { logApiCall } from '@/lib/apiLogger';

/**
 * 진행형 시작하기 체크리스트 (Phase 4 — 학습 루프 / 리텐션).
 *
 * Phase 2의 feature_first_use(solb_feat_used)를 자동 체크 소스로 사용 — 사용자가 기능을 처음 쓰면
 * logFeatureFirstUse가 solb_feat_used에 기록 + 'solb-feature-used' 이벤트 → 체크리스트 항목이 자동 ✓.
 *
 * 노출: 로그인 사용자 + 미완료(<100%) + 미디스미스. 100% 또는 디스미스 시 영구 숨김(강요 금지).
 * 카피는 descriptive(§6). 항목 클릭 시 해당 영역으로 안내(미완료만).
 */

const FEAT_KEY = 'solb_feat_used';
const DISMISS_KEY = 'solb_checklist_dismissed';
const DONE_LOGGED_KEY = 'solb_checklist_done_logged';

type ItemAction =
  | { kind: 'section'; section: MainSection }
  | { kind: 'event'; event: string };

interface ChecklistItem {
  featureId: string;
  label: string;
  hint: string;
  action: ItemAction;
}

const ITEMS: ChecklistItem[] = [
  { featureId: 'stock-add', label: '내 종목 추가',   hint: '검색해서 보유 종목을 담아보세요',        action: { kind: 'section', section: 'portfolio' } },
  { featureId: 'ai-hunch',  label: 'AI 촉 받아보기', hint: 'AI 인사이트에서 오늘의 새 종목 정보를 확인', action: { kind: 'section', section: 'insights' } },
  { featureId: 'analysis',  label: '종목 분석 열기', hint: '종목 추가 후 건강 점수·차트 보기',          action: { kind: 'section', section: 'portfolio' } },
  { featureId: 'mentor',    label: '멘토 분석 보기', hint: '종목 분석에서 6명의 관점 보기',             action: { kind: 'section', section: 'portfolio' } },
  { featureId: 'home-edit', label: '홈 화면 편집',   hint: '위젯을 내 방식대로 정리',                  action: { kind: 'event', event: 'solb-open-home-edit' } },
];

export default function GettingStartedChecklist() {
  const { user, loading } = useAuth();
  // 신규자 한정 — 가입 14일 이내만 노출. 배포 시점에 이미 있던 기존 유저는 solb_feat_used가 비어(과거 사용분 미기록)
  // '0/5 시작하기'가 갑툭튀하므로 created_at 게이트로 차단.
  const createdAt = (user as { created_at?: string } | null)?.created_at;
  const isNew = !!createdAt && (Date.now() - new Date(createdAt).getTime()) < 14 * 24 * 60 * 60 * 1000;
  const [done, setDone] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(() => {
    try {
      const v = JSON.parse(localStorage.getItem(FEAT_KEY) || '[]');
      setDone(Array.isArray(v) ? v : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refresh();
    try { setDismissed(!!localStorage.getItem(DISMISS_KEY)); } catch { /* ignore */ }
    setChecked(true);
    const h = () => refresh();
    window.addEventListener('solb-feature-used', h);
    window.addEventListener('storage', h); // 다른 탭 동기화
    return () => {
      window.removeEventListener('solb-feature-used', h);
      window.removeEventListener('storage', h);
    };
  }, [refresh]);

  const completed = ITEMS.filter(it => done.includes(it.featureId)).length;
  const allDone = completed === ITEMS.length;

  // 100% 도달 1회 텔레메트리
  useEffect(() => {
    if (!allDone || !user || !isNew) return;
    try {
      if (!localStorage.getItem(DONE_LOGGED_KEY)) {
        localStorage.setItem(DONE_LOGGED_KEY, '1');
        logApiCall('checklist_complete');
      }
    } catch { /* ignore */ }
  }, [allDone, user, isNew]);

  if (!checked || loading) return null;
  if (!user || !isNew) return null;        // 로그인 + 신규자(가입 14일 내)만
  if (dismissed || allDone) return null;    // 스킵 또는 완료 시 영구 숨김

  const act = (item: ChecklistItem) => {
    if (done.includes(item.featureId)) return;
    logApiCall('checklist_item_click', undefined, { featureId: item.featureId });
    // 분석/멘토는 종목이 있어야 의미 → 첫 보유 분석 패널 직접 열기, 없으면 종목 추가로 유도(막다른 길 방지)
    if (item.featureId === 'analysis' || item.featureId === 'mentor') {
      const inv = usePortfolioStore.getState().stocks.investing.filter(s => !s.demo);
      if (inv.length > 0) usePortfolioStore.getState().setAnalysisSymbol(inv[0].symbol);
      else usePortfolioStore.getState().setCurrentSection('portfolio');
      return;
    }
    if (item.action.kind === 'section') usePortfolioStore.getState().setCurrentSection(item.action.section);
    else window.dispatchEvent(new CustomEvent(item.action.event));
  };

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
    logApiCall('checklist_dismissed', undefined, { at: completed });
  };

  const pct = Math.round((completed / ITEMS.length) * 100);

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
          🚀 주비 시작하기 <span style={{ color: 'var(--brand-primary)' }}>{completed}/{ITEMS.length}</span>
        </span>
        <button
          onClick={dismiss}
          aria-label="시작하기 체크리스트 닫기"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 8, lineHeight: 1 }}
        >
          <X size={15} />
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10 }}>천천히 하나씩 익혀보세요.</div>

      {/* 진행 바 */}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={ITEMS.length}
        aria-valuenow={completed}
        aria-label="시작하기 진행률"
        style={{ height: 6, borderRadius: 3, background: 'var(--bg-subtle)', overflow: 'hidden', marginBottom: 12 }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand-primary)', transition: 'width 0.3s ease' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {ITEMS.map((item) => {
          const isDone = done.includes(item.featureId);
          return (
            <button
              key={item.featureId}
              onClick={() => act(item)}
              disabled={isDone}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                padding: '8px 6px', borderRadius: 10, background: 'none', border: 'none',
                cursor: isDone ? 'default' : 'pointer',
              }}
            >
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                width: 22, height: 22, borderRadius: 11,
                background: isDone ? 'var(--brand-primary)' : 'transparent',
                border: isDone ? 'none' : '2px solid var(--border-strong, var(--border-light))',
                color: 'var(--on-brand-fg)',
              }}>
                {isDone && <Check size={13} strokeWidth={3} />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: isDone ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>
                  {item.label}
                </span>
                {!isDone && (
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{item.hint}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
