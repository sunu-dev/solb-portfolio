# 2026-10-23 - 종목 동기화 성능 개선 운영 배포

## 작업 요약
- 사용자의 운영 적용 요청에 따라 DB 변경과 독립적인 종목 동기화 개선을 먼저 배포했다.
- 현재 운영 기준 `dpl_6f7UiyPGErz58NE2AaQpTyWcskd3`를 확인하고 기존 격리본을 `/private/tmp/joobi-io-release-20261023`으로 복제했다. route/test 2개만 교체한 것을 src 비교로 검증했다.
- 격리본 사전검사1713tests+1skip, 운영 원격빌드1710tests+4skip·TypeScript·Next빌드 통과. 로컬 Next 빌드는 정체되어 중단했고 원격빌드 성공을 근거로 검증했다. custom meta 옵션의 배포 API 거절은 옵션 제거 후 해결했다.
- 신규 배포 `dpl_AP8SCnv4gnJpgtPgTbabEatyQukc` READY, https://joobi.kr 연결 확인. 홈200·예약 API 미인증401. config는 기존 DB 장애로 503 지속(약8.3초).
- DB 읽기 전용 재조회는 544/connection timeout. 알림 scheduler SQL migration은 운영 미적용.

## 결정사항
- DB가 막혀도 독립 적용 가능한 앱 개선은 먼저 반영한다. 알림 SQL과 후속 실측만 DB 회복을 기다린다.
- 예약 기능 확인을 이유로 실수신자 테스트 발송이나 대규모 종목 수집 수동 재실행을 하지 않는다. 다음 정상 정기 실행 결과로 확인한다.

## 미해결 TODO
- [ ] DB 회복 후 알림 SQL migration 개별 적용·필수 기능 검증.
- [ ] 다음 정기 종목 동기화의 쓰기배치/변동없음 로그와 24시간 IOPS/WAL 확인.

## 다음 세션 진입점
- `docs/IO_PERFORMANCE_FIX_2026-10-23.md` 참고. 앱은 운영 적용 완료, 알림 SQL과 DB 장애 복구·실측은 남음.
