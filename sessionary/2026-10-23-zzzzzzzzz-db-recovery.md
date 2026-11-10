# 2026-10-23 - Supabase 503 재진단과 재시작

## 작업 요약
- 종목 동기화 개선 배포는 기존 READY 상태. 운영 홈 200, config 503 재현.
- 공식 Management API의 실제 서비스 health 조회: db/auth/rest 모두 UNHEALTHY. 프로젝트 목록 ACTIVE_HEALTHY와 일치하지 않아 목록 상태는 복구 근거로 쓰지 않는다.
- metrics API 500 Failed to fetch project metrics. 오류 추적 ID: 73506fdc215246999c60b3632a8550b8.
- 기존 CLI 인증을 출력·저장하지 않고 관리 API에 사용했다. 프로젝트 restart를 한 번 호출했고 HTTP 200 접수.
- 재시작 후 2026-10-23 17:24~17:25 KST 검증: read-only select now() HTTP 400 Database is possibly not accessible at the moment; db/auth/rest UNHEALTHY; joobi.kr/api/config 503.

## 결정사항
- 재시작 접수와 복구 완료를 구분한다. 재시작 반복·유료 업그레이드·대량 작업 실행은 하지 않는다.
- DB에 접근할 수 없어 digest migration은 미적용. I/O 예산이 유일한 원인이라고 단정하지 않는다.
- Supabase 지원에 전달할 증거가 확보됐다. 외부 지원 메시지는 발송하지 않았다.

## 미해결 TODO
- [ ] Supabase 측 프로젝트 복구 확인 또는 지원 문의.
- [ ] 실제 SQL/config 회복 후 baseline과 digest migration 개별 적용 및 검증.
- [ ] 다음 정기 동기화 로그와 24시간 I/O 실측.

## 다음 세션 진입점
- 프로젝트 ytowigkzunbrhyucbsqu. 지원에는 DB/auth/rest UNHEALTHY, restart HTTP 200 후 지속, select now 실패, 위 metrics 오류 추적 ID를 전달한다.
- 임시 진단 스크립트 /private/tmp/joobi-supabase-recovery-check.py 는 읽기 전용. restart 스크립트는 재실행하지 않는다.
