'use client';

import { useEffect } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useStockData, useMacroData, useAutoRefresh } from '@/hooks/useStockData';
import Header from '@/components/layout/Header';
import MainNav from '@/components/layout/MainNav';
import MacroStrip from '@/components/portfolio/MacroStrip';
import PortfolioHero from '@/components/portfolio/PortfolioHero';
import StockList from '@/components/portfolio/StockList';
import SearchBar from '@/components/portfolio/SearchBar';
import EventsSection from '@/components/events/EventsSection';
import NewsSection from '@/components/news/NewsSection';
import AnalysisPanel from '@/components/analysis/AnalysisPanel';
import EditStockModal from '@/components/common/EditStockModal';
import SettingsPanel from '@/components/common/SettingsPanel';

export default function Home() {
  const { currentSection, loadPortfolio, analysisSymbol } = usePortfolioStore();
  const { refreshAll } = useStockData();
  const { fetchMacro } = useMacroData();

  useEffect(() => {
    // Wait for Zustand hydration, then fetch
    const unsub = usePortfolioStore.persist.onFinishHydration(() => {
      loadPortfolio();
      fetchMacro();
      refreshAll();
    });
    // If already hydrated
    if (usePortfolioStore.persist.hasHydrated()) {
      loadPortfolio();
      fetchMacro();
      refreshAll();
    }
    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useAutoRefresh();

  return (
    <div className="min-h-screen bg-[#F2F4F6]">
      <div className="max-w-[460px] mx-auto">
        <Header />
        <MainNav />

        <div className="px-5 pb-12">
          {currentSection === 'portfolio' && (
            <>
              <PortfolioHero />
              <MacroStrip />
              <SearchBar />
              <StockList />
            </>
          )}
          {currentSection === 'events' && <EventsSection />}
          {currentSection === 'news' && <NewsSection />}
        </div>
      </div>

      {analysisSymbol && <AnalysisPanel />}
      <EditStockModal />
      <SettingsPanel />
    </div>
  );
}
