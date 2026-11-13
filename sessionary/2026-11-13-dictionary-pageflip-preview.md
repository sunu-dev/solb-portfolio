# 2026-11-13 - 사전 책장 시안 재작업

## 작업 요약
- b7475ba의 단순 rotateY 카드 전환을 사용자가 거부. 해당 CSS 전환 제거, 서비스 기본 폰트와 이전/다음 이동 유지.
- react-pageflip 2.0.3 / page-flip 2.0.7을 사용한 개발전용 `/brand-preview/dictionary-book` 추가. 기존 운영 사전을 대체하지 않음.
- 두 페이지 펼침/좁은 화면 한 페이지, 검색 이동, 저장과 출처 연결. React 19 ref 재실행 시 같은 DOM을 중복 append하는 upstream 경로를 방어하고 회귀 테스트 2개 추가.
- Safari 실제 검수: 1–2 → 3–4 → 5–6 및 이전 장, 검색 ETF 이동 확인. 접힘 중간 프레임의 뒷면·그림자 확인. 390px에서 한 페이지/6번 ETF 본문과 번호 일치 확인. 실제 폰 터치는 미검수.
- 최초 번호/본문 불일치 관찰에는 비활성 Safari 창의 렌더링 정지·동시 조작이 섞여 있음. ref 중복이 그 관찰의 유일 원인이라고 확정하지 않음.
- 사용자 디자인 피드백: 큰 카드/스캔 문서처럼 보이고 아마추어 느낌. 작은 판형, 간결한 헤더, 얇은 단면, 본문 위계로 재조정했으나 사용자 승인 없음.
- ‘낯설었던 말이, 내 말이 될 때까지.’를 ‘궁금한 주식 용어를 찾아보세요.’로 수정. 추상적 장식 문구 제거.
- Threads 참고를 실제 확대 열람: https://www.threads.com/@ultramarine.gy/post/DfgQ6a0H1hj/media . 게시물은 리디북스의 곡면 효과를 밀리의 서재에도 요청하는 내용. 연속 영상 전체 재생 검증으로 보고하지 않음.
- 평면 접힘과 곡면 텍스트 변형의 차이를 인정하고 `/brand-preview/dictionary-curl`을 별도 추가. BSD 3-Clause HP/gl-transitions 셰이더의 라이선스 전문 유지. html-to-image는 넘김 때만 사용, 정지 상태는 실제 HTML.
- 곡면 시안은 버튼 이동/느리게 보기, 실패 시 즉시 이동, reduced-motion 즉시 이동. 손 드래그 미구현. Safari 페이지 1→2→3 이동 확인, 곡면 중간 프레임의 시각 품질 확인은 미완료.
- 사용자가 실제 종이 질감을 요구하여 imagegen 내장 도구로 재질 방향의 정적 컨셉 시안 생성 요청. 앱 구현 화면과 구분한다.

## 결정사항
- 운영은 5ebb887 유지. 모든 push 금지. 사전 배포는 사용자 시안 확인 전 보류.
- 개발전용 두 경로는 production에서 notFound. 시안/실험을 운영 구현 완료로 보고하지 않는다.
- 비밀정보·운영 질문·실제 주식 모델 호출·계정 설정·DB 변경 없음.
- 새 글꼴을 도입하지 않는다. 종이 질감은 글자 대비를 해치지 않는 미세한 섬유와 조명/책등/단면으로 표현할 것. 노이즈만 얹는 방식 피하기.

## 검증
- pageflip 단계: 타입, 전체2929통과17생략, 공통5종, 도구4, quality66, webpack 빌드 통과.
- 후속 곡면 코드 추가 후 타입/공통5/webpack 결과는 HANDOFF의 최신 검사란 참고.
- 유료 모델 검사17개 등 생략 유지. 모바일 실기기/터치, reduced-motion 실제 설정, 다른 브라우저, 메모리·프레임 속도 미검수.

## 미해결 TODO
- [ ] 재질 컨셉 시안 확인 후 실제 사전 UI에 적용. 사용자가 아직 디자인을 승인하지 않음.
- [ ] 곡면 중간 프레임/글자 선명도 검수, 손 드래그·취소·반대방향·기기별 성능 구현/검증.
- [ ] 기존 사전 검색·메모·저장·복습 통합 검수 후 별도 배포 승인.

## 다음 세션 진입점
- DictionaryBookPreview.tsx/.module.css, DictionaryCurlPreview.tsx/.module.css, pageFlipRef.ts, pageCurlRenderer.ts, pageCurlShader.ts.
- 로컬3013 dev서버 유지. `/brand-preview/dictionary-book`, `/brand-preview/dictionary-curl`.
- 다른 프로젝트3122 서버는 조작하지 않는다. Safari 메인 창이 계속 전환되어 검수용 별도 창을 만들었음.
- 작업 기준 b7475ba. 이번 변경은 로컬 커밋으로 보관하며 push/배포 없음. 정확한 해시는 git log 확인.

## 재질 컨셉 및 최종 검사
- 내장 imagegen으로 정적 컨셉 생성, 사용자에게 표시. docs/design-previews/dictionary-paper-concept-20261113.png 및 같은 이름 .md에 프롬프트 보관. 실제 구현 화면 아님.
- 곡면 코드 최종 타입/전체2929통과17생략/공통5/webpack 빌드 통과. 도구4·quality66은 동일 작업 중 앞서 통과. 빌드와 동시 타입검사로 생긴 .next/types 누락은 빌드 후 재검사 통과.
- 재질 적용·곡면 품질·실기기 확인은 미완료. 운영5ebb887 유지.
