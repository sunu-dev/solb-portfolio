# 2026-06-21 — 초보 차트 해설 + 분석 패널 §6 대규모 정화 + $/₩ 정렬 (PR #23)

> 흐름: 파운더가 종목 분석 차트 2건 지적(①초보가 차트 못 읽으니 차트 바로 밑에 쉬운 설명 ②$/₩ 정렬 틀어짐) → 6에이전트 전문가 회의 → 회의가 더 큰 §6 누출 발견(분석 패널에 명시적 매수/매도 추천 라이브) → 내가 §6 정화를 너무 terse하게(용어만 남게) → 파운더 교정("비서답게 쉽게·비유로") → chartNarrative 풍부 재작성 → 적대 3렌즈가 내가 놓친 치명 §6 2건 잡음 → 반영 → 운영 머지.

## 작업 요약 (운영 머지 완료, PR #23 / main d42d705)
- **차트 직하 초보 해설**: 신규 `src/utils/chartNarrative.ts`(buildChartNarrative→요약 항상+카드 펼침: 비유 whatIsIt + 현재상태 nowMeans). RSI=온도계·볼린저=띠·지지저항=눈에 익은 가격대. AnalysisPanel 차트 직하 약어 범례를 해설 블록(요약+`<details>` 접힘)으로 교체. level 바인딩(basic엔 볼린저 미렌더→설명 생략).
- **§6 대규모 정화**(요청 범위 초과 발견 — 라이브 방향0 위반): generateAIReport(매수 관심·분할 매수/매도 고려·이익 실현·손절 점검)·getChartShapeSummary(매수 관점·역사적 반등 통계)·getBollingerStatus/getMACDStatus desc·generateSummary·currentStatus·detectPattern 전수 descriptive 중립화. 볼린저/MACD/거래량 buy/sell 색칩→중립 토큰. GLOSSARY 방향 표현→관찰적 정의. 누출 불변식 테스트(`chartNarrative.test.ts`) 신설.
- **$/₩ 정렬**: 내 투자 현황 카드→grid 2컬럼 우정렬+tabular-nums(grid 트랙=보이지 않는 컬럼 가이드). 손익색 보존.

## 결정사항 (왜)
- **§6 정화가 차트 설명의 선결 게이트**: 처방·예측 카피가 살아있는 채 친절한 초보 설명을 더하면 "볼린저 상단=비쌈=팔 때"로 드리프트 증폭(5렌즈 만장일치). 같은 PR로 묶음.
- **정적 분석/차트 카피는 §6 사각**: lint:alerts ONBOARDING_FORBIDDEN은 경로 한정(onboarding/tourRegistry), 런타임 alertCompliance는 알림 전용 → 정적 UI 카피 무방비. → 누출 불변식 테스트로 박제(메모리 [[descriptive-not-prescriptive]] 보강).
- **초보 설명은 줄이는 게 아니라 더 풀어쓰는 것**(파운더 교정): 비서답게 "뭔지→지금 왜 이런지→어떤 뜻인지"를 비유로. §6은 (a)서술까지만 (b)앞일 양쪽+"아무도 모름"+참고용 (c)색 valence(매수/매도) 제거(색은 텍스트보다 강한 신호)로 안전.
- **서버 LLM 리포트는 범위 밖**(api/ai-analysis는 이미 §6 가드 내장). 클라 generateAIReport는 미렌더(dead)지만 재사용 누출 방지로 함께 정화.

## 미해결 TODO
- [ ] 운영 육안 검증: 차트 해설 톤/문구(파운더 직접 확인 후 다듬기), 칩 중립색, $/₩ 정렬, 다크.
- [ ] (선택) 차트 해설 펼침률 텔레메트리(chart_guide_expand) 보고 첫 진입 펼침 기본 전환 A/B.
- [ ] 차트에 지지/저항선 실제 렌더는 없음(현재 개념 설명만) — 추가 시 "과거에 자주 멈춘 자리"까지만(미래 반등 단정 금지).
- [ ] (투어 잔여·이월) demo_to_login funnel from='demo-banner' 분기·checklist_* 화이트리스트 통일.

## 다음 세션 진입점
차트 해설은 운영 반영 완료. 다음 후보: ① 차트 해설 톤 운영 검증/다듬기(파운더 피드백 대기) ② 상위 painkiller **세무 v1 카나리**(미진행, BLOCKER#1·프리뷰 READY·세무사법 §20③ 감수 게이트). 메모리 [[descriptive-not-prescriptive]](차트 §6 공식)·[[tour-system-ssot-2026-06-21]] 참조.

> §6 교훈: 정적 UI 카피(분석/차트/요약 카드)는 lint·런타임 가드 사각이다. 새 분석/해설 기능엔 누출 불변식 테스트를 코드에 함께. 친절할수록 처방으로 미끄러지니 "앞일=양쪽+아무도 모름+참고용", "색 valence 금지".
