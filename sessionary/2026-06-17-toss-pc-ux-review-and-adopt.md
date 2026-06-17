# 2026-06-17 — 토스증권 PC vs 주비 PC 비교 리뷰(20인 패널) → 채택분 구현 7배치

> 흐름: (앞 세션 연속) SpaceX 레버리지 가드 main 머지 → 파운더가 토스증권 PC 스크린샷 2장(다크/라이트, SOXL 상세) 제시 "우리 PC와 비교 20인 회의" → deep 패널 → 정체성 게이트로 거른 채택분을 7배치로 구현(브랜치 `feat/pc-ux-craft-batch1`).

## 작업 요약

### A. SpaceX 레버리지 가드 (앞 세션 마무리 — main 머지·배포)
- `detectLeverageProfile` SSOT 통합으로 미국 영어명 LETF(1.5X/3X/5X/Bull/Bear) 커버. 마이그 `2026-06-16_stock_listings_enrich_cursor.sql` 파운더 선적용 → `b5cbf56` main 머지·push(production). 상세: `2026-06-16-spacex-leverage-coverage.md`, 메모리 `project_leverage_single_stock_policy`.

### B. 토스 PC vs 주비 PC — 20인 패널 (workflow `wf_4d3f0ac6-b03`)
- 패널·교차검증 중 세션한도로 종합 에이전트 실패 → transcript에서 구조화결과 추출해 직접 종합(채택 103 중 생존 87).
- **결론**: 토스=풀 브로커 터미널(매매·호가·소수점·커뮤니티·레버리지 전면·위젯 워크스페이스). 주비=관리·학습 도구(방향0·매매없음). **따라잡기 아니라 토스가 못/안 하는 빈자리(중립 관리·복기·세무·학습) 선점**이 승로.
- SSOT 문서: `docs/TOSS_PC_UX_REVIEW_ADOPT.md`(색 분류 규칙·로드맵·체크리스트).

### C. 채택 구현 — 7 커밋 (브랜치 `feat/pc-ux-craft-batch1`, 미머지)
1. `67481e0` 배치1: 토스블루 브랜드 누출 제거(theme-color·manifest·AI/검색 CTA·헤더 → Mossy Teal) + 차트 다크 테마(StockChart) + designTokens.brandPrimary
2. `3b0729f` 배치4B·4C: '오늘 한 줄'(dormant, §6 게이트) + 관심 currency 연동
3. `66f5c1a` 배치3.5-A: lg+ 모달 880 + 데스크톱 섹션 점프 칩
4. `bb44cfa` 배치3.5-A: 종목 스위처(‹ ›) + 상태 reset 가드
5. `4f49698` 다크모드 elevation(hairline 보더)
6. `30d6e22` WatchToggle 단일 컴포넌트(MarketMovers·Cohort, 토스블루 제거)
7. `ee23e4b` lg+ '넓게 보기' opt-in 토글(880↔1080)
- 그 사이: 배치2(크로스헤어 OHLC·기준선·useFocusTrap 모달 a11y), 배치3(딥링크 ?stock=·검색 살펴보기·키보드 내비), 배치4A(관심 정렬·최근 본)는 1·2번 커밋에 포함.
- 전부 tsc 0 · lint:alerts/korean OK · production build ✓ · vitest 회귀 0(formatKRW 4건 기존).

## 결정사항 (왜)
- **`#3182F6`은 손익색('하락=파랑', `--color-loss`)이자 토스블루** 두 의미 → **일괄 sweep 절대 금지**. 브랜드/AI/CTA 용처만 teal로, 손익색·`--color-info`·`--brand-rain`은 보존(색 분류 규칙=문서 §1).
- **'오늘 한 줄'은 §6 게이트 준수 dormant**: `buildMoverNote`를 `src/lib/moverNote.ts`로 추출(morning-brief와 SSOT 공유), `/api/mover-note`가 서버에서 `DIGEST_RAG_EXPLANATION` 검사 → off면 `{note:null}`(무노출). 클라가 env 못 읽으므로 서버 라우트로 게이트 강제. off/on 양쪽 점검 통과. 약관 v4 변호사 후 플래그 on 시 활성.
- **AiChok '둘러보기'는 의도 유지**: WatchToggle('관심 추가')로 강제하면 AI 촉 관찰 프레이밍(§6-인접 카피) 훼손 → 변경 안 함.
- **2컬럼 전면 재배치는 미구현**: 차트블록(1303~1512) 중첩 fragment로 blind 래핑 시 모달 붕괴 위험 + 시각검증 불가 → 라이브 시각 루프 필수 항목으로 남김.

## 미해결 TODO
- [ ] **(파운더) 프리뷰로 PC UX 7배치 육안 검증** — 특히 다크 차트·크로스헤어·딥링크·스위처·관심 토글·넓게 보기. 문제없으면 main 머지(=production).
- [ ] **2컬럼 전면 재배치** — 프리뷰 띄워 파운더와 함께(차트블록 안전 추출 + CSS grid).
- [ ] **52주 위치 미니바** — 관심 행 52주 고저 데이터 소스 부재 → fundamentals 프리페치 파이프라인 선결.
- [ ] **PC 복기 작업대 / 세무 작업대** — 큰 기능(세무는 `tax-v1-canary` BLOCKER 연결).
- [ ] (앞 세션 잔존) 세무 v1 카나리 검증·공개 결정 / 변호사 1회 상담 묶음(L1~L4·T1+·F1·F2).
- [ ] (별건 사전존재) `formatKRW.test.ts` 4건 실패 — 축약 vs 전체표기.

## 다음 세션 진입점
- 브랜치 `feat/pc-ux-craft-batch1` (7커밋, push됨, main 미머지). `docs/TOSS_PC_UX_REVIEW_ADOPT.md`가 채택 SSOT(체크리스트로 진행상황 추적).
- 다음=프리뷰 육안 검증 → 머지 / 2컬럼 전면 / 세무·복기 작업대 중 택. dev 서버 켜져 있었음(localhost:3000).
