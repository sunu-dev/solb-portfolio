'use client';

import { useShallow } from 'zustand/react/shallow';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { currentInviteAccess, resolveInviteAccess, type InviteCheck } from '@/lib/inviteAccess';
import { supabase } from '@/lib/supabase';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useStockData, useAutoRefresh } from '@/hooks/useStockData';
import type { MacroEntry, QuoteData } from '@/config/constants';
import { useRealtimePrice } from '@/hooks/useRealtimePrice';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolioSync } from '@/hooks/usePortfolioSync';
import { useNotification } from '@/hooks/useNotification';
import Header from '@/components/layout/Header';
import MarketSummary from '@/components/layout/MarketSummary';
import OfflineNotice from '@/components/common/OfflineNotice';
import MobileNav from '@/components/layout/MobileNav';
import EconomicCalendar from '@/components/economy/EconomicCalendar';
import BriefingDialog from '@/components/portfolio/BriefingDialog';
import PortfolioSection from '@/components/portfolio/PortfolioSection';
import SettingsPanel from '@/components/common/SettingsPanel';
// ToastAlert removed — alerts now shown in sidebar notification center
import AgeEligibilityGate from '@/components/auth/AgeEligibilityGate';
import CoachMark from '@/components/onboarding/CoachMark';
import TourChapterSheet from '@/components/onboarding/TourChapterSheet';
import GuestTourBanner from '@/components/onboarding/GuestTourBanner';
import InviteGate from '@/components/auth/InviteGate';
import { logApiCall } from '@/lib/apiLogger';
import { recordProDemandVisit } from '@/lib/proDemandActivity';
import JoobiLockup from '@/components/brand/JoobiLockup';
import { preparePortfolioIdentity, type LocalPortfolio } from '@/lib/portfolioIdentity';
import { clearUserStorage } from '@/lib/userStorage';
import { isGuideId } from '@/lib/guideNotebook';
import type { MarketGuideId } from '@/config/marketGuides';
import { useDesktopViewport } from '@/hooks/useDesktopViewport';
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

export default function Home() {
  const auth = useAuth();
  const identity = auth.user?.id ?? null;
  const [prepared, setPrepared] = useState<{ identity: string | null } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (auth.loading) return;
    let done = false;
    const prepare = () => {
      if (done) return;
      done = true;
      try {
        const store = usePortfolioStore.getState();
        const persisted = usePortfolioStore.persist.getOptions().partialize!(store) as LocalPortfolio;
        preparePortfolioIdentity(identity, persisted, localStorage, () => {
          // OAuth consent belongs to the in-progress login, not the legacy portfolio.
          clearUserStorage({ preservePendingConsent: true });
          store.resetPortfolio();
        }, portfolioOwnerId => usePortfolioStore.setState({ portfolioOwnerId }));
        setFailed(false);
        setPrepared({ identity });
      } catch {
        setFailed(true);
      }
    };
    const unsubscribe = usePortfolioStore.persist.onFinishHydration(prepare);
    if (usePortfolioStore.persist.hasHydrated()) prepare();
    return unsubscribe;
  }, [auth.loading, identity]);

  // Do not mount portfolio readers, quote requests or cloud sync before this boundary.
  if (failed || auth.loading || !prepared || prepared.identity !== identity) {
    // Critical startup layout travels with the HTML, independent of CSS/JS chunks.
    return <div data-startup-screen style={{
      minHeight: '100svh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
      background: 'var(--bg, #FFFFFF)', color: 'var(--text-primary, #191F28)',
      fontFamily: 'system-ui, sans-serif', textAlign: 'center',
    }}>
      <JoobiLockup variant="loading" />
      <p role={failed ? 'alert' : 'status'} style={{ margin: 0, maxWidth: 360, fontSize: 14, lineHeight: 1.7 }}>{failed
        ? '이전 기록을 안전하게 보관하지 못했어요. 브라우저 저장 공간을 확인한 뒤 다시 시도해주세요.'
        : '로그인 상태와 내 정보를 확인하고 있어요.'}</p>
      <details open={failed || undefined} style={{ maxWidth: 360, fontSize: 13, lineHeight: 1.7 }}>
        <summary style={{ cursor: 'pointer', padding: 12 }}>화면이 열리지 않나요?</summary>
        <p style={{ margin: '0 0 12px' }}>연결 상태를 확인한 뒤 다시 불러와 주세요.</p>
        {/* Native navigation also works when the app's JavaScript has not loaded. */}
        <form action="/" method="get">
          <button type="submit" style={{
            padding: '12px 20px', borderRadius: 12, border: '1px solid #D1D6DB',
            background: '#FFFFFF', color: '#191F28', font: 'inherit', cursor: 'pointer',
          }}>다시 불러오기</button>
        </form>
      </details>
    </div>;
  }
  return <HomeContent key={identity ?? 'guest'} auth={auth} />;
}

function HomeContent({ auth }: { auth: ReturnType<typeof useAuth> }) {
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
  const [hydrated, setHydrated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showMobileAlerts, setShowMobileAlerts] = useState(false);
  const [inviteCheck, setInviteCheck] = useState<InviteCheck | null>(null);
  const [inviteRetry, setInviteRetry] = useState(0);
  const [guideRequest, setGuideRequest] = useState<{ id: MarketGuideId; key: number }>();
  const userId = user?.id;
  const inviteAccess = userId ? currentInviteAccess(userId, inviteCheck) : 'checking';

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

  // 확인 전에는 메인 화면을 열지 않는다. 이전 계정/취소된 조회 결과도 재사용하지 않는다.
  useEffect(() => {
    if (!userId || authLoading) return;
    let active = true;
    void resolveInviteAccess(supabase, userId).then(status => {
      if (active) setInviteCheck({ userId, status });
    });
    return () => { active = false; };
  }, [userId, authLoading, inviteRetry]);

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

  // 초대코드 게이트 — 로그인은 됐지만 코드 미입력
  if (user && !authLoading && inviteAccess === 'required') {
    return (
      <AgeEligibilityGate userId={user.id} onSignOut={signOut}>
        <InviteGate user={user} onVerified={() => setInviteCheck({ userId: user.id, status: 'allowed' })} />
      </AgeEligibilityGate>
    );
  }

  if (!hydrated || authLoading || (user && inviteAccess !== 'allowed')) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg, #FFFFFF)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 8 }}><JoobiLockup variant="loading" /></div>
          <div role="status" className="text-[#B0B8C1] text-[12px]">
            {inviteAccess === 'error' ? '가입 정보를 확인하지 못했어요. 다시 확인해주세요.' : '가입 정보를 확인하고 있어요. 잠시만 기다려주세요.'}
          </div>
          {user && inviteAccess === 'error' && <button type="button" onClick={() => {
            setInviteCheck(null);
            setInviteRetry(value => value + 1);
          }}>다시 확인하기</button>}
          {user && <button type="button" onClick={() => void signOut()}>다른 계정으로 로그인</button>}
        </div>
      </div>
    );
  }

  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    '';

  const content = (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: 'var(--bg, #FFFFFF)' }}>
      {/* Sticky Header - 48px */}
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
      <div className="flex flex-1 w-full app-shell" style={{ minHeight: 'calc(100vh - 48px - 49px)', margin: '0 auto' }}>
        {/* Main content area */}
        <main className="flex-1 min-w-0 main-content" style={{ padding: '20px 16px 60px 16px' }}>
          <style>{`@media (min-width: 769px) { .main-content { padding: 32px 32px 80px 32px !important; } }`}</style>
          {/* 비로그인 방문자 둘러보기 진입(목표 B) — 강제 모달 아닌 디스미스 가능 1줄 배너.
              !authLoading 가드 — 세션 해석 전 로그인 유저에게 한 프레임 깜빡임 노출 차단 */}
          {!user && !authLoading && <GuestTourBanner />}
          {currentSection === 'portfolio' && <PortfolioSection />}
          {currentSection === 'insights' && <InsightsSection guideRequest={guideRequest} />}
          {currentSection === 'events' && <AnalysisSection />}
          {currentSection === 'news' && <NewsSection />}
        </main>

        {/* Right sidebar - always visible on desktop */}
        <aside className="hidden md:block w-[280px] shrink-0 border-l border-[#F2F4F6]" style={{ padding: '32px 20px 80px 20px', position: 'sticky', top: '48px', alignSelf: 'flex-start', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
          {desktopViewport && <><RightSidebar /><BadgeSection /></>}
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
      {analysisSymbol && <AnalysisPanel />}
      {editingCat !== '' && <EditStockModal />}
      <SettingsPanel />

      {/* Auth overlays */}
      {showLogin && <LoginModal
        isOpen={showLogin && !authLoading && !user}
        onClose={() => setShowLogin(false)}
        onKakaoLogin={() => {
          setShowLogin(false);
          signInWithKakao();
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
  return user ? <AgeEligibilityGate userId={user.id} onSignOut={signOut}>{content}</AgeEligibilityGate> : content;
}
