/**
 * 홈 편집 위젯 SSOT (순수 데이터 — React/store import 금지. §6 누출 테스트가 가볍게 import).
 *
 * 카탈로그=코드(이 파일), 사용자 의도=저장(portfolioStore hiddenWidgets·widgetOrder). menuRegistry 동형.
 * 코어(Dashboard 히어로·보유 테이블)는 여기 미등재 = 구조적 영구 고정(편집 UI 표면 없음 → self-lockout 불가).
 *
 * zone — 코어 끼임을 '활용': 코어가 zone 분리벽이라 순서변경이 zone 경계를 못 넘는다.
 *   above-core(MorningBriefing) / below-core(.home-stack: broker·chapter·ai-hunch) / analysis(분석탭 위젯).
 * §6 — id는 추상 카테고리 화이트리스트만(티커 절대 금지). ai-hunch-link은 hideable:false로 영구무료 AI촉 발견경로 박제.
 */

export type WidgetId =
  | 'morning-briefing'
  | 'broker-block'
  | 'monthly-chapter'
  | 'ai-hunch-link'
  | 'value-chart'
  | 'benchmark-compare'
  | 'treemap'
  | 'portfolio-health'
  | 'goal-progress'
  | 'chapter-shelf';

export type WidgetZone = 'above-core' | 'below-core' | 'analysis';

export interface HomeWidget {
  id: WidgetId;
  label: string;
  zone: WidgetZone;
  hideable: boolean;
  reorderable: boolean;
  defaultVisible: boolean;
  defaultOrder: number;
  /** 숨김 상태에서 외부 점프(data-slot)가 들어올 때 정책. */
  onHiddenJump?: 'auto-restore' | 'no-op';
}

export const WIDGET_META: HomeWidget[] = [
  { id: 'morning-briefing', label: '아침 브리핑', zone: 'above-core', hideable: true, reorderable: false, defaultVisible: true, defaultOrder: 0 },
  // below-core (.home-stack) — 순서변경 가능
  { id: 'broker-block', label: '증권사 요약·통합 보유', zone: 'below-core', hideable: true, reorderable: true, defaultVisible: true, defaultOrder: 0 },
  { id: 'monthly-chapter', label: '월간 챕터', zone: 'below-core', hideable: true, reorderable: true, defaultVisible: true, defaultOrder: 1 },
  { id: 'ai-hunch-link', label: 'AI 촉 바로가기', zone: 'below-core', hideable: false, reorderable: true, defaultVisible: true, defaultOrder: 2 },
  // analysis (분석 서브탭) — 표시/숨김만(순서변경 v2 연기)
  { id: 'value-chart', label: '자산 추이', zone: 'analysis', hideable: true, reorderable: false, defaultVisible: true, defaultOrder: 0 },
  { id: 'benchmark-compare', label: '시장 대비 성과', zone: 'analysis', hideable: true, reorderable: false, defaultVisible: true, defaultOrder: 1 },
  { id: 'treemap', label: '포트폴리오 맵', zone: 'analysis', hideable: true, reorderable: false, defaultVisible: true, defaultOrder: 2 },
  { id: 'portfolio-health', label: '건강 점수', zone: 'analysis', hideable: true, reorderable: false, defaultVisible: true, defaultOrder: 3, onHiddenJump: 'auto-restore' },
  { id: 'goal-progress', label: '목표 달성', zone: 'analysis', hideable: true, reorderable: false, defaultVisible: true, defaultOrder: 4 },
  { id: 'chapter-shelf', label: '챕터 책장', zone: 'analysis', hideable: true, reorderable: false, defaultVisible: true, defaultOrder: 5 },
];

export const WIDGET_IDS: ReadonlySet<string> = new Set(WIDGET_META.map(w => w.id));
export const HIDEABLE_IDS: ReadonlySet<string> = new Set(WIDGET_META.filter(w => w.hideable).map(w => w.id));
export const NON_HIDEABLE_IDS: ReadonlySet<string> = new Set(WIDGET_META.filter(w => !w.hideable).map(w => w.id));

export const getWidget = (id: string): HomeWidget | undefined => WIDGET_META.find(w => w.id === id);
export const getZoneWidgets = (zone: WidgetZone): HomeWidget[] =>
  WIDGET_META.filter(w => w.zone === zone).sort((a, b) => a.defaultOrder - b.defaultOrder);

/** 저장된 숨김 목록 → 유효(hideable) id만. 미지·티커·non-hideable silent drop. */
export function resolveHidden(saved: string[]): WidgetId[] {
  return saved.filter((id): id is WidgetId => HIDEABLE_IDS.has(id));
}

/** zone 위젯을 저장 순서로 정렬 → 유효 저장 id 먼저 + 신규 위젯 defaultOrder tail append(앱 업데이트 안전). */
export function resolveWidgetOrder(saved: string[], zone: WidgetZone): WidgetId[] {
  const zoneIds = getZoneWidgets(zone).map(w => w.id);
  const inZone = new Set(zoneIds);
  const savedInZone = saved.filter((id): id is WidgetId => inZone.has(id as WidgetId));
  const rest = zoneIds.filter(id => !savedInZone.includes(id));
  return [...savedInZone, ...rest];
}

/** 사용자에게 표시되어야 하나? non-hideable은 hiddenWidgets에 있어도 강제 표시(§6 이중 방어). */
export function isWidgetHidden(id: WidgetId, hiddenWidgets: string[]): boolean {
  if (NON_HIDEABLE_IDS.has(id)) return false;
  return hiddenWidgets.includes(id);
}
