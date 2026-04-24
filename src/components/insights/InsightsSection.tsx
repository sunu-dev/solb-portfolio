'use client';

import { usePortfolioStore } from '@/store/portfolioStore';
import AiChokSection from '@/components/portfolio/AiChokSection';
import PortfolioDNA from '@/components/portfolio/PortfolioDNA';
import ConversationalTimeline from '@/components/portfolio/ConversationalTimeline';
import MonthlyReplay from '@/components/portfolio/MonthlyReplay';
import YearAgoCard from '@/components/portfolio/YearAgoCard';
import EmptyState from '@/components/common/EmptyState';

/**
 * AI 인사이트 탭
 * - AI 생성 콘텐츠 허브 (촉·DNA·내러티브·회고)
 * - 바텀 네비 전용 탭, 포트폴리오/분석 탭에서 흩어진 AI 섹션들을 한 곳에 집중
 */
export default function InsightsSection() {
  const { stocks } = usePortfolioStore();
  const investingCount = (stocks.investing || []).filter(s => s.avgCost > 0 && s.shares > 0).length;
  const hasAnyStock = (stocks.investing?.length || 0) + (stocks.watching?.length || 0) > 0;

  return (
    <div>
      {/* 페이지 타이틀 */}
      <div style={{ marginBottom: 24 }}>
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
          {/* 1. AI 촉 — 가장 시그니처 */}
          <AiChokSection />

          {/* 2. 포트폴리오 DNA — 내 투자 캐릭터 (투자 중 종목 있을 때만) */}
          {investingCount > 0 && <PortfolioDNA />}

          {/* 3. 주비의 이야기 — 채팅형 내러티브 */}
          {investingCount > 0 && <ConversationalTimeline />}

          {/* 4. 월간 회고 */}
          {investingCount > 0 && <MonthlyReplay />}

          {/* 5. 1년 전 오늘 */}
          {investingCount > 0 && <YearAgoCard />}
        </>
      )}
    </div>
  );
}
