# Supabase Disk I/O 원인 측정 — 2026-10-23

## 10월23일 장애 중 관측

- 2026-10-23 14:39 KST에 운영 `https://joobi.kr/api/config`는 약 6.7초 후 HTTP 503을 반환했다. 인증 없는 Supabase Data API 루트 요청은 HTTP 401로 즉시 응답했지만, 이는 게이트웨이 인증 응답일 뿐 DB 연결 정상화의 증거가 아니다.
- 연결된 운영 DB에 대한 읽기 전용 `supabase inspect db traffic-profile --linked`는 로그인 역할 생성 단계에서 HTTP 544와 `Connection terminated due to connection timeout`으로 실패했다. 대시보드 자동 접근도 시간 초과했다. [Supabase 상태](https://status.supabase.com/)는 API Gateway 사건을 Monitoring으로 표시했다.
- 이전 대시보드 관측: Free Nano, Disk IO Balance 13%, DB 55.2 MB, WAL 96 MB, 메모리 41%. WAL의 **현재 점유 크기**만으로 어떤 작업이 얼마의 WAL을 발생시켰는지는 알 수 없다.

## 수정 전 코드상 후보(제거·운영 반영 완료)

`/api/cron/sync-listings`는 매일 09:00 KST 실행되며 전체 종목 목록을 읽은 뒤, 기존 종목에 대해 500건씩 나눠 `last_seen`을 `UPDATE`한다. 과거 기록의 US 종목 약 24,400건을 기준으로만 계산해도 약 25회의 페이지 조회와 약 49회의 배치 갱신이다. 현재 실제 건수는 DB 장애로 확인하지 못했다. 각 갱신은 실제 행 버전과 WAL을 만든다. `stock_listings`에는 모든 `UPDATE`에서 `last_seen`을 다시 쓰는 행 단위 트리거도 있다.

현재 상장폐지 후보 판정은 그날 Finnhub 목록과 DB의 `symbol` 집합 차이를 직접 비교한다. `last_seen`은 이 판정에 쓰이지 않으며, 관리자 API가 필드를 조회하나 화면에서 표시하지 않는다. 따라서 이 **대량 갱신은 기능상 불필요해 보인다**. 매분 digest retry와 10분/2시간 시장 관찰 작업도 다른 후보지만, 기여도는 아직 측정되지 않았다.

## 복구 직후 측정 순서 (읽기 전용)

1. Supabase Database Report의 최근 24시간 **Disk IOPS(read/write), throughput, CPU, memory**를 2026-10-22 19:00 UTC 경고 전후와 매일 00:00 UTC 종목 동기화 전후로 비교한다. Free 플랜은 보고서 기간이 최근 24시간이라 과거 창이 사라지기 전에 기록한다. 공급자 공통 장애 기간의 5xx 추이도 별도로 표시한다.
2. 아래 통계 스냅샷을 DB 연결 복구 직후와 다음 동기화 직전·직후에 각각 저장한다. 누적 통계이므로 한 시점의 수치만으로 해당 날짜의 I/O를 단정하지 않는다. 리셋 시각이 바뀌면 두 스냅샷의 차이를 사용하지 않는다. **통계 리셋 함수는 실행하지 않는다.**
3. Supabase CLI로 `traffic-profile`, `calls`, `outliers`, `table-stats`, `vacuum-stats`, `bloat`를 조회한다. `stock_listings`와 digest/market-watch 관련 SQL의 호출 수·갱신 수·WAL·읽기/더티 블록을 비교한다. `wal_bytes`와 더티 블록은 물리 디스크 I/O와 동일한 값이 아니므로 Database Report의 IOPS와 함께 판단한다.
4. `stock_listings` 갱신 수가 동기화 한 번에 약 2.4만 증가하고 같은 시간대 쓰기 IOPS·WAL이 급증하면 해당 작업이 기여한 것으로 판단한다. 반대로 24시간 내내 지속적인 쓰기라면 매분 작업과 autovacuum, 다른 호출을 우선 조사한다.

### SQL Editor용 가벼운 스냅샷

각 블록을 따로 실행해 시각과 결과를 저장한다. 사용자 데이터 행이나 비밀값을 읽지 않는다.

```sql
select clock_timestamp() as captured_at, datname, stats_reset,
       blks_read, blks_hit, tup_inserted, tup_updated, tup_deleted, temp_bytes
from pg_stat_database
where datname = current_database();
```

```sql
select clock_timestamp() as captured_at, schemaname, relname,
       n_tup_ins, n_tup_upd, n_tup_hot_upd, n_tup_del, n_dead_tup,
       autovacuum_count, last_autovacuum, seq_scan, idx_scan
from pg_stat_user_tables
where schemaname = 'public'
order by n_tup_upd desc
limit 20;
```

```sql
select clock_timestamp() as captured_at, stats_reset, wal_records, wal_fpi, wal_bytes
from pg_stat_wal;
```

```sql
select clock_timestamp() as captured_at, queryid, calls, rows,
       round(total_exec_time::numeric) as total_exec_ms,
       shared_blks_read, shared_blks_dirtied, wal_bytes
from pg_stat_statements
where query ilike '%stock_listings%'
order by wal_bytes desc
limit 20;
```

SQL Editor에서 `pg_stat_statements`가 다른 스키마에 설치됐거나 일부 컬럼이 없는 버전이면 해당 블록만 Supabase Query Performance 보고서로 대체한다. 원문 SQL과 사용자 정보는 진단 보고서에 복사하지 않는다.

공식 근거: [Supabase Reports](https://supabase.com/docs/guides/observability/reports), [DB 검사와 누적 통계 주의](https://supabase.com/docs/guides/observability/inspect), [PostgreSQL 통계](https://www.postgresql.org/docs/current/monitoring-stats.html), [pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html).

## 복구 후 측정 실행(10월24일)

`capture-io-snapshot.mjs`는 기존 Supabase CLI 로그인이나 SUPABASE_ACCESS_TOKEN을 메모리에서만 사용한다. SQL은 read_only=true로 통계를 읽고, 서비스 health와 public config·실제 호스트 디스크 counters를 저장한다. 사용자 행·SQL 원문·키를 저장하지 않는다. 새 출력 파일만 생성하므로 기존 증거를 덮지 않는다.

```sh
node scripts/capture-io-snapshot.mjs --output artifacts/io-monitor-20261024/followup.json --baseline artifacts/io-monitor-20261024/host-baseline.json
```

현재 `screen -ls`의 `joobi-io-24h-20261024`에서24시간 관측이 진행 중이다. 종료 예정은10월25일00:40 KST. `artifacts/io-monitor-20261024/window/summary.json`은 종료 후 생성된다. 관측 간격·누락·컴퓨터 sleep 제한과 판정 기준은 `docs/MARKET_SOURCE_RECOVERY_2026-10-24.md` 참고. 단발 두 표본으로 그 사이 전체 가동시간이나 특정 SQL의 물리 I/O 기여도를 단정하지 않는다.
