'use client';

import { usePortfolioStore, type MainSection } from '@/store/portfolioStore';
import { BarChart3, Newspaper, CalendarDays, Menu } from 'lucide-react';

const TABS: { id: MainSection | 'more'; label: string; Icon: typeof BarChart3 }[] = [
  { id: 'portfolio', label: '포트폴리오', Icon: BarChart3 },
  { id: 'news', label: '뉴스', Icon: Newspaper },
  { id: 'events', label: '이벤트', Icon: CalendarDays },
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
              color: isActive ? '#3182F6' : '#B0B8C1',
              fontSize: 11,
              fontWeight: isActive ? 600 : 400,
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
                background: '#3182F6',
                borderRadius: 1,
              }} />
            )}
            <tab.Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
