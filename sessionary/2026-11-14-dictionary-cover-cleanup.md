# 2026-11-14 - 격자 표지와 선택 강조선 제거

## 작업 요약
- 사용자 거부한 도마 같은 격자 무늬 제거. 표지 노출 폭과 둥근 모서리, 그림자 축소.
- 모바일 표지 패딩12/18px에서3/5px로 축소. 전환 레이어 치수도 일치시킴.
- 선택 단어의 왼쪽 inset 강조선·색면 제거. 굵기/텍스트 색과 기존 북마크만 유지.
- Safari390×844 목차에서 무늬/강조선 제거를 직접 확인.

## 결정사항
- 이전 시안에 사용한 재질을 관성적으로 유지하지 않는다. 사용자 거부한 격자/왼쪽 바를 실제 기본 CSS에서 삭제.
- CSS 변경에 타입/UI lint/dark lint 및 실화면 검증. 전체suite/빌드는 이번 재실행 안 함. 직전83ab0b2 검사와 구분.
- push/배포/데이터 변경 없음. 로컬 커밋만.

## 미해결 TODO
- [ ] 최종 미감 승인, 물리 낱장 넘김/드래그 등 기존 후속은 HANDOFF 참조.

## 다음 세션 진입점
- DictionaryMaterial.module.css, StockDictionary.module.css.
- localhost:3013/brand-preview/dictionary-material, 서버 유지.
