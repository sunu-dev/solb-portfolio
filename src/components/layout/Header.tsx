'use client';

import appUI from '../ui/AppUI.module.css';
import styles from './Navigation.module.css';
import { useShallow } from 'zustand/react/shallow';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { usePortfolioStore, type MainSection } from '@/store/portfolioStore';
import { Settings, Bell, Search, HelpCircle, LayoutGrid, Sun, Moon } from 'lucide-react';
import { useModalViewport } from '@/hooks/useModalViewport';
import UserMenu from '@/components/auth/UserMenu';
import type { User } from '@supabase/supabase-js';
import { useUnreadAlertCount } from '@/hooks/useActiveAlerts';
import { PRIMARY_SECTIONS } from '@/lib/menuRegistry';
import JoobiLockup from '@/components/brand/JoobiLockup';

const SearchBar = dynamic(() => import('@/components/portfolio/SearchBar'), {
  loading: () => <p role="status" style={{ padding: 20 }}>검색을 준비하고 있어요…</p>,
});

// 최상위 탭 — menuRegistry SSOT에서 파생(3곳 표류 방지). 풀 라벨 사용(헤더는 폭 여유).
const NAV_ITEMS: { label: string; section: MainSection }[] = PRIMARY_SECTIONS.map((m) => ({
  label: m.label,
  section: m.action.kind === 'section' ? m.action.section : 'portfolio',
}));

interface HeaderProps {
  user?: User | null;
  onLoginClick?: () => void;
  onSignOut?: () => void;
}

export default function Header({ user, onLoginClick, onSignOut }: HeaderProps) {
  const { currentSection, setCurrentSection, darkMode, toggleDarkMode, analysisSymbol } = usePortfolioStore(useShallow(state => ({
    currentSection: state.currentSection,
    setCurrentSection: state.setCurrentSection,
    darkMode: state.darkMode,
    toggleDarkMode: state.toggleDarkMode,
    analysisSymbol: state.analysisSymbol,
  })));
  const unreadCount = useUnreadAlertCount();
  const [showSearch, setShowSearch] = useState(false);
  const [searchOpened, setSearchOpened] = useState(false);
  const searchVisible = showSearch && !analysisSymbol;
  const openSearch = () => { setSearchOpened(true); setShowSearch(true); };
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  useModalViewport(searchVisible, searchRef, { lockScroll: false });
  const closeSearch = () => {
    if (searchRef.current?.contains(document.activeElement)) searchTriggerRef.current?.focus({ preventScroll: true });
    setShowSearch(false);
    setSearchOpened(false);
  };

  // Keyboard shortcut for search + open-search 이벤트 (온보딩에서 사용)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        setSearchOpened(true);
        setShowSearch(true);
      }
    };
    const openSearch = () => { setSearchOpened(true); setShowSearch(true); };
    window.addEventListener('keydown', handler);
    window.addEventListener('open-search', openSearch);
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('open-search', openSearch); };
  }, []);

  return <header className={`main-header ${styles.header}`}>
    <div className={styles.inner}>
      <button type="button" className={styles.home} aria-label="주비 홈으로" onClick={() => setCurrentSection('portfolio')}><JoobiLockup variant="header" /></button>
      <nav className={styles.desktop} aria-label="주요 메뉴">
        {NAV_ITEMS.map(item => <button type="button" key={item.section} className={styles.item}
          aria-current={currentSection === item.section ? 'page' : undefined}
          onClick={() => setCurrentSection(item.section)}>{item.label}</button>)}
        <button type="button" className={styles.item} onClick={() => window.dispatchEvent(new CustomEvent('open-feature-directory'))} aria-label="전체 메뉴 열기"><LayoutGrid size={15} aria-hidden="true" />전체</button>
      </nav>
      <div className={styles.actions}>
        <button type="button" onClick={toggleDarkMode} className={styles.action}
          aria-label={darkMode ? '라이트 모드로 전환' : '다크 모드로 전환'} title={darkMode ? '라이트 모드' : '다크 모드'}>
          {darkMode ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>
        <button type="button" data-tour="help-button" onClick={() => { window.location.href = '/help'; }}
          className={`${styles.action} ${styles.help}`} aria-label="도움말" title="도움말"><HelpCircle size={18} aria-hidden="true" /></button>
        <button type="button" className={`${styles.action} ${styles.notification}`} title="알림"
          aria-label={unreadCount > 0 ? `알림, 읽지 않은 알림 ${unreadCount}개` : '알림'}
          onClick={() => {
            const el = document.getElementById('solb-alert-center');
            if (el && window.innerWidth >= 1024) {
              el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
              return;
            }
            window.dispatchEvent(new CustomEvent('open-mobile-alerts'));
          }}>
          <Bell size={18} aria-hidden="true" />
          {unreadCount > 0 && <span className={styles.count}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </button>
        <div className={styles.searchWrap}>
          <button type="button" ref={searchTriggerRef} data-slot="search-trigger" className={styles.search}
            aria-label="종목 검색" aria-expanded={searchVisible} aria-controls="stock-search-dialog"
            onClick={() => searchVisible ? closeSearch() : openSearch()}>
            <Search size={18} aria-hidden="true" /><span>종목 검색</span><kbd>/</kbd>
          </button>
          {searchOpened && <div id="stock-search-dialog" hidden={!searchVisible} ref={searchRef} role="dialog" aria-label="종목 검색" tabIndex={-1}
            onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); closeSearch(); } }}
            className={`stock-search-popover ${styles.popover}`}>
            <SearchBar active={searchVisible} onExplore={() => { /* Keep the search session while detail is open. */ }} onClose={closeSearch} />
          </div>}
        </div>
        {user ? <UserMenu user={user} onSignOut={onSignOut || (() => {})} /> : <>
          <button type="button" className={`${styles.action} ${styles.guestSettings}`} onClick={() => window.dispatchEvent(new CustomEvent('toggle-settings'))} aria-label="설정 열기"><Settings size={18} aria-hidden="true" /></button>
          <button type="button" onClick={onLoginClick} className={`${appUI.textButton} ${styles.login}`}>로그인</button>
        </>}
      </div>
    </div>
  </header>;
}
