# 2026-11-09 - Supabase 지연의 앱/공급 환경 원인 분리

## 작업 요약
- 사용자 요청: Supabase 탓인지 우리 코드/부하인지 먼저 구분. 서버 설정·cron·요금제 변경 없이 읽기 전용 진단.
- 동일 app_config7행 SELECT 직접REST/SDK/운영API 10회 비교. 모두200이지만 두 시점에서 공통2.5~2.7초 지연. 마지막 REST upstream2212ms. 화면/SDK 단독 원인으로 설명 불가.
- 별도 SQL 실행계획4표본0.109~0.868ms/disk read0. 처음 통계조회는 버전 차이로 실패, 새 증거파일로 수정 후 비교. 기존 실패 증거 유지.
- 약272초간 일치하는 top-level SQL117회/합계1.277초, 새 진단5회0.575초 별도. reset/eviction/start 유지. 잠금0 표본. 과거 누적 cron 이력 쓰기 순위를 현재 원인으로 오인하지 않음.
- DB cron 실제4개; 최근1시간 시장6/digest60회 정상주기. api_calls40건 기록은 best-effort 누락 가능.
- 별도175.6초 창 system880IOPS/16.87MB/s vs data5.02IOPS/.364MB/s, swap-in/out75383/71228페이지 증가. 메모리Available244/Total426MB. OOM·특정프로세스원인·현재IOcredit0 증명 아님.
- 우리 공통 인증 guard가 provider 오류를 anonymous로 오분류하고 deadline이 없음을 확인. 5초 제한+실제 fetch 취소+503 분리. service client signal은 요청별로 격리. 인증 우회 없음.
- root 및 격리 후보 반영. 관련44개/후보전체2440개 테스트 통과13생략, 후보typecheck/변경ESLint 통과. 이번추가3파일 후 새 production build/배포는 안 함.

## 결정사항
- 결론은 요청 처리 경로/실행 환경 지연 의심 + 확정된 앱 장애처리 결함. Supabase 플랫폼결함과 Nano사양한계 구분은 미완료. 느린 SQL이나 호출 폭주가 원인이라는 증거는 해당 짧은 구간에서 없음.
- 공급자 지원 초안을 갱신하되 외부 발송 안 함. 서버 내부 per-process/credit/service 로그 확인 필요. 무조건 증설·재시작하지 않음.
- 후보 최신 manifest는 artifacts/db-isolation-20261109/candidate-manifest.json. 예전17파일manifest만 사용하면 이번 수정 누락. root의 독자 포트폴리오 handoff 보존.
- 이번 결과는 사건 진단 표본이며 영구 규칙으로 승급할 새 항목 없음.

## 미해결 TODO
- [ ] 공급자 내부 원인 확인: 지원 초안 전달 승인 필요, 임의 외부 발송 금지.
- [ ] 갱신 후보 프로덕션 빌드/선별 배포 및 실제 인증 검수. 운영은 F4pjjoV7Zt3zydY9gQFj2FQgSiUg 유지.
- [ ] 장기 재발/카카오 인증/iPhone/최초 기사·답변 지연은 별도 잔여.

## 다음 세션 진입점
artifacts/db-isolation-20261109/RESULT.txt 및 candidate-manifest.json. 격리 후보 /private/tmp/joobi-answer-context-20261109. 재현 스크립트3개와 안전한 수치 evidence 보존. scripts/capture-io-snapshot.mjs는 기존 진단 도구. SUPPORT-DRAFT.md는 artifacts/runtime-followup-20261108 안에 있고 미발송. 로컬 자격증명/환경변수 값/원문 쿼리/개인 데이터는 기록하지 않음.

## 후속 질문: 첫 진입·새로고침 대기 원인
- 운영 정본 /private/tmp/joobi-runtime-followup-20261108의 코드로 확인. root에는 미배포 vault 작업이 있으므로 운영 경로와 구분했다.
- Home은 useAuth 세션 복원 및 local store identity 준비가 끝나야 HomeContent를 마운트. 로그인 회원은 초대/이용권한과 동의 내역 확인이 끝나야 본문을 표시한다. 초대와 동의 조회는 이미 병렬이며 모두 직렬이라고 설명하면 안 된다.
- 세션 복원은 항상 원격 요청이 아니며 토큰 갱신 등이 필요하면 원격 지연 영향 가능. 초대 확인은 RLS user_portfolios 조회, 150ms 후 필요하면 config/admin 병렬 조회; 동의 확인은 user_consents 직접 조회. 각각6초 제한. 포트폴리오 DB 전체 동기화·시세 완료 자체는 페이지 표시 조건에 포함되지 않는다.
- 운영 useAuth의6초 fail은 receivedAuthEvent=true로 설정해 뒤늦은 getSession 성공을 무시할 수 있다. 이전 후보에서 수정했으나 아직 미배포.
- 따라서 공급자 지연이 전면 로딩으로 전달되는 구조와 늦은 회복을 놓치는 앱 결함은 확인. 첫 HTML/JS/세션/초대/동의/본문 표시까지 동일 navigation의 단계별 실측 비중은 아직 없다. 앞선config2.5초를 전체 첫화면 로딩 시간으로 오인하지 않는다.
