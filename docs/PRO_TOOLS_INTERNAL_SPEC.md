# 주비 도구형 PRO 내부 준비안

기준일: 2026-07-18  
상태: 내부 준비 전용, 판매·결제 비활성

## 1. 상품 경계

주비 플러스는 투자정보나 투자판단의 대가를 받지 않는다. 결제 대상은 사용자가 직접 입력한 기록을 더 편리하게 저장·정리·복구·내보내는 기능으로 한정한다.

무료와 PRO에서 항상 같아야 하는 항목:

- AI 분석 횟수·모델·품질·응답 우선순위
- 오늘 시장 흐름 설명
- 시세 갱신 기준
- 투자 관련 알림
- 종목 목록과 종목 설명 범위

기존 무료 기능인 다중 증권사 통합과 기본 클라우드 동기화는 나중에 잠그지 않는다.
사용자가 입력한 데이터의 기본 CSV·JSON 수동 내보내기도 무료로 보장한다. 데이터 이동권 자체를 결제벽으로 쓰지 않는다.

## 2. 내부 상품안

- 월 4,900원
- 연 49,000원
- 기간별 묶음·변경 이력·예약 실행을 포함한 고급 내보내기
- 이전 저장 버전 복구
- 기본 기간 이후 기록 보관
- 여러 장 OCR 가져오기와 중복 확인
- 화면 구성 프리셋
- 일반 광고 도입 시 광고 제거

## 3. 기술 구조

- 상품 SSOT: `src/config/proPlan.ts`
- 권한 해석: `src/lib/proEntitlements.ts`
- 사용자 권한 API: `GET /api/me/entitlements`
- 출시 준비도: `src/lib/proReadiness.ts`
- 관리자 확인: `/admin`의 `PRO 준비` 탭
- DB 기반: `supabase/migrations/20260718000400_pro_tools_foundation.sql`
- 내보내기 기반: `src/utils/portfolioExport.ts`
- 수요 검증 판정: `src/lib/proDemandValidation.ts`
- 수요 검증 UI: `src/components/pro/ProDemandOffer.tsx`
- 수요 이벤트 API: `POST /api/pro-demand/event`
- 운영 노출 플래그: `PRO_DEMAND_TEST_ENABLED=true`, 개인정보 게이트: `PRO_DEMAND_POLICY_READY=true`, 코호트: `PRO_DEMAND_COHORT`

클라이언트 UI 표시는 보조 수단일 뿐이다. 서버 비용·저장공간을 쓰는 PRO 기능은 반드시 서버가 `GET /api/me/entitlements`와 동일한 기준으로 다시 검사해야 한다.

### 가져오기 대조·복구 현재 구현

- `src/lib/portfolioReconciliation.ts`가 증권사와 티커를 함께 사용해 새 항목·변경 있음·그대로·확인 필요를 판정한다.
- 증권사가 다른 동일 티커는 별도 보유로 처리하고, 증권사가 없거나 여러 기존 계좌와 겹치면 자동 변경하지 않는다.
- OCR 검토 화면은 기존 평단·수량과 새 값을 나란히 보여주고 선택한 변경만 한 번에 승인한다.
- 승인 직전 로컬 복구 지점 한 건을 무료 안전장치로 남기고, 완료 화면에서 즉시 되돌릴 수 있다.
- 여러 복구 버전의 장기 보관·서버 동기화·복구 이력은 여전히 PRO 후보이며 판매 게이트 전에는 활성화하지 않는다.

## 4. 판매 잠금

아래 환경값이 모두 `true`이고 코드 준비도 검사까지 통과해야 `readyForSales`가 참이 된다.

- `PRO_TOOLS_SALES_ENABLED`
- `PRO_TOOLS_SCHEMA_READY`
- `PRO_TOOLS_LEGAL_APPROVED`
- `PRO_TOOLS_POLICIES_READY`
- `PRO_TOOLS_BILLING_READY`
- `PRO_TOOLS_BUSINESS_READY`
- `PRO_TOOLS_MANUAL_GRANTS_AUDITED`
- `PRO_TOOLS_RESTORE_DRILL_READY`
- `PRO_TOOLS_METRICS_READY`
- `PRO_TOOLS_SUPPORT_READY`

`PRO_TOOLS_SALES_ENABLED` 하나만 켜서는 판매 준비 상태가 되지 않는다.

`PRO_DEMAND_TEST_ENABLED`는 결제 없는 가격 가설 화면을 요청하는 플래그다. 실제 판매 플래그와 독립이며, 이 값을 켜도 결제·구독·권한 부여는 발생하지 않는다. 다만 사용자 노출은 아래 세 조건이 모두 충족돼야 한다.

- 이벤트 마이그레이션 `20260719000100_pro_demand_events.sql` 적용
- 개인정보 처리방침에 수요 검증 이벤트의 목적·항목·최대 180일 보관을 반영하고 동의 버전 처리 검토
- `PRO_DEMAND_POLICY_READY=true`와 `PRO_DEMAND_TEST_ENABLED=true` 설정

어느 하나라도 빠지면 설정 API와 이벤트 API가 fail-closed로 동작한다.

## 5. 결제 구현 전 빠뜨리면 안 되는 항목

- 결제 웹훅 서명 검증
- `(provider, event_id)` 멱등성 처리
- 결제 성공과 권한 부여를 하나의 서버 흐름으로 처리
- 연체·취소·환불·기간 만료 시 권한 회수
- 연체는 현재 결제기간 종료 후 최대 3일만 유예하고, 이후 자동 회수
- 관리자 수동 권한 변경 감사 로그
- 구독 해지 버튼과 다음 결제일 표시
- 환불 기준과 고객지원 연락처
- 사업자등록·통신판매업·결제대행 계약
- 개인정보 처리방침의 결제사·보관기간 반영
- 금융위원회 법령해석 또는 전문가 확인 자료 보관
- 사업자등록·통신판매업·현금영수증·부가세 처리 확인
- 기존 수동 PRO 계정의 사유·만료일 전수 점검
- 스테이징 백업 복구 훈련과 신규 판매 중단 스위치 검증
- 결제 장애 시 투자 관련 무료 기능을 잠그지 않는 장애 격리

## 6. 현재 의도적으로 하지 않은 것

- 결제대행사 선택과 SDK 설치
- 체크아웃·웹훅 운영 코드
- 운영 DB 마이그레이션 적용
- 무료 기능의 PRO 전환
- 투자 AI 호출량·품질·속도 차등

이 항목들은 공식 법률 확인과 파운더 승인 후 별도 배치로 진행한다.

가격과 결제 가능성 검토, 무료/유료 상세 경계, 검증 실험은 `docs/FREE_PRO_MONETIZATION_WTP_REVIEW.md`를 따른다.
