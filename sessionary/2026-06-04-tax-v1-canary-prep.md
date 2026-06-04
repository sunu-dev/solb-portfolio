# 2026-06-04 — 세무 v1 양도세 합산기 카나리 준비 (BLOCKER #1)

> 흐름: "세무 v1 카나리 검증부터" → 슬라이스(`tax-v1-slice`, main 28커밋 뒤처짐)를 현행 main에 재통합 → 다크모드 픽스 → 준비도 적대적 리뷰(GO-WITH-FIXES) → must-fix 7건 반영 → 프리뷰 배포. **카나리 실행 자체는 파운더 액션(지인 5인).**
> **다음 진입점**: 파운더가 프리뷰 링크로 5인 카나리 → 결과 가져오면 GO/조건부/NO-GO 판정 → 머지(공개)+결제+변호사 / 또는 v2 자동합산 설계.

## 작업 요약

### 재통합 (`tax-v1-canary` 브랜치, main 미머지)
- `tax-v1-slice`는 고유 커밋 2개(899c28c·0ba64e8)뿐, main보다 28커밋 뒤처짐. 카나리가 현행 앱(IA·건강점수) 위에서 돌도록 **새 브랜치 `tax-v1-canary`(main 기반)에 재통합**:
  - 신규 파일 그대로 반입: taxStore.ts·TaxEstimateModal.tsx·tax.test.ts (무충돌).
  - tax.ts에 computeTaxEstimate+타입 수동 추가(골격은 main에 이미 있음, legal-review 경로 주석 보존).
  - PortfolioSection: 진입 카드(Dashboard 직후, 카나리 가시성)+모달 마운트+showTax. 슬라이스의 `var(--text)`→현행 `--text-primary` 정합.

### 다크모드 픽스 (모달)
- `var(--text)`(미정의 변수)→`--text-primary` 5곳 = **다크모드 글자 안 보이던 버그**. 하드코딩 라이트색(F8F9FA·E5E8EB·#fff·4E5968)→테마 변수.

### 카나리 준비도 리뷰(GO-WITH-FIXES) must-fix 7건 (`371e786`)
- **[B-1 blocker] WTP 측정 장치**: 없으면 카나리=시연. Vercel Analytics 행동 이벤트 5종(tax_modal_open·first_entry·**aha_2brokers**·result_positive·hometax_click) + 결과 직후 **3지선다 WTP 위젯**(유료/무료/안씀, track).
- [B-2] 연도 토글 단일화(올해만) — entries에 연도필드 없어 혼선.
- [B-3] 출처 안내('양도소득세 계산내역') 상시 노출 + 손실 − 안내.
- [B-5] 입력 type=number→text — iOS numeric 키패드에 − 없어 **손실 입력 막히던 것** 해소.
- [B-6] 면책 색 #9A6700→var(--color-warning) 다크 가독성.
- [B-7] taxStore 인앱브라우저 안전 스토리지(localStorage throw 시 in-memory 폴백, rehydrate 크래시 방지).
- [B-4] lint 세무 게이트: 파일경로 외 **줄-내용**(양도세·세무·홈택스·기본공제)에도 TAX_FORBIDDEN 적용 + **단일줄 `/* */` 주석 스트립 버그** 수정(주석 오검출 방지).
- med: 카드 sub '추정해 보기'·면책 '참고용·전문 세무 서비스 아님·만원 반올림'·tax.test 경계 4건(13/13).
- 검증: tsc 0·vitest 13/13·lint:alerts/korean ✓·build 0. 프리뷰 READY.

## 결정사항 (왜)
1. **재통합 = 새 브랜치(merge 아님)** — 슬라이스가 28커밋 뒤처져 PortfolioSection 충돌 지옥. 신규 파일 반입 + 카드만 현행 구조에 수동 재배치가 깨끗.
2. **카나리 ≠ 시연. 측정 장치를 코드에 내장** — WTP를 측정할 텔레메트리+위젯이 없으면 "지인이 봤다"는 정성 인상만 남음. 검증의 전제. (메모리 승급 후보)
3. **§20③ 안전선** — '세무대리/신고대행/세무상담/세무비서' 금지(부정문 "~아님"도 substring 걸림). 면책은 "전문 세무 서비스가 아니라 계산 도구"로. lint 게이트를 줄-내용까지 확장해 사각 봉합.
4. **카나리 가시성 > IA 정석** — 검증 중인 피봇 기능이라 Dashboard 직후 prime 배치. 검증 후 위치/허브 이동 재결정.

## 미해결 TODO
- [ ] **(파운더 액션) 5인 카나리 실행** — 프리뷰 링크 전달, 질문 1·4(첫 숫자 찾기 마찰·"월 얼마") 중심 관찰. 핵심 신호=aha_2brokers 도달률+WTP 위젯.
- [ ] 카나리 결과 → GO(머지+결제+변호사 약관 §20③)/조건부(무료 retention)/NO-GO(v2 자동합산) 판정.
- [ ] 실기기 점검: iOS 손실(−) 입력·카카오 인앱 입력보존·Samsung 全角−·다크 면책.
- [ ] (별건, 사전 존재) `formatKRW.test.ts` 4건 실패 — `₩1.0만` 축약 기대 vs `₩10,000` 반환. 테스트/구현 중 무엇이 맞는지 결정.
- [ ] (메모리 승급 후보) "검증(카나리)엔 측정 장치를 코드에 내장 — 없으면 시연" 방법론.

## 다음 세션 진입점
프리뷰: `solb-portfolio-git-tax-v1-canary-sunudevelop-1252s-projects.vercel.app`. 카나리 결과가 있으면 판정→다음 단계. 없으면 결과 대기 중이므로 다른 BLOCKER(레버리지 사후 자문·joobi.kr Phase A) 또는 신규 작업.
