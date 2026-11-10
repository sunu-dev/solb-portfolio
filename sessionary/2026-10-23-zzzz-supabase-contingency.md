# 2026-10-23 - Supabase 대체 경로 검토

## 작업 요약
- 운영 DB의 Disk IO Balance 13% 및 별도의 Supabase API Gateway 장애를 계기로 대체 공급자 가능성을 검토했다. 장애·I/O 원인 분리는 `2026-10-23-zzz-disk-io-diagnosis.md`에 기록했다.
- 현재 앱은 Supabase SDK를 참조하는 비테스트 파일 약 80개, `.from()` 대상 테이블 약 30개, 사용 RPC 8개, Kakao/Google Auth, 사용자별 RLS, `pg_cron`/`pg_net` 예약에 의존한다. 브라우저에서도 Supabase에 직접 접근한다. 따라서 일반 Postgres로 DB만 복사하는 것은 완전한 이전이 아니다.
- 공식 문서 기준 후보: (1) 현 공급자의 쿼리/예약 부하 최적화 및 백업, 필요 시 compute 증설, (2) Neon Postgres + 독립 Auth(예: Clerk) + 예약 작업 재구성, (3) Supabase 자체 호스팅. Neon은 Postgres 데이터 이전 경로가 있으나 Supabase Auth·PostgREST·RLS 연동·RPC·외부 호출 cron을 별도 검증해야 한다. Kakao는 OIDC를 제공하고 Clerk는 커스텀 OIDC 공급자를 지원하지만 실제 계정 연결/기존 사용자 ID 보존은 PoC가 필요하다. 자체 호스팅은 API 형태를 더 유지할 수 있지만 백업·모니터링·업데이트·고가용성을 직접 운영해야 한다.

## 결정사항
- 단일 경고와 공급자 장애만으로 즉시 운영 이전하지 않는다. 현재 운영 DB가 읽기 전용 `select now()`도 연결 시간 초과라 신뢰할 수 있는 덤프·데이터 검증이 불가능하다. 비효율적 쿼리가 원인이면 공급자 변경 후에도 재발할 수 있다.
- 우선 장애 회복 후 I/O 원인 및 백업 가능 여부를 확인한다. 이후 같은 문제가 반복되거나 실측 부하가 현 compute의 지속 한계를 넘으면 별도 환경에서 Neon+독립 Auth를 단계별 PoC로 검증한다. 실시간 이중 쓰기/즉시 장애 전환을 약속하지 않는다.

## 미해결 TODO
- [ ] DB 연결 회복 후 시간별 Disk I/O·상위 SQL·예약 작업, 데이터 백업/복원 가능성을 확인한다.
- [ ] 이전을 결정하게 되면 Kakao/Google 계정 매핑, 사용자 ID와 동의 이력, RLS 동등성, 포트폴리오 동시 수정 RPC, 예약 작업을 격리 환경에서 검증한다.

## 다음 세션 진입점
- 먼저 `sessionary/TODO.md` 최상단 Disk I/O 복구 과제를 수행한다. Supabase 공통 장애 종료 후에도 DB 접속과 `/api/config`가 회복되지 않으면 프로젝트 자체 병목을 우선 조사한다.
