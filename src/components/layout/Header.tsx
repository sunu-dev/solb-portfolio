'use client';

import { useState, useEffect } from 'react';
import { usePortfolioStore, type MainSection } from '@/store/portfolioStore';
import { Settings, Bell } from 'lucide-react';
import SearchBar from '@/components/portfolio/SearchBar';
import UserMenu from '@/components/auth/UserMenu';
import type { User } from '@supabase/supabase-js';

const NAV_ITEMS: { label: string; section: MainSection }[] = [
  { label: '포트폴리오', section: 'portfolio' },
  { label: '뉴스', section: 'news' },
  { label: '이벤트 분석', section: 'events' },
];

interface HeaderProps {
  user?: User | null;
  onLoginClick?: () => void;
  onSignOut?: () => void;
}

export default function Header({ user, onLoginClick, onSignOut }: HeaderProps) {
  const { currentSection, setCurrentSection, darkMode, toggleDarkMode, alerts, dismissedAlerts } = usePortfolioStore();
  const unreadCount = alerts.filter(a => !dismissedAlerts.includes(a.id)).length;
  const [showSearch, setShowSearch] = useState(false);

  // Keyboard shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <header
      className="sticky top-0 z-40"
      style={{ background: 'var(--surface, white)', height: '48px', borderBottom: '1px solid var(--border-light, #F2F4F6)' }}
    >
      <div className="header-inner flex items-center h-full mx-auto" style={{ maxWidth: '1200px' }}>
        {/* Logo */}
        <div className="flex items-center shrink-0" style={{ gap: '8px' }}>
          <img src="/logo-solb.svg" alt="SOLB" style={{ width: 28, height: 28 }} />
          <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.01em' }}>
            <span style={{ background: 'var(--brand-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>SOLB</span>
            <span className="hidden md:inline" style={{ color: 'var(--text-primary, #191F28)' }}> PORTFOLIO</span>
          </span>
        </div>

        {/* Main navigation tabs — hidden on mobile, replaced by MobileNav */}
        <nav className="hidden md:flex items-center overflow-x-auto scrollbar-hide" style={{ marginLeft: '24px', height: '100%' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = currentSection === item.section;
            return (
              <button
                key={item.section}
                onClick={() => setCurrentSection(item.section)}
                className="relative cursor-pointer flex items-center"
                style={{
                  height: '100%',
                  padding: '0 24px',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--text-primary, #191F28)' : 'var(--text-secondary, #8B95A1)',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
                {isActive && (
                  <span
                    className="absolute"
                    style={{
                      bottom: 0,
                      left: '24px',
                      right: '24px',
                      height: '2px',
                      background: 'var(--text-primary, #191F28)',
                      borderRadius: '1px',
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right actions — gap 통일 */}
        <div className="flex items-center" style={{ gap: 8 }}>

        {/* Dark mode toggle */}
        <button
          onClick={(e) => { e.currentTarget.blur(); toggleDarkMode(); }}
          className="flex items-center justify-center cursor-pointer shrink-0 hover:bg-[#F8F9FA] dark:hover:bg-[var(--surface-hover)] active:bg-transparent"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            fontSize: '16px',
            background: 'transparent',
            border: 'none',
            WebkitTapHighlightColor: 'transparent',
            outline: 'none',
          }}
          aria-label={darkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
          title={darkMode ? '라이트 모드' : '다크 모드'}
        >
          {darkMode ? '\u2600\uFE0F' : '\uD83C\uDF19'}
        </button>

        {/* Alert bell */}
        <button
          onClick={(e) => {
            e.currentTarget.blur();
            // Desktop (lg+): scroll to sidebar alert center
            const el = document.getElementById('solb-alert-center');
            if (el && window.innerWidth >= 1024) {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              return;
            }
            // Mobile: open dedicated alert bottom sheet
            window.dispatchEvent(new CustomEvent('open-mobile-alerts'));
          }}
          className="relative flex items-center justify-center cursor-pointer shrink-0 hover:bg-[#F8F9FA] dark:hover:bg-[var(--surface-hover)] active:bg-transparent"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary, #8B95A1)',
            WebkitTapHighlightColor: 'transparent',
            outline: 'none',
          }}
          title="알림"
        >
          <Bell className="w-[16px] h-[16px]" />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                fontSize: 10,
                fontWeight: 700,
                color: '#fff',
                background: '#EF4452',
                borderRadius: 8,
                padding: '1px 4px',
                minWidth: 14,
                textAlign: 'center',
                lineHeight: '14px',
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Search toggle */}
        <div className="relative">
          <button
            data-slot="search-trigger"
            aria-label="종목 검색"
            onClick={() => setShowSearch(!showSearch)}
            className="flex items-center cursor-pointer hover:bg-[#F2F4F6] dark:hover:bg-[var(--surface-hover)] transition-colors"
            style={{
              gap: '6px',
              padding: '10px 14px',
              minHeight: '44px',
              borderRadius: '8px',
              background: 'var(--bg-subtle, #F8F9FA)',
              fontSize: '13px',
              color: 'var(--text-tertiary, #B0B8C1)',
            }}
          >
            <span className="hidden md:inline">종목 검색</span>
            <span className="md:hidden">검색</span>
            <kbd
              className="font-sans"
              style={{
                fontSize: '11px',
                color: '#B0B8C1',
                background: 'var(--surface, #fff)',
                border: '1px solid #F2F4F6',
                borderRadius: '4px',
                padding: '1px 5px',
                marginLeft: '4px',
              }}
            >
              /
            </kbd>
          </button>
          {showSearch && (
            <div className="fixed left-4 right-4 top-[50px] z-50 md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:w-[360px]">
              <SearchBar onClose={() => setShowSearch(false)} />
            </div>
          )}
        </div>

        {/* Auth area: Login button or UserMenu */}
        {user ? (
          <UserMenu user={user} onSignOut={onSignOut || (() => {})} />
        ) : (
          <>
            {/* Settings (only when not logged in) */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('toggle-settings'))}
              className="flex items-center justify-center cursor-pointer transition-colors"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '8px',
                color: '#8B95A1',
                marginLeft: '4px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F8F9FA')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Settings className="w-[18px] h-[18px]" />
            </button>

            {/* Login button */}
            <button
              onClick={onLoginClick}
              style={{
                marginLeft: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#3182F6',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: '8px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F0F6FF')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              로그인
            </button>
          </>
        )}
        </div>{/* end right actions */}
      </div>
    </header>
  );
}
