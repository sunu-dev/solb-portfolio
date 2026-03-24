'use client';

import { useEffect, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useStockData, useMacroData, useAutoRefresh } from '@/hooks/useStockData';
import Header from '@/components/layout/Header';
import MarketSummary from '@/components/layout/MarketSummary';
import RightSidebar from '@/components/layout/RightSidebar';
import BottomTicker from '@/components/layout/BottomTicker';
import PortfolioSection from '@/components/portfolio/PortfolioSection';
import EventsSection from '@/components/events/EventsSection';
import NewsSection from '@/components/news/NewsSection';
import AnalysisPanel from '@/components/analysis/AnalysisPanel';
import EditStockModal from '@/components/common/EditStockModal';
import SettingsPanel from '@/components/common/SettingsPanel';

export default function Home() {
  const { currentSection, loadPortfolio, analysisSymbol } = usePortfolioStore();
  const { refreshAll } = useStockData();
  const { fetchMacro } = useMacroData();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = usePortfolioStore.persist.onFinishHydration(() => {
      setHydrated(true);
      loadPortfolio();
      fetchMacro();
      refreshAll();
    });
    if (usePortfolioStore.persist.hasHydrated()) {
      setHydrated(true);
      loadPortfolio();
      fetchMacro();
      refreshAll();
    }
    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useAutoRefresh();

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#B0B8C1] text-[13px]">불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Sticky Header - 48px */}
      <Header />

      {/* Market Summary - one line */}
      <MarketSummary />

      {/* Main body: content + right sidebar */}
      <div className="flex flex-1 max-w-[1400px] mx-auto w-full" style={{ minHeight: 'calc(100vh - 48px - 49px - 32px)' }}>
        {/* Main content area */}
        <main className="flex-1 min-w-0" style={{ padding: '40px 48px 80px 48px' }}>
          {currentSection === 'portfolio' && <PortfolioSection />}
          {currentSection === 'events' && <EventsSection />}
          {currentSection === 'news' && <NewsSection />}
        </main>

        {/* Right sidebar - always visible on desktop */}
        <aside className="hidden lg:block w-[280px] shrink-0 border-l border-[#F2F4F6]" style={{ padding: '32px 24px 80px 24px' }}>
          <RightSidebar />
        </aside>
      </div>

      {/* Bottom ticker - 32px fixed */}
      <BottomTicker />

      {/* Overlays */}
      {analysisSymbol && <AnalysisPanel />}
      <EditStockModal />
      <SettingsPanel />
    </div>
  );
}
