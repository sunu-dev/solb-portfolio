# 2026-06-04 — 정보구조(IA) 재정비 + 적대적 리뷰 루프

> 흐름: (오전, main 배포) σ 용어 평이화·AI촉 로그인버그·온보딩 재노출·레거시 솔비서 sweep·legal-review 폴더·SERVICE_OVERVIEW → (오후, 브랜치 `ia-p0`) "토스/카카오처럼 메뉴 보여줄 필요성" 15인+ IA 리뷰 → **전면 IA 재정비 구현 → 적대적 리뷰 워크플로 2회 → 결함 14건 수정 → 프리뷰**.
> **다음 세션 핵심**: `ia-p0` 프리뷰 검토 → 좋으면 main 머지(공개). IA는 사용자 노출 큰 변경이라 프리뷰에서 PC·모바일·태블릿 직접 확인 후 머지 결정.

## 작업 요약

### A. main 직접 배포 (오전, 사용자 제보 픽스 — 각 commit 참조)
- σ(z-score) 퀀트 용어 → '평소보다 N배 큰' 평이화 6곳 (`afb29ee`)
- AI 촉 로그인 게이트 버그: fetchChok에 Authorization Bearer 누락 → getSession 토큰 첨부 (`9d15c55`)
- 온보딩 기존유저 재노출: localStorage-only → 서버 status(dbPortfolioStatus) 게이트 + 레거시 '솔(松)' 카피 제거 (`fdb55c1`)
- 전체수익현황 기간행 정렬: 인라인칩 → 세로 grid 리스트(tabular-nums) (`b159428`)
- 레거시 솔비서 sweep: 사용자 노출 0건(완료), solb.kr 이메일은 joobi.kr TODO, solb_ 키 15종 rename 금지 가드레일 (`44faedc`)
- legal-review 폴더 + SERVICE_OVERVIEW 서비스 정의서 (`3649c43`·`de19ab6`)

### B. IA 재정비 (브랜치 `ia-p0`, main 미머지 — 프리뷰)
16~25인 IA 패널 리뷰(menu=0·both=11·cleanup=5) 권고를 5청크로 구현. **"관리·확인 1번"을 프라임 공간에, 탐색·회고·메뉴는 적소로.**

| 청크 | 내용 | commit |
|---|---|---|
| P0-1 | dead code 5종 삭제(Heatmap·CirclePack·Mindmap·LoginStreak·MonthlyReplay) + 시점성 배너(챕터키워드·아침브리핑) 상단→하단 강등 | `bc91803` |
| P1-b/P2 | MarketMovers(시장발견)+회고 6종(Throwback·TradePatternMirror·PortfolioDNA·StockPulse·InvestmentJournal·ShareCard) 포트폴리오→AI인사이트 탭 이관. ChapterShelf만 잔류 | `7d7c8cd` |
| P0-2 | 보유 테이블 승격 — BrokerSummaryCard·MergedHoldingsCard를 종목탭 리스트 '아래'로 강등 | `d5520a7` |
| P1-a | 더보기→검색 내장 '전체' 기능 허브(FeatureDirectory 신설: 주요메뉴 4타일+도구+환경). PC 헤더 '전체' 진입점(open-feature-directory) | `a691dc6` |
| — | 오커밋된 임시 워크플로 파일 제거 | (별도) |

### C. 적대적 리뷰 루프 (ultracode)
- **리뷰 워크플로 `wjjdbkqtv`**: 5차원(reachability·dead-triggers·duplicate-render·logic-regression·ux-copy) 병렬 리뷰 → 각 결함 적대적 재검증. **확정 15건 / 기각 4건**.
- **결함 14건 수정** (`4fe4fc9`), 설계상 수용 1건(모바일 관심종목=포트폴리오 탭 경유):
  - [HIGH] MarketMovers가 보유0 신규유저 도달 불가 → `!hasAnyStock` 빈상태 분기에도 노출(두 분기 상호배타=중복 아님). 의도('탐색=보유무관') 복원.
  - [HIGH] /help '투어 다시 보기' 데드경로(location.href 후 setTimeout 레이스) → solb_tour_pending 플래그로 CoachMark 자동시작 재사용.
  - [HIGH] PC '전체'가 모바일 바텀시트 풀폭 → BottomSheet `desktopVariant`(lg+ 중앙모달+Esc). 진입점 `lg:flex` 단일화(768–1023 이중노출 제거).
  - [MED] brokerFilter 컨트롤이 리스트 아래라 효과 미인지 → 리스트 상단 활성필터 칩 + 필터0 전용 빈상태(진짜 보유0과 구분).
  - [MED] AI인사이트 미니nav에 시장발견·회고 누락 → ref+섹션 추가.
  - [LOW] 배지 PC 중복(시트 모바일한정)·검색 이중노출(상단필드 단일화)·알림센터 PC 사이드바 위임·미사용 import 제거·주석 정정.
- **재검증 워크플로 `w8ixjuhp0`**: 4개 수정 클러스터 → **전부 OK**(새 회귀 없음).
- 검증: tsc 0 · lint:alerts ✓ · lint:korean ✓ · build 0(전 단계).

## 결정사항 (왜)

1. **IA는 main 직접 아닌 브랜치+프리뷰** — 사용자 노출 큰 시각/구조 변경은 프리뷰 검토 후 머지 (feedback_pc_mobile·design_consistency 원칙).
2. **이관 컴포넌트는 상호배타 분기 양쪽에 둬도 됨** — `{cond ? A : B}`는 런타임 단일 마운트라 중복 아님. MarketMovers를 빈상태/홀더 양 분기에 둬 신규·기존 모두 커버.
3. **데드 메뉴 방지 = 항상 마운트된 트리거만 허브에 노출** — 화면 종속 이벤트(chapter-shelf)는 제외. 알림센터는 PC=사이드바 스크롤/모바일=바텀시트로 디바이스 분기.
4. **진입점 브레이크포인트 일치** — 헤더 '전체'(lg:flex)와 하단 '더보기'(lg:hidden)가 겹치지 않게 lg(1024) 기준 단일화.
5. **brokerFilter는 컨트롤을 아래로 옮기되 결과 위치에 인지·해제 UI 보강** — 필터 강등의 UX 부작용을 활성필터 칩+전용 빈상태로 상쇄.

## 미해결 TODO

- [ ] **`ia-p0` 프리뷰 검토 → main 머지 결정** (PC·모바일·태블릿 직접 확인). 프리뷰: `solb-portfolio-git-ia-p0-sunudevelop-1252s-projects.vercel.app`
- [ ] (머지 시) 5청크 한 번에 main → production 자동 배포. dead code 삭제 포함이라 번들 감소.
- [ ] (설계 수용분) 모바일 관심종목 빠른 진입 — 필요 시 포트폴리오 탭 watching 딥링크 검토(차단 아님).

## 다음 세션 진입점

`ia-p0` 프리뷰를 열어 ① 포트폴리오 탭(Dashboard→보유테이블 프라임, 증권사카드 아래) ② AI인사이트 탭(시장발견+회고, 빈상태에서도 시장발견) ③ 더보기/전체 허브(모바일 바텀시트, PC 헤더'전체'→중앙모달) ④ 증권사 필터 활성 시 상단 칩을 확인. 좋으면 `git checkout main && git merge ia-p0 && git push`. 별도 신규 작업은 세무 v1 카나리 검증(BLOCKER #1)이 우선.
