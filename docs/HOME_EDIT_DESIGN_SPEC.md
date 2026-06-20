# 홈 편집(A) 구현 설계 스펙

> 2026-06-21. 16에이전트 설계 워크플로(깊은 인벤토리→9 트랙→종합→통합→완전성 비평). 코드 라인 검증 기반. 판정: **ready-with-gaps**(아래 §완전성 비평의 3 high 갭 선해결 필요).
> 경계 확정(파운더): 코어=Dashboard 히어로(총금액)+보유 테이블 시스템 **고정**, 보조 위젯만 편집.

## 1. 편집영역 레이아웃 모델 — 존(zone) 기반
'코어 끼임'은 해결이 아니라 **활용**: 코어가 zone 분리벽이 되어 순서변경 범위를 자연 봉쇄.
- `type Zone = 'above-core' | 'below-core' | 'analysis'`
- **코어(레지스트리 미등재 = 구조적 영구 고정)**: Dashboard 히어로(L392) + 보유 테이블 시스템(L503-1096). 표시/숨김·순서 UI 표면 자체가 없음 → self-lockout 불가.
- **above-core**: MorningBriefing(L395). 표시/숨김만(1개라 순서 무의미).
- **below-core**(.home-stack L1100): broker-block, monthly-chapter, ai-hunch-link. **↑↓ 순서변경 + 표시/숨김**(ai-hunch-link은 숨김 불가).
- **analysis**(분석탭 L1158): value-chart·benchmark·treemap·health·goal·chapter-shelf. **표시/숨김만**(순서변경 v2 연기 — grid 리플로우·dead-jump 얽힘).
- **순서변경은 same-zone 인접 swap만**, 코어/zone 경계 못 넘음. **CSS order 금지 → JSX 배열 재정렬**(resolveWidgetOrder로 정렬한 배열을 stableId key로 map). 이유: .home-stack 비위젯 자식(MonthlyWrapped·AI촉 button)이 CSS order 시 DOM/탭/SR desync → WCAG 1.3.2·2.4.3 위반.

## 2. 아키텍처 3계층 (PortfolioSection 단일 통합점)
- **`src/lib/homeWidgetRegistry.ts`** (순수 데이터 SSOT — React/store import 0, §6 테스트가 가볍게 import):
  `WidgetId` string-literal union(추상 카테고리, 티커 금지) + `WIDGET_META: HomeWidget[]`(id·label·zone·hideable·reorderable·defaultVisible·defaultOrder·onHiddenJump) + `WIDGET_IDS`/`HIDEABLE_IDS`/`NON_HIDEABLE_IDS` + `resolveWidgetOrder(saved,zone)`·`resolveHidden(saved)`. menuRegistry 동형.
- **portfolioStore 영속**: `hiddenWidgets: string[]`(블랙리스트·사용자 숨김만) + `widgetOrder: string[]`(below-core 정렬키) + `editMode`(transient, partialize 제외). setter: `toggleWidgetHidden`(=toggleMenuFavorite 복제 + broker-block이면 `setBrokerFilter(null)` + NON_HIDEABLE no-op)·`moveWidget(id,dir)`·`resetHomeLayout`.
- **`WidgetCard.tsx`**: 일반모드 **zero surface/border**(passthrough only, `position:relative`). 11개 위젯이 자체 카드 chrome 보유 → 'self-owns chrome'을 등재 전제. 편집 chrome은 시트 행에서만.
- **컴포넌트 맵**은 레지스트리가 아니라 PortfolioSection 안 `useMemo`(4 결합 위젯이 `WidgetContext` closure 필요). meta/component 물리 분리(§6 테스트가 recharts/store 안 끌게).

### 위젯 엔트리 (10개)
| id | zone | hideable | reorderable | 결합 |
|---|---|---|---|---|
| morning-briefing | above-core | ✓ | ✗ | 비용0(props0, 자체닫기 solb_briefing_seen) |
| broker-block | below-core | ✓ | ✓ | **brokerFilter 양방향**(숨김 시 `setBrokerFilter(null)` 필수). BrokerSummary+Merged 1엔트리 |
| monthly-chapter | below-core | ✓ | ✓ | onOpenWrapped/onOpenPreviousChapter → ctx 주입 |
| **ai-hunch-link** | below-core | **✗(§6)** | ✓ | ctx.gotoInsights. Lock 정적 배지 |
| value-chart·benchmark | analysis | ✓ | ✗ | 비용0(store 직결) |
| treemap | analysis | ✓ | ✗ | 6 props → store 직결 리팩터(단일 caller) |
| portfolio-health | analysis | ✓ | ✗ | data-slot 점프 수신 → **onHiddenJump:auto-restore** |
| goal-progress·chapter-shelf | analysis | ✓ | ✗ | props 어댑터 |

**결합 전략**: 전 위젯 props-zero는 WRONG GOAL. 올바른 목표 = 공유 배선을 단일 `WidgetContext`{brokerFilter, setBrokerFilter, openWrapped, gotoChapterShelf, gotoInsights, setAnalysisSymbol, investingStocks, investingData, ...}로 집중. 7위젯 단순 등재, 4위젯만 ctx 주입.

## 3. 영속·reconcile (localStorage-only)
- 평탄 2배열(menuFavorites 직접 복제) — 객체 스키마 기각(order 범위가 below-core 3위젯뿐).
- reconcile = **소비 시점 런타임 화이트리스트 필터**(persist migrate 아님): `resolveHidden`=HIDEABLE_IDS 통과만, `resolveWidgetOrder`=유효 id 먼저 + 신규 위젯 defaultOrder tail append. 미지·티커 id silent drop.
- **4지점 필수 배선**(silent fail 백본): interface(L57)·initial(L167)·partialize(L577)·resetPortfolio(L481). 누락 시 새로고침 초기화/계정전환 잔존/crash/타입에러.
- reset: 시트 하단 '기본값으로 되돌리기' + 기존 UndoToast 5초 복구.

## 4. 편집 UX
- **진입**: Dashboard 히어로 우상단 SlidersHorizontal → `solb-open-home-edit` 발행 → PortfolioSection 구독(setEditOpen).
- **편집 = BottomSheet**(desktopVariant lg+ 440 중앙모달 / 모바일 풀폭 바텀시트, 1컴포넌트). 3존을 시트 안 단일 수직 리스트(zone 헤더+행)로 평탄화. **즉시저장**(시트 열린 채 본문 실시간 반영, '저장' 버튼 없음, '완료'=닫기).
- 행: Eye/EyeOff 토글(aria-pressed) + below-core만 ChevronUp/Down. ai-hunch-link은 Lock 배지.
- **3상태 시각+텍스트+ARIA 이중 구분**(색만 의존 금지): 사용자숨김(dashed+OFF) / 자동비표시(gate false: '아직 데이터가 없어요·쌓이면 자동으로 나타나요'+disabled) / 일시dismiss(오늘 확인함).

## 5. 모바일·a11y
- BottomSheet 1컴포넌트 PC/모바일 수렴. ↑↓+토글 DnD 없이 동일(WCAG 2.5.7). 44x44 타깃. 진입점 히어로 우상단 단일.
- **신규 a11y 인프라**(현재 0건): 전역 `@media(prefers-reduced-motion:reduce)` 백스톱(globals.css 끝, 미가드 키프레임 일괄 청산 — 릴리스 노트 명시) + announce 채널(UndoToast aria-live 패턴 복제, koreanJosa 적용) + ↑↓/토글 직후 포커스 재설정. `.sr-only`는 Tailwind 빌트인 가용.

## 6. §6 박제
AI 촉 발견경로 **삼중 방어**: (1)ai-hunch-link hideable:false → 시트 토글 안 그림, (2)toggleWidgetHidden setter NON_HIDEABLE no-op, (3)resolveHidden 소비 시점 force-show. todayHeadline·insights 1급탭·Dashboard setCurrentSection('insights')는 home_layout 밖이라 자동 보존. 위젯 id는 추상 카테고리 화이트리스트만(티커 금지). **누출 불변식 테스트**(homeWidgetRegistry.test.ts, assertNoStockLeak 재사용): id가 티커 패턴 실패·STOCK_KR 교집합 공집합·resolve가 티커 drop·직렬화에 종목 0. `vitest run`을 prebuild에 추가.

## 7. 텔레메트리 (검증=측정)
logApiCall 재사용, 5이벤트: home_edit_enter{trigger,visible/hiddenCount}·home_edit_exit{durationMs,changed}·widget_toggle{id,to}·widget_reorder{id,dir,from/to}·home_layout_reset. metadata에 위젯 id(화이트리스트)만 — 티커·금액 금지. 분모=로그인 유저.

## 8. 단계별 빌드 (~3.5~5d)
- **0. 사전정리**(~0.5d): MonthlyWrapped를 .home-stack 밖 오버레이군으로 선이동(JSX 재정렬 전제). 기능변화 0.
- **1. 데이터·영속**(~0.5d): homeWidgetRegistry.ts + store 4지점 + 3 setter + reconcile. 렌더 미변경. 계정전환 e2e.
- **2. WidgetCard + 숨김**(~1d): WidgetCard passthrough + resolveHidden 적용. 편집 UI 없이 숨김만.
- **3. 편집 시트 + 재정렬**(~1.5d): HomeEditSheet + 진입/이탈 + 토글/↑↓ + WidgetContext + 컴포넌트 맵 + AiHunchSlimLink 추출 + stableId key.
- **4. dead-jump + a11y**(~1d): auto-restore 가드(2 핸들러) + reduced-motion + announce + 포커스.
- **5. §6 + 텔레메트리**(~0.5d): broker-block onHide 리셋 + 누출 테스트 + 5 텔레메트리 + prebuild test.

## 9. 완전성 비평 — 선해결 갭 (판정 ready-with-gaps)
- **[HIGH] SSR/hydration mismatch**: persist에 skipHydration 없음 + hiddenWidgets/widgetOrder가 SSR 임계경로(menuFavorites는 상호작용 게이트라 선례 무효). 숨긴 유저는 서버 HTML과 클라 divergence+flash. → **하이드레이션 전략 명시**(useHasHydrated/mounted 플래그로 하이드 전 전부표시, 또는 skipHydration+useEffect). **Phase 2 명시 단계로**.
- **[HIGH] analysis-zone 데이터 스코프**: investingData가 analysis-tab IIFE closure(L1161) 안에서 계산 → body 스코프 단일 WidgetContext/컴포넌트맵으로 못 잡음. → **investingData를 body로 hoist(useMemo)** 또는 zone별 맵 분리. 스펙대로는 빌드 불가.
- **[MEDIUM] empty-block DOM gap**: broker-block 래퍼 div(L1103) 컨테이너 게이트 없음 → 두 자식 self-null 시 빈 flex gap. → **게이트 결정을 mapper 레벨로**(child return-null 의존 금지).
- **[정정] migrate 존재**: store에 version:1 + migrate()(L549-553) 실재 — 스펙의 'no-migrate 선례'는 오기. 런타임 reconcile은 유효하나 위젯 id 스키마 하드 변경 시 migrate가 escape valve.
- (기타 medium/low): BottomSheet 포커스 트랩/복원 검증, 빈-broker-block gap, 텔레메트리 enter/exit 페어링 ref, reduced-motion blast radius.

## 10. 최고 severity 런타임 리스크
- **brokerFilter ORPHAN-LOCK**(HIGH): broker-block 숨김 + brokerFilter≠null → 코어 테이블이 안 보이는 필터에 갇힘. → `setBrokerFilter(null)` 부수효과 **필수**(절대 누락 금지).
- store 4지점 누락 silent fail(HIGH) → 1단계 동시 추가 + 계정전환 e2e.
- non-hideable 단일점 방어(HIGH) → setter no-op + reconcile force-show 이중.

## 파운더 결정 (대부분 권고 채택)
- 영속 스키마: **평탄 2배열**(권고) / 객체
- 재배치: **JSX 재정렬**(권고·코드상 명백)
- 편집 모달리티: **BottomSheet**(권고)
- broker: **1엔트리**(권고, id launch 전 freeze)
- dead-jump: **auto-restore**(권고)
- treemap: **store 직결**(권고) / propsAdapter
- 진입점: **히어로 우상단**(권고)
- analysis 순서변경: **v1 비제공**(권고)
- 텔레메트리 입도: 즉시 vs 배치(↑↓ 노이즈면 배치)
- 첫 진입 coachmark: 미결(노출 시 reduced-motion 가드)
