'use client';

import { usePortfolioStore, type MainSection } from '@/store/portfolioStore';

const TABS: { id: MainSection | 'more'; label: string; icon: string }[] = [
  { id: 'portfolio', label: '포트폴리오', icon: '📊' },
  { id: 'news', label: '뉴스', icon: '📰' },
  { id: 'events', label: '이벤트', icon: '📅' },
  { id: 'more', label: '더보기', icon: '☰' },
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
        background: 'white',
        borderTop: '1px solid #F2F4F6',
        display: 'flex',
        zIndex: 50,
      }}
      className="lg:hidden mobile-bottom-nav"
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
              gap: 2,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? '#3182F6' : '#8B95A1',
              fontSize: 10,
              fontWeight: isActive ? 600 : 400,
            }}
          >
            <span style={{ fontSize: 20 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
