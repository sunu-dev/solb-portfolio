# 2026-11-13 - Codex 인수, DB 지연 측정, 채팅 소수정과 Claude 코드 검토

## 작업 요약
- 사용자 요청 순서: 원격 확인 → Supabase 측정 → 종목명·양자택일 답 수정. push 금지, 운영 변경 전 확인, 인증 우회·운영 테스트 계정 생성 금지.
- 시작 시 로컬 main bf55401/clean. 읽는 동안 Claude가 문서 커밋 dcc031c를 만들었고 사용자가 “이번턴은 너야”로 인수 확인. 기존 변경을 보존했다.
- `git ls-remote --heads origin` 실제 결과: main bf554011a989798a057a4ac31fb33716d0389188 하나. release/chat-natural-20261112·backup/main-20261112 없음. 사용자에게 즉시 보고. push 실행 안 함.
- Claude 최신 문서에는 main 전체 운영 dpl_2RZZR7K2AgoLcn482PnMyeuhiKLf 유지 결정이 기록됨. 이 세션에서 Vercel 배포 ID/운영 전체 기능을 독립 검증하지 않았다. 이번 사용자의 선별 배포·승인 조건을 우선한다.
- 로컬 브랜치 fix/chat-followup-20261113, 제품 코드 e921efa. main은 dcc031c 그대로.

## Supabase 측정
- 재현 스크립트: scripts/measure-supabase-read-latency.mjs. 공개 anon 키로 Auth health·user_portfolios/user_consents 제한 조회, joobi.kr/api/config 캐시 MISS 조회. 응답 본문·키를 출력/저장하지 않음.
- 단독/4개 병렬 순서를 번갈아 각 4라운드, 2세트 총64건. 이는 부하 시험이나 실제 인증 계정 조회가 아님.
- 첫 세트 01:15:11~01:15:14 UTC: 32건 전부200. 익명 portfolio/consent42~218ms, Auth31~665ms, 운영 config95~685ms.
- 로컬 무조회 간격 약4분34초 뒤 01:19:49~01:20:16 UTC: 31건200, consent1건 TypeError/10.521초(HTTP 상태 없음, 네트워크 오류 상세 원인은 미수집).
- 두 번째 첫 Auth4.142초(upstream35ms), portfolio809ms(upstream545ms), consent960ms(upstream112ms), config3.217초.
- 첫 요청 이후에도 느림: 01:20:08 병렬 portfolio3.766초(upstream2322ms), consent3.879초(upstream1989ms), config3.976초. 이후 같은 병렬 그룹54~149ms로 회복.
- 01:22:34 UTC 별도 읽기 전용 관리 SQL 표본: blocked0, idle client13, app_config SELECT7행 execution0.914ms/shared read0. 지연 순간과 동시 측정 아님.
- 근거(로컬 무시 산출물): artifacts/db-latency-20261113/{initial,after-local-quiet,query-baseline}.json. 기존 query-snapshot.mjs를 /private/tmp에 복사해 출력 폴더만 바꾸어 read_only 관리 API 실행.

### 판정과 개선안
- 앱 로그인 UI만의 지연은 아님: 익명 직접 REST와 운영 공개 설정 경로에도 재현.
- 유휴 뒤 첫 조회만의 문제라고 단정 불가: 후속 요청에도 지연. 로컬 무조회는 cron·다른 사용자가 있는 DB 유휴의 증거가 아님.
- 4개 동시 조회가 항상 느리지는 않음. 단독에도 지연이 있으며 시간대 효과·연결 재사용이 혼재해 동시성 인과는 미확정.
- 일부는 upstream 자체가 약2초. 다른 표본은 전체4초/upstream35ms라 네트워크·게이트웨이 등 외부 구간도 분리 필요.
- Nano 자원 한계와 공급자 처리 경로 문제를 구분할 현재 CPU/메모리/IO-credit 동시 지표 없음. 11/9 스왑 관찰을 오늘의 인과 증거로 쓰지 않음.
- 브라우저 access host unavailable로 기존 정상 로그인 세션 측정 불가. 인증 토큰 추출·쿠키 주입·테스트 계정 생성 안 함.
- 다음: 정상 로그인 브라우저에서 user_portfolios/user_consents/admin의 시간과 중복 요청 수를 수집하고, 같은 시각 공급자 자원·연결·요청 로그와 대조. 현재 스크립트의 실패 원인 코드·네트워크 구간 계측 보강도 필요.
- 앱 인증 코드/DB 설정은 수정 안 함. 중복 호출이 확인되면 같은 사용자·요청의 in-flight 공유를 검토하되 권한 확인/계정 경계는 유지. 자원 경합이 확인되면 예약 작업 중첩 조절·사양 검토, SQL 병목이면 해당 계획부터 수정. 지금 무조건 timeout 증가·중복 재시도·증설은 근거 부족.

## 채팅 수정
- 목록과 선택 대상 모두 칩과 동일하게 STOCK_KR 우선, 기존 이름·코드 fallback. 삼성전자 코드 중복 표시 해결.
- 마지막 물음의 아니면/또는/혹은/둘 중/어느 쪽을 확인해 짧은 네·아니요를 선택으로 단정하지 않고 “두 가지 중 어느 쪽인지 말씀해 주세요.”로 즉답.
- 되묻기는 AI/사용량 호출 없음. 횟수0·반복 네에서도 버튼 사용 가능. 명시적 선택을 입력하면 원래 AI 질문의 이력을 유지해 전송.
- 단일 예·아니요 질문과 “네?”는 기존 경로 유지. 결정 프롬프트에도 양자택일을 선택으로 단정하지 않는 규칙 추가.
- 규칙 기반 감지이므로 모든 한국어 질문 형식의 의미 판정을 보장하지 않음.

## Claude 코드 검토 (사용자 중간 질문에 답)
- 범위: 7622f0e/efce1b1/78b91ea/9da461b/a14d59f 주요 변경. 전체 코드 독립 감사 완료 아님.
- 타당: 기사 없는 원인 답에서 제목 제거, 확인한 가격만 전달; 한 번 재작성 후 모든 검사를 다시 통과해야 전달/사용량 기록; 첫 기사 열람 전 조기 반환 방지.
- 확인된 결함: assistantQuestion.ts UNSURE가 단정/확정을 단독으로 인정한다. `이유는 금리 인상 때문이라고 단정할 수 있어요. 정확한 원인은 확인하지 못했어요.`를 assistantUnsourcedCauseIssue에 넣으면 undefined로 통과.
- 임시 재현 테스트1 + 기존 관련139 =140 통과로 현재 동작 확인. 이 테스트는 “잘못된 통과”를 재현한 것이지 안전성 합격이 아님. 임시 파일은 지움. 후속에서는 reject 기대 테스트로 추가하고 고칠 것. 이번 두 소수정에 섞어 고치지 않음.
- 회사 설명 hedge:350ms 뒤 추가 읽기1회, 전체3초 상한은 있음. 지연 단축 방식으로 타당하나 느린 패자 요청 취소가 없고 DB 부하를 늘리므로 근본 해결 주장 불가. 장애 원인으로 확정하지도 않음.
- “네”를 대화로 이어가게 한 취지는 타당하나 양자택일 구분이 없었던 결함은 이번 수정으로 보완.
- 제3자 투자의견: 사용자에게 선택 질문을 보냈고 답 대기. 관련 정책/코드는 변경 안 함.

## 검사
- e921efa 제품 코드: npm run typecheck 통과.
- npm test -- --maxWorkers=2: 앱2904통과/17생략(253파일 통과/13파일 생략).
- npm run test:tools:4통과. npm --prefix quality-lab test:66통과.
- lint:ui/alerts/korean/darkmode/tour-anchors 모두 통과. 기존 ai-chok 고아 앵커 경고1건 유지.
- npm run build: 최초 샌드박스 Turbopack이6분 이상 진행 없고 CPU0%. 이번 PID19285/18308만 확인 후 종료. 권한 재실행으로 prebuild 포함 최종 프로덕션 빌드 통과.
- quality-lab 최초 EPERM(listen127.0.0.1)은 권한 재실행으로 통과. Vite 설정 경고는 기존 것.
- 실제 모델 테스트 미실행(비용0), 운영 사용자 질문 미전송(횟수 사용0). 브라우저·실기 검수 미실행(연결 불가).
- push/운영 배포 없음. 이번에 시작한 테스트·측정·빌드는 종료. 기존3122 InterviewLoop 서버 건드리지 않음.

## 결정사항
- 미검수 변경이 사용자 main push에 섞이지 않도록 별도 로컬 fix 브랜치에 커밋.
- 운영 기준이 bf55401로 바뀐 기록이 있으므로 옛 b49f711 릴리스로 바로 배포하면 나머지 main 기능을 되돌릴 수 있음. 다음 배포는 실제 운영 소스를 재확인하고 해당 기준 위에 이번 코드 커밋만 선별, 검사·사용자 확인 후 진행.
- 새 영속 규칙은 만들지 않았고 기존 push/승인 규칙을 적용. 별도 메모리 승급 후보 없음.

## 미해결 TODO
- [ ] 로그인 실제 계측 + 동시 자원 지표로 Supabase 원인 분리.
- [ ] 원인 검사 단정/확정 긍정문 통과 결함 수정·회귀 검사.
- [ ] e921efa 브라우저 검수·선별 릴리스 준비·배포 승인.
- [ ] 제3자 투자의견 범위 사용자 결정.

## 다음 세션 진입점
HANDOFF.txt → 이 기록. assistantQuestion.ts:UNSURE, assistantWithoutReporting.test.ts, scripts/measure-supabase-read-latency.mjs.
