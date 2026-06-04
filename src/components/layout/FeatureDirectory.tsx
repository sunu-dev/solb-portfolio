'use client';

import { usePortfolioStore, type MainSection } from '@/store/portfolioStore';
import {
  BarChart3, Sparkles, Newspaper, CalendarDays,
  Search, Bell, Compass, HelpCircle, Settings, ChevronRight,
  Moon, Sun,
} from 'lucide-react';

/**
 * 전체 메뉴 허브 — 토스/카카오 증권의 '전체' 패턴.
 *
 * IA P1-a: 더보기를 단순 사이드바 복제에서 '검색 내장 카테고리형 기능 디렉터리'로 승격.
 * 모바일은 하단 네비 '더보기', PC는 헤더 '전체' 버튼에서 같은 시트로 진입.
 *
 * 진입점 원칙: 어느 화면에서든 동작하는 트리거만 노출(섹션 전환·항상 마운트된 전역 이벤트).
 *  - setCurrentSection: 스토어 → 항상 동작
 *  - open-search(Header)·open-mobile-alerts/toggle-settings(page)·open-tour(CoachMark): 항상 마운트
 *  - 화면 종속 이벤트(예: chapter-shelf)는 데드 메뉴 방지 위해 제외(포트폴리오 탭에서 도달).
 */
interface Props {
  /** 액션 실행 후 부모 시트를 닫는 콜백 */
  onNavigate: () => void;
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text-tertiary, #B0B8C1)',
  letterSpacing: '-0.2px',
  margin: '0 4px 10px',
};

export default function FeatureDirectory({ onNavigate }: Props) {
  const { currentSection, setCurrentSection, darkMode, toggleDarkMode } = usePortfolioStore();

  const go = (section: MainSection) => { setCurrentSection(section); onNavigate(); };
  const emit = (name: string) => { window.dispatchEvent(new CustomEvent(name)); onNavigate(); };

  // 주요 메뉴 — 2열 타일
  const primary: { id: MainSection; label: string; sub: string; Icon: typeof BarChart3 }[] = [
    { id: 'portfolio', label: '포트폴리오', sub: '보유·관리', Icon: BarChart3 },
    { id: 'insights', label: 'AI 인사이트', sub: 'AI 촉·이야기', Icon: Sparkles },
    { id: 'news', label: '뉴스', sub: '내 종목 소식', Icon: Newspaper },
    { id: 'events', label: '이벤트 분석', sub: '실적·배당 일정', Icon: CalendarDays },
  ];

  // 도구 — 목록형
  const tools: { label: string; sub: string; Icon: typeof Search; onClick: () => void }[] = [
    { label: '종목 검색', sub: '이름·티커로 빠르게 찾기', Icon: Search, onClick: () => emit('open-search') },
    { label: '알림 센터', sub: '주비 AI 알림 모아보기', Icon: Bell, onClick: () => emit('open-mobile-alerts') },
    { label: '둘러보기', sub: '주요 기능 가이드 투어', Icon: Compass, onClick: () => emit('open-tour') },
    { label: '도움말', sub: '사용법·자주 묻는 질문', Icon: HelpCircle, onClick: () => { onNavigate(); window.location.href = '/help'; } },
  ];

  return (
    <div>
      {/* 허브 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 4px 16px' }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary, #191F28)', letterSpacing: '-0.03em' }}>
          전체
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary, #B0B8C1)' }}>주비의 모든 기능</span>
      </div>

      {/* 검색 내장 — 종목 검색 진입 (필드형 버튼) */}
      <button
        onClick={() => emit('open-search')}
        className="cursor-pointer"
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '14px 16px', marginBottom: 24, minHeight: 48,
          background: 'var(--bg-subtle, #F2F4F6)', border: 'none', borderRadius: 12,
          color: 'var(--text-tertiary, #B0B8C1)', fontSize: 14, textAlign: 'left',
        }}
        aria-label="종목 검색 열기"
      >
        <Search size={18} />
        <span style={{ flex: 1 }}>종목 검색</span>
        <kbd style={{
          fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)',
          background: 'var(--surface, #fff)', border: '1px solid var(--border-light, #F2F4F6)',
          borderRadius: 4, padding: '1px 6px',
        }} className="hidden md:inline">/</kbd>
      </button>

      {/* 주요 메뉴 */}
      <div style={SECTION_LABEL}>주요 메뉴</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
        {primary.map(({ id, label, sub, Icon }) => {
          const isActive = currentSection === id;
          return (
            <button
              key={id}
              onClick={() => go(id)}
              className="cursor-pointer"
              style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                padding: '16px 14px', minHeight: 92, textAlign: 'left',
                background: isActive ? 'var(--brand-primary-light)' : 'var(--bg-subtle, #F8F9FA)',
                border: `1px solid ${isActive ? 'var(--brand-primary)' : 'transparent'}`,
                borderRadius: 14,
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? 'var(--brand-primary)' : 'var(--surface, #fff)',
                  color: isActive ? '#fff' : 'var(--brand-primary)',
                }}
              >
                <Icon size={18} strokeWidth={2} />
              </span>
              <span>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>
                  {label}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 2 }}>
                  {sub}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* 도구 */}
      <div style={SECTION_LABEL}>도구</div>
      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 24 }}>
        {tools.map(({ label, sub, Icon, onClick }, idx) => (
          <button
            key={label}
            onClick={onClick}
            className="cursor-pointer"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              width: '100%', padding: '14px 8px', minHeight: 56, textAlign: 'left',
              background: 'none', border: 'none',
              borderTop: idx > 0 ? '1px solid var(--border-light, #F2F4F6)' : 'none',
            }}
          >
            <span style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-subtle, #F2F4F6)', color: 'var(--text-secondary, #4E5968)',
            }}>
              <Icon size={18} strokeWidth={1.9} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
                {label}
              </span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 1 }}>
                {sub}
              </span>
            </span>
            <ChevronRight size={16} style={{ color: 'var(--text-tertiary, #B0B8C1)', flexShrink: 0 }} />
          </button>
        ))}
      </div>

      {/* 환경 */}
      <div style={SECTION_LABEL}>환경</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* 설정 */}
        <button
          onClick={() => emit('toggle-settings')}
          className="cursor-pointer"
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            width: '100%', padding: '14px 8px', minHeight: 56, textAlign: 'left',
            background: 'none', border: 'none',
          }}
        >
          <span style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-subtle, #F2F4F6)', color: 'var(--text-secondary, #4E5968)',
          }}>
            <Settings size={18} strokeWidth={1.9} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
              설정
            </span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 1 }}>
              알림·계정·표시 설정
            </span>
          </span>
          <ChevronRight size={16} style={{ color: 'var(--text-tertiary, #B0B8C1)', flexShrink: 0 }} />
        </button>

        {/* 다크 모드 토글 — 시트는 닫지 않음(전환 즉시 확인) */}
        <button
          onClick={(e) => { e.currentTarget.blur(); toggleDarkMode(); }}
          className="cursor-pointer"
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            width: '100%', padding: '14px 8px', minHeight: 56, textAlign: 'left',
            background: 'none', border: 'none',
            borderTop: '1px solid var(--border-light, #F2F4F6)',
          }}
          aria-label={darkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          <span style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-subtle, #F2F4F6)', color: 'var(--text-secondary, #4E5968)',
          }}>
            {darkMode ? <Sun size={18} strokeWidth={1.9} /> : <Moon size={18} strokeWidth={1.9} />}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
              {darkMode ? '라이트 모드' : '다크 모드'}
            </span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 1 }}>
              현재 {darkMode ? '다크' : '라이트'} 모드예요
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
