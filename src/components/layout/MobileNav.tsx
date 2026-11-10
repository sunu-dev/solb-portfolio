'use client';

import { useShallow } from 'zustand/react/shallow';

import { usePortfolioStore, type MainSection } from '@/store/portfolioStore';
import { BarChart3, Menu } from 'lucide-react';
import { PRIMARY_SECTIONS } from '@/lib/menuRegistry';
import styles from './Navigation.module.css';

// 하단 탭 — menuRegistry SSOT 4섹션(navLabel 우선=좁은 폭 대응) + '더보기'.
const TABS: { id: MainSection | 'more'; label: string; Icon: typeof BarChart3 }[] = [
  ...PRIMARY_SECTIONS.map((m) => ({
    id: (m.action.kind === 'section' ? m.action.section : 'portfolio') as MainSection | 'more',
    label: m.navLabel ?? m.label,
    Icon: m.Icon as typeof BarChart3,
  })),
  { id: 'more', label: '더보기', Icon: Menu },
];

interface MobileNavProps {
  onMoreClick: () => void;
}

export default function MobileNav({ onMoreClick }: MobileNavProps) {
  const { currentSection, setCurrentSection } = usePortfolioStore(useShallow(state => ({
    currentSection: state.currentSection,
    setCurrentSection: state.setCurrentSection,
  })));

  return <nav className={`mobile-bottom-nav ${styles.bottom}`} aria-label="하단 내비게이션">
    {TABS.map(tab => {
      const isActive = tab.id !== 'more' && currentSection === tab.id;
      return <button type="button" key={tab.id} className={styles.bottomItem} aria-current={isActive ? 'page' : undefined}
        onClick={() => { if (tab.id === 'more') onMoreClick(); else setCurrentSection(tab.id as MainSection); }}>
        <span className={styles.bottomIcon}><tab.Icon size={22} strokeWidth={isActive ? 2.1 : 1.7} aria-hidden="true" /></span>
        <span>{tab.label}</span>
      </button>;
    })}
  </nav>;
}
