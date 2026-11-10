# 2026-10-23 - Supabase Disk I/O 경고 후속 진단

## 작업 요약
- Gmail에서 Supabase의 `solb-portfolio` Disk IO Budget 경고 원문을 읽었다. 발송 시각은 2026-10-22 19:00 UTC(한국 10월23일04:00). 이 경고는 직전 `/api/config` 522/504 확인보다 약 8시간 먼저 왔다. 메일은 예산 소진 시 요청 지연, I/O wait에 따른 CPU 증가, 인스턴스 무응답 가능성을 설명한다.
- Supabase 공식 문서에 따르면 작은 compute는 일일 I/O burst budget을 사용하고, 소진되면 baseline으로 제한된다. 원인 후보는 메모리 swap, 낮은 캐시 적중률, 느린 쿼리, 높은 요청량이다. 이메일만으로 실제 소진률이나 쿼리 원인을 확정할 수 없다.
- Supabase CLI의 프로젝트 목록에서는 운영 프로젝트 `ACTIVE_HEALTHY`(ap-northeast-2)였지만, `supabase inspect db db-stats --linked`는 로그인 역할 생성 중 544/DB connection timeout으로 실패했다. control-plane 상태와 실제 DB 연결 가능 상태가 다르다.
- Vercel 최근 30분 운영 요청은 134건 중 504가 16건이었다. 이 구간의 웹 요청 급증은 확인되지 않았다. `digest-retry`는 매분 예약됐으나 같은 구간 1건만 도착해 504로 끝났다. 장애 전 트래픽 패턴과 예약 이력은 Vercel Hobby 로그 보존 기간 밖이라 확인하지 못했다.
- 코드상 I/O 후보: 매일 `sync-listings`가 전체 `stock_listings`를 페이지 조회하고 기존 활성 종목 전체의 `last_seen`을 500건씩 갱신한다(기록상 US 약 24,400건). `market-watch`는 10분마다 관찰 이벤트를 upsert, 산업 관찰은 2시간마다 저장한다. `digest-retry`는 매분 DB RPC 2건과 pg_net 호출을 수행한다. 실제 기여도는 시간대별 Disk I/O·메모리·캐시 적중률·상위 SQL 지표로 판별해야 한다.
- 사용자가 Supabase 대시보드에 로그인해 Infrastructure를 확인했다. 서울 `t4g.nano` 프로젝트의 Disk IO Balance는 13%, 메모리 41%, 디스크 사용량 4%(DB 55.2 MB, WAL 96 MB, 시스템 168.1 MB)였다. 따라서 저장 공간 부족보다는 I/O 예산 소진 가능성이 높다. 화면의 CPU 수치는 요약 카드와 그래프가 서로 다르게 표시돼 시점·정의를 확인하기 전까지 근거로 사용하지 않는다.
- Supabase 대시보드 상단 공지의 공식 상태 페이지는 `API Gateway Request Issues`를 Monitoring으로 표시했다. 최초 조사 시각은 10월23일 02:01 KST(브라우저 표시), 서울 리전을 포함한 Data APIs에 영향이 있었다. 공지는 API gateway/backplane 수요 급증을 원인으로 설명한다. 프로젝트 고유 Disk I/O 경고보다 먼저 시작한 공급자 장애이며, 504의 일부 요인일 수 있지만 프로젝트 I/O 경고 자체를 대체 설명하지는 않는다.
- 대시보드 Database Observability의 IOPS·throughput·연결 수는 `Unable to load data`, Query Performance는 결과를 가져오지 못했다. SQL Editor에서 가벼운 `select now()`도 `Connection terminated due to connection timeout`으로 실패했다. 같은 시점(2026-10-23 04:48 UTC) 운영 `/api/config`는 HTTP 503으로 응답했다. 따라서 상위 SQL·시간별 부하와 장애 기여도를 아직 확정할 수 없다. 운영 코드나 예약은 원인 미확정 상태에서 변경하지 않았다.

## 결정사항
- Disk I/O 예산 소진과 Supabase 공통 API Gateway 장애가 동시에 존재한다. DB 직접 연결도 실패하므로 공급자 공통 장애만으로 서비스 장애를 단정하지 않는다. 두 원인의 기여도를 분리하려면 프로젝트의 시간별 I/O·쿼리 지표와 공급자 장애 종료 후의 복구 여부가 필요하다.
- 유료 compute 상향, 프로젝트 재시작, 정기 작업 중단은 비용·서비스 영향이 있어 원인 확인 없이 실행하지 않는다.

## 미해결 TODO
- [ ] Supabase 관측/DB 연결이 회복되면 Infrastructure의 일별/최저 Disk IO balance와 Database report 시간별 추이, 메모리·swap·cache hit·상위 쿼리/호출 수를 2026-10-22 00:00~2026-10-23 04:30 UTC에 대조한다.
- [ ] DB가 다시 연결되면 `supabase inspect db db-stats/outliers/calls/table-stats/bloat` 읽기 전용 점검 후 가장 큰 I/O 원인을 고친다.
- [ ] `/api/config`가 정상 200으로 회복되는지 확인하고 실제 로그인·예약 작업의 지연/실패를 재검수한다.

## 다음 세션 진입점
- 운영 API는 장애 시 약 9초 후 503을 반환하도록 이미 배포됨(`dpl_6f7UiyPGErz58NE2AaQpTyWcskd3`). 이번 세션에는 추가 배포가 없다.
- Supabase 인프라 링크는 `https://supabase.com/dashboard/project/ytowigkzunbrhyucbsqu/settings/infrastructure#disk_io`, Database Observability는 `https://supabase.com/dashboard/project/ytowigkzunbrhyucbsqu/observability/database`, 공식 공지는 `https://status.supabase.com/incidents/01M5J8ZQ04EZXAYF10Q75MGC1T`. DB 연결과 관측 데이터가 돌아오면 19:00 UTC 경고 전후 변화와 cron 시각을 맞춘다.
