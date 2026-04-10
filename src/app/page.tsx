'use client';

import { useEffect, useState } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useStockData, useMacroData, useAutoRefresh } from '@/hooks/useStockData';
import type { MacroEntry, QuoteData } from '@/config/constants';
import { useRealtimePrice } from '@/hooks/useRealtimePrice';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolioSync } from '@/hooks/usePortfolioSync';
import { useNotification } from '@/hooks/useNotification';
import Header from '@/components/layout/Header';
import MarketSummary from '@/components/layout/MarketSummary';
import RightSidebar from '@/components/layout/RightSidebar';
import BadgeSection from '@/components/portfolio/BadgeSection';
import BottomTicker from '@/components/layout/BottomTicker';
import OfflineNotice from '@/components/common/OfflineNotice';
import MobileNav from '@/components/layout/MobileNav';
import MobileSidebar from '@/components/layout/MobileSidebar';
import MobileAlertSheet from '@/components/layout/MobileAlertSheet';
import PortfolioSection from '@/components/portfolio/PortfolioSection';
import EventsSection from '@/components/events/EventsSection';
import NewsSection from '@/components/news/NewsSection';
import AnalysisPanel from '@/components/analysis/AnalysisPanel';
import EditStockModal from '@/components/common/EditStockModal';
import SettingsPanel from '@/components/common/SettingsPanel';
// ToastAlert removed — alerts now shown in sidebar notification center
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
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showMobileAlerts, setShowMobileAlerts] = useState(false);

  // Mobile alert sheet open via custom event (from header bell icon)
  useEffect(() => {
    const handler = () => setShowMobileAlerts(true);
    window.addEventListener('open-mobile-alerts', handler);
    return () => window.removeEventListener('open-mobile-alerts', handler);
  }, []);

  // Supabase DB 동기화 (로그인 시에만 활성화)
  usePortfolioSync(user);

  // PWA push notifications
  useNotification();

  useEffect(() => {
    let initialized = false;
    const init = () => {
      if (initialized) return;
      initialized = true;
      setHydrated(true);
      loadPortfolio();

      // Instantly restore cached macro + quote data from localStorage
      const { updateMacroEntry } = usePortfolioStore.getState();
      try {
        const macroCached = localStorage.getItem('solb_macro_cache');
        if (macroCached) {
          const { data, ts } = JSON.parse(macroCached);
          if (Date.now() - ts < 30 * 60 * 1000) {
            for (const [key, val] of Object.entries(data)) {
              if (val) updateMacroEntry(key, val as MacroEntry);
            }
          }
        }
      } catch { /* ignore */ }
      try {
        const quoteCached = localStorage.getItem('solb_quote_cache');
        if (quoteCached) {
          const { data, ts } = JSON.parse(quoteCached);
          if (Date.now() - ts < 30 * 60 * 1000) {
            for (const [sym, quote] of Object.entries(data)) {
              if (quote && (quote as QuoteData).c) updateMacroEntry(sym, quote as QuoteData);
            }
          }
        }
      } catch { /* ignore */ }

      // Finnhub 키를 서버에서 가져와 스토어에 저장 (번들 노출 방지)
      const { apiKey, setApiKey } = usePortfolioStore.getState();
      if (!apiKey) {
        fetch('/api/ws-token').then(r => r.json()).then(({ token }) => {
          if (token) setApiKey(token);
        }).catch(() => {});
      }

      Promise.all([fetchMacro(), refreshAll()]);
    };
    const unsub = usePortfolioStore.persist.onFinishHydration(init);
    if (usePortfolioStore.persist.hasHydrated()) init();
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg, #FFFFFF)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, background: 'var(--brand-gradient, #3182F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 6 }}>솔비서</div>
          <div className="text-[#B0B8C1] text-[12px]">폭풍우에도 흔들리지 않는 내 투자 비서</div>
        </div>
      </div>
    );
  }

  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    '';

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: 'var(--bg, #FFFFFF)' }}>
      {/* Sticky Header - 48px */}
      <Header
        user={user}
        onLoginClick={() => setShowLogin(true)}
        onSignOut={signOut}
      />

      {/* Market Summary - one line */}
      <MarketSummary />
      <OfflineNotice />

      {/* Main body: content + right sidebar */}
      <div className="flex flex-1 w-full" style={{ minHeight: 'calc(100vh - 48px - 49px - 32px)', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Main content area */}
        <main className="flex-1 min-w-0 main-content" style={{ padding: '20px 16px 60px 16px' }}>
          <style>{`@media (min-width: 769px) { .main-content { padding: 32px 32px 80px 32px !important; } }`}</style>
          {currentSection === 'portfolio' && <PortfolioSection />}
          {currentSection === 'events' && <EventsSection />}
          {currentSection === 'news' && <NewsSection />}
        </main>

        {/* Right sidebar - always visible on desktop */}
        <aside className="hidden lg:block w-[280px] shrink-0 border-l border-[#F2F4F6]" style={{ padding: '32px 20px 80px 20px', position: 'sticky', top: '48px', alignSelf: 'flex-start', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
          <RightSidebar />
          <BadgeSection />
        </aside>
      </div>

      {/* Bottom ticker - 32px fixed */}
      <BottomTicker />

      {/* Overlays */}
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

      {/* Mobile bottom navigation (hidden on lg+) */}
      <MobileNav onMoreClick={() => setShowMobileSidebar(true)} />

      {/* Mobile alert sheet (bell icon) */}
      <MobileAlertSheet
        isOpen={showMobileAlerts}
        onClose={() => setShowMobileAlerts(false)}
      />

      {/* Mobile sidebar sheet */}
      <MobileSidebar
        isOpen={showMobileSidebar}
        onClose={() => setShowMobileSidebar(false)}
      />
    </div>
  );
}
