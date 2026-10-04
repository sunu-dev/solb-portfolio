'use client';

import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePortfolioStore } from '@/store/portfolioStore';
import { Search, Settings, ChevronRight, Moon, Sun, Pin, X } from 'lucide-react';
import {
  PINNABLE_ITEMS, resolveFavorites, runMenuAction,
  type MenuItem, type MenuActionContext,
} from '@/lib/menuRegistry';
import { logApiCall } from '@/lib/apiLogger';
import styles from './FeatureDirectory.module.css';

interface Props {
  onNavigate: () => void;
}

const SUPPORT_IDS = new Set(['about', 'tour', 'help']);
const TOOL_ITEMS = PINNABLE_ITEMS.filter(item => !SUPPORT_IDS.has(item.id));
const SUPPORT_ITEMS = PINNABLE_ITEMS.filter(item => SUPPORT_IDS.has(item.id));

/** 메뉴와 이동 동작은 menuRegistry에서 가져오고, 시트에서는 탐색 순서만 구성한다. */
export default function FeatureDirectory({ onNavigate }: Props) {
  const pinButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const {
    setCurrentSection, setCurrentTab,
    darkMode, toggleDarkMode, menuFavorites, toggleMenuFavorite,
  } = usePortfolioStore(useShallow(state => ({
    setCurrentSection: state.setCurrentSection,
    setCurrentTab: state.setCurrentTab, darkMode: state.darkMode,
    toggleDarkMode: state.toggleDarkMode, menuFavorites: state.menuFavorites,
    toggleMenuFavorite: state.toggleMenuFavorite,
  })));

  // 시트의 닫기 버튼에 포커스가 있어도 검색을 열기 전에 현재 메뉴를 닫는다.
  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      window.dispatchEvent(new CustomEvent('open-search'));
      onNavigate();
    };
    window.addEventListener('keydown', handleSearchShortcut, true);
    return () => window.removeEventListener('keydown', handleSearchShortcut, true);
  }, [onNavigate]);

  const ctx: MenuActionContext = { setCurrentSection, setCurrentTab, onNavigate };
  const favorites = resolveFavorites(menuFavorites);
  const isPinned = (id: string) => menuFavorites.includes(id);
  const emit = (name: string) => { window.dispatchEvent(new CustomEvent(name)); onNavigate(); };

  const runItem = (item: MenuItem, viaFavorite: boolean) => {
    logApiCall(viaFavorite ? 'menu_nav_via_favorite' : 'menu_nav', undefined, { id: item.id });
    runMenuAction(item.action, ctx);
  };
  const togglePin = (item: MenuItem) => {
    logApiCall(isPinned(item.id) ? 'menu_pin_removed' : 'menu_pin_added', undefined, { id: item.id });
    toggleMenuFavorite(item.id);
  };

  const renderRow = (item: MenuItem, viaFavorite = false) => (
    <li key={(viaFavorite ? 'fav-' : '') + item.id} className={styles.pinnableRow}>
      <button
        type="button"
        onClick={() => runItem(item, viaFavorite)}
        className={`${styles.rowButton} ${viaFavorite ? styles.compactRow : ''}`}
      >
        <span className={styles.icon} aria-hidden="true"><item.Icon size={21} strokeWidth={1.8} /></span>
        <span className={styles.rowText}>
          <span className={styles.label}>{item.label}</span>
          {!viaFavorite && item.sub ? <span className={`${styles.description} reading-copy`}>{item.sub}</span> : null}
        </span>
      </button>
      <button
        type="button"
        ref={viaFavorite ? undefined : node => { pinButtons.current[item.id] = node; }}
        onClick={() => {
          // 바로가기 행이 사라져도 같은 기능의 핀 버튼에서 키보드 탐색을 이어간다.
          if (viaFavorite) pinButtons.current[item.id]?.focus();
          togglePin(item);
        }}
        className={`${styles.pinButton} ${isPinned(item.id) ? styles.pinned : ''}`}
        aria-pressed={isPinned(item.id)}
        aria-label={isPinned(item.id) ? `${item.label} 바로가기에서 빼기` : `${item.label} 바로가기에 고정`}
      >
        <Pin size={17} strokeWidth={1.8} fill={isPinned(item.id) ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
    </li>
  );

  return (
    <div className={styles.directory}>
      <div className={styles.header}>
        <h2 className={styles.title}>전체 메뉴</h2>
        <button type="button" className={styles.mobileClose} onClick={onNavigate} aria-label="전체 메뉴 닫기">
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      <button type="button" onClick={() => emit('open-search')} className={styles.search} aria-label="종목 검색 열기" aria-keyshortcuts="/">
        <Search size={20} aria-hidden="true" />
        <span>종목 검색</span>
        <kbd className={styles.shortcut} aria-hidden="true">/</kbd>
      </button>

      {favorites.length > 0 ? (
        <section className={styles.section} aria-labelledby="menu-favorites-heading">
          <h3 id="menu-favorites-heading" className={styles.sectionHeading}>바로가기</h3>
          <ul className={styles.list}>{favorites.map(item => renderRow(item, true))}</ul>
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="menu-tools-heading">
        <h3 id="menu-tools-heading" className={styles.sectionHeading}>더 살펴보기</h3>
        {favorites.length === 0 ? <p className={`${styles.pinHint} reading-copy`}>핀을 누르면 바로가기에 모아볼 수 있어요.</p> : null}
        <ul className={styles.list}>{TOOL_ITEMS.map(item => renderRow(item))}</ul>
      </section>

      <section className={styles.section} aria-labelledby="menu-help-heading">
        <h3 id="menu-help-heading" className={styles.sectionHeading}>이용 안내</h3>
        <ul className={styles.list}>{SUPPORT_ITEMS.map(item => renderRow(item))}</ul>
      </section>

      <section className={styles.section} aria-labelledby="menu-settings-heading">
        <h3 id="menu-settings-heading" className={styles.sectionHeading}>환경 설정</h3>
        <ul className={styles.list}>
          <li>
            <button type="button" onClick={() => emit('toggle-settings')} className={styles.rowButton}>
              <span className={styles.icon} aria-hidden="true"><Settings size={21} strokeWidth={1.8} /></span>
              <span className={styles.rowText}>
                <span className={styles.label}>설정</span>
                <span className={`${styles.description} reading-copy`}>알림·계정·표시 설정</span>
              </span>
              <ChevronRight size={17} className={styles.chevron} aria-hidden="true" />
            </button>
          </li>
          <li>
            <button type="button" onClick={toggleDarkMode} className={styles.rowButton} aria-label={darkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}>
              <span className={styles.icon} aria-hidden="true">
                {darkMode ? <Sun size={21} strokeWidth={1.8} /> : <Moon size={21} strokeWidth={1.8} />}
              </span>
              <span className={styles.rowText}>
                <span className={styles.label}>{darkMode ? '라이트 모드' : '다크 모드'}</span>
                <span className={`${styles.description} reading-copy`}>현재 {darkMode ? '다크' : '라이트'} 모드예요</span>
              </span>
              <ChevronRight size={17} className={styles.chevron} aria-hidden="true" />
            </button>
          </li>
        </ul>
      </section>
    </div>
  );
}
