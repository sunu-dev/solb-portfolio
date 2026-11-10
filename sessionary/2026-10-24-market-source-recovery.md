# 2026-10-24 - 시장 원천 수집 복구와24시간 관측 시작

## 작업 요약
- 사용자가 남은 항목 진행을 요청해 환율·KRX·BLS 실패를 진단하고 운영에 수정했다.
- Yahoo 일봉의 null 직전 봉을 확인해 명시적인 intraday previousClose만 보조 조회하도록 수정했다. BLS 구독 ICS의 대상 월 누락을 확인해 공식 CPI/고용 release table로 전환했다.
- KRX는 운영403을 공개 웹 요청/세션 처리로 회복했다. 자정 이후에는 정상 빈 RSS가 lastBuildDate를 생략해 신선도 검사에 걸리는 것을 실제189문자 원문으로 확인했다. fresh HTTP Date·Age·공식 빈 RSS 형태를 함께 검증하도록 수정했다.
- 중간 Yahoo429는 원천별 요청 설정을 분리하고 Retry-After를 존중하도록 보강했다. 기사 제목이나 지수만으로 시장조치를 추정하지 않는다.
- 기존 운영 격리본에8파일 선별 배포. 최종 `dpl_Gx9iGyhrmNgg7M97uQc5nBpdJG9N` READY. 원격1739tests+4skip·TypeScript·Next빌드 통과. 관련61tests·실제 원문2사례 검증·별도 로컬tsc·ESLint 통과.
- 새 테스트의 HeadersInit 타입 오류를 확인하기 전에 원격 빌드를 시작한 순서 오류가 있었다. fixture 수정 후 별도tsc를 통과시켰고 최종 원격 TypeScript 성공도 확인했다.
- 00:40 정기 수집 후00:41 공개 조회: quotes20/20, KRX1/1, economics1/1, market-news2/2, 경고 없음. 산업42/42는23:05 관측이며 아직 다음2시간 예약 전이다.
-24시간 관측 도구를 만들고45초 시험(health4/I/O2, 실패·누락0, 자동종료)을 검증했다. 실제 screen 작업도 시작했고 첫표본이 정상이다.

## 10월24일07:17 정리 시점의 중간 관측
- 관측기는 screen에서 계속 실행 중이다. 마지막 API 표본은07:15 KST.
- API80회·I/O7회, 기록된 실패0. 표본 사이 최대 간격300.003초로 현재까지 큰 누락은 없다.
- 약6시간35분의 중간 결과이며24시간 완료가 아니다. 종료 summary는 아직 없다.
- 실제 로그인/저장 기록 확인, 오늘09시 정기 동기화, 10월25일00:40 이후 최종 결과 검토가 남아 있다.
- 근거: artifacts/io-monitor-20261024/window/progress-20261024-0717.json.

## 결정사항
- 업무 데이터 발행/알림을 실행하지 않는 보호된 원천 진단 경로를 유지한다. 공통 요청 로그는 남는다.
-24시간 관측은 외부 알림이나 운영 변경 없이, 이 컴퓨터에서5분 API/매시간 DB·물리디스크 통계를 읽는다. sleep/종료 시 누락될 수 있으며 표본 검증을 연속 가동시간 보장으로 표현하지 않는다.
- 물리 disk counters는 장치별로 구분하며 WAL과 동일시하지 않는다. host boot 지표가 없으면 DB postmaster 시작 시각을 연속성 근거로 쓰고 감소/재시작된 통계를 비교하지 않는다.
- 본인 카카오 인증과 저장 기록 조회는 사용자 확인이 필요하다. 다른 방식의 QA로 실제 OAuth를 대체하지 않는다.

## 미해결 TODO
- [ ] 사용자 실제 카카오 로그인·저장 종목/기록 정상 확인.
- [ ] 오늘09:00 sync-listings의 writeBatches/unchangedCount와 신규·상폐 보호 확인.
- [ ] 10월25일00:40 이후24시간 summary·누락·실패·재시작·디스크/WAL 증감 검토. 다른 필요한 갱신(enrich-listings 등)과 구분.

## 다음 세션 진입점
- docs/MARKET_SOURCE_RECOVERY_2026-10-24.md, artifacts/market-source-recovery-20261024/ 참조.
- 운영 격리본 /private/tmp/joobi-source-recovery-20261023. 루트 전체 배포 금지.
- screen 세션 joobi-io-24h-20261024, screen PID77158·Node PID77164(시작 당시 값). 시작10월24일00:40:16 KST → 종료예정10월25일00:40:16 KST.
- artifacts/io-monitor-20261024/window/run.json, observations.jsonl, io-*.json. 종료 후 summary.json. 파일이 없거나 sampling_complete=false면24시간 완료로 판단하지 않는다.

## 메모리 승급 검토
- 후보: BLS 대상 월은 공식 release table로 확인하고, KRX의 정상 빈 RSS는 fresh HTTP 응답과 함께 검증한다는 수집 원칙.
- 현재 정본은 위 운영 문서이며 영구 메모리에는 아직 반영하지 않았다. 사용자 동의 후 reference/project 분류로 승급할 수 있다. 관측 기간·PID 같은 일시적인 정보는 승급 대상이 아니다.
