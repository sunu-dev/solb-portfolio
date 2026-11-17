# 2026-11-17 - 사전 전체 개념 체험

## 작업 요약
- 사용자가 주식분할·분배금뿐 아니라 모든 용어 체험 요구. 기존5개 외53개 추가,58개 누락검사.
- 주식 조각 분할/병합, 수치 비교, 캔들, 구조 단계 타입으로 용어별 예시 구현.
- 거래량/주식/수익률/ETF/펀드 기존 체험 유지. 디자인 톤/폰트 유지.
- 분할 전체가치 보존, 분배금 지급시 전체자산 불변/가격하락시 손실 예시 검증.
- 전체2974통과19생략. 타입/ESLint/webpack빌드/품질lint 통과. 기존tour고아마커1경고.
- 격리된 실제 컴포넌트 브라우저390px 전체58개 모든 버튼 클릭, 가로넘침/누락0.
- 분할·분배금 스크린샷 확인. 어두운 토큰과 reduced-motion 전환0초 확인.
- 실제 운영 전체 사전 및 실기기/사용자 최종미감은 미검수.

## 결정사항
- 자동재생 대신 단계 선택, 값 변화에 의미 부여. 모든 용어를 개별3D영상으로 제작하지 않음.
- 서로 다른 단위인 PER/이익률/배당수익률/RSI는 막대길이 비교 생략.
- OHLC를 경로처럼 연결하지 않고 실제 캔들 몸통/꼬리 표시.
- 기존 운영 승인된 뉴스 수정3d9a4d8과 분리해 feat/dictionary-all-concepts-20261117 작업.
- 뉴스 수정 배포 READY 및 joobi.kr alias일치/공개3경로200 확인. 운영 실유료대화 추가없음.

## 미해결 TODO
- [ ] 새 체험 사용자 디자인 검수 및 실기기 확인.
- [x] 후속 운영 지시로6355927 push/READY/alias/사전 확인 완료.
- 후속 배포 요청:46afbbf 커밋/main fast-forward 완료. AGENTS.md 사용자직접push 규칙 준수, push/새배포 미실행. 기존 검사코드와 동일하여 전체검사 반복하지 않음.

## 다음 세션 진입점
- HANDOFF.txt, src/lib/dictionaryScenes.ts, src/components/learning/DictionaryScenarioStage.tsx.
- /private/tmp/joobi-dictionary-all 검수harness/스크린샷, /private/tmp/dictionary-*.log.

## 운영 배포 완료
- 사용자 push대기 안내 후 운영배포 재지시.6355927 push, dpl_9xVrTLHSm1vyX9fv7iXZXQjpHPUF READY.
- 원격2971통과22생략/도구4,production빌드 통과. joobi.kr alias일치/공개3경로200.
- 새배포 최근10분error조회 recordsReturned0. 단기관찰임.
- 운영guest 사전 분할/분배금 단계선택 및 계산결과 확인,390px 가로넘침없음. 계정저장/유료호출없음.
- 결과문서만 후속미커밋 유지.
