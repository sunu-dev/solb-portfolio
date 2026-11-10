'use client';

import { useShallow } from 'zustand/react/shallow';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useStockData, useAutoRefresh } from '@/hooks/useStockData';
import type { MacroEntry, QuoteData } from '@/config/constants';
import { useRealtimePrice } from '@/hooks/useRealtimePrice';
import PersonalLearningProvider from '@/components/learning/PersonalLearningProvider';
import JoobiAssistantLauncher from '@/components/learning/JoobiAssistantLauncher';
import type { useAuth } from '@/hooks/useAuth';
import { useNotification } from '@/hooks/useNotification';
import Header from '@/components/layout/Header';
import frameStyles from './AppFrame.module.css';
import MarketSummary from '@/components/layout/MarketSummary';
import OfflineNotice from '@/components/common/OfflineNotice';
import MobileNav from '@/components/layout/MobileNav';
import EconomicCalendar from '@/components/economy/EconomicCalendar';
import BriefingDialog from '@/components/portfolio/BriefingDialog';
import PortfolioSection from '@/components/portfolio/PortfolioSection';
import SettingsPanel from '@/components/common/SettingsPanel';
// ToastAlert removed — alerts now shown in sidebar notification center
import CoachMark from '@/components/onboarding/CoachMark';
import TourChapterSheet from '@/components/onboarding/TourChapterSheet';
import GuestTourBanner from '@/components/onboarding/GuestTourBanner';
import AccountAccessStatus from '@/components/auth/AccountAccessStatus';
import { logApiCall } from '@/lib/apiLogger';
import { recordProDemandVisit } from '@/lib/proDemandActivity';
import { isGuideId } from '@/lib/guideNotebook';
import { parseOAuthReturnFailure, type OAuthReturnFailure } from '@/lib/oauthRedirect';
import { PENDING_CONSENT_KEY } from '@/lib/pendingConsent';
import type { MarketGuideId } from '@/config/marketGuides';
import { useDesktopViewport } from '@/hooks/useDesktopViewport';
import UsageTelemetry from '@/components/common/UsageTelemetry';
import { useWorkspaceNavigation } from '@/hooks/useWorkspaceNavigation';

const RightSidebar = dynamic(() => import('@/components/layout/RightSidebar'));
const BadgeSection = dynamic(() => import('@/components/portfolio/BadgeSection'));
const MobileSidebar = dynamic(() => import('@/components/layout/MobileSidebar'));
const MobileAlertSheet = dynamic(() => import('@/components/layout/MobileAlertSheet'));
const EditStockModal = dynamic(() => import('@/components/common/EditStockModal'));
const LoginModal = dynamic(() => import('@/components/auth/LoginModal'));
const OnboardingFlow = dynamic(() => import('@/components/onboarding/OnboardingFlow'));

const AnalysisSection = dynamic(() => import('@/components/analysis/AnalysisSection'), { loading: () => <p role="status">화면을 불러오고 있어요…</p> });
const NewsSection = dynamic(() => import('@/components/news/NewsSection'), { loading: () => <p role="status">화면을 불러오고 있어요…</p> });
const InsightsSection = dynamic(() => import('@/components/insights/InsightsSection'), { loading: () => <p role="status">화면을 불러오고 있어요…</p> });
const AnalysisPanel = dynamic(() => import('@/components/analysis/AnalysisPanel'), { loading: () => <p role="status">화면을 불러오고 있어요…</p> });

export default function HomeContent({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const { currentSection, loadPortfolio, analysisSymbol, darkMode, dbPortfolioStatus, editingCat } = usePortfolioStore(useShallow(state => ({
    currentSection: state.currentSection,
    loadPortfolio: state.loadPortfolio,
    analysisSymbol: state.analysisSymbol,
    darkMode: state.darkMode,
    dbPortfolioStatus: state.dbPortfolioStatus,
    editingCat: state.editingCat,
  })));
  const { refreshAll } = useStockData();
  const desktopViewport = useDesktopViewport();
  useWorkspaceNavigation();
  const { user, loading: authLoading, signInWithKakao, signOut } = auth;
  const [hydrated, setHydrated] = useState(() => usePortfolioStore.persist.hasHydrated());
  const [showLogin, setShowLogin] = useState(false);
  const [oauthReturnError, setOAuthReturnError] = useState<OAuthReturnFailure | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showMobileAlerts, setShowMobileAlerts] = useState(false);
  const [guideRequest, setGuideRequest] = useState<{ id: MarketGuideId; key: number }>();
  const userId = user?.id;

  useEffect(() => {
    const open = (id: unknown) => {
      if (!isGuideId(id)) return;
      setGuideRequest(previous => ({ id, key: (previous?.key ?? 0) + 1 }));
      usePortfolioStore.getState().setCurrentSection('insights');
    };
    const params = new URLSearchParams(window.location.search);
    const id = params.get('guide');
    if (isGuideId(id)) {
      open(id);
    } else if (params.get('view') === 'insights' || id === 'coffee') {
      usePortfolioStore.getState().setCurrentSection('insights');
    }
    const handle = (event: Event) => {
      const id = (event as CustomEvent<{ id?: unknown }>).detail?.id;
      if (!isGuideId(id)) return;
      open(id);
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'insights');
      url.searchParams.set('guide', id);
      if (url.href !== window.location.href) window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
    };
    const restoreGuide = () => {
      const guide = new URLSearchParams(window.location.search).get('guide');
      if (isGuideId(guide)) setGuideRequest(previous => ({ id: guide, key: (previous?.key ?? 0) + 1 }));
      else setGuideRequest(undefined);
    };
    window.addEventListener('popstate', restoreGuide);
    window.addEventListener('open-market-guide', handle);
    const unsubscribe = usePortfolioStore.subscribe((state, previous) => {
      if (previous.currentSection === 'insights' && state.currentSection !== 'insights') setGuideRequest(undefined);
    });
    return () => {
      window.removeEventListener('open-market-guide', handle);
      window.removeEventListener('popstate', restoreGuide);
      unsubscribe();
    };
  }, []);

  // Mobile alert sheet open via custom event (from header bell icon)
  useEffect(() => {
    const handler = () => setShowMobileAlerts(true);
    window.addEventListener('open-mobile-alerts', handler);
    return () => window.removeEventListener('open-mobile-alerts', handler);
  }, []);

  // 전체 메뉴 시트 — PC 헤더 '전체' 버튼에서 진입(모바일은 하단 네비 '더보기' onMoreClick)
  useEffect(() => {
    const handler = () => setShowMobileSidebar(true);
    window.addEventListener('open-feature-directory', handler);
    return () => window.removeEventListener('open-feature-directory', handler);
  }, []);

  // 비로그인 종목 추가 시도 → 로그인 모달
  useEffect(() => {
    const handler = () => setShowLogin(true);
    window.addEventListener('open-login', handler);
    return () => window.removeEventListener('open-login', handler);
  }, []);

  // 랜딩 CTA 딥링크 — 인증 상태 확인 뒤 로그인 모달을 열고 일회성 쿼리는 제거한다.
  useEffect(() => {
    if (authLoading || user) return;
    const result = parseOAuthReturnFailure(window.location.href);
    if (!result) return;
    // 제공자에서 인증을 취소한 동의는 다음 로그인이나 다른 계정에 넘기지 않는다.
    try { sessionStorage.removeItem(PENDING_CONSENT_KEY); } catch { /* 저장소를 사용할 수 없어도 복귀는 허용한다. */ }
    setOAuthReturnError(result.failure);
    setShowLogin(true);
    window.history.replaceState(null, '', result.cleanPath);
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') !== '1') return;
    if (!user) setShowLogin(true);
    params.delete('login');
    const query = params.toString();
    window.history.replaceState(
      null,
      '',
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
  }, [authLoading, user]);

  // PWA push notifications
  useNotification();

  useEffect(() => {
    let initialized = false;
    const init = () => {
      if (initialized) return;
      initialized = true;
      setHydrated(true);
      loadPortfolio();
      recordProDemandVisit();

      // Instantly restore cached macro + quote data from localStorage
      const { updateMacroEntry } = usePortfolioStore.getState();
      const CACHE_TTL = 5 * 60 * 1000;
      try {
        const macroCached = localStorage.getItem('solb_macro_cache');
        if (macroCached) {
          const { data, ts } = JSON.parse(macroCached);
          if (Date.now() - ts < CACHE_TTL) {
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
          if (Date.now() - ts < CACHE_TTL) {
            for (const [sym, quote] of Object.entries(data)) {
              if (quote && (quote as QuoteData).c) updateMacroEntry(sym, quote as QuoteData);
            }
          }
        }
      } catch { /* ignore */ }

      // 시세·캔들은 전부 서버 라우트를 거치므로 클라이언트 API 키가 필요 없다.
      // (예전에는 여기서 모든 방문자가 /api/ws-token으로 Finnhub 키를 받아
      //  localStorage에 영속시켰다 — 실시간 WebSocket 전용 키는 useRealtimePrice가
      //  로그인 세션이 있을 때만 지연 요청한다.)
      // refreshAll includes indices and FX in its quote batch.
      void refreshAll();
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

  // Show onboarding only for genuinely NEW users.
  // ⚠️ 기존: localStorage('solb_onboarded')만 체크 → 기기/브라우저 바뀌거나 캐시 지우면 기존 유저도
  //    온보딩 재노출(localStorage-only 안티패턴). 수정: 서버 포트폴리오 status로 '기존/신규' 판정.
  //  - dbPortfolioStatus 'unknown' = 서버 로드 전 → 판정 보류(깜빡 노출 방지)
  //  - 'ok' = DB에 포트폴리오 있음(기존 유저) → 제외 + 플래그 박제
  //  - 'empty' = 첫 로그인인데 로컬 보유도 없을 때만 온보딩(로그인 전 사용했으면 제외)
  useEffect(() => {
    if (!user || authLoading) return;
    if (dbPortfolioStatus === 'unknown') return;
    if (localStorage.getItem('solb_onboarded')) return;
    if (dbPortfolioStatus === 'ok') {
      localStorage.setItem('solb_onboarded', 'true');
      return;
    }
    // dbPortfolioStatus === 'empty'
    const s = usePortfolioStore.getState().stocks;
    const hasHoldings = (s.investing?.length || 0) + (s.watching?.length || 0) + (s.sold?.length || 0) > 0;
    if (hasHoldings) {
      localStorage.setItem('solb_onboarded', 'true');
      return;
    }
    setShowOnboarding(true);
  }, [user, authLoading, dbPortfolioStatus]);

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

  if (!hydrated || authLoading) return <AccountAccessStatus phase="session" />;

  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    '';

  const content = (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg, #FFFFFF)' }}>
      <UsageTelemetry enabled={hydrated && !authLoading} userId={userId ?? null}
        feature={analysisSymbol ? 'analysis' : currentSection === 'portfolio' ? 'portfolio' : currentSection === 'news' ? 'news' : currentSection === 'insights' ? 'insights' : 'other'} />
      {/* Shared navigation frame */}
      <Header
        user={user}
        onLoginClick={() => setShowLogin(true)}
        onSignOut={signOut}
      />

      {/* Market Summary - one line */}
      <div data-tour="macro-strip">
        <MarketSummary />
      </div>
      <OfflineNotice />

      {/* Main body: content + right sidebar */}
      <div className={`flex flex-1 app-shell ${frameStyles.frame}`}>
        {/* Main content area */}
        <main className={`main-content ${frameStyles.content}`}>
          {/* 비로그인 방문자 둘러보기 진입(목표 B) — 강제 모달 아닌 디스미스 가능 1줄 배너.
              !authLoading 가드 — 세션 해석 전 로그인 유저에게 한 프레임 깜빡임 노출 차단 */}
          {!user && !authLoading && <GuestTourBanner />}
          {currentSection === 'portfolio' && <PortfolioSection />}
          {currentSection === 'insights' && <InsightsSection guideRequest={guideRequest} />}
          {currentSection === 'events' && <AnalysisSection />}
          {currentSection === 'news' && <NewsSection />}
        </main>

        {/* Right sidebar - always visible on desktop */}
        <aside className={frameStyles.sidebar}>
          {desktopViewport && <><RightSidebar /><BadgeSection compact /></>}
        </aside>
      </div>

      <footer
        className="flex min-h-[120px] items-start justify-center border-t border-[#F2F4F6] px-4 pt-7 pb-[88px] text-center md:min-h-[96px] md:items-center md:py-8"
        style={{ color: 'var(--text-secondary, #8B95A1)', fontSize: 13, lineHeight: 1.5 }}
      >
        <div><a href="/about" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: 'var(--text-body)', fontWeight: 600 }}>주비 서비스 소개</a><p>© 2026 Joobi · made by sunulab</p></div>
      </footer>

      <EconomicCalendar />
      <BriefingDialog
        userId={user?.id}
        signedInAt={user?.last_sign_in_at}
        ready={!showOnboarding && dbPortfolioStatus !== 'unknown'}
      />

      {/* Overlays */}
      {!analysisSymbol && !showOnboarding && <JoobiAssistantLauncher />}
      {analysisSymbol && <AnalysisPanel key={user?.id??'guest'} owner={user?.id??'guest'} />}
      {editingCat !== '' && <EditStockModal />}
      <SettingsPanel isLoggedIn={!!user} />

      {/* Auth overlays */}
      {showLogin && <LoginModal
        isOpen={showLogin && !authLoading && !user}
        onClose={() => { setShowLogin(false); setOAuthReturnError(null); }}
        returnError={oauthReturnError}
        onKakaoLogin={async () => {
          setOAuthReturnError(null);
          const started = await signInWithKakao();
          if (started) setShowLogin(false);
          return started;
        }}
      />}

      {/* Onboarding overlay */}
      {showOnboarding && (
        <OnboardingFlow
          userName={userName}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* Coach mark tour — 본 화면 첫 진입 시 자동 시작 + 'open-tour' 이벤트로 재시작 */}
      {!showOnboarding && <CoachMark />}

      {/* 둘러보기 챕터 선택 시트 — 메뉴 '둘러보기'(open-tour)로 열림, 챕터 선택 시 CoachMark 실행 */}
      <TourChapterSheet />

      {/* Mobile bottom navigation (hidden on lg+) */}
      <MobileNav onMoreClick={() => setShowMobileSidebar(true)} />

      {/* Mobile alert sheet (bell icon) */}
      {showMobileAlerts && <MobileAlertSheet
        isOpen={showMobileAlerts}
        onClose={() => setShowMobileAlerts(false)}
      />}

      {/* Mobile sidebar sheet */}
      {showMobileSidebar && <MobileSidebar
        isOpen={showMobileSidebar}
        onClose={() => setShowMobileSidebar(false)}
      />}
    </div>
  );
  const learningContent = <PersonalLearningProvider key={user?.id ?? 'guest'} owner={user?.id ?? 'guest'}>{content}</PersonalLearningProvider>;
  return learningContent;
}
