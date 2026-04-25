'use client';

import { useRef, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import AiChokSection from '@/components/portfolio/AiChokSection';
import ConversationalTimeline from '@/components/portfolio/ConversationalTimeline';
import CohortReference from '@/components/portfolio/CohortReference';
import { inferInvestorBehavior } from '@/utils/investorBehavior';
import EmptyState from '@/components/common/EmptyState';
import InvestorTypeQuiz from './InvestorTypeQuiz';
import { INVESTOR_TYPES } from '@/config/investorTypes';

/**
 * AI 인사이트 탭 — IA 재정비 (전문가 회의 결과 적용)
 *
 * 발견/AI 카테고리만 잔여:
 *   1. AI 촉 (실제 Gemini 호출 — 오늘의 종목 발견)
 *   2. 주비의 이야기 (오늘 상태 내러티브)
 *   3. 숨은 종목 (유형별 큐레이션 + 섹터 비교)
 *
 * 분석 탭(종목 → 분석 서브탭)으로 이동된 회고/통계 컴포넌트:
 *   - ThrowbackCard (과거 비교 — 분석 카테고리)
 *   - TradePatternMirror (메모 통계 — 분석 카테고리)
 *   - PortfolioDNA (캐릭터 분류 — Health와 함께)
 *
 * 종목 탭 시즌 카드로 이동:
 *   - MonthlyReplay (월말~월초만 강조, 시간 적응형)
 */

interface SectionRef {
  id: string;
  label: string;
  emoji: string;
  element: React.RefObject<HTMLDivElement | null>;
}

export default function InsightsSection() {
  const { stocks, macroData, investorType, investorTypeSetAt, setInvestorType } = usePortfolioStore();
  const [showQuiz, setShowQuiz] = useState(false);
  const investingCount = (stocks.investing || []).filter(s => s.avgCost > 0 && s.shares > 0).length;
  const hasAnyStock = (stocks.investing?.length || 0) + (stocks.watching?.length || 0) > 0;
  const hasTypeSet = !!investorTypeSetAt;
  const typeMeta = INVESTOR_TYPES[investorType];

  // P3 — 행동 보정: 자가진단 vs 실제 포트폴리오 매칭
  const behavior = hasTypeSet
    ? inferInvestorBehavior(stocks.investing || [], macroData, investorType)
    : null;
  const bestFitMeta = behavior?.isMismatch ? INVESTOR_TYPES[behavior.bestFit] : null;

  const chokRef = useRef<HTMLDivElement>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const cohortRef = useRef<HTMLDivElement>(null);

  const sections: SectionRef[] = [
    { id: 'chok',   label: '촉',       emoji: '🎯', element: chokRef },
    { id: 'story',  label: '이야기',   emoji: '💬', element: storyRef },
    { id: 'cohort', label: '숨은 종목', emoji: '🌐', element: cohortRef },
  ];

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      const offsetTop = ref.current.getBoundingClientRect().top + window.scrollY - 80; // 헤더 여유
      window.scrollTo({ top: offsetTop, behavior: 'smooth' });
    }
  };

  return (
    <div>
      {/* 페이지 타이틀 */}
      <div style={{ marginBottom: 16 }}>
        <h1
          style={{
            fontSize: 22, fontWeight: 800, color: 'var(--text-primary, #191F28)',
            marginBottom: 6, letterSpacing: '-0.01em',
          }}
        >
          🤖 AI 인사이트
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary, #8B95A1)', lineHeight: 1.5 }}>
          주비 AI가 읽어주는 오늘의 포트폴리오 이야기
        </p>
      </div>

      {/* 유형 미설정 → 부드러운 유도 배너 */}
      {hasAnyStock && !hasTypeSet && (
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
          <span style={{ fontSize: 24 }}>🎯</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
              내 투자 유형 알아보기
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary, #8B95A1)', marginTop: 2 }}>
              1분 퀴즈로 나에게 맞춘 AI를 받아보세요
            </div>
          </div>
          <span style={{ fontSize: 14, color: 'var(--text-tertiary, #B0B8C1)' }}>›</span>
        </button>
      )}

      {/* 유형 설정 완료 → 작은 뱃지 */}
      {hasAnyStock && hasTypeSet && (
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
          <span style={{ fontSize: 14 }}>{typeMeta.emoji}</span>
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
          <span style={{ fontSize: 18, flexShrink: 0 }}>🪞</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary, #4E5968)', lineHeight: 1.5 }}>
              자가진단은 <strong style={{ color: typeMeta.accentColor }}>{typeMeta.emoji} {typeMeta.nameKr}</strong>인데,
              현재 포트폴리오는 <strong style={{ color: bestFitMeta.accentColor }}>{bestFitMeta.emoji} {bestFitMeta.nameKr}</strong> 패턴에 더 가까워요
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

      {/* 종목 없을 때 */}
      {!hasAnyStock ? (
        <EmptyState
          icon="🤖"
          title="아직 분석할 종목이 없어요"
          description="종목을 추가하면 주비 AI가 맞춤 인사이트를 만들어드려요."
          primaryAction={{
            label: '종목 추가하기',
            onClick: () => {
              const btn = document.querySelector('[data-slot="search-trigger"]') as HTMLElement;
              if (btn) btn.click();
            },
          }}
        />
      ) : (
        <>
          {/* Mini-nav — 섹션 빠른 이동 */}
          {investingCount > 0 && (
            <div
              role="navigation"
              aria-label="인사이트 섹션 바로가기"
              className="flex scrollbar-hide"
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 5,
                gap: 6,
                padding: '10px 2px',
                marginBottom: 12,
                overflowX: 'auto',
                background: 'var(--bg, #FFFFFF)',
                borderBottom: '1px solid var(--border-light, #F2F4F6)',
              }}
            >
              {sections.map(s => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.element)}
                  aria-label={`${s.label} 섹션으로 이동`}
                  className="cursor-pointer shrink-0"
                  style={{
                    padding: '6px 12px', borderRadius: 20,
                    fontSize: 12, fontWeight: 600,
                    color: 'var(--text-secondary, #4E5968)',
                    background: 'var(--bg-subtle, #F2F4F6)',
                    border: 'none', whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: 4,
                    minHeight: 32,
                  }}
                >
                  <span>{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          )}

          <style>{`
            @keyframes insight-fade-in {
              from { opacity: 0; transform: translateY(8px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .insight-stagger {
              opacity: 0;
              animation: insight-fade-in 0.4s ease-out forwards;
            }
          `}</style>

          {/* 1. AI 촉 — 오늘의 발견 */}
          <div ref={chokRef} className="insight-stagger" style={{ animationDelay: '0s' }}>
            <AiChokSection />
          </div>

          {/* 2. 주비의 이야기 — 오늘 상태 내러티브 */}
          {investingCount > 0 && (
            <div ref={storyRef} className="insight-stagger" style={{ animationDelay: '0.1s' }}>
              <ConversationalTimeline />
            </div>
          )}

          {/* 3. 숨은 종목 — 같은 유형 투자자가 자주 보는 (큐레이션, 추천 아님)
              유형 미설정 시에도 placeholder 노출(미니 nav 클릭 작동) */}
          {hasAnyStock && (
            <div ref={cohortRef} className="insight-stagger" style={{ animationDelay: '0.2s' }}>
              <CohortReference onStartQuiz={() => setShowQuiz(true)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
