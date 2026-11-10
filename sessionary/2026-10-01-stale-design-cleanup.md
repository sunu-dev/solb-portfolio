# 2026-10-01 - 오래된 미반영 시안 폐기

## 작업 요약
- 사용자 요청으로 9월 19~21일의 반려·대체된 분석/원형·좌표 맵/브랜드 시안을 정리.
- 운영과 다르던 PortfolioHealth, PortfolioSection, PortfolioTerrain 3파일을 운영 소스 커밋 fc4f892로 복원.
- 미추적 시안·helper·테스트·preview·폰트 32파일 삭제. 이미 커밋된 운영 파일은 삭제하지 않음.
- 삭제 전 백업: `/private/tmp/joobi-stale-discard-backup-20261001.tar.gz` (임시 경로).
- 운영 관련 문서·세셔너리·AGENTS 및 SQL 원본은 보존. SQL을 실행하거나 DB 상태를 변경하지 않음.
- Vercel 직접 조회: 현재 운영 dpl_8ero7PpARLo5MkE2jKFNtcCtqZ71, 생성 시각 2026-09-21 14:46:40 KST.

## 결정사항
- 단순히 오래됐다는 이유가 아니라 기존 작업 기록상 반려/후속 운영 버전으로 대체된 구현을 폐기.
- Vercel 생성 날짜는 배포 시점만 확인할 수 있으며 작성 도구(Codex/Claude)는 조회 응답에 없음.
- 이번 작업에 원격 push/운영 배포 없음.
- 삭제된 route의 오래된 Next.js 생성 타입으로 검사 오류가 나서 dev 타입 캐시를 임시 폴더로 옮기고 next typegen으로 갱신.

## 미해결 TODO
- [ ] 운영 관련 SQL 원본의 실제 DB 적용 상태 대조 후 별도 커밋 정리.
- 문서와 이전 작업 기록의 커밋 정리는 별도 범위로 유지.
- 기존 실제 iPhone Safari 확인 항목 유지.

## 다음 세션 진입점
- 제품 소스는 운영 커밋 fc4f892 기준으로 복원됨.
- git status에 남은 문서·기록·SQL은 새 미반영 제품 기능이 아님.
- 영구 메모리 승급 후보 없음.
