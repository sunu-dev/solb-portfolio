# 2026-11-14 - 사전 하단·종이 클릭·진입 버튼

## 작업 요약
- SVG 하단의 뾰족한 V/두꺼운 표지를 완만하고 얇게 수정. 중앙 쪽수 오른쪽 이동.
- 오른쪽 종이 클릭 다음, 왼쪽 이전. 링크/버튼/입력/summary·선택·6px 이상 이동 제외. 처음/끝과 busy 방어.
- LearningDesk/PortfolioTools 공통 작은 책 SVG+주식사전 이름으로 변경. 미리보기에서도 진입 가능.
- Safari 데스크톱 1–2/3→3/3→1–2/3 실제 종이 클릭, 메모 창 열고 닫은 후 쪽수 유지, 진입 버튼 확인.
- 전체2929통과17생략/도구4/타입/공통5종/webpack빌드 통과. 기존 ai-chok 경고 유지.
- 로그 /private/tmp/joobi-dictionary-click-{tests,tools,build}.log. 이번 quality-lab 미실행.

## 결정사항
- 사용자 기준은 사전의 질감과 자연스러운 종이 경험. 기능 통과를 디자인 완성으로 취급하지 않음.
- 마지막 펼침면 1–2/2는 다음 장 없는 상태. 기존 종이 클릭 미연결과 구분.
- 기존 펼침면 전체 캡처 전환은 실제 한 장이 책등 축으로 넘어가는 구현이 아님. 한계를 명시.
- React best-practices 검토: 공통 버튼 재사용, 데이터/유료 호출 추가 없음, 명시 client 경계, 키보드 버튼 보존.

## 미해결 TODO
- [ ] 모바일/다크/드래그 선택/키보드 실검수. Safari 사용자 다른 페이지 이동으로 조작 중단.
- [ ] 실제 한 장 곡면 넘김과 최종 질감 검수. 이번 최종 완성·미감 승인 없음.
- [ ] 운영 반영 미실행. push 없음. 유료 모델/운영 계정/DB 변경 없음.

## 다음 세션 진입점
- DictionaryBookSurface, DictionaryPages, DictionaryShortcut, useDictionaryPageTurn.
- localhost:3013/brand-preview/dictionary-material 서버 유지(기존 세션78907).
- 로컬 커밋만. 검증 기준과 최종 커밋은 HANDOFF/git log 확인. 영속 룰 승급 없음.
