# 2026-11-16 - 고정비 최소화 1차 최적화

## 작업 요약
- 사용자 서비스 검증 전 월 초저비용 유지 요청, 불필요한 DB조회/예약작업/로그검토 진행 승인.
- 운영 main1a84dea에서 perf/low-cost-20261116 분리. 이전 배포 결과 문서 미커밋 보존.
- 운영 api_calls 최근24시간 집계만 읽음:quotes688,market-watch223,cron market-watch144,usage40,economic-events39,industry-watch11. 로그 집계라 CDN적중/실패한 기록 등 전체 트래픽과 다름.
- market-watch 수집144회는10분주기와 일치. digest유휴guard 이미 적용,수집/알림주기 임의 축소 안 함.
- 시장 소식 공개 읽기: 동일 프로세스·동일30초관찰시간버킷 요청을 합침. 최대한개 엔트리,실패 미보관,조회시각 버킷 분리,결과복제로 소비자 변경 격리. 발행 성공/실패 이후 무효화,이전 in-flight결과는캐시복원불가.
- 경제 일정 숨김탭 자동조회 중단/보이는 순간갱신/리스너해제. 기존5분 캐시·폴링 유지.

## 결정사항
- 추가 서비스/서버/구독 없음. 요금제·DB스키마·cron·권한·운영계정 데이터 변경 없음.
- api_calls는 호출제한/관측에도 쓰이므로 로그비용 이유로 제거하지 않음. 시장/알림 주기 보존.
- 캐시는 프로세스별이므로 인스턴스간 공유/항상절감 보장 아님. 이미 CDN캐시30초 존재,이 변경은 서버내 중복/AI근거읽기에 보완적.
- 경제 일정 숨김1시간이면 원래최대12회주기 요청을 생략. 실제 비용/IO 감소율은 미측정.
- 현재 무료 사용료를 더 깎는 작업이 아니라 사용량을 줄여 유료상향 필요를 늦추는 목적. IO경고 해결로 보고하지 않음.

## 검증
- 관련13검사 통과:동시병합,TTL만료,실패재시도,관찰시간분리,진행중무효화,결과복제,발행후갱신,숨김/복귀/해제.
- 타입/변경코드ESLint 통과. webpack production build 통과.
- /private/tmp/joobi-low-cost-{tests,type,lint,build}.log.
- 이번 브라우저 실화면/운영 반영 후 실측/전체회귀 미실행.

## 미해결 TODO
- [ ] 운영 반영 전 최종검토,반영후 동일시간대 호출량·응답시간 비교.
- [ ] IO경고시간별시스템/DB디스크지표 대조(이전24시간차트조회실패).
- [ ] 실제Vercel청구액 확인 후 단일서버 이전 손익 결정. 서버구매/이전 미진행.

## 다음 세션 진입점
- src/lib/coalescedRead.ts,marketWatchStore.ts,src/hooks/useEconomicEvents.ts 및 관련테스트.
- HANDOFF.txt,이전IO조사 sessionary/2026-11-16-supabase-disk-io.md.

## 운영 반영 진행
- 사용자 운영 반영 승인,원격/main/HEAD1a84dea동일.전체2938통과17생략/도구4통과/ESLint/품질검사통과/기존webpack빌드통과.
- 기존ai-chok tour고아마커 경고1유지.이번커밋/main통합/push진행.복구1a84dea/dpl_Ks5Zv1BwQqLSMQtXRSJnS6rGMQxG.

## 운영 반영 완료
- main/origin/main02be1b3, dpl_F1BsPxHg7J6w3KQiQY3amQSNp1pG READY,joobi.kr alias확인.
- 원격2935통과20생략/Turbopack production빌드통과.로컬2938통과17생략/도구4통과.
- 홈200/시장소식200(events,runs배열)/경제일정200(events배열).관측435/51/463ms는단일샘플이며CDN포함가능,절감/개선율근거아님.
-17:53KST새배포직전10분 error로그0건,장기무오류보장아님.숨김폴링장시간운영검수미실행.
- 추가비용/요금제/DB/cron변경없음.실제IO감소량은추후동일조건비교.
- 코드push완료,후속결과문서만미커밋.운영반영TODO해소,실측TODO유지.
