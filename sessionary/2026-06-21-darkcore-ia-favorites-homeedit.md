# 2026-06-20~21 — 다크 코어·IA 슬림·AI촉 캐시워밍·즐겨찾기(B)·홈편집(A) 8 PR

> 흐름: 파운더가 다크모드 가독성/UI 밀도/IA를 연달아 지적 → 매번 패널+적대적 리뷰로 근본 처리 → 8 PR 운영 머지. 모든 적대적 리뷰 0건(설계 단계 비평이 갭 선차단).

## 작업 요약 (운영 머지 완료, main)
- **PR #2/#3 (다크 손익 가독성·세로 리듬)**: 손익 행 `오늘` 라벨이 미정의 토큰 `var(--text)`로 다크에서 묻힘 → `--text-primary` 교정. 홈 카드 세로 간격 드리프트(24/32) → `.home-stack`(부모 gap) 구조화.
- **PR #5 (다크모드 색상 코어)**: 근본원인=다크가 토큰 리매핑 + 하드코딩 색 substring 허용목록으로 쪼개져 '수동 active 색쌍'(bg=text-primary 다크에서 밝아짐 + color='#fff' 안 뒤집힘=흰글자 on 흰배경) 못 잡음. → `--pill-active-bg/fg` 색쌍 신설 + active 19곳 토큰화 + `scripts/lint-darkmode.mjs`(R1 active색쌍·R3 미정의토큰·R4 라이트보더) prebuild 게이트. R1=0 달성, 가드가 회의 밖 실버그(MonthlyChapter)도 검출.
- **PR #4 (포트폴리오=보유관리 슬림화, IA)**: 14인 패널 → 포트폴리오 화면 과적 해소. 모닝브리핑 상단 승격·맵 compact 제거·뉴스 CTA 제거·AI촉 1줄 슬림. 코어 잠금.
- **PR #6 (AI 촉 캐시워밍·A안)**: "AI촉 늦게 뜸" 4렌즈 만장일치=클릭로드 기각(대기를 클릭 뒤로 옮길 뿐+발견성 손실). 마운트=AI 미사용(intent='fetch'). 원인=enrichUniverse 지연 → `enrich-warm` cron(세션경계 2회/일, Gemini 미호출) + 텔레메트리.
- **PR #7 (메뉴 즐겨찾기 'B')**: `menuRegistry.ts` SSOT(Header/MobileNav/FeatureDirectory 3곳 통합, '이벤트 분석'/'이벤트' label/navLabel 분리) + '바로가기'/**Pin**(Star는 종목찜 점유라 충돌 회피) + localStorage.
- **PR #8 (홈 화면 편집 'A')**: 16에이전트 설계 스펙(`docs/HOME_EDIT_DESIGN_SPEC.md`) → 6단계 구현. 코어(총금액+보유테이블) 레지스트리 미등재=영구 고정, 보조 위젯만 zone(above/below/analysis) 표시·숨김 + below-core ↑↓. AI촉 hideable:false(§6 박제, 3중 방어 + 누출 불변식 테스트 5/5).

## 결정사항 (왜)
- **다크는 '허용목록 추격' 대신 '토큰 강제 + lint 가드'**: 허용목록은 신규 컴포넌트를 늘 늦게 따라가 재발. → 메모리 `project_design_system` 다크 코어 표준에 박제.
- **AI촉 클릭로드 기각**: 느림 원인이 AI가 아니라 enrich 지연이라 클릭은 해결 아님. 영구무료 AI촉=핵심 리텐션 자산이라 숨기면 안 됨.
- **홈편집은 opinionated 명료함 vs 커스터마이즈를 '시간축 분리'**: 디폴트=코드 SSOT(협상불가), 편집=코어 잠근 옵트인 escape hatch. 14인 패널은 세무 카나리 후 권고했으나 파운더가 지금 진행 결정(기회비용 인지).
- **편집영역 '코어 끼임'을 zone으로 활용**: 코어가 zone 분리벽 → 순서변경이 경계 못 넘음. CSS order 아님(JSX 재정렬+stableId key) — 비위젯 자식 DOM/탭/SR desync 회피.
- **레지스트리 패턴 = 카탈로그(코드)/의도(저장)**: 위젯·메뉴 추가/삭제/리네임이 무마이그레이션 코드 변경. 저장은 id 배열만. → 메모리 승급(아래).

## 미해결 TODO
- [ ] **홈편집 announce 채널**(선택 폴리시): 토글/순서변경 시 aria-live 음성 피드백(현재 aria-pressed/label만, BottomSheet가 Escape/스크롤락은 처리). 머지 후 보강 가능.
- [ ] **R4 라이트 보더 103건 sweep**(대부분 admin/debug): lint:darkmode soft가 추적 중. 점진 정리 후 strict 격상.
- [ ] **세무 v1 카나리(BLOCKER#1, tax-v1-canary)**: 패널이 1순위 기회비용으로 지목. 프리뷰 READY·파운더 액션만 남음(이번 세션 미진행).
- [ ] **레버리지 가드 약관 v4 변호사 게이트**(기존 미확정 3건).

## 다음 세션 진입점
홈편집(A)·즐겨찾기(B) 운영 배포 완료·적대적 리뷰 0건. 운영 육안 검증(편집 시트 동작·디폴트 무변·다크) 후 announce 폴리시 보강 여부 결정. 또는 세무 카나리(painkiller)로 전환.
