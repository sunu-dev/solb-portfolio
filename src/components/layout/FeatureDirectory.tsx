'use client';

import { usePortfolioStore } from '@/store/portfolioStore';
import { Search, Settings, ChevronRight, Moon, Sun, Pin } from 'lucide-react';
import {
  PRIMARY_SECTIONS, PINNABLE_ITEMS, resolveFavorites, runMenuAction,
  type MenuItem, type MenuActionContext,
} from '@/lib/menuRegistry';
import { logApiCall } from '@/lib/apiLogger';

/**
 * 전체 메뉴 허브 — 토스/카카오 증권의 '전체' 패턴. 모바일='더보기'·PC='전체' 같은 시트.
 *
 * 메뉴 정의는 menuRegistry SSOT에서 파생(Header/MobileNav와 단일 소스). '바로가기'(메뉴 즐겨찾기)는
 * PINNABLE_ITEMS에 Pin 토글을 달아 사용자가 고정 → 상단 '바로가기' 섹션에 등재순으로 노출.
 * 진입점 원칙: 화면 비종속 트리거만(섹션 전환·전역 이벤트·href·알림센터) — 데드 메뉴 방지.
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

// 주요 메뉴 타일 — 메뉴별 컬러 아이콘 칩(토스/카카오 전체-그리드 생동감). 다크 자동 플립 토큰.
const TILE_ACCENT: Record<string, { bg: string; fg: string }> = {
  portfolio: { bg: 'var(--brand-primary-light, rgba(14,124,123,0.08))', fg: 'var(--brand-primary)' },
  insights: { bg: 'var(--color-purple-bg, rgba(175,82,222,0.08))', fg: 'var(--color-purple, #AF52DE)' },
  news: { bg: 'var(--color-warning-bg, rgba(255,149,0,0.08))', fg: 'var(--color-warning, #FF9500)' },
  events: { bg: 'var(--color-success-bg, rgba(0,198,190,0.08))', fg: 'var(--color-success, #00C6BE)' },
};
const accentFor = (id: string) => TILE_ACCENT[id] ?? TILE_ACCENT.portfolio;

export default function FeatureDirectory({ onNavigate }: Props) {
  const {
    currentSection, setCurrentSection, setCurrentTab,
    darkMode, toggleDarkMode, menuFavorites, toggleMenuFavorite,
  } = usePortfolioStore();

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

  // 행 — 관심종목/도구/바로가기 공통. 네비 버튼 + 분리된 Pin 토글 버튼.
  const renderRow = (item: MenuItem, opts: { viaFavorite?: boolean; first?: boolean } = {}) => (
    <div
      key={(opts.viaFavorite ? 'fav-' : '') + item.id}
      style={{
        display: 'flex', alignItems: 'center',
        borderTop: opts.first ? 'none' : '1px solid var(--border-light, #F2F4F6)',
      }}
    >
      <button
        onClick={() => runItem(item, !!opts.viaFavorite)}
        className="cursor-pointer"
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 8px', minHeight: 56, textAlign: 'left', background: 'none', border: 'none',
        }}
        aria-label={item.label}
      >
        <span style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-subtle, #F2F4F6)', color: 'var(--text-secondary, #4E5968)',
        }}>
          <item.Icon size={18} strokeWidth={1.9} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>
            {item.label}
          </span>
          {item.sub && (
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 1 }}>
              {item.sub}
            </span>
          )}
        </span>
      </button>
      <button
        onClick={() => togglePin(item)}
        className="cursor-pointer"
        aria-pressed={isPinned(item.id)}
        aria-label={isPinned(item.id) ? `${item.label} 바로가기에서 빼기` : `${item.label} 바로가기에 고정`}
        style={{
          flexShrink: 0, width: 44, height: 44, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none',
          color: isPinned(item.id) ? 'var(--brand-primary)' : 'var(--text-tertiary, #B0B8C1)',
        }}
      >
        <Pin size={18} strokeWidth={isPinned(item.id) ? 2 : 1.9} fill={isPinned(item.id) ? 'currentColor' : 'none'} />
      </button>
    </div>
  );

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

      {/* 바로가기 — 핀으로 고정한 메뉴(등재순). 비었으면 발견 유도 1줄. */}
      <div style={SECTION_LABEL}>바로가기</div>
      {favorites.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 24 }}>
          {favorites.map((item, i) => renderRow(item, { viaFavorite: true, first: i === 0 }))}
        </div>
      ) : (
        <div
          style={{
            marginBottom: 24, padding: '16px', display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--bg-subtle, #F8F9FA)', borderRadius: 14,
          }}
        >
          <span style={{
            flexShrink: 0, width: 40, height: 40, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--brand-primary-light, rgba(14,124,123,0.08))', color: 'var(--brand-primary)',
          }}>
            <Pin size={18} strokeWidth={2} />
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text-secondary, #8B95A1)', lineHeight: 1.55 }}>
            아래 기능의 <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>핀</span> 버튼을 누르면<br />여기에 바로가기가 생겨요.
          </span>
        </div>
      )}

      {/* 주요 메뉴 — 2열 타일 (4탭, 항상 노출이라 핀 대상 아님) */}
      <div style={SECTION_LABEL}>주요 메뉴</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 26 }}>
        {PRIMARY_SECTIONS.map((item) => {
          const isActive = item.action.kind === 'section' && currentSection === item.action.section;
          const ac = accentFor(item.id);
          return (
            <button
              key={item.id}
              onClick={() => runItem(item, false)}
              className="cursor-pointer feature-tile"
              style={{
                display: 'flex', flexDirection: 'column', gap: 12,
                padding: '18px 16px', minHeight: 104, textAlign: 'left',
                background: isActive ? ac.bg : 'var(--surface, #FFFFFF)',
                border: `1.5px solid ${isActive ? ac.fg : 'transparent'}`,
                borderRadius: 18,
                boxShadow: isActive ? 'none' : 'var(--card-shadow, 0 2px 6px rgba(0,0,0,0.04), 0 0 1px rgba(0,0,0,0.06))',
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                style={{
                  width: 46, height: 46, borderRadius: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? ac.fg : ac.bg,
                  color: isActive ? 'var(--pill-active-fg, #fff)' : ac.fg,
                }}
              >
                <item.Icon size={22} strokeWidth={2} />
              </span>
              <span>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)', letterSpacing: '-0.02em' }}>
                  {item.label}
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-tertiary, #B0B8C1)', marginTop: 3 }}>
                  {item.sub}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* 더 많은 기능 — 핀 가능(관심 종목·알림 센터·둘러보기·도움말) */}
      <div style={SECTION_LABEL}>더 많은 기능</div>
      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 24 }}>
        {PINNABLE_ITEMS.map((item, i) => renderRow(item, { first: i === 0 }))}
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
