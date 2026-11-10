# 2026-10-18 - 상황별 인사·ETF 설명·이미지 교체

## 작업 요약
상황별 인사 200개와 반복 회피, 선택 지역 기상청 예보 연동을 구현했다. 301개 ETF의 34가지 구조 설명과 KORU 환율 가상 예제, TSLL 단일주식 설명을 보완했다. 이미지 목록과 inline SVG를 조사하고 ETF 9종·멘토 6종을 새로 생성해 교체했다. 산업 장면 97종은 접촉 시트 검수 후 기존 체계를 유지했다.

## 결정사항
초보자가 용어와 가격 전달 과정을 연결하도록 정의→구조→예제를 제공한다. 날씨는 기본 비활성·직접 지역 선택이며 확인된 최신 예보만 사용한다. 생성 그림은 장식에 쓰고 구조 설명과 데이터 차트는 읽을 수 있는 텍스트·실제 데이터로 유지한다. 원본 작업 트리에 다른 변경이 많아 이전 운영 기준에 40개 파일만 선별 적용했다.

## 운영 결과
운영 dpl_HkH5MpbVsjFjiNMzdxSMwREgzXm5 READY. 로컬 1,573 테스트 통과/1 제외, Vercel 1,570 통과/4 제외 및 빌드 통과. Chrome 운영 KORU 원화와 설명, 운영 날씨 API 확인. 증거 artifacts/patterns-funds-20261018/REPORT.md 및 IMAGE_AUDIT.md.

## 미해결 TODO
- [ ] 실제 iPhone Safari/PWA·큰 글자·움직임 줄이기·OAuth 왕복 검수는 기존 실기 후속과 함께 진행.

## 다음 세션 진입점
최신 선별 소스 /private/tmp/joobi-patterns-funds-release-20261018. artifacts/patterns-funds-20261018/files.txt의 40파일, selected-change.tgz와 sha256.json 참고. 전체 원본 작업 트리 배포 금지. 이미지 생성 프롬프트·원본 경로는 generated-final.json. 메모리 승급 후보는 날씨 선택/최신성 및 생성 그림과 데이터 시각화 구분 원칙이며, 사용자 승인 전 영구 메모리 변경하지 않음.
