# 2026-11-13 - 기사 수집 개선 배포

## 작업 요약
- 4c22d3f: 공식 NVIDIA 출처 허용, 경영진 사건 문단 보존, 회사 열람 최대2회(첫 유효 기사면 조기 반환), 회사 근거 없는 결과를 부분 수집으로 판정·1분 재시도, 캐시 v13, 공급자 실패 상태 로그. 진단 테스트 종목/출력 경로 선택 가능.
- 전체2919통과17생략, 타입/공통5종/도구4/quality66 통과. quality 첫 실행 listen EPERM 후 권한 재실행 통과. 로컬 webpack 빌드 통과(최종 진단·테스트 추가 전). 최종 원격 빌드 별도 확인.
- 실제 API 전체 경로3표본: 첫 표본은 추가한 AP/Reuters 접근금지400으로 기사0, 해당 출처 제거 후 두번째는 기사0, 세번째200/16.818초 CEO 사임·임시CEO 선임 출처 포함 설명 성공. 수집 단독 진단3표본(첫2 실패400, 최종1통과). 실제 API 비용 발생. 운영 계정 질문횟수 사용 없음. 로컬 하네스는 인증·사용량을 mock하며 실제 모델/자료 호출, 운영 인증 검수와 구분.
- 이번400은 새로 추가했던 금지 출처 때문. 기존 운영 장애 원인으로 확정하지 않음. AP/Reuters 제거 완료.

## 결정사항
- 수집 안정성 전체 해결을 주장하지 않음. 영어RSS 우선/범용 공식회사 출처 등록/회사 원인 충분성 별도 판정은 후속. 개인 의혹 규칙 변경 없음.
- 사용자 배포 승인, 최신 AGENTS의 push금지 적용. CLI 단계 배포 후 promote.

## 미해결 TODO
- [ ] 기사0건 비율·본문 필터 단계 진단 확대, 시장 기사만 있을 때 원인 충분성 검사.

## 다음 세션 진입점
- assistantArticleSources.ts, assistantEvidenceSource.ts, assistantQuestion.ts.

## 운영 결과
- 4c22d3f / dpl_7kHL5q5TZUXutsvXiPMmPwhs6R9E READY, 원격빌드1분45초. promote 성공. 단계홈200/API401, 운영홈200/API401. 운영로그인 질문 미검수. 복구 dpl_BDpzQjeS4yDco4atagjYxMGbd2ru.
- Git push 없음. 릴리스 워크트리 /private/tmp/joobi-sources-release-20261113 유지. 실제 모델은 로컬 서버경로 하네스만; 기사 수집 변동성 남음.

## 운영 결과
- 4c22d3f / dpl_7kHL5q5TZUXutsvXiPMmPwhs6R9E READY, 원격빌드1분45초. promote 성공. 단계홈200/API401, 운영홈200/API401. 운영로그인 질문 미검수. 복구 dpl_BDpzQjeS4yDco4atagjYxMGbd2ru.
- Git push 없음. 릴리스 워크트리 /private/tmp/joobi-sources-release-20261113 유지. 실제 모델은 로컬 서버경로 하네스만; 기사 수집 변동성 남음.
