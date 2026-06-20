'use client';

import { usePortfolioStore, type MainSection } from '@/store/portfolioStore';
import { BarChart3, Menu } from 'lucide-react';
import { PRIMARY_SECTIONS } from '@/lib/menuRegistry';

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
  const { currentSection, setCurrentSection } = usePortfolioStore();

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--surface, white)',
        borderTop: '1px solid var(--border-light, #F2F4F6)',
        display: 'flex',
        zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      className="lg:hidden mobile-bottom-nav"
      aria-label="하단 내비게이션"
    >
      {TABS.map((tab) => {
        const isActive = tab.id !== 'more' && currentSection === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.id === 'more') onMoreClick();
              else setCurrentSection(tab.id as MainSection);
            }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? 'var(--brand-primary)' : 'var(--text-tertiary, #B0B8C1)',
              fontSize: 10,
              fontWeight: isActive ? 600 : 400,
              letterSpacing: '-0.3px',
              position: 'relative',
              paddingTop: 10,
              paddingBottom: 6,
            }}
          >
            {isActive && (
              <span style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 20,
                height: 2,
                background: 'var(--brand-primary)',
                borderRadius: 1,
              }} />
            )}
            <tab.Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
