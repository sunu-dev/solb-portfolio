# 2026-05-12 — 온보딩(스타트 가이드) 전면 강화

> 이 세션은 [2026-05-12-listings-pipeline](2026-05-12-listings-pipeline.md) 이후의 마지막 작업.

## 작업 요약

사용자 제기 — "처음 사용자가 왔을 때 안내해주는 게 너무 빈약". 9인 회의(UX·콘텐츠·PM·프론트·분석가·마케터·신규유저·재방문자·접근성) → 합의 → A+B+C+D 전수 구현·배포 (커밋 8c51074, +680 / −168).

### Phase A — OnboardingFlow 4 step 재설계

기존 흐름은 브랜드 스토리 중심 (솔=소나무, 환영 인사, 종목 추가, 완료). "그래서 뭘 해주는데?" 답이 없었음.

| Step | 신규 | 내용 |
|---|---|---|
| 0 | 가치 약속 3카드 | 📊 한 줄 요약 / 🎯 AI 촉 / 🧑‍🏫 멘토 6명 — Aha 시드 |
| 1 | 기존 유지 | 샘플 / OCR / 인기 종목 |
| 2 | AI 촉 미리보기 | 정적 샘플 카드 3종 (NVDA·JNJ·XOM 예시) — 실 API 호출 X, 한도 보존 |
| 3 | 시작 + 투어 안내 | 브랜드 스토리는 1줄로 축약 |

- 우상단 '건너뛰기' 버튼 신규
- `onboarding_step_view`/`complete`/`skip` 이벤트 추적

### Phase B — CoachMark 본 화면 4 핫스팟 투어

신규 컴포넌트 `src/components/onboarding/CoachMark.tsx`. 작동:
- localStorage `solb_tour_pending` 자동 시작 (온보딩 완료 직후)
- `window.dispatchEvent('open-tour')` 수동 재시작 (도움말 페이지에서)
- 4 핫스팟: `macro-strip` / `portfolio-section` / `ai-chok` / `help-button`
- 반투명 오버레이 + boxShadow 9999px 트릭으로 하이라이트 링 + 툴팁 모달
- `data-tour="..."` 속성으로 타겟 element 식별 (4 곳 마킹)
- 모바일 좌표 안전 (`vw - TOOLTIP_WIDTH - 16` 클램프)
- 타겟 못 찾으면 600ms 후 다음 step 자동 진행 (lazy mount 대응)

### Phase C — /help 도움말 페이지 (5 섹션)

신규 정적 페이지 `src/app/help/page.tsx`. 섹션:
- AI 촉 (3 Q&A — 한도/비로그인 정책 명시)
- 멘토 6명 (소개 + 사용법)
- 건강 점수 (4축 계산 / 점수별 액션)
- 알림 (종류 / 푸시 설정)
- 매수 시뮬

`<details>` HTML 요소로 FAQ 형태. 상단에 "본 화면 투어 다시 보기" CTA (메인 진입 + `open-tour` dispatch).

헤더에 `<HelpCircle>` 버튼 추가 (`data-tour="help-button"`, 알림 벨 옆) → /help 이동.

### Phase D — Funnel 이벤트

- `onboarding_step_view` (step별)
- `onboarding_complete` / `onboarding_skip`
- `tour_started` / `tour_step` / `tour_completed` / `tour_skipped`
- `help_opened`

→ `/admin` 성장 탭에서 단계별 이탈률 추적 가능.

## 결정사항

### 회의에서 합의된 큰 결정들

1. **온보딩 안에서 실 AI 호출 금지** — Aha moment(AI 촉 미리보기)는 정적 샘플로. 한도 1회/일은 본 화면 진입 후 사용자 명시 클릭으로 보존.
2. **하이브리드 가이드** — 첫 진입 자동 코치마크 + ❓ 버튼으로 언제든 재시작. 강제 X.
3. **❓ 버튼 = /help 이동** — popover 메뉴 만들 수 있었으나 단순성 우선. /help에서 투어 재시작 CTA로 우회.
4. **브랜드 스토리 축소** — "솔=소나무, 비=폭풍우" 매력적이지만 step 0 차지하기엔 헛것. step 3 "준비 완료"에 한 줄 부록.
5. **건너뛰기 옵션 필수** — 강제 4 step은 PC 사용자에게 갑갑(접근성). 우상단 X 버튼 노출.

### 진단으로 밝혀진 사실

- MacroStrip 컴포넌트는 실제 시장 지수 ticker가 아닌 fear-greed gauge (별도). 진짜 매크로 ticker는 `MarketSummary` — page.tsx 라인 216에서 마운트.
- 본 화면 진입 후 가이드는 0건이었음 (코치마크/툴팁/투어 부재).
- 도움말 페이지(`/help`)도 없었음.

## 미해결 TODO

- 🟡 (P2) 사용자 첫 5분 funnel 분석 — `/admin` 성장 탭에 `onboarding_*`/`tour_*` 이벤트 집계 위젯 추가
- 🟡 (P2) 카운트마크 모바일 보텀시트 패턴 — 현재 위치 기반 툴팁은 PC 친화. 모바일에서는 풀스크린 보텀시트가 더 좋다는 접근성 의견 (베타 사용자 피드백 보고 결정)
- 🟢 (P3) /help 페이지 콘텐츠 보강 — 영상·이미지·동영상 가이드 (초기 베타 단계라 텍스트 충분)

## 다음 세션 진입점

1. 배포 검증 (1~3분 후 Vercel 자동 배포)
   - 시크릿 모드 → 신규 가입 → 4 step 온보딩 확인
   - 본 화면 진입 시 코치마크 4단계 자동 시작 확인
   - 헤더 ❓ 클릭 → /help 진입 확인
   - /help 에서 "투어 다시 보기" 클릭 → 메인에서 투어 재시작 확인
2. 1주일 후 `/admin` 성장 탭에서 단계별 이탈률 확인 (이벤트 집계 위젯 별도 필요)
3. 다음 작업 후보: docs/UNIVERSE_INCLUSION_CRITERIA.md / ai-analysis 신규 IPO 안내 / 사용자 피드백 반영

## 메모리 승급 자문

이번 작업은 단발성 UI 개선이라 영속적 메모리 후보 약함. 다만 다음은 가치 있을 수 있음:
- (선택) "코치마크 패턴 (data-tour 속성)" — 향후 새 기능 추가 시 동일 패턴 따르도록. 코드 자체로 충분히 self-documenting이라 메모리 우선순위 낮음.

→ 메모리 승급 안 함. 코드 + 이 세셔너리로 충분.
