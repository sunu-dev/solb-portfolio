import type { ComponentType } from 'react';
import { BarChart3, Sparkles, Newspaper, CalendarDays, Star, Bell, Compass, HelpCircle } from 'lucide-react';
import type { MainSection } from '@/store/portfolioStore';
import type { StockCategory } from '@/config/constants';

/**
 * 메뉴 SSOT — Header(NAV_ITEMS)·MobileNav(TABS)·FeatureDirectory(primary/관심종목/tools)가
 * 각각 하드코딩하던 메뉴 정의를 단일 소스로 통합. 3곳 표류(예: 이벤트 라벨 '이벤트 분석' vs '이벤트')를
 * 의도적 label/navLabel로 명시 분리해 SSOT화. '바로가기'(메뉴 즐겨찾기) 후보도 여기서 파생.
 *
 * 원칙(FeatureDirectory 주석 상속): 어느 화면에서든 동작하는 트리거만(섹션 전환·전역 이벤트·href·알림센터).
 *   화면 종속 트리거(chapter-shelf 등)는 데드 메뉴 방지 위해 등재하지 않는다.
 * §6: 핀 가능한 id는 PINNABLE_IDS 화이트리스트(메뉴 키)로만 제한 — 개별 종목 티커는 절대 핀 대상 아님(종목찜=watchlist).
 */

type IconType = ComponentType<{ size?: number | string; strokeWidth?: number }>;

export type MenuAction =
  | { kind: 'section'; section: MainSection; tab?: StockCategory }
  | { kind: 'event'; event: string }
  | { kind: 'href'; href: string }
  | { kind: 'alert-center' };

export interface MenuItem {
  id: string;
  label: string;        // 풀 라벨 (Header·디렉터리)
  navLabel?: string;    // 모바일 하단탭 짧은 라벨 (없으면 label) — 좁은 폭 대응(의도적)
  sub?: string;
  Icon: IconType;
  action: MenuAction;
  primaryNav: boolean;  // 최상위 4탭 여부 (Header/MobileNav 파생)
  pinnable: boolean;    // '바로가기' 핀 후보 (1급 4탭은 상시 노출이라 제외)
}

export const MENU_ITEMS: MenuItem[] = [
  { id: 'portfolio', label: '포트폴리오', sub: '보유·관심·관리', Icon: BarChart3, action: { kind: 'section', section: 'portfolio' }, primaryNav: true, pinnable: false },
  { id: 'insights', label: 'AI 인사이트', sub: 'AI 촉·이야기', Icon: Sparkles, action: { kind: 'section', section: 'insights' }, primaryNav: true, pinnable: false },
  { id: 'news', label: '뉴스', sub: '내 종목 소식', Icon: Newspaper, action: { kind: 'section', section: 'news' }, primaryNav: true, pinnable: false },
  { id: 'events', label: '이벤트 분석', navLabel: '이벤트', sub: '실적·배당 일정', Icon: CalendarDays, action: { kind: 'section', section: 'events' }, primaryNav: true, pinnable: false },
  // ── 화면 비종속 도착지/도구 — '바로가기' 핀 후보 ──
  { id: 'watchlist', label: '관심 종목', sub: '찜한 종목 모아보기', Icon: Star, action: { kind: 'section', section: 'portfolio', tab: 'watching' }, primaryNav: false, pinnable: true },
  { id: 'alerts', label: '알림 센터', sub: '주비 AI 알림 모아보기', Icon: Bell, action: { kind: 'alert-center' }, primaryNav: false, pinnable: true },
  { id: 'tour', label: '둘러보기', sub: '주요 기능 가이드 투어', Icon: Compass, action: { kind: 'event', event: 'open-tour' }, primaryNav: false, pinnable: true },
  { id: 'help', label: '도움말', sub: '사용법·자주 묻는 질문', Icon: HelpCircle, action: { kind: 'href', href: '/help' }, primaryNav: false, pinnable: true },
];

export const PRIMARY_SECTIONS = MENU_ITEMS.filter(m => m.primaryNav);
export const PINNABLE_ITEMS = MENU_ITEMS.filter(m => m.pinnable);
export const PINNABLE_IDS = new Set(PINNABLE_ITEMS.map(m => m.id));
export const getMenuItem = (id: string): MenuItem | undefined => MENU_ITEMS.find(m => m.id === id);

/** 저장된 즐겨찾기 id 배열 → 유효(화이트리스트 통과)·등재순 정렬된 MenuItem[]. 미지 id는 조용히 drop. */
export function resolveFavorites(ids: string[]): MenuItem[] {
  const set = new Set(ids.filter(id => PINNABLE_IDS.has(id)));
  return PINNABLE_ITEMS.filter(m => set.has(m.id)); // 등재(고정)순 — 드래그-리오더 없음
}

export interface MenuActionContext {
  setCurrentSection: (s: MainSection) => void;
  setCurrentTab: (t: StockCategory) => void;
  onNavigate: () => void;
}

/** 화면 비종속 트리거만 실행 — 데드 메뉴 방지 원칙. */
export function runMenuAction(action: MenuAction, ctx: MenuActionContext): void {
  switch (action.kind) {
    case 'section':
      ctx.setCurrentSection(action.section);
      if (action.tab) ctx.setCurrentTab(action.tab);
      ctx.onNavigate();
      break;
    case 'event':
      window.dispatchEvent(new CustomEvent(action.event));
      ctx.onNavigate();
      break;
    case 'href':
      ctx.onNavigate();
      window.location.href = action.href;
      break;
    case 'alert-center':
      // PC: 상시 노출된 우측 사이드바로 스크롤, 모바일: 바텀시트
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        ctx.onNavigate();
        document.getElementById('solb-alert-center')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.dispatchEvent(new CustomEvent('open-mobile-alerts'));
        ctx.onNavigate();
      }
      break;
  }
}
