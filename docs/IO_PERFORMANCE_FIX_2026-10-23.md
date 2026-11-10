# I/O 부하 개선 (2026-10-23)

## 구현

- `sync-listings`: 변동 없는 종목의 `last_seen` UPDATE 제거. 신규 등록 및 정상 수집 시장의 상장폐지 후보 감지는 유지한다. 동일한 24,400종목 fixture에서 25회 읽기, 0회 쓰기 확인. 이전의 약 49개 UPDATE 요청과 24,400행 갱신을 생략한다. 물리 I/O 감소율은 운영 실측 전이다.
- 전체 조회는 `symbol` 기본키 순서와 커서로 페이지 이동하여 OFFSET 누적 스캔을 없앤다. 이미 읽은 상태로 universe 종목을 보호하여 추가 조회를 없애고, UPDATE에도 universe/delisted 제외 조건을 넣는다.
- 실패·빈 목록·형식 오류·모든 유형 미지원인 시장은 상폐 판정에서 제외한다. 정상 시장 수집은 계속한다. DB 쓰기 실패는 500으로 반환한다. 완료 로그에 읽기/쓰기 배치 수, 변동 없는 행 수, 제외 시장, 소요 시간을 남긴다.
- `20261023000100_digest_idle_io.sql`: 매분 확인 주기는 유지하되, 전송 예정/재시도/만료/끊긴 lease/미보고 실패가 없으면 pg_net HTTP 호출을 생략한다. 빈 큐에서 HTTP 요청·응답 저장 및 worker RPC 2회를 줄인다. pg_cron 자체 실행 기록은 계속 발생한다. 실패 미보고 행 조회에는 부분 인덱스를 추가한다.
- `last_seen` 컬럼과 기존 트리거는 호환성을 위해 보존한다. 이제 정상 전체 수집의 시각을 대표하지 않으며, 현재 제품의 판정·표시에는 사용되지 않는다. 수집 여부는 완료 로그로 확인한다.

## 검증

- `npm test`: 153파일 통과, 2파일 skip; **1,723 tests passed / 2 skipped**.
- `syncListings.test.ts` 8개: 24,400종목 무변동·신규 등록·상폐·universe 보호·시장별 수집 실패·전체 실패·DB 쓰기 실패.
- 임시 PGlite PostgreSQL에 기존 digest 스키마/worker SQL과 새 migration을 적용. **1,152 상태 조합**에서 scheduler 판단과 실제 claim/만료 처리/실패 보고의 작업 필요 여부 일치. 빈 큐 HTTP 0회, migration 재적용 성공. HTTP 함수는 로컬 기록용 stub이며 외부 발송 없음.
- 재현: 임시 디렉터리에 `@electric-sql/pglite` 설치 후 `node scripts/verify-digest-idle-io.mjs /path/to/node_modules/@electric-sql/pglite/dist/index.js`.
- 변경 파일 ESLint 통과. 앱 타입 검사 통과(`/private/tmp/joobi-io-tsconfig.json`, artifacts 제외). 기본 tsc는 기존 `artifacts/app-ui-system-20261016/original-only-before/.../MarketWatch.tsx`의 누락된 publication 타입 오류로 실패. 그 백업 파일은 수정하지 않았다.

## 운영 적용 및 후속 검증

종목 동기화 앱 개선은 **운영 반영 완료**했다. 배포 `dpl_AP8SCnv4gnJpgtPgTbabEatyQukc` READY, https://joobi.kr. 이전 운영 `dpl_6f7UiyPGErz58NE2AaQpTyWcskd3`의 격리본을 복제한 `/private/tmp/joobi-io-release-20261023`에 route와 해당 테스트만 추가했다. 소스 디렉터리 비교로 두 파일만 다른 것을 확인했다.

격리본 사전 검사·테스트 1713 passed/1 skipped. Vercel 운영 빌드에서 1710 passed/4 skipped, TypeScript·Next 빌드 통과. 로컬 Next 빌드는 샌드박스에서 진행이 멈춰 중단했으며 실제 배포 검증은 성공한 Vercel 빌드 결과를 근거로 한다. 최초 배포 시 custom meta 옵션은 API에서 거절되어 제거 후 정상 배포했다. 운영 확인: 홈 200, 인증 없는 sync-listings 401, 기존 장애인 `/api/config` 503(약 8.3초). 인증된 수집 작업을 수동 실행하거나 실수신자에게 테스트 알림을 보내지 않았다.

**알림 SQL migration도 운영 적용 완료**했다. 23시경 기존 함수의 본문이 검토한 원본과 일치하는지 확인하고, `20261023000100_digest_idle_io.sql` 한 개와 해당 migration 이력을 트랜잭션으로 적용했다. lock_timeout 3초·statement_timeout 15초를 사용했고 HTTP201 성공. 다른 미적용 migration은 실행하지 않았다.

운영 사후 검증:
- 함수 idle guard 존재, security invoker 및 postgres 전용 실행 권한 유지.
- 부분 인덱스 valid/ready, migration 이력 version `20261023000100` 확인.
- 매분 cron active 유지, 적용 후 최근 5회 모두 succeeded. pg_cron·pg_net 작업자 정상, HTTP 대기 큐 0.
- 일반 read-only 역할에는 함수 실행이 거절되는 것을 확인. 관리자 역할의 명시적 READ ONLY 트랜잭션에서는 빈 대기열에 `skipped_idle_http=true` 반환. 발송·쓰기는 하지 않았다.
- pg_net 전체 삽입 통계는 다른 예약 호출도 포함하므로 digest 개선 효과의 단독 실측으로 쓰지 않는다.

복구 후 I/O baseline을 확보했다. WAL 통계 reset은 2026-10-23 08:38 UTC여서 장애 이전 전체 일자와 직접 비교할 수 없다. 종목 동기화 정기 실행은 아직 도래하지 않았고 24시간 I/O 개선율은 미확정이다. 관측 구간에서는 market_watch_events 갱신이 가장 많았으나 이것만으로 장애 원인이라고 판단하지 않는다.

## 운영 재개 검증 (10월23일23:16 KST 당시 관측)

- 기존 공개 흐름 검사 47/47 통과: 8종목의 일간·연간 차트, 검색, 기업 설명, 브리핑 상태, 뉴스, 경제 일정 응답, 시세, 페이지, 비인증 권한 경계. HTTP200은 각 외부 자료의 최신성 보장과 별개다.
- 별도 Chrome 세션에서 데스크톱·390px 모바일 로그인 창, 미동의 버튼 비활성화, 게스트 복귀 확인. 모바일 가로 넘침·pageerror·관측된 API5xx 없음. 시장 소식 API200, 86이벤트.
- 설정 API200, service_mode=beta, invite_required=true. 기존 초대형 베타 운영을 재개할 수 있는 상태. 실제 카카오 OAuth 완료·기존 계정의 저장 기록 조회는 사용자 확인 대기.
- 최종 자료 품질 검사: 산업 기사26개 선택/42개 제공, 시장 뉴스2/2 정상. 시장 시세19/20(원·달러 비교 미확인), KRX 공시0/1, 경제 자료 전체 확인0/1. 해당 API는 이전 기록 사용 경고를 반환한다. 최신 수집 시각은 산업23:05·시장23:10 KST. 전체 데이터 정상 또는 정식 공개 준비 완료로 표현하지 않는다.

증거: `artifacts/io-readiness-20261023/`의 baseline·SQL 사후 검증·공개 검증47건·최종 공개 상태·로그인 화면.

후속:
- 실제 카카오 로그인·저장 기록 정상 여부 확인.
- 환율·KRX·BLS 수집 복구는10월24일00:40 운영 검증 완료. `docs/MARKET_SOURCE_RECOVERY_2026-10-24.md` 참고.
- 다음 정기 종목 동기화의 writeBatches/unchangedCount, 신규/상폐 감지 확인.
- 다음 24시간 IOPS/WAL/latency와 재시도 정상 동작 확인.

## 10월24일00:40 후속 상태

원천 수집 누락3건도 운영 복구 완료. 현재 앱 배포는 `dpl_Gx9iGyhrmNgg7M97uQc5nBpdJG9N`이며 앞선 I/O 앱 개선과 SQL을 포함한다. 실제 디스크 지표 API도 HTTP200으로 회복됐다. 24시간 로컬 관측이10월24일00:40부터25일00:40까지 진행 중이며, 첫 표본은 정상이다. 실제 OAuth 사용자 확인·다음 일일 동기화·24시간 결과 판정은 남아 있다.
