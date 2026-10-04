'use client';
import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useModalViewport } from '@/hooks/useModalViewport';
import { usePortfolioStore } from '@/store/portfolioStore';
import { inferInvestorBehavior } from '@/utils/investorBehavior';
import { INVESTOR_TYPES } from '@/config/investorTypes';
import InvestorTypeQuiz from './InvestorTypeQuiz';
import InvestorTypeIcon from './InvestorTypeIcon';
import { ChevronRight, GitCompare, ScanSearch } from 'lucide-react';

export default function InvestorProfile() {
  const { stocks, macroData, investorType, investorTypeSetAt, setInvestorType } = usePortfolioStore(useShallow(state => ({
    stocks: state.stocks, macroData: state.macroData, investorType: state.investorType,
    investorTypeSetAt: state.investorTypeSetAt, setInvestorType: state.setInvestorType,
  })));
  const [showQuiz, setShowQuiz] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(showQuiz, dialogRef, () => setShowQuiz(false));
  useModalViewport(showQuiz, dialogRef);
  const hasAnyStock = stocks.investing.length + stocks.watching.length > 0;
  const hasTypeSet = !!investorTypeSetAt;
  const typeMeta = INVESTOR_TYPES[investorType];
  const behavior = hasTypeSet ? inferInvestorBehavior(stocks.investing, macroData, investorType) : null;
  const bestFitMeta = behavior?.isMismatch ? INVESTOR_TYPES[behavior.bestFit] : null;
  return <div>
      {/* 유형 미설정 → 부드러운 유도 배너 */}
      {!hasTypeSet && (
        <button
          onClick={() => setShowQuiz(true)}
          style={{
            width: '100%', marginBottom: 16,
            padding: '14px 16px',
            borderRadius: 14,
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-light)',
            textAlign: 'left', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <ScanSearch size={24} strokeWidth={1.75} color="var(--text-body)" aria-hidden="true" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
              내 투자 유형 알아보기
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A1)', marginTop: 2 }}>
              간단한 질문으로 선호하는 설명 방식을 골라보세요
            </div>
          </div>
          <ChevronRight size={16} color="var(--text-body)" aria-hidden="true" />
        </button>
      )}

      {/* 유형 설정 완료 → 작은 뱃지 */}
      {hasTypeSet && (
        <button
          onClick={() => setShowQuiz(true)}
          aria-label={`현재 투자 유형: ${typeMeta.nameKr}. 변경하려면 클릭`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginBottom: behavior?.isMismatch ? 8 : 14,
            padding: '8px 12px', borderRadius: 12, minHeight: 44,
            background: 'var(--bg-subtle, #F8F9FA)',
            border: '1px solid var(--border-light)',
            cursor: 'pointer',
          }}
        >
          <InvestorTypeIcon type={typeMeta.id} size={18} color="var(--text-body)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {typeMeta.nameKr}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-body)' }}>변경 ›</span>
        </button>
      )}

      {/* P3 — 행동 보정 힌트: 자가진단 vs 실제 포트폴리오 미스매치 */}
      {hasAnyStock && behavior?.isMismatch && bestFitMeta && (
        <div
          role="status"
          aria-label="투자 성향 행동 보정 힌트"
          style={{
            marginBottom: 14,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <GitCompare size={18} color="var(--text-secondary, #8B95A1)" strokeWidth={1.75} aria-hidden="true" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5 }}>
              자가진단은 <strong style={{ color: 'var(--text-primary)' }}>{typeMeta.nameKr}</strong>인데,
              현재 포트폴리오는 <strong style={{ color: 'var(--text-primary)' }}>{bestFitMeta.nameKr}</strong> 패턴에 더 가까워요
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-body)', marginTop: 4 }}>
              섹터 분포 {behavior.gapPct.toFixed(0)}%p 차이 · 의도적이라면 무시하세요
            </div>
          </div>
          <button
            onClick={() => setShowQuiz(true)}
            style={{
              flexShrink: 0,
              padding: '8px 10px', minHeight: 44,
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--surface, #FFFFFF)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            재진단
          </button>
        </div>
      )}

      {/* 퀴즈 모달 */}
      {showQuiz && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="투자자 유형 퀴즈"
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowQuiz(false); }}
        >
          <div
            style={{
              background: 'var(--surface, #FFFFFF)', borderRadius: 20,
              maxHeight: 'calc(var(--modal-viewport-height, 100dvh) - 32px)', overflow: 'auto',
              padding: '28px 24px 24px', width: '100%', maxWidth: 480,
            }}
          >
            <InvestorTypeQuiz
              onComplete={(type) => {
                setInvestorType(type);
                setShowQuiz(false);
              }}
              onSkip={() => setShowQuiz(false)}
              onClose={() => setShowQuiz(false)}
            />
          </div>
        </div>
      )}

  </div>;
}
