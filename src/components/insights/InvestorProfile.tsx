'use client';
import { useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { inferInvestorBehavior } from '@/utils/investorBehavior';
import { INVESTOR_TYPES } from '@/config/investorTypes';
import InvestorTypeQuiz from './InvestorTypeQuiz';
import InvestorTypeIcon from './InvestorTypeIcon';
import { ChevronRight, GitCompare, ScanSearch } from 'lucide-react';

export default function InvestorProfile() {
  const { stocks, macroData, investorType, investorTypeSetAt, setInvestorType } = usePortfolioStore();
  const [showQuiz, setShowQuiz] = useState(false);
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
            background: 'linear-gradient(135deg, var(--color-info-bg, rgba(49,130,246,0.08)) 0%, rgba(175,82,222,0.06) 100%)',
            border: '1px solid rgba(49,130,246,0.18)',
            textAlign: 'left', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <ScanSearch size={24} strokeWidth={1.75} color="var(--color-info, #3182F6)" aria-hidden="true" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
              내 투자 유형 알아보기
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B95A1)', marginTop: 2 }}>
              1분 퀴즈로 나에게 맞춘 AI를 받아보세요
            </div>
          </div>
          <ChevronRight size={16} color="var(--text-tertiary, #B0B8C1)" aria-hidden="true" />
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
            padding: '6px 12px', borderRadius: 20,
            background: 'var(--bg-subtle, #F8F9FA)',
            border: `1px solid ${typeMeta.accentColor}33`,
            cursor: 'pointer',
          }}
        >
          <InvestorTypeIcon type={typeMeta.id} size={15} color={typeMeta.accentColor} />
          <span style={{ fontSize: 11, fontWeight: 700, color: typeMeta.accentColor }}>
            {typeMeta.nameKr}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)' }}>변경 ›</span>
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
            background: `linear-gradient(135deg, ${bestFitMeta.accentColor}10, ${typeMeta.accentColor}08)`,
            border: `1px solid ${bestFitMeta.accentColor}30`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <GitCompare size={18} color="var(--text-secondary, #8B95A1)" strokeWidth={1.75} aria-hidden="true" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5 }}>
              자가진단은 <strong style={{ color: typeMeta.accentColor }}>{typeMeta.nameKr}</strong>인데,
              현재 포트폴리오는 <strong style={{ color: bestFitMeta.accentColor }}>{bestFitMeta.nameKr}</strong> 패턴에 더 가까워요
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 4 }}>
              섹터 분포 {behavior.gapPct.toFixed(0)}%p 차이 · 의도적이라면 무시하세요
            </div>
          </div>
          <button
            onClick={() => setShowQuiz(true)}
            style={{
              flexShrink: 0,
              padding: '5px 10px',
              borderRadius: 8,
              fontSize: 10,
              fontWeight: 600,
              background: 'var(--surface, #FFFFFF)',
              border: `1px solid ${bestFitMeta.accentColor}40`,
              color: bestFitMeta.accentColor,
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
              maxHeight: '92vh', overflow: 'auto',
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
