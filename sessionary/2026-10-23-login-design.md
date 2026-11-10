# 2026-10-23 - 로그인 화면 디자인과 주식 공부 손그림

## 작업 요약
- 기존 460px 세로형 로그인 모달을 데스크톱 2열 구성과 모바일 단일 열로 재구성했다. 제품 소개, 연령 확인, 필수 동의, 카카오 버튼의 흐름을 정리했다.
- 노트 손그림 안에 `주가·실적·뉴스` 메모와 혼합 캔들 차트를 넣은 새 투명 PNG를 만들고 로그인에 연결했다. 생성은 built-in image_gen 편집 모드를 사용했다. 원본 손그림은 유지하고 새 파일로 저장했다.
- 로그인 조건과 개인정보 처리 로직은 유지했다. 초대 코드 안내의 중복 둘러보기 버튼만 제거하고 하단의 게스트 진입은 유지했다.
- 로컬 Chrome 데스크톱·390px·320px·다크 모드 확인. 390px에서 카카오 버튼 표시, 320px에서 내부 스크롤·가로 넘침 없음. 실제 약관 동의·OAuth는 실행하지 않았다.
- 운영 중인 소스에서 로그인 TSX/CSS와 새 PNG만 반영한 `/private/tmp/joobi-login-design-20261023` 격리본으로 전체 빌드 통과: 1700 tests + 1 skipped, UI·알림·한국어·다크 모드·투어 검사, TypeScript, Next 빌드. 기존 `ai-chok` 고아 tour anchor는 경고로 남았다.
- Vercel 보호된 미리보기 `dpl_9r5LDMcSv8xHJSLv3KUcxfrPwD4z` READY: https://solb-portfolio-ljortlntf-sunudevelop-1252s-projects.vercel.app. 인증된 `vercel curl`로 `/`와 새 PNG HTTP 200을 확인했다. 브라우저는 Vercel 로그인 화면으로 이동하므로 미리보기 브라우저 육안 검사는 로컬 화면으로 대신했다. 운영 배포는 하지 않았다.

## 결정사항
- 첫 화면에는 주식비서의 가치를 한 줄로 보여주고, 손그림으로 주식 공부라는 맥락을 보탠다. 차트는 실제 수익률·전망처럼 보이지 않도록 숫자·티커·상승 화살표를 뺐다.
- 생년월일 계산과 필수 약관 동의, 초대 코드 판정은 그대로 둔다. 법적 동의나 실제 OAuth 테스트를 사용자 대신 실행하지 않는다.
- 이번 요청에는 운영 배포 지시가 없어 검증 가능한 미리보기까지만 만들었다. 다른 대량 변경이 남은 root 전체를 배포하지 않는다.

## 미해결 TODO
- [ ] 사용자가 디자인을 확인한 뒤 이 세 파일만 운영에 반영할지 결정한다.
- [ ] 실제 Kakao OAuth·약관 동의 과정은 사용자 참여 검수가 필요하다.

## 다음 세션 진입점
- 로컬 변경: `src/components/auth/LoginModal.tsx`, `LoginModal.module.css`, `public/illustrations/home/portfolio-study-handdrawn-v1.png`.
- 운영 기준과 로그인 선별본: `/private/tmp/joobi-login-design-20261023`. 기존 운영은 `dpl_BYVTsjoZkePQ7cqPZhRvgY87Sg5L`이다.
- 새 PNG final imagegen prompt: preserve notebook/pencil composition and exact Korean `주가`, `실적`, `뉴스`; remove upward arrow and neon glow; mixed simple candlesticks with subtle mustard accents; transparent background, no numbers/tickers/logos.
