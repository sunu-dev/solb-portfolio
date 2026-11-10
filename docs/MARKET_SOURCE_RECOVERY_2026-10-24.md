# 시장 원천 수집 복구 및 24시간 관측 — 2026-10-24

## 결과

운영 https://joobi.kr, 배포 `dpl_Gx9iGyhrmNgg7M97uQc5nBpdJG9N` READY.
기준 배포 `dpl_AP8SCnv4gnJpgtPgTbabEatyQukc`의 격리본에 앱·테스트 8파일만 선별 반영했다. 격리본은 `/private/tmp/joobi-source-recovery-20261023`이다. 루트의 다른 작업은 배포하지 않았다.

10월24일 00:40 KST 정기 수집 결과를 00:41 공개 API에서 캐시와 구분해 확인했다.

| 원천 | 확인 결과 |
|---|---|
| 시세·환율 | 20/20 정상, 환율 전일 비교 포함 |
| KRX RSS | 1/1 정상, 자정 이후 유효한 빈 목록 처리 |
| 경제 자료 | 1/1 정상, BLS 포함 경고 없음 |
| 시장 뉴스 | 2/2 정상 |
| 산업 검색 | 42/42 정상, 26건 선택(23:05 확인, 다음 2시간 수집 전) |

`/api/config`, `/api/economic-events`, `/api/market-watch` HTTP200. 경제 일정97개·시장 이벤트89개를 반환했고 두 피드의 경고는 비어 있었다. 설정은 beta·초대 코드 필요 상태다.

## 원인과 수정

### 환율
- Yahoo의 3개월 일봉 응답에서 직전 봉이 null인 실제 사례를 확인했다. 이전의 더 오래된 가격으로 건너뛰거나 조회 시작 종가로 대체하지 않는다.
- 환율 비교가 불가능할 때만 같은 종목의 당일 5분봉 metadata.previousClose를 보조 조회한다. 종목 일치·수치·시각 검증을 유지한다. 일봉 과거 자료는 변동 범위 계산에 사용한다.
- Yahoo에는 기존 요청 설정을 유지하고 KRX·BLS의 웹 문서용 설정을 분리했다. 429는 Retry-After를 존중하며 긴 대기는 다음 정기 수집으로 넘긴다. 반복 즉시 재시도로 제한을 악화시키지 않는다.

### BLS
- 공식 구독 ICS는 `Employment Situation`처럼 발표 대상 월이 빠진 제목을 제공한다. 기존 parser가 월을 요구해 일정을 버렸다. 일부 환경에서는403도 확인됐다.
- 대상 월·발표일·시간이 명시된 BLS 공식 CPI/고용 release table을 사용한다. 미국 동부시간과 서머타임, 연도 경계, 잘못된 날짜를 검증한다. 표가 없거나 요청이 실패하면 실패 상태를 유지한다.
- 실제 공식 문서에서 CPI14개·고용14개를 파싱했고, 운영에서도28개를 확인했다. cache key v2로 이전 수집 방식의 캐시와 구분한다.
- 근거: https://www.bls.gov/schedule/news_release/cpi.htm , https://www.bls.gov/schedule/news_release/empsit.htm . 구독 안내: https://www.bls.gov/help/hlpiCAL.htm .

### KRX
- 초기 운영 요청의403은 공개 웹 문서 요청 설정과 공식 공개 세션 처리로 회복했다. 세션 쿠키는 같은 KRX 호스트에만 사용하고 저장·출력하지 않는다.
- 이후 자정에 남은 실패는403이 아닌 `Stale exchange feed`였다. 실제 KIND RSS는 공시가 없으면189문자의 유효한 빈 RSS를 반환하며 lastBuildDate를 생략한다.
- 비어 있는 공식 RSS 형태, fresh HTTP Date(수집 시각 ±60초), Age 없음/0, 정상 RSS 문법을 함께 확인할 때만 빈 조회를 성공 처리한다. 항목이 있거나 buildDate가 있으면 기존30분 신선도 검사를 유지한다. 오래된·미확인 빈 피드는 거절한다.
- 빈 RSS로 시장조치의 부재·해제를 추정하지 않는다. 기존 날짜별 발동·해제 원문 검증을 유지한다.

## 검증

- 관련61 tests 통과, 실제 저장 원문2사례 검증(BLS 표·환율의 null 봉·KRX 자정 빈 RSS) 통과.
- 격리본 전체 사전 테스트1730 passed/1 skipped. 후속 변경 포함 최종 운영 원격 빌드1739 passed/4 skipped, Next 컴파일·TypeScript 통과. 수정본의 별도 로컬 tsc와 변경 파일 ESLint도 통과.
- 보호된 `/api/cron/market-watch?diagnose=1`은 고정된3원천만 검사한다. 실제 업무 데이터 발행·알림 발송을 실행하지 않는다(기존 공통 요청 로그는 유지). 무인증401, 잘못된/누락된 secret 차단, 일반 예약 경로 유지 테스트 포함.
- 최종 진단: KRX 정상 빈 목록, BLS28, FX 정상. 이어 실제00:40 정기 수집·공개 조회에서도 모두 정상 확인.
- 중간에 새 테스트 자료의 HeadersInit 타입 오류가 확인됐다. 배포 시작 전 실패 결과를 확인하지 못한 순서 오류가 있어 fixture를 수정하고 별도 tsc를 재검사했다. 최종 운영 원격 TypeScript 성공까지 확인했다.
- 공개 자료의 당시 수집 범위 내 검증이다. 전 세계 모든 정보, 실제 계정 OAuth 완료, 장기 안정성의 증거로 확대하지 않는다.

증거는 `artifacts/market-source-recovery-20261024/`에 있다. 원천 전체 기사 본문·인증값·사용자 데이터는 보관하지 않았다.

## 24시간 관측

- 실행: `scripts/watch-io-window.mjs` → `scripts/capture-io-snapshot.mjs`.
- screen 세션 `joobi-io-24h-20261024`, 시작 **10월24일00:40:16 KST**, 예정 종료 **10월25일00:40:16 KST**.
- 매5분 운영 config 응답과 지연, 매시간 SQL/WAL·테이블 통계·Supabase 실제 디스크별 counters·서비스 health를 읽는다. 진단기 자체는 운영 수정·외부 메시지 발송을 하지 않는다.
- 45초 시험에서 health4회, I/O2회, 누락/실패0 및 자동 종료 확인. `full_day_elapsed=false`로 짧은 시험을24시간 완료로 세지 않는다.
- 실제24시간 작업도 첫 health200·I/O 정상 저장을 확인했다. 결과 경로 `artifacts/io-monitor-20261024/window/`: run.json, observations.jsonl, io-*.json. 종료 시 summary.json 생성.
- 물리 디스크별 counter를 합산하지 않는다. 호스트 boot 지표가 없으면 PostgreSQL 시작 시각 연속성을 기준으로 삼으며, 통계 재시작·개별 counter 감소는 비교에서 제외한다. WAL과 물리 I/O는 다른 지표다.
- 이 컴퓨터가 잠들거나 꺼지면 관측이 누락될 수 있다. 중단/긴 공백이 있으면 sampling_complete가 거짓이거나 summary 자체가 없으므로 완료로 판단하지 않는다. 5분 간격 표본은 연속적인 가동시간 보장이 아니다.
- 기존23:36 SQL 기준과 00:14 호스트 기준도 보존했다. 장애 이전 원인과24시간 개선율은 아직 확정하지 않았다.

## 다음 확인

1. 실제 카카오 로그인 완료·저장 종목/기록 조회는 사용자 확인 대기. Chrome 진입/게스트 검사와 구분한다.
2. 오늘09:00 정기 sync-listings의 writeBatches/unchangedCount와 신규·상폐 보호 확인. 10:00 enrich-listings의 필요한 갱신은 별도로 구분한다.
3. 10월25일00:40 이후 screen 종료·summary·마지막 스냅샷의24시간 경과/누락/재시작 여부와 디스크·WAL 증감을 확인한다.

## 10월24일07:17 중간 결과

마지막 API 관측07:15 KST까지 API80회·I/O7회, 기록된 실패0. 표본 사이 최대 간격300.003초로 큰 공백 없음. screen 수집기는 실행 중이고 종료 summary는 아직 없다. 약6시간35분의 표본 결과이며24시간 완료·연속 무중단을 뜻하지 않는다. 진행 증거: `artifacts/io-monitor-20261024/window/progress-20261024-0717.json`.
