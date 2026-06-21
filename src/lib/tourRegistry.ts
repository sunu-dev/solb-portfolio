/**
 * 투어(코치마크) 스텝 SSOT — 순수 데이터(런타임 React/store import 금지).
 *
 * 카탈로그=코드(이 파일), 사용자 의도=저장/재진입 키(id). menuRegistry/homeWidgetRegistry 동형.
 * CoachMark는 이 배열을 렌더만 한다(스크롤·position 계산 로직은 CoachMark 소유). 기능 추가 시
 * 여기 한 줄 등록으로 투어가 확장된다.
 *
 * anchor — 코드 내 data-tour="..." 마킹 키. 둘은 반드시 일치해야 하며 scripts/lint-tour-anchors.mjs가
 *   빌드에서 강제(레지스트리에 있으나 코드에 없는 '데드 앵커' = 600ms 무음 skip 회귀 → 차단).
 *
 * §6 — title/desc는 descriptive(현재상태 거울·정보 제공)만. '추천/약점 분석' 등 prescriptive 금지.
 *   이 파일은 scripts/lint-alerts.mjs의 ONBOARDING_FILE_RE에 포함돼 §6 금지어휘 박제 대상이다.
 *
 * ⚠️ Phase 1 = '데이터 분리만'(렌더 동작 불변). 챕터 자동전환·게스트 분기는 Phase 3.
 *   visibility/requiresAuth/featureId는 Phase 3(게스트 투어)·Phase 2(측정) 예약 필드 — 현재 미소비.
 */

import type { MainSection } from '@/store/portfolioStore'; // 타입 전용(런타임 erase) → 순수 유지

/** 둘러보기 챕터 — Phase 3에서 'insights'|'news'|'events'|'customize' deep 챕터 추가 예정. */
export type TourChapterId = 'home';

export interface TourChapter {
  id: TourChapterId;
  label: string;
  /** core = 첫 진입 자동 노출 / deep = 탭 첫진입·둘러보기 시트에서 선택 재생(Phase 3). */
  tier: 'core' | 'deep';
}

export const TOUR_CHAPTERS: TourChapter[] = [
  { id: 'home', label: '홈 — 오늘 내 주식 읽기', tier: 'core' },
];

export interface TourStep {
  /** 안정적 식별자 — 저장·텔레메트리·재진입 키. */
  id: string;
  /** data-tour="..." 앵커 키 — 코드 마킹과 일치(lint:tour-anchors 강제). */
  anchor: string;
  title: string;
  desc: string;
  /** 툴팁 위치 — 앵커 기준 위/아래. */
  position: 'top' | 'bottom';
  /** 이 스텝이 사는 화면 영역. 현재(Phase 1) 전부 'portfolio'(홈). Phase 3 탭 자동전환 키. */
  section: MainSection;
  /** 소속 챕터(둘러보기 시트 그룹). */
  chapter: TourChapterId;
  /** 학습 계층 — 현재 전부 core. */
  tier: 'core' | 'deep';

  // ── Phase 3(게스트 투어)·Phase 2(측정) 예약 필드 — 현재 미소비. 로직 없이 스키마만 준비. ──
  /** 비로그인 게스트 투어 노출 범위. 미지정=both. Phase 3에서 소비. */
  visibility?: 'guest' | 'authed' | 'both';
  /** 로그인 필요한 기능을 가리키는 스텝인가. Phase 3 게스트 스킵 판정용. */
  requiresAuth?: boolean;
  /** feature_first_use 채택률 매핑 키. Phase 2 측정에서 소비. */
  featureId?: string;
}

/**
 * 투어 스텝 — 배열 순서 = 렌더 순서(현 CoachMark 동작과 1:1).
 * Phase 1은 4개 홈 스텝(core). 신규 기능 편입은 Phase 3.
 */
export const TOUR_STEPS: TourStep[] = [
  { id: 'market',    anchor: 'macro-strip',       chapter: 'home', section: 'portfolio', tier: 'core', position: 'bottom', title: '오늘의 시장',       desc: '미국·한국 주요 지수와 환율, 공포지수를 한 번에 확인할 수 있어요.' },
  { id: 'portfolio', anchor: 'portfolio-section', chapter: 'home', section: 'portfolio', tier: 'core', position: 'bottom', title: '내 종목 한 줄 요약', desc: '오늘 가장 큰 움직임, 52주 위치, 멘토 점수까지 한 줄로 요약해드려요.' },
  { id: 'ai-hunch',  anchor: 'ai-chok',           chapter: 'home', section: 'portfolio', tier: 'core', position: 'top',    title: 'AI 촉 — 매일 새 종목', desc: '매일 1번 새 종목 정보 3개를 받아볼 수 있어요. 로그인 사용자 무료.' },
  { id: 'help',      anchor: 'help-button',       chapter: 'home', section: 'portfolio', tier: 'core', position: 'bottom', title: '도움말',           desc: '언제든 ❓ 버튼으로 가이드를 다시 볼 수 있어요.' },
];

/** 레지스트리가 가리키는 모든 앵커(화이트리스트). lint:tour-anchors가 코드 data-tour와 대조. */
export const TOUR_ANCHORS: ReadonlySet<string> = new Set(TOUR_STEPS.map(s => s.anchor));

export const getTourStep = (id: string): TourStep | undefined => TOUR_STEPS.find(s => s.id === id);
export const getChapterSteps = (chapter: TourChapterId): TourStep[] =>
  TOUR_STEPS.filter(s => s.chapter === chapter);
