# 2026-09-21 - 건강 점수 안내 카드

## 작업 요약
- 사용자가 운영 분석 탭의 왼쪽 파란 강조선과 AI 느낌 장식을 제거하고 디자인 개선 요청.
- 운영 파일과 로컬 건강점수 전체 개편안이 다른 상태임을 확인. 전체 개편 배포 없이 안내 카드만 독립 HealthInsight 컴포넌트로 분리.
- 파란 테두리/강조선/이모지를 제거하고 중립 제목, 설명 글자 대비, 여백으로 구성. 로컬 건강점수 안내에도 적용.
- 개발 전용 `/health-insight-preview`에서 운영 문구를 그대로 사용한 카드 확인 가능.

## 결정사항
- 이번 범위는 안내 카드 시각 개선. 점수 계산 및 권고 문구 변경 없음.
- 운영에 적용할 때 기존 PortfolioHealth의 nextAction JSX만 HealthInsight로 교체. 로컬 전체 PortfolioHealth를 배포하면 미승인 개편이 포함되므로 금지.

## 미해결 TODO
- 사용자 승인 후 운영 반영 완료.

## 다음 세션 진입점
- http://localhost:3000/health-insight-preview
- HealthInsight.tsx, HealthInsight.module.css.

## 검증
- 변경 TSX ESLint 통과. 브라우저 320/390/960px 넘침 없음, 왼쪽 테두리 0px, 오류 없음. 모바일 스크린샷 확인.

## 운영 반영
- 커밋 `4aa9d52` 푸시 완료. 기존 운영 건강 점수에서 nextAction 영역만 교체해 배포. 미승인 로컬 개편안은 보존.
- 배포 `dpl_CAXoDgape5gHgVEQgaPfmLnXGoZt`, joobi.kr 운영 승격. 테스트 1,036개 통과/4개 건너뜀.
- 운영 320/390/768/1280px 가로 넘침 없음, 안내 카드 왼쪽 테두리 0px, 브라우저 오류 0. 샘플 체험 종료 확인.
