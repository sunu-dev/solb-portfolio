# 토스증권 PC vs 주비 PC — UI/UX 리뷰 채택 계획 (SSOT)

> 작성 2026-06-17 · 근거: 20인 전문가 패널(워크플로 `wf_4d3f0ac6-b03`, 채택 103건 중 교차검증 생존 87건) + 사용자 UI/UX 집중 리뷰.
> 원칙: **토스 따라잡기가 아니라, 토스가 못/안 하는 PC 빈자리(관리·복기·세무·학습) 선점 + 우리 craft 부채 정리.**

## 0. 정체성 가드 (절대 채택 안 함 — 적대적 검증 전원 탈락)
- 매매/주문/호가/소수점 매매 (브로커 아님·면허 없음)
- 위젯 드래그 워크스페이스(블룸버그형) — 미니멀 디자인 방향 충돌 + a11y + 거래 없는 빈 워크스페이스
- 매매 시그널형 커뮤니티(수익률 자랑) — §6/유사투자자문
- 레버리지 전면 노출 — 단일종목 레버리지 AI 분석 거부·신규 발굴 차단 정책 유지
- 풀 드로잉 툴바·1분봉/실시간 틱·다지표 무한적층·AI 인사이트 화면마다 LLM 재생성

## 1. ⚠️ 색상 분류 규칙 (가장 중요 — 일괄 sweep 금지)
`#3182F6`은 코드에서 **두 의미**로 쓰인다. 반드시 구분해서 처리:

| 의미 | 처리 | 예 |
|---|---|---|
| **한국 손익색 '하락=파랑'** (`--color-loss`) | **보존(불변)** | `isGain ? '#EF4452' : '#3182F6'`, 캔들 downColor, `var(--color-loss, #3182F6)` 전부 |
| **`--color-info` 정보 시맨틱** | **이번 배치 보류**(시맨틱·파급 큼, 별도 결정) | `var(--color-info, #3182F6)` 다수 |
| **토스블루-as-브랜드/CTA/AI 액센트** | **→ Mossy Teal `var(--brand-primary, #0E7C7B)`** | theme-color, AI 버튼, 검색 CTA, 타임프레임 활성 |
| **`--brand-rain` (브랜드 '비(雨)' 모티프)** | **보류**(브랜드 의사결정 — 사용자 확인) | `--brand-rain: #3182F6` |

> `--brand-primary`는 이미 정의됨(globals.css:20 light `#0E7C7B` / :341 dark `#14B8A6`). 문제는 안 쓰고 하드코딩이 샌 것.

## 2. 적용 로드맵 (배치)

### 배치 1 — 브랜드 첫인상 + AI 표면 + 차트 다크 (이번 PR · 전부 'craft 부채/하드코딩→토큰', 저위험)
- [ ] `designTokens.ts`에 `brandPrimary`·`brandPrimaryLight` 추가(현재 누락 — `--brand-primary` 노출 안 됨)
- [ ] **차트 다크 테마** `StockChart.tsx` — `darkMode` 셀렉터 구독 + `CHART_THEME{light,dark}`(bg/text/grid/border) 3개 차트에 적용. 캔들 빨강↑/파랑↓ 불변. (다크에서 흰 박스 → 해소)
- [ ] **브랜드 첫인상 경로**: `layout.tsx` `<meta theme-color>` `#3182F6→#0E7C7B`, `public/manifest.json` `theme_color` 동일, `error.tsx`/`global-error.tsx` CTA 배경, `page.tsx:215` 그라데 fallback
- [ ] **AI/검색 브랜드 액센트**: `AnalysisPanel.tsx` AI 진행바·%·step·pulse·loadingBar·AI 버튼·'주비 AI' 라벨·리포트 카드·로그인/재시도 버튼·아바타 fallback·타임프레임 활성 → `--brand-primary`. `SearchBar.tsx` '추가' CTA → `--brand-primary`
- [ ] **헤더**: active 탭 밑줄 무채색→teal, 다크토글 이모지 ☀️/🌙 → lucide `Sun`/`Moon`(형제 아이콘과 통일)

### 배치 2 — 차트 학습성 + 접근성 (다음 PR)
- [ ] 캔들 **크로스헤어 OHLC 리드아웃**(`subscribeCrosshairMove` HTML 오버레이, 한국 손익색) — 토스 대비 최대 차트 격차
- [ ] 차트 기준선(볼린저 middle·RSI 70/30·MACD 0선, 중립 회색·테마 토큰) + 지표 on/off 토글(우리 6지표 범위 내)
- [ ] 모달 a11y: `useFocusTrap` 훅 + ESC 닫기 + 포커스 복원(AnalysisPanel·Insights 퀴즈 우선) — '거짓 aria-modal' 해소
- [ ] 차트/MentorRadar `role=img`+`aria-label`(스크린리더), `prefers-reduced-motion` 전역화

### 배치 3 — PC 발견/공유 동선 (구현 완료 2026-06-17)
- [x] 종목 상세 **`?stock=` URL 동기화**(`page.tsx` mount+sync 2-effect, `pushState`/`replaceState`/`popstate`) — 공유·북마크·새 탭·새로고침·뒤로가기로 닫기 복원
- [x] 검색 결과 **'살펴보기' 경로**(행 본문 클릭→`openAnalysis`→AnalysisPanel / '추가'는 `stopPropagation` 별도 버튼) — 소유 전 학습 발견 루프. 비보유 종목 가격은 최신 캔들 종가 폴백(`AnalysisPanel` price)
- [x] 검색 **키보드 내비**(↑↓ 이동·Enter 살펴보기, 활성 행 하이라이트, 검색 갱신 시 reset)
- [x] (배치 3.5-A) lg+ 종목 상세 **모달 폭 확대(880px) + 데스크톱 섹션 점프 칩**(차트·뉴스, 실제 렌더 섹션만, 토스블루 회피) — PC 스캔성. 재배치 없이 폭/앵커만(저위험·build 통과)
- [x] (배치 3.5-B-부분) **lg+ '넓게 보기' opt-in 토글(880↔1080px)** — 무재배치 모달 폭 확대(차트가 넓어짐). 헤더 우측 컨트롤 1그룹화. 기본 off·localStorage·lg+ 전용.
- [ ] (배치 3.5-B-전면) **차트 좌·정보 우 전면 2컬럼 재배치** — ⏸️ 보류: 차트블록(1303~1512)이 중첩 fragment 多 → blind 래핑 시 모달 전체 붕괴 위험. **라이브 시각 루프 필수**(프리뷰 배포 후 파운더와 함께)
- [x] (배치 3.5-A) 상세 내 **종목 스위처(‹ ›)** — 보유/관심/매도(getAllSymbols) 순회 + symbol 변경 시 AI/멘토/차트 상태 reset 가드(스테일 방지) + 딥링크 URL 연동. 목록 밖(검색) 종목은 미노출
- [x] '최근 본 종목' 칩 — 배치 4A에서 완료

### 배치 4 — 관심 사이드바 '살아있는 정보' + 복기/세무 (빈자리 선점)
- [x] **관심 정렬 토글**('추가순' / '많이 움직인 순' = abs(dp), 미로딩 바닥) — `RightSidebar`, 추천·서열 아님(방향0) (4A, 2026-06-17)
- [x] **'최근 본 종목' 칩**(store `recentSymbols` ring-buffer 8 + persist, `setAnalysisSymbol`서 기록, 관심 중복 제외) — descriptive 재진입 (4A, 2026-06-17)
- [x] 관심 사이드바 **'오늘 한 줄'** (4B, dormant) — `buildMoverNote`를 `src/lib/moverNote.ts`로 추출(§6 게이트 SSOT: `DIGEST_RAG_EXPLANATION`+`gateDigestNote`, morning-brief와 공유) + `/api/mover-note` 라우트(서버 게이트) + RightSidebar top-mover 배선. **점검: off→`{note:null}` 무노출 / on→실제 헤드라인 인용 노트 둘 다 확인.** 변호사 후 플래그 켜면 활성
- [x] 관심 **currency 연동**(글로벌 $/₩ 토글 — 미국 종목만 환산, KR 이중환산 방지) (4C)
- [ ] 관심 행 **52주 위치 미니바** — ⏸️ 보류: 관심 행에 52주 고저 데이터 소스 부재(종목 열어야 캔들 생성). 종목별 fundamentals 프리페치 파이프라인이 선결
- [~] 단일 `WatchToggle` 동사 통일 — 컴포넌트 신설(`common/WatchToggle.tsx`, Mossy Teal) + MarketMovers·CohortReference 적용(MarketMovers 토스블루 제거 보너스). 남은 호출부(AiChok 카드·검색)는 후속
- [ ] PC 복기 작업대(흩어진 회고 집결)·Monthly Wrapped 공유 카드
- [ ] PC 세무 작업대(통합 양도세 정리 — `tax-v1-canary` 읽기전용 레이아웃 승격, 토스 빈자리)

### 보류/별건
- `--color-info` 토스블루 → 시맨틱 audit 후 별도 결정(파급 큼)
- `--brand-rain` 블루 유지 여부 → 브랜드 의사결정(사용자 확인)
- 컴포넌트별 잔존 CTA 블루(SettingsPanel·OcrImport·EditStockModal·EventsSection 등) → 색 의미론 audit PR로 일괄

## 3. 검증 게이트 (매 배치)
`npx tsc --noEmit` 0 · `npm run lint:alerts`·`lint:korean` 통과 · `npx vitest run`(leverageGuard 등 회귀 0) · 다크/라이트·PC/모바일 양쪽 육안 확인.
배포는 기존 게이트(레버리지 약관 v4 변호사 검토와 무관한 순수 UI라 별도 차단 없음, 단 main 머지=production).
