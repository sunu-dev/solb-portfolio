# 2026-11-13 - 로고 주비 점프 인사

## 작업 요약
- 사용자 로고 빨간 상승선을 캐릭터가 깡총 뛰는 요청 구현. 시작92e2e20 clean, fix/chat-followup-20261113.
- JoobiLockup greet 옵션을 실제 Header 홈 버튼에만 적용. 선택 캐릭터를 SVG 장식으로 배치하고3점프/착지를2.4초에 재생.
- 화면에 보인 뒤1.2초 대기해 첫 인사. 이후 마우스 진입시만 재생,30초 간격 제한. 자동 반복 없음.
- 기존 다른 로고 변형의 가벼운 움직임 유지. 글자/선/클릭영역/접근성 이름 유지.
- 화면밖/비활성탭/reduced-motion에서 취소. 정리시 타이머·리스너·애니메이션 해제.

## 결정사항
- 브랜드 인사이며 시장 데이터·등락·매수 신호와 연동하지 않음.
- 기존 이미지 사용, 신규 얼굴/부위 원화 제작 없음. 말풍선 옆 캐릭터 위치는 변경하지 않음.
- 운영714681a 유지. 이번 배포/push/유료모델/운영 질문 없음.

## 검증
- 타입, 전체2927통과17생략, 공통5종, 도구4, quality66, webpack production build 통과.
- 기존 ai-chok 고아 앵커 경고 유지. npm run build 대신 npx next build --webpack.
- 저위험 시각 변경에 구현복제 테스트 추가하지 않음. 실제 브라우저/모바일 점프 모습은 미검수.
- 검사 프로세스 종료. 코드/인계 기록 로컬 커밋만.

## 미해결 TODO
- [ ] 실제 헤더에서 크기·점프 여백·모바일·reduced-motion 검수.
- [ ] 운영 반영 확인 후 배포.

## 다음 세션 진입점
- src/components/brand/JoobiLockup.tsx, JoobiLockup.module.css, src/components/layout/Header.tsx.
