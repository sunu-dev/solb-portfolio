'use client';

import { usePortfolioStore, type MainSection } from '@/store/portfolioStore';

const TABS: { id: MainSection; label: string }[] = [
  { id: 'portfolio', label: '포트폴리오' },
  { id: 'events', label: '이벤트 분석' },
  { id: 'news', label: '뉴스' },
];

export default function MainNav() {
  const { currentSection, setCurrentSection } = usePortfolioStore();

  return (
    <nav className="bg-white border-b border-[#F2F4F6]">
      <div className="flex px-5">
        {TABS.map(tab => {
          const isActive = currentSection === tab.id;
          return (
            <button key={tab.id} onClick={() => setCurrentSection(tab.id)}
              className={`relative py-3 mr-5 text-[14px] tracking-tight transition-colors ${
                isActive ? 'text-[#191F28] font-semibold' : 'text-[#B0B8C1] font-normal'
              }`}>
              {tab.label}
              {isActive && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#191F28] rounded-full" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
