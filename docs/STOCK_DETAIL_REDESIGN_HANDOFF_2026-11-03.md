> 2026-11-04 후속 운영: **HUE** (`dpl_HUEtrtvPYmb7n5R157vCzgQJWGXd`), 정본 `/private/tmp/joobi-assistant-evidence-20261104`, 롤백 Ez8. 하이쿠 직접 질문의 원문 근거·대화·미차감 검증을 운영에 반영했다. 아래 과거 배포 상태보다 이 기록이 우선한다. 큰 상세 미배포 후보를 공개하기 전 `artifacts/assistant-evidence-20261104/source-manifest.json`의 변경을 보존한다. 실제 Chrome 클릭 검수는 host/native 장애로 여전히 미완료다. 상세 결과는 같은 폴더의 REPORT.md.

# 종목 상세화면 재구성 — 다음 Codex 세션 진입점

## 2026-11-04 최신 운영 및 검수 접근
- 최신 운영은 `dpl_ALDwQyqhvobiKDmW58PnM1GCbaHJ`, 정본 `/private/tmp/joobi-personal-learning-20261104`, 롤백 GCX. 직접 질문·계정별 주식사전·선택 복습을 추가했다. `artifacts/personal-learning-20261104/REPORT.md` 먼저 확인한다. 큰 상세 재구성은 여전히 미배포다.
- 큰 상세 후보에도 학습 기능을 동기화했다. 운영 정본에서 재구성을 이어가거나 큰 후보를 쓸 때 새 기능을 덮어쓰지 않는다.
- Chrome 확장 host는 실패했지만 `cua.getApp('com.google.Chrome')` native 방식으로 게스트 저장/복습을 일부 확인했다. 이후 `Sky Computer Use native pipe startup failed`가 재발했다. 아래 옛 kernel 오류 기록과 현재 검수 범위를 구분한다.

사용자 요청: 새 Codex 세션에서 Chrome을 제어해 실제 상세화면을 보며 재구성한다. 기존 제품 방향을 다시 확정하거나 새 개선 엔진을 만드는 작업이 아니다.

## 후속 작업 상태 — 공통 구조 수정안 구현
- Chrome은 다시 초기화 오류로 실패했다. 실제 클릭·모바일·다크 검수와 운영 반영은 미완료다.
- 수정안은 루트12파일과 `/private/tmp/joobi-detail-redesign-20261103`에 있다. 아래 재구성 가설을 처음부터 다시 만들지 말고 이 후보를 이어 검수한다.
- 미리보기: `http://127.0.0.1:3002/?stock=340810.KQ` (로컬 서버가 계속 실행 중인지 확인).
- 3개 주요 이동, 가격 아래 짧은 소개, 고객/수익 본문 중복 제거, 시세 요청과 회사 읽기 분리, 늦은 로딩에 의한 읽기 위치 초기화 방지를 구현했다.
- 전체2,100개 통과 후 읽기 복귀 보완 관련20개 재검사·타입·선택 ESLint·필수 UI/문구 검사 통과. 실제 화면 검수와 구분한다.
- 최종 후보·검증 범위: `artifacts/detail-redesign-20261103/REPORT.md`, `source-manifest.json`, `verification.json`.
- 이후 차트 해설 기능만 별도로 운영 반영했다. 큰 구조 수정안 후보와 운영 정본을 혼동하지 않는다.

## 추가 반영 — 차트 해설
- **이전 운영은 대기 애니메이션·가격 위치 UI `dpl_GCXr9H41rsC2x4nhcLomAfAe13zT`**, 정본 `/private/tmp/joobi-chart-feedback-20261104`, 롤백Hz. Hz에서UI6파일만 변경: 요청 중 선/봉 애니메이션·짧은 설명, 마지막 가격과 범위 내 위치 표시. API/모델/횟수 변경·추가 실모델 호출 없음. `artifacts/chart-feedback-20261104/REPORT.md`, `production-verification.json`. 아래 여러 관점 해설과 큰 미배포 상세 개편의 상태는 유지한다.
- **이전 운영 — 여러 관점 차트 해설 `dpl_HzQ2CXLAYwT9pvCNCem8jTcuWVKY`**, 정본 `/private/tmp/joobi-chart-studies-20261103`, 롤백7Z. 아래7Z 설명은 이전 단계다. 버튼 채움/아이콘, 계산 가능한 여러 관점 중2~3개 해석, 선택 지표 표시·무료 관점 변경·용어/근거 펼침 반영. 시선AI 실모델 재시험과 로컬2,114개/원격2,111개 통과. `artifacts/chart-studies-20261103/REPORT.md`·`production-verification.json` 확인. 큰3개 메뉴 개편은 여전히 미배포, Chrome 실제 클릭도 미검수.
- 현재 운영 `dpl_7ZrhCSNW2vSBaBWV8QwfdNw8Re46`, 정본 `/private/tmp/joobi-chart-release-20261103`. HeH 정본에서 12파일만 선택 변경했다. 롤백은 HeH.
- 1일 차트 아래 ‘이 차트 쉽게 풀어보기’ → 기존 `/api/ai-analysis`의 `chart-session`. 같은 거래일의 5분 자료를 서버가 다시 받아 AI와 차트에 함께 사용한다. 기존 동의·횟수·비용 조건을 사용하고 자동 모델 호출은 없다.
- 큰 구조 수정안에도 차트 관련 소스와 호출부를 반영했다. 미리보기의 공개 candle 프록시와 AI 서버키 미설정 조건은 그대로이므로 미리보기를 운영 AI 실동작 시험으로 사용하지 않는다.
- 실제 Haiku6회·예상$0.0057557, 로컬 전체2,102개 통과, 원격 빌드 성공. 인증/저장소는 실모델 시험에서 모의 처리했다. Chrome 실제 클릭은 여전히 미검수.
- `artifacts/chart-explanation-20261103/REPORT.md`, `production-verification.json`, `source-manifest.json`.

## 바로 시작하기
1. `docs/JOOBI_EXPLANATION_PRINCIPLES.md`와 `sessionary/TODO.md` 상단을 읽는다.
2. Chrome 제어 연결부터 확인한다. 성공하면 `https://joobi.kr/?stock=340810.KQ`에서 현재 모습·클릭 후 모습·복귀를 직접 살핀다. 컴퓨터 사용은 제공된 CUA 도구를 사용한다.
3. 운영 정본과 루트를 비교한다. 루트에는 이 요청과 관계없는 미배포 변경이 많으므로 전체 배포하지 않는다.
4. 아래 재구성 가설을 실제 화면과 대조해 조정한 뒤 구현한다. 기능·본문·출처·서버 공개 판단·동의/횟수 조건을 보존한다.

## 현재 운영 기준
- 운영 배포: `dpl_GCXr9H41rsC2x4nhcLomAfAe13zT` READY.
- 운영 정본: `/private/tmp/joobi-chart-feedback-20261104` (임시 경로이므로 존재와 운영 일치부터 재확인).
- 직전 롤백 기준: `dpl_HzQ2CXLAYwT9pvCNCem8jTcuWVKY`. 그 이전은7Z→HeH→Cet.
- 증거: `artifacts/claude-haiku-cost-20261103/REPORT.md`, `provider-release-manifest.json`, `production-verification.json`.
- 종목 질문과 기업 설명 처리에 Haiku 5.5 직접 API 반영. 키는 이미 서버 환경변수에 등록했으며 값을 읽거나 출력할 필요가 없다.
- 실모델 시험19회·예상비용$0.020082. 질문 시험은 인증/저장소를 모의 처리했으므로 로그인한 운영 화면의 실제 AI 호출까지 검증한 결과가 아니다.
- 기존30예약, 비용 상한, 사고 보류, 시범 기한, 기업 설명 편집 승인 조건 유지. 화면 재구성을 이유로 변경하지 않는다.

## Chrome 제어 상태
- 이전 세션과 이번 재확인 모두 Chrome 접근 전 다음 오류로 실패:
  `failed to write kernel assets: No such file or directory (os error 2)`.
- 이번에는 문서 재조회 실패 → CUA 런타임 reset → 새 `cua.getState()`도 동일 오류. 새 Codex 채팅 자체가 해결책이라는 보장은 없다.
- 공식 브라우저 안내는 앱 업데이트, 브라우저 재시작, 설정 > Computer Use의 Manage 연결 및 확장 프로그램 프로필 확인, 새 Codex 채팅, 앱 재시작 순의 점검을 제공한다.
- 공식 문서: https://learn.chatgpt.com/docs/chrome-extension#troubleshooting
- 실제 브라우저 클릭·모바일·다크·키보드/복귀는 미검수 상태로 남긴다. HTTP/API·JS 파일 확인을 화면 검수로 표현하지 않는다.

## 소스에서 확인한 재구성 대상
- `AnalysisNavigation.tsx`: 차트, 거래일 브리핑, 회사/종목 이해, 가격·거래량, 주비 노트, 자료·비교, 배우기, 내 투자까지 최대8개 이동 항목. 현재는 긴 화면 내 이동이므로 독립 탭이라고 오해하지 않는다.
- `StockCompanyOverview.tsx`: 수익 구조가 첫 소개 뒤에 나오고 펼친 ‘어떻게 돈을 버나요?’에서도 반복된다.
- ‘주비 노트’·‘자료·비교’·‘배우기’의 역할과 회사 질문/산업 탐색/AI 질문 사이 구분이 초보자에게 명확한지 실제 흐름으로 확인한다.
- 이전 작업에서 일반 산업 그림과 중복 안내는 이미 줄였다. 과거 캡처의 문제를 현재 문제로 단정하지 않는다.

## 재구성 가설 — 실제 화면 확인 후 구현

첫 화면은 회사명·가격·자료 시점, 회사/상품의 한 문장 설명, 중요한 최신 내용 순으로 읽히게 한다. 미확인 주가 원인이나 과거 사업 자료를 오늘의 사건처럼 만들지 않는다.

주요 이동은 ‘지금 상황 / 회사 이해(ETF는 상품 이해) / 내 투자’의 세 흐름으로 묶는 방향을 검토한다. 차트·브리핑·자료·용어·질문은 관련 흐름 안에서 접근하게 하며, 메뉴 개수를 줄이기 위해 기능을 없애지는 않는다.

```text
회사명 · 종목 구분                  가격 · 기준 시각
무엇을 하는 회사/상품인지 한 문장

지금 상황         회사/상품 이해         내 투자

선택한 내용의 핵심
  → 필요한 차트·근거·실제 제품과 쓰임
  → 그 내용을 읽고 생길 법한 질문과 답
  → 모르는 용어의 뜻·예시·원문
```

- 회사 이해: 실제 제품과 생활 속 쓰임 → 누가 왜 돈을 내는지 → 매출과 이익에서 볼 점. 같은 수익 설명을 두 번 노출하지 않는다.
- 상품 이해: ETF·지수 뜻 → 투자 대상 → 하루 목표/손실 예시 → 여러 날 보유 시 차이. 기업 실적 설명으로 바꾸지 않는다.
- 차트: 크기·기간 선택·현재/마지막 자료 시점과 최저/최고 범위의 역할을 나눈다. 선의5분 마지막 가격과 구간 내 고저의 차이를 보존한다.
- 질문: 질문→실제 답→도움 되는 다음 질문으로 이어지게 한다. 공통 질문 반복, 격언, 억지 비유로 분량을 늘리지 않는다.
- 용어: 바로 뜻과 예시를 보고 닫으면 원래 문장·스크롤·초점으로 돌아온다.
- 내 투자: 등록한 전체/증권사별 기록을 읽기 쉽게 제공한다. 누락 시세·매수가·환율을0으로 채우거나 부분 합계를 전체처럼 표시하지 않는다. 개인 기록을 AI에 전송하지 않는 기존 경계를 지킨다.
- 시각 방향: 기존 글꼴·중립색/배경·절제된 구분선을 사용하고 읽기 폭과 여백을 정리한다. 같은 둥근 카드·큰 일반 그림·의미 없는 번호·강한 보조 버튼 테두리를 반복하지 않는다.

## 이어 볼 코드
- 상세 조립·상태/질문·복귀: `src/components/analysis/AnalysisPanel.tsx`, `AnalysisPanel.module.css`.
- 상세 이동: `src/components/analysis/AnalysisNavigation.tsx`, `AnalysisNavigation.module.css`.
- 회사 본문: `src/components/analysis/StockCompanyOverview.tsx`, `StockCompanyOverview.module.css`.
- 질문: `src/components/analysis/StockAnalysisQuestions.tsx`, `src/config/stockQuestions.ts`.
- 자료/산업: `src/components/analysis/StockDetailResources.tsx`, `src/components/explore/`.
- ETF 설명: `src/components/explore/FundExploration.tsx`, `src/lib/fundExploration.ts`, `src/lib/fundLearning.ts`.
- 용어: `src/components/common/FinancialText.tsx` 및 용어 모달.
- 공개 사업 자료: `src/lib/companyBusiness/delivery.ts`, `src/lib/companyAnalysisContext.ts`.
- 회사 자료: `src/lib/companyStories.ts`, `src/app/api/company-profile/route.ts`.

## 실제 확인할 범위
- 시선AI: SEEU ON/ID → 알체라·피앤피시큐어 비교 → 근거 링크 → 이전 위치 복귀.
- SOXL: ETF·기초지수·NYSE 뜻 → 하루±1% 예시 → 여러 날 수익률 차이 → 복귀.
- CARG: 기존 운영 설명·근거·버전 유지, 새 모델 시험 초안으로 바꾸지 않기.
- 자료가 없는 회사: 업종으로 사업을 만들어내지 않기, 오류/보류/없음 구분.
- 데스크톱·좁은 모바일·다크, 키보드, 검색/보유 목록 두 진입 경로, 펼침과 화면 넓게/닫기, 다른 회사 탐색 후 복귀.
- AI 질문은 로그인·성인 동의·남은 횟수·실제 사업 자료·출처 링크와 답 본문을 함께 확인한다.

## 완료 판단
선택한 공통 구조가 여러 종목에 적용되고, 실제 화면에서 내용을 이해할 수 있으며, 질문/용어/자료를 보고 제자리로 돌아오는 것을 확인한다. 스크린샷 한 장·테스트 개수·UI 재배치만으로 초보자 사용성이 개선됐다고 보고하지 않는다.
