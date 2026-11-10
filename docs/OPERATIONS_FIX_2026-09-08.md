# 2026-09-08 운영 저장·초대 코드 수정

## 확인된 원인

- 운영 REST 스키마 조회(200): save_user_portfolio_if_current_v2는 있으나
  user_portfolios.daily_snapshots는 없음. portfolio_history는 있음.
- 기존 테이블에는 CREATE TABLE IF NOT EXISTS 안의 컬럼 선언이 추가되지 않는다.
- 운영 UI는 클라우드 재시도 상태. CAS 함수는 누락 컬럼을 읽고 쓰므로 정상 저장 불가.
- 기존 코드 적용은 INSERT 실패를 삼킨 뒤 valid=true를 반환하며,
  use_count read-modify-write와 보상 쓰기를 별도 요청으로 처리함.

## 수정

1. 20260908000100_restore_daily_snapshots.sql: 누락 컬럼만 추가.
   stocks, updated_at, history 및 로컬 outbox는 변경하거나 삭제하지 않는다.
2. 20260908000200_atomic_signup_code.sql: 사용자별 advisory lock + 코드 행 잠금.
   한 트랜잭션에서 유효성/한도 확인, 사용 기록, 횟수, 가입 행, 보상 처리.
   실패 시 전체 롤백. 이미 완전히 적용된 동일 요청만 멱등 성공.
   할인·프로모션 코드는 가입에 사용할 수 없음. service_role만 함수 실행 가능.
3. API는 공통 인증/레이트리밋 래퍼를 적용하고 검증된 사용자 ID만 전달.
   RPC 실패는 503, 미적용은 409. UI도 HTTP 성공 + valid + applied를 모두 요구.

## 적용 순서와 현재 상태

- 코드/SQL 작성, 관련 단위 테스트 18개 및 전체 842개 통과(1개 skipped).
- 전체 빌드·변경 파일 ESLint·git diff --check 통과.
- 운영 DB에 두 마이그레이션 적용 성공(SQL Editor). 컬럼/함수 존재 재조회 true/true.
- 기존 운영 계정 화면에서 '클라우드 동기화 정상' 확인.
- DB 트랜잭션 테스트: 임시 auth 사용자 2명과 한도 1 코드로 최초 적용,
  동일 요청 멱등 성공, 다른 사용자 한도 초과 거절, 첫 포트폴리오 행 생성 확인.
  테스트는 ROLLBACK으로 모든 임시 행을 제거했고 기존 사용자 데이터는 변경하지 않음.
- 별도 연결의 실제 동시 요청 스트레스 테스트 및 카카오 신규 가입 E2E는 미완료.
- 첫 원격 배포 2회는 SQL 원본 제외 때문에 테스트 실패. 운영은 기존 배포 유지.
  SQL 원본 검사는 로컬/저장소 CI에서 유지하며 Vercel 앱 빌드에서는 2개만 skip.
- 최종 운영 배포 dpl_M1q2sjqmC9fdtGJqPpdQGbjn6vfF READY.
  https://solb-portfolio.vercel.app 에 연결됨. 원격 840 passed / 3 skipped 및 빌드 통과.
- 기존 작업 트리에는 이전 배포 변경도 포함되므로 무관한 변경을 되돌리지 않는다.
- 저장 재시도 성공, 새 계정 초대 적용/첫 종목 저장/재접속 복원 검증 필요.
- 초대 필수 설정은 이번 수정에서 변경하지 않는다.

## 추가 발견 (별도 승인 후 점검 필요)

- Supabase Advisor가 public.sent_alerts, public.push_subscriptions의 RLS 비활성화를
  CRITICAL로 표시함. 현재 접근 권한/정책 및 호출 경로를 점검하기 전 홍보 보류 권고.
- 위 테이블 권한은 이번 범위에서 임의 변경하지 않았다.

## 반드시 구분할 것

- 단위 테스트/SQL 작성은 운영 적용 완료나 DB 동시성 테스트 통과를 뜻하지 않는다.
- 추천·초대 게이트의 서버 전역 접근 제어 완성 또는 법적 운영 적합성 판정이 아니다.
- Supabase 로그인 후 운영 DB 변경을 완료하기 전에는 저장 문제가 해결됐다고 보고하지 않는다.
