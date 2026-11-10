# 2026-09-08 운영 오픈 점검 — 아직 NO-GO

## 이번 확인 및 수정
- 탭 제목을 `주비 | 내 주식 비서`로 축약.
- 동일 SVG에서 favicon.ico, 일반/마스커블 홈 아이콘 4종 생성. 재생성 스크립트 추가.
- 캐시된 아이콘 갱신을 위해 명시 아이콘 URL 버전 추가.
- 푸시 API는 토큰 확인 후 검증된 user_id로만 service client 저장/삭제하도록 수정.
- 삭제 DB 오류를 성공으로 숨기던 서버/클라이언트 경로 수정.
- 관련 5개 신규 테스트 포함 전체 854 passed / 1 skipped, TypeScript 통과.
- 운영 배포 완료: dpl_HPqSPKQhXEmLPRhS5kgDrrmYh1ix, READY.
- 원격 852 passed / 3 skipped, TypeScript 및 운영 빌드 통과.
- 운영 `/`와 `/joobi-icon.svg` 200, 짧은 탭 제목 응답 확인.
- 미인증 codes/validate, push/subscribe, admin/growth, cron/check-alerts 모두 401 확인.

## P0 — 변경 전 운영 DB에서 직접 확인 (읽기 전용 SQL)
| 테이블 | RLS | anon SELECT | anon INSERT | authenticated UPDATE |
| --- | --- | --- | --- | --- |
| push_subscriptions | false | true | true | true |
| sent_alerts | false | true | true | true |
| user_portfolios | true | true | true | true |

포트폴리오의 테이블 권한은 RLS 정책과 함께 평가해야 하므로 위 표만으로 취약하다고 판정하지 않는다.
푸시/발송 테이블은 RLS가 없으므로 직접 접근 차단 필요. 익명 HEAD 조회에 보이는 행이 없다는 것은 안전 증명이 아님.

## 승인 후 적용 결과
- 서버 수정 배포 완료 후 20260908000300_lock_notification_tables.sql 운영 적용 성공.
- 두 테이블 모두 RLS=true, anon SELECT/INSERT=false, authenticated UPDATE=false,
  service_role INSERT=true 재조회 확인. 데이터 변경/삭제 없음.
- user_portfolios SELECT/INSERT/UPDATE/DELETE 정책은 auth.uid()=user_id 확인.
- 이 정책 검사는 서로 다른 실제 로그인 계정 간 E2E 격리 시험을 대체하지 않음.
- 로그인 사용자의 실제 푸시 구독 저장·해제 및 발송 시험은 아직 미완료.

## 적용 순서 (재현용)
1. 이번 서버 API·브랜드 변경 운영 배포 및 READY 확인.
2. 20260908000300_lock_notification_tables.sql 적용. 데이터 변경·삭제 없음.
3. pg_class RLS=true, 익명/일반 사용자 권한=false, service_role 권한=true 확인.
4. 익명 REST 거절, 로그인 사용자 구독 저장/해제, cron 접근 회귀 확인.
5. 실제 알림 발송은 사용자 동의 후 테스트. 자동 발송을 테스트 목적으로 임의 실행하지 않음.

## 오픈 전 미완료
- 완료: 위 두 테이블 접근 제어 운영 적용 및 권한 재검증.
- P0: 카카오 신규 계정 → 동의 → 초대 코드 → 첫 종목 저장 → 재접속 복원 E2E.
- P0: 초대 전용 모드를 쓸 경우 API/DB까지 초대 우회 차단 확인. 화면 게이트만으로 보장하지 않음.
- P1: 푸시 endpoint 검증/요청 제한, 위조 구독 등록 및 서버 발송 경로 보안 검토.
- P1: 사용자 간 데이터 격리와 탈퇴 데이터 삭제/연결 해제 웹훅 실검증.
- P1: 백업 복원 연습, 장애 알림 수신처, 시세 장애·지연·휴장 경계 검증.
- P1: 도메인 결정 후 OAuth 리다이렉트·카카오 JS 도메인·OG/canonical 설정 확인.
- P1: 모바일 Safari/PWA 설치·아이콘 캐시 갱신 실기기 확인.

전체 출시 승인/법적 적합성 판정을 의미하지 않으며, 미완료 항목을 통과로 표시하지 않는다.

## 로그인 후 동의 화면 중복 노출 수정

- 사용자 확인: 로그인 전에 생년월일/필수 약관 동의를 완료했으나, OAuth 복귀 후 동일한 입력 화면이 잠깐 재노출됨.
- 코드 원인: useAuth 초기 getSession은 동의 저장을 기다리지 않고 사용자를 공개하고,
  auth 이벤트는 별도로 동의를 저장함. AgeEligibilityGate 조회가 저장보다 먼저 끝날 수 있음.
  초대 상태가 나중에 도착하면 게이트도 재마운트되어 다시 조회함.
- 저장 책임을 게이트로 이동해 임시 동의 저장 → 현재 버전 성인/약관/개인정보 동의 조회를 직렬화.
  저장·조회 오류는 실패 상태로 유지, 초대 입력 UI는 eligible일 때만 마운트.
- 로그인된 사용자에게 LoginModal 재노출 차단, 계정 변경 시 게이트 상태 초기화,
  늦은 초기 세션 응답이 최신 인증 이벤트를 덮어쓰는 경로 차단.
- 지연 저장·실패 후 재시도·기존 회원·누락/구버전·조회 예외 회귀 7건 포함 861 passed, 1 skipped.
- 이는 코드/모의 DB 회귀 결과임. 실제 카카오 왕복 브라우저 검증은 아직 미완료.

### 운영 배포 후 재검증
- dpl_9arbBo6MUuxi88FGGnKheLhzu1sP / production READY 및 solb-portfolio.vercel.app alias 완료.
- 운영 빌드 859 passed, 3 skipped (로컬 전용 SQL 검사 등), 타입 검사 및 빌드 성공.
- 운영 홈페이지 HTTP 200, 비인증 POST /api/codes/validate HTTP 401 확인. 코드 사용·DB 변경 없음.
- Chrome 새 배포 /?login=1: 생년월일 공란, 필수 동의 미선택, 카카오 버튼 disabled 확인.
- 브라우저가 비로그인 상태이므로 실제 OAuth 왕복 및 로그인 후 동의 조회 확인은 사용자 로그인 대기.

## 후속 발견: 초대 판정 전 메인 화면 노출
- 운영 사용자 재검증에서 기존 로그인 프로필/메인이 1~2초 표시된 후 초대 화면 전환을 보고함.
- 원인: Home의 serviceMode='open', needsInvite=false 기본값과 비동기 config/초대 조회.
  동의 저장 순서 수정과 별개 결함이며 앞선 비로그인 테스트로 검증되지 않았음.
- 기본 입장 허용 제거. 계정별 checking/allowed/required/error로 분리하고, 취소된 조회 무시.
- 인증/초대 확인 중에는 헤더/포트폴리오를 마운트하지 않음. 메인도 동의 게이트 children으로 이동.
- 설정/관리자/DB 오류는 재시도 화면, 초대 미등록은 초대 화면. 두 경우를 구분.
- 로컬 verify: 868 passed, 1 skipped. 지연 응답/계정 변경/DB 오류/설정 오류 회귀 7건 추가.
- API/DB 초대 권한 강제는 별도 미완료 항목이며 이 UI 수정만으로 보안을 보장하지 않음.
- 후속 운영 배포 dpl_6REvveUFyNt5wsiQ2VbMWnZffQjs READY, 운영 alias 적용 완료.
- 원격 빌드 866 passed, 3 skipped. 실제 로그인 세션의 새로고침 전환은 사용자 재검증 필요.
