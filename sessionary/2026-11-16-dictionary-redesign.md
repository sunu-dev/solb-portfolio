# 2026-11-16 - 주식사전 재설계

## 작업 요약
- 사용자 운영 캡처: 한쪽에 저장/출처만 남는 책 쪽 나눔, 낡은 미감 거절.
- 첫 목록/단일 정의 시안 뒤 “2026년 현대적 AI/3D 인터랙티브 디자인” 지시를 받아 입체 체험까지 확장.
- main5b4daa7에서 redesign/dictionary-20261116 분리. 이전 배포 결과 문서 미커밋 변경 보존.
- 검색/목록과 단일 정의 구조, 전체 기본/실제 내 단어 분리, 관련 용어·메모·복습 유지.
- CSS3D 카드/수량 기둥/소유칸/금액판 구현. ETF·펀드/거래량/주식/수익률5항목은 직접 조작, 나머지는 입체 이름판과 관련 개념.
- 별도 AI 호출·시세 조회·모델/이미지 생성 없음. 가상 예시와 개념 그림을 명시.

## 결정사항
- 시각 효과가 용어 이해와 연결되게 한다. 수량 합계/소유 비율/수익률 변화가 입력에 반응한다.
- 읽기·저장 버튼이 페이지 조각으로 갈라지지 않게 CSS columns와 캡처 넘김을 실제 경로에서 제거.
- 기존 정의/공식출처/계정 저장/API 변경 없음. 과거 책 효과 소스는 개발 시안 때문에 보존.
- 반투명 밝은 카드의 글자가 글로벌 .dark button 규칙으로 흐려지는 문제를 명시적 색으로 수정.
- 3D 막대 첫 클릭이 부모 scene에 전달되는 문제 재현(pointerdown/up/click target 증거). 부모 plane pointer-events:none, 버튼 auto와 앞쪽 Z배치로 해결. 100→300→350 직접 클릭 재검증.
- 지속 애니메이션 없음. 감소 모션에서는 포인터 tilt와 전환 억제. 키보드 입력은 native button/range.
- 메모리 승급 없음. 프로젝트 디자인 문서로 최신 결정을 관리.

## 검증
- 관련 dictionaryAvailability/personalDictionary/personalDictionaryCloud18검사 통과.
- TS/변경TSX ESLint/UI·한국어·dark lint 통과. webpack production build 통과.
- 1440 데스크톱/390·320 모바일, 밝음/어두움 실화면 확인. OS 실기기가 아닌 브라우저 검사.
- 저장/메모/헷갈림/퀴즈 진입·복귀, 저장0개 빈 화면, 모달 Escape와 focus 복귀 확인.
- ETF3카드 클릭, 거래량100/300/350, 소유50%, -20%→80만원 확인.
- 첫 메모 재검수 timeout은 이미 열린 details를 닫아 생긴 자동화 순서 문제. open 상태 확인 후 통과.
- 개발 CSP 통계2건, 로컬 production Vercel 통계 스크립트404와 MIME 오류는 기존 로컬 환경 문제. 재설계 런타임 예외는 발견하지 않음.
- 전체 회귀/운영 로그인/실기기 미실행. 사용자 디자인 승인 별도.
- 코드 커밋/push/배포 없음. 운영은5b4daa7 책 디자인 유지.

## 미해결 TODO
- [ ] 사용자 디자인 검수 및 추가 수정.
- [ ] 실제 휴대폰/OS reduced-motion, 운영 로그인 후 검수.
- [ ] 승인된 최종 디자인 main 통합/배포.

## 다음 세션 진입점
- HANDOFF.txt 및 docs/JOOBI_DICTIONARY_DESIGN_SYSTEM.md 최신11/16절.
- localhost3013/brand-preview/dictionary-material.
- 스크린샷 artifacts/dictionary-redesign-20261116, 로그 /private/tmp/joobi-dictionary-redesign-*.log.

- 최종 production 빌드 재시작3014 후 실제 모달에서 거래량 막대 직접 클릭100 확인.

## 후속 — 입체 장면 중심으로 고도화
- 사용자 “조금 더, 미래지향적 디자인” 요청 반영. 목록형 시안의 구조는 유지하되 입체 체험을 제목 아래로 올려 개념이 먼저 눈에 들어오게 함.
- 최대1180×860, 제목52, 목록264. ETF/수익률/주식/연결 개념별 광원 배색 및 카드 반사광, 짧은 용어 전환.
- 넓게 보기/목록 복귀, / 검색, reader 포커스 좌우 단어 이동. 입력/텍스트편집/range는 단축키 제외.
- ETF→펀드 같은 관련 용어 경로를 최대6개 표시하고 앞 용어로 복귀. 검색/분류 변경 시 초기화.
- 키보드 검색의 중복 focus 테두리는 input 대신 검색 상자 경계로 표시.
- 검수: ETF→펀드→ETF, 넓게 보기 후 / focus, 수익률 slider방향키10→11(단어는 유지), 밝음/어두움·390px 확인.
- 관련18검사/타입/TSX ESLint/UI·dark·한국어lint/production build 통과. 전체 회귀 미반복.
- 최종 production3014 재시작(session79449), 실제모달 넓게 보기→/검색→거래량막대100 클릭 통과.
- 스크린샷 refined-desktop-light/refined-focus-dark/refined-mobile-dark. 운영 반영/커밋/push 없음.

## 후속 — 폰트·설명 디자인
- 사용자 피드백: 입체 표현에 비해 폰트·설명 영역이 여전히 오래된 인상.
- 제목 굵기750→620, 크기52→46. 로컬 Pretendard Variable을 사전 전용으로 확실히 로드. 첫 뜻25/21px, 본문18/17px, 예시16px 위계.
- 기존 정의를 Intl.Segmenter(ko)로 나눠 첫 문장을 입체 예시 위로, 후속 문장은 아래로 배치. 원문 내용·출처 변경 없음.
- 중복 부제·쉽게 말하면 라벨·녹색 예시 상자 제거. 여백·구분선·작은 옆 제목으로 예시 구분.
- 본문 FinancialText는 onOpen으로 사전 내 탐색에 연결. 옛 미니 수첩 팝업 없이 경로 복귀 가능.
- PC 밝음/어두움,390/320px overflow 없음. 본문 거래량→주식→거래량 경로 검증. 폰트 loaded 확인.
- 타입/ESLint/UI·dark·한국어lint/관련18검사/production webpack build 통과. 최신 로그 /private/tmp/joobi-dictionary-editorial-*.log.
- production3014 종료 시도는 sandbox 권한으로 실패. 별도3015 시작은 자동 승인 후 성공(session54265).3014 기존 프로세스 유지, 최신 검수는3015.
- 사용자 미감·실기기 검수 대기. 커밋/push/운영 배포 없음. 다음 진입은 StockDictionary.tsx/.module.css 및3013 미리보기.

## 후속 — 디자인 방향 승인 후 품질 검토
- 사용자 현재 방향 진행 승인, 추가 개선 검토 요청. 저장소 main5b4daa7 기반 별도 브랜치 유지.
- 매출 등 일반 용어의 입체 제목 반복이 보충 설명을 모바일 아래로 밀어냄을 확인. 일반 용어는 기본 설명/관련 용어로 정리하고 실제 조작 가능한5개 용어만 체험 유지.
- 체험 보조 글자 크기/대비 및 focus-visible 개선. 모바일 자산/수익률/주식 장면 높이 조정.
- 브라우저58개 전체 정의/출처 표시·가로넘침 확인.320px dark 매출 출처까지 첫 화면에 표시. 매출→순이익 탐색,ETF저장/카드선택/Tab focus 통과.
- 타입/변경TSX ESLint/UI·dark·한국어lint/webpack build 통과. 직전18개검사는 반복 안 함. 최신 로그 /private/tmp/joobi-dictionary-quality-*.log.
- 이미지 quality-mobile-dark.png, quality-mobile-keyboard.png. dev3013최신,production3015는 이전 실행프로세스 유지. 커밋/push/배포 없음.
- 남은 개선 후보: 매출과 순이익 등 차이를 직접 이해하는 개별 체험은 근거/콘텐츠 설계 후 추가. 실기기·로그인 검수 미실행.

## 운영 반영 진행
- 사용자 “운영에 반영하자”에 따라 이번 커밋/main통합/push 승인 적용. 원격 fetch 후 origin/main=main=HEAD5b4daa7, 충돌 없음.
- 전체2933통과17생략/도구4통과/타입·lint·webpack빌드 통과. 기존 ai-chok 고아 tour마커 경고1 유지.
- 복구 기준 dpl_F622wRwdBexcoB7KkYGPFWaBPHYo /5b4daa7. 자동 배포 완료 후 운영 실화면 확인 예정.

## 운영 반영 완료
- main/origin/main1a84dea, dpl_Ks5Zv1BwQqLSMQtXRSJnS6rGMQxG READY. joobi.kr alias 확인. 홈페이지/폰트200.
- 원격2930통과20생략, Turbopack build/타입 통과.06:24:25 UTC 배포 완료.
- 운영 기존 로그인 상태에서 사전 ETF/카드선택/검색/매출/모바일390/출처/닫기 검수 통과. 계정 저장 데이터 수정하지 않음.
- 최초 계정 확인 실패, 재연결2회 후 회복. 새 배포10분 오류조회에서 /api/config upstream failure1건(06:25:13 UTC). 기존 계정 지연과 같은 증상이며 원인 미확정. 인증/config 소스 변경 없음.
- 실기기/운영 저장·복습 검수는 후속. 운영 반영 및 방향 승인 대기 항목은 해소.
- 코드 clean 확인 후 결과 문서만 후속 갱신/미커밋. 반복 배포 방지 위해 문서만 추가 push하지 않음.
