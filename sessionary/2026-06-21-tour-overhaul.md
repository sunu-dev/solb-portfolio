# 2026-06-21 — 투어/온보딩 강화 6 PR (전략회의 → Phase 0~3b)

> 흐름: 파운더 "본 화면 투어 다시 보기를 강화 + 첫 방문자도 이용? 전략회의" → 8에이전트 전략회의(6렌즈 진단+종합+적대적) → 단계별 구현, 각 PR 적대적 다중에이전트 리뷰 후 운영 머지. help 현행화 포함 6 PR(#12~#17).

## 작업 요약 (운영 머지 완료, main)
- **PR #12 (help 현행화)**: /help가 신규 기능(홈편집·바로가기) 누락 + 개선제안 위치 stale → FAQ 2개 추가·정정.
- **PR #13 (Phase 0 핫픽스)**: 라이브 §6/브랜드/데이터 결함 즉시 차단. ①§6 prescriptive 카피 5곳(OnboardingFlow/CoachMark "추천")→descriptive + `lint-alerts.mjs` ONBOARDING_FORBIDDEN 경로한정 박제(DIGEST/TAX 패턴 미러) ②CoachMark 토스블루 #3182F6→`--brand-primary`, 툴팁 #fff→`--surface` ③**온보딩 샘플 종목이 watching→savePortfolioToDB로 실제 서버 계좌 동기화되던 오염** 차단(StockItem.demo 플래그 + `stripDemoStocks`).
- **PR #14 (Phase 1 SSOT)**: 하드코딩 투어 2배열 → `src/lib/tourRegistry.ts` 순수 데이터 SSOT(menuRegistry/homeWidgetRegistry 동형). CoachMark는 import만(동작 불변). **`scripts/lint-tour-anchors.mjs` 신설**(레지스트리 anchor↔코드 data-tour 일치 빌드 강제=데드앵커 무음skip 차단), prebuild 5번째 게이트. §6 테스트 + 박제.
- **PR #15 (Phase 2 측정)**: `logApiCall` 비로그인 early-return 갭 메움. `tour_events` 테이블(RLS service-only)+`/api/tour-event`(공개 no-auth, service-role rate-limit fail-CLOSED)+`logTourEvent`(로그인→api_logs/게스트→sink)+`logFeatureFirstUse`(5곳 배선). admin/growth에 featureAdoption·코호트·guestFunnel **대시보드 렌더**. cleanup-pii cron에 tour_events 30일 TTL.
- **PR #16 (Phase 3a 챕터형)**: 5챕터(home=core 자동 + insights/news/events/customize=deep). CoachMark **멀티섹션 폴링 엔진**(step.section≠현재면 setCurrentSection→앵커 폴링→종료 시 원탭 복원). 신규 앵커 5개. `TourChapterSheet`(둘러보기→챕터 선택 시트, 완료 뱃지). `--text-body` 토큰 신설.
- **PR #17 (Phase 3b 게스트)**: 비로그인 `GuestTourBanner`(디스미스 1줄, 강제모달 아님)→home 게스트 투어. AiChokSection loginForMore 분기=**티커 없는 §6 면책+로그인 CTA**(파운더 결정). 홈 ai-hunch 스텝 section portfolio→insights 교정(data-tour=ai-chok가 insights에만 렌더되던 잠재 버그).

## 결정사항 (왜)
- **전략회의 첫방문자 결론 = YES 조건부**: 강제모달 ❌→1줄 배너 / 샘플 sessionStorage 격리 / AI촉 단일 가입훅 / 비개인화 descriptive / 게스트 측정채널 전제(Phase 2가 충족). 검증가가 종합안도 놓친 라이브 결함(watching 오염·§6 카피 5곳·lint glob 오해) 잡음 → Phase 0 우선.
- **Phase 분해**: 검증가 스코프 경고 반영. Phase 0(핫픽스)→1(SSOT)→2(측정, 검증=측정 룰상 게스트 투어 전 측정 선행)→3a(챕터, 목표A)→3b(게스트, 목표B). 빅뱅 기각.
- **데드앵커 빌드 게이트**: menuRegistry '데드 메뉴' 문제의 투어판 재발 방지. 적대적 리뷰가 추출 정규식 따옴표 비대칭(med)·중복 anchor 미검출(low)·URL 절단(low) 잡아 보강.
- **rate-limit fail-CLOSED + service-role**: 기존 `enforceRateLimit`는 anon클라+api_calls RLS SELECT 정책 의존 → 정책 누락 시 count=0 fail-open(프로젝트 known RLS anon 안티패턴). 공개 엔드포인트라 service-role 직접 count + 실패 시 거부로 교체.
- **React 인라인 hex는 다크 allowlist 미적용**: `[style*="color:#4E5968"]` 셀렉터는 브라우저가 인라인색을 `rgb()`로 직렬화해 매칭 실패 → 인라인엔 무효. `--text-body` 토큰이 정답. (메모리 design_system 보강)
- **게스트 AI촉 = 티커 없는 설명만**(파운더 §6 결정): 익명 공개에 종목 예시(CHOK_PREVIEW) 노출은 '추천 콘텐츠 상시 게시' 유사투자자문 해석 리스크(패널 변호사검토 권장) → 전환 강함 옵션 기각하고 §6 안전 채택.

## 미해결 TODO
- [ ] **⚠️ 운영: `supabase/migrations/2026-06-21_tour_events.sql` Supabase 수동 적용** — 게스트 투어 라이브라 demo_started/demo_to_login 생성됨. 미적용 시 guestFunnel 안 쌓임(대시보드 "측정 대기" 무중단). 적용해야 목표B 전환율 측정 ON.
- [ ] **3b-2 (다음 작업)**: sessionStorage 데모 포트폴리오 — 게스트에게 populated 보유 거울(샘플 데이터로 실제 화면 체감). decision #4: solb_demo_ 격리, watching 미주입, 로그인 전환 시 비우기/가져오기 분기. PortfolioSection 렌더가 데모 오버레이 읽어야 함(고위험).
- [ ] **Phase 4 (백로그)**: 진행형 체크리스트("주비 시작하기 3/5") — 채택 데이터 확인 후.
- [ ] formatKRW.test 4건 사전존재 실패(@/utils/formatKRW, 투어 무관) — 별도 정리 후보.

## 다음 세션 진입점
3b-2부터. 핵심 난제 = "게스트 샘플 종목을 watching(persist)에 안 넣고 PortfolioSection에 표시". 후보: 비-persist 스토어 슬라이스(demoStocks) + partialize 제외 + PortfolioSection이 demo 모드일 때 머지 렌더. 로그인 전환 시 데모 클리어/가져오기 분기(usePortfolioSync userIdRef 가드 정합 확인). 메모리 [[project_tour_system]] 참조.
