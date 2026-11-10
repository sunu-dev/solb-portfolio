'use client';
import { openEconomicCalendar } from '@/components/economy/EconomicHighlights';
import { usePortfolioStore } from '@/store/portfolioStore';
import ConversationalTimeline from '@/components/portfolio/ConversationalTimeline';
import { ChevronRight } from 'lucide-react';
import reportStyles from './ReportOverview.module.css';
import MarketGuide, { type MarketGuideRequest } from './MarketGuide';
import PersonalMarketReport from './PersonalMarketReport';
import MarketWatch from '@/components/market/MarketWatch';

export default function InsightsSection({ guideRequest }: { guideRequest?: MarketGuideRequest }) {
  const stocks = usePortfolioStore(s => s.stocks);
  const hasHoldings = stocks.investing.some(s => s.avgCost > 0 && s.shares > 0);
  return <div className={reportStyles.report}>
    <header className={reportStyles.header}>
      <div><p className={reportStyles.eyebrow}>시장 소식과 내 종목 점검</p><h1>주비 리포트</h1></div>
      <button onClick={() => window.dispatchEvent(new CustomEvent('open-briefing'))}>브리핑 다시 보기</button>
    </header>
    <MarketGuide request={guideRequest}>
    <MarketWatch />
    <PersonalMarketReport />
    <section className={reportStyles.check} data-tour="insights-story" aria-label="내 종목 점검">
      <h2>내 종목 점검</h2>
      {hasHoldings ? <ConversationalTimeline /> : <div className={reportStyles.emptyCheck}><p>궁금한 회사 하나부터 최근 소식과 뜻을 살펴보세요.</p><button type="button" onClick={() => document.querySelector<HTMLButtonElement>('[data-slot="search-trigger"]')?.click()}>관심 있는 회사 찾기 →</button></div>}
    </section>
    <button className={reportStyles.calendar} onClick={() => openEconomicCalendar()}><span><strong>다가오는 경제 일정</strong><small>금리·물가·고용·내 종목 실적</small></span><ChevronRight size={20} aria-hidden="true" /></button>
    </MarketGuide>
  </div>;
}
