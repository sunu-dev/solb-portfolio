'use client';

import { useEffect, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useStockData, useMacroData, useAutoRefresh } from '@/hooks/useStockData';
import { useRealtimePrice } from '@/hooks/useRealtimePrice';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolioSync } from '@/hooks/usePortfolioSync';
import { useNotification } from '@/hooks/useNotification';
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
import ToastAlert from '@/components/common/ToastAlert';
import LoginModal from '@/components/auth/LoginModal';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';
import { logApiCall } from '@/lib/apiLogger';

export default function Home() {
  const { currentSection, loadPortfolio, analysisSymbol, darkMode } = usePortfolioStore();
  const { refreshAll } = useStockData();
  const { fetchMacro } = useMacroData();
  const { user, loading: authLoading, signInWithGoogle, signInWithKakao, signOut } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Supabase DB 동기화 (로그인 시에만 활성화)
  usePortfolioSync(user);

  // PWA push notifications
  useNotification();

  useEffect(() => {
    const unsub = usePortfolioStore.persist.onFinishHydration(() => {
      setHydrated(true);
      loadPortfolio();
      // Macro and quotes in parallel for faster first paint
      Promise.all([fetchMacro(), refreshAll()]);
    });
    if (usePortfolioStore.persist.hasHydrated()) {
      setHydrated(true);
      loadPortfolio();
      Promise.all([fetchMacro(), refreshAll()]);
    }
    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Log login event
  useEffect(() => {
    if (user && !authLoading) {
      logApiCall('login', undefined, { provider: user.app_metadata?.provider || 'unknown' });
    }
  }, [user, authLoading]);

  // Show onboarding on first login
  useEffect(() => {
    if (user && !authLoading) {
      const onboarded = localStorage.getItem('solb_onboarded');
      if (!onboarded) {
        setShowOnboarding(true);
      }
    }
  }, [user, authLoading]);

  const handleOnboardingComplete = () => {
    localStorage.setItem('solb_onboarded', 'true');
    setShowOnboarding(false);
  };

  // Apply dark class to html element
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useAutoRefresh();
  useRealtimePrice();

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#B0B8C1] text-[13px]">불러오는 중...</div>
      </div>
    );
  }

  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    '';

  return (
    <div className="min-h-screen bg-white flex flex-col overflow-x-hidden">
      {/* Sticky Header - 48px */}
      <Header
        user={user}
        onLoginClick={() => setShowLogin(true)}
        onSignOut={signOut}
      />

      {/* Market Summary - one line */}
      <MarketSummary />

      {/* Main body: content + right sidebar */}
      <div className="flex flex-1 w-full" style={{ minHeight: 'calc(100vh - 48px - 49px - 32px)', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Main content area */}
        <main className="flex-1 min-w-0 main-content" style={{ padding: '20px 16px 60px 16px' }}>
          <style>{`@media (min-width: 769px) { .main-content { padding: 40px 48px 80px 48px !important; } }`}</style>
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
      <ToastAlert />
      {analysisSymbol && <AnalysisPanel />}
      <EditStockModal />
      <SettingsPanel />

      {/* Auth overlays */}
      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onGoogleLogin={() => {
          setShowLogin(false);
          signInWithGoogle();
        }}
        onKakaoLogin={() => {
          setShowLogin(false);
          signInWithKakao();
        }}
      />

      {/* Onboarding overlay */}
      {showOnboarding && (
        <OnboardingFlow
          userName={userName}
          onComplete={handleOnboardingComplete}
        />
      )}
    </div>
  );
}
