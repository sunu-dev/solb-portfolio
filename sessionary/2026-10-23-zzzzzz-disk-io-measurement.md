# 2026-10-23 - Disk I/O 원인 측정 시도

## 작업 요약
- 사용자 요청에 따라 Supabase Disk I/O 원인을 실측하려 했다. 공식 상태 페이지의 API Gateway 사건은 Monitoring 상태였고, 운영 `/api/config`는 14:39 KST에 약 6.7초 뒤 503을 반환했다. Supabase Data API 루트는 인증 없는 요청에 401로 빠르게 응답했으나 DB 정상화의 증거는 아니다.
- 운영 DB 읽기 전용 `supabase inspect db traffic-profile --linked`는 로그인 역할 생성 단계에서 544/DB connection timeout으로 다시 실패했다. Supabase 대시보드 자동 접근도 시간 초과했다. 따라서 현재 시간별 I/O와 상위 SQL 실측은 수집하지 못했다.
- 코드상 매일 `sync-listings`가 과거 기록상 US 약 24,400개 이상의 종목을 조회하고 기존 종목 `last_seen`을 500건 배치로 모두 갱신한다. 이 필드는 현재 상폐 판정에 사용되지 않으며 관리자 API가 조회만 하고 화면 표시도 없다. 기능상 제거 가능한 쓰기 부하로 보이지만 이번 I/O 경고의 주원인인지는 확정하지 않는다.
- 복구 직후 측정할 시간대·SQL 스냅샷·판정 기준을 `docs/DISK_IO_MEASUREMENT_2026-10-23.md`에 기록했다. 앱 코드나 운영 예약은 변경하지 않았다.

## 결정사항
- DB가 연결되지 않는 동안 추측만으로 공급자 요금제 변경이나 정기 작업 중단을 실행하지 않는다. 특히 공급자 공통 장애와 프로젝트 I/O 병목을 분리해야 한다.
- 다음 측정에서 `stock_listings` 갱신 수·WAL 변화와 매일 00:00 UTC의 쓰기 IOPS 피크가 겹치면 대량 `last_seen` 갱신 제거를 우선 검토한다. 지속적인 I/O라면 매분 작업과 다른 쓰기 호출을 따로 조사한다.

## 미해결 TODO
- [ ] DB 복구 후 Database Report 최근 24시간과 `pg_stat_statements`/테이블·WAL 통계의 전후 스냅샷을 수집한다.
- [ ] 종목 동기화와 매분 digest retry의 기여도를 분리하고, 근거가 확보되면 불필요한 갱신을 줄인다.

## 다음 세션 진입점
- `docs/DISK_IO_MEASUREMENT_2026-10-23.md`의 복구 직후 측정 순서대로 진행한다. Free 보고서는 최근 24시간 창만 제공한다.
