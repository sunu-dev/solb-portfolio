# 2026-11-16 - Supabase Disk IO 경고 조사

## 작업 요약
- 사용자 이메일 소진 경고 후 읽기 전용 조사 요청. 사용자 대시보드 로그인 후 관리 UI/CLI/공식 Metrics API 조회.
- 프로젝트 ACTIVE_HEALTHY, Free/Nano(최대0.5GB RAM), 기본 디스크 처리량5MB/s. 대시보드에도 소진 임박 경고.
- Infrastructure 최근7일 요약 Disk IO Balance69% 표시. 정확한 순간 잔여량/경고시점 잔여량으로 단정 금지.
- DB stats69MB, 캐시 적중률1.00(반올림), 통계 약24일 누적. 대시보드 Database83.5MB/전체0.37GB/8GB(집계 정의 차이), 용량 부족 증거 없음.
- 60분/24시간 Memory commitment1.51GB SEVERE. 실제 RAM 사용량과 다른 지표.
- Metrics API 단일 샘플: MemTotal426258432,MemAvailable257445888,SwapTotal1073737728,SwapFree590950400 bytes. 사용 가능RAM 약246MiB/스왑사용약45%. 현재 고갈 증거 아님.
- 60분 CPU표시11.53%,IOPS2,throughput27KB/s.24시간 CPU17.02%. 요약값이며 순간 최대/장애시간값 아님.
- 24시간 IOPS/throughput/연결/디스크 차트 Unable to load data. 경고/실패 시간과 IO 소진 직접 대조 불가.
- outliers(표시 쿼리 범위) enqueue_digest_retry33457회/45분58초83.4%,enqueue_market_watch3621회/8분38초15.7%. DB전체 IO비중 아님. 평균약82ms/143ms,누적기간 존재.
- cron 활성: digest매분,market10분,industry2시간,retention매일. pg_proc 확인 결과 digest idle guard 이미 적용(true). 무조건 매분HTTP호출한다고 해석 금지.
- traffic-profile net._http_response/market_watch_events 등 쓰기 활동 확인. 이 도구 blocks_write는 추정치로 실제 IO 원인 확정 불가.

## 결정사항
- 요금제/DB설정/cron/소스 변경 없음. 쿼리는 시스템 집계만 읽음. CLI 표준 임시 로그인 역할 사용, 자격증명 출력 안 함.
- 메모리 commitment 경고만으로 OOM/스왑 폭주 확정 금지. 작은 Nano와 지속 예약부하는 조사후보.
- 무료 Nano의 성능 여유 확대는 운영 안정화 후보이나 비용/변경 동의 전 실행 안 함.
- 경고시점 IO/IOwait/스왑 시간대 지표 확보 후 컴퓨트 상향과 쿼리최적화를 결정.

## 미해결 TODO
- [ ] 대시보드24시간IO차트 조회 실패 해소/경고시간 잔여량 확인.
- [ ] 장애시간 config 지연과 시스템디스크/데이터디스크/IOwait/스왑 변화 대조.
- [ ] 필요 시 최소 Micro 상향 비용/중단시간을 사용자와 검토. 적용 미실행.

## 다음 세션 진입점
- HANDOFF.txt, Supabase Observability/Database 및 Infrastructure.
- /private/tmp/joobi-db-{stats,cron,schedules}.json,joobi-db-{traffic,outliers,tables}.txt,joobi-supabase-metrics.txt.
- 문서 https://supabase.com/docs/guides/observability/metrics 및 https://supabase.com/kb/troubleshooting/memory-and-swap-usage-explained-aPNgm0
