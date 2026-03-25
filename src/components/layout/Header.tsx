'use client';

import { useState, useEffect } from 'react';
import { usePortfolioStore, type MainSection } from '@/store/portfolioStore';
import { useStockData, useMacroData } from '@/hooks/useStockData';
import { Settings } from 'lucide-react';
import SearchBar from '@/components/portfolio/SearchBar';

const NAV_ITEMS: { label: string; section: MainSection }[] = [
  { label: '포트폴리오', section: 'portfolio' },
  { label: '뉴스', section: 'news' },
  { label: '이벤트 분석', section: 'events' },
];

export default function Header() {
  const { currentSection, setCurrentSection } = usePortfolioStore();
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
      className="sticky top-0 z-40 bg-white"
      style={{ height: '48px', borderBottom: '1px solid #F2F4F6' }}
    >
      <div className="flex items-center h-full mx-auto" style={{ maxWidth: '1400px', padding: '0 48px' }}>
        {/* Logo */}
        <div className="flex items-center shrink-0" style={{ gap: '8px' }}>
          <div
            className="flex items-center justify-center"
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: '#3182F6',
            }}
          >
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 800 }}>S</span>
          </div>
          <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.01em' }}>
            <span style={{ color: '#3182F6' }}>SOLB</span>
            <span style={{ color: '#191F28' }}> PORTFOLIO</span>
          </span>
        </div>

        {/* Main navigation tabs */}
        <nav className="flex items-center" style={{ marginLeft: '48px', height: '100%' }}>
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
                  color: isActive ? '#191F28' : '#8B95A1',
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
                      background: '#191F28',
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

        {/* Search toggle */}
        <div className="relative">
          <button
            data-slot="search-trigger"
            onClick={() => setShowSearch(!showSearch)}
            className="flex items-center cursor-pointer hover:bg-[#F2F4F6] transition-colors"
            style={{
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              background: '#F8F9FA',
              fontSize: '13px',
              color: '#B0B8C1',
            }}
          >
            종목 검색
            <kbd
              className="font-sans"
              style={{
                fontSize: '11px',
                color: '#B0B8C1',
                background: '#fff',
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
            <div className="absolute right-0 top-full mt-2 w-[360px] z-50">
              <SearchBar onClose={() => setShowSearch(false)} />
            </div>
          )}
        </div>

        {/* Settings */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('toggle-settings'))}
          className="flex items-center justify-center cursor-pointer transition-colors"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            color: '#8B95A1',
            marginLeft: '8px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#F8F9FA')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Settings className="w-[18px] h-[18px]" />
        </button>
      </div>
    </header>
  );
}
