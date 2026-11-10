/** Design guidance and review inventory. Colors and control sizes stay in shared CSS. */
export const designNavigation = [
  ['direction', '주비다운 화면'], ['identity', '브랜드와 로고'], ['foundations', '색과 글자'],
  ['illustrations', '손그림'], ['rules', '화면·말투·움직임'], ['components', '동작과 상태'],
  ['detail', '실제 상세 화면'], ['review', '접근성·점검'], ['coverage', '적용 현황'],
] as const;

export const brandRules = [
  ['차분한', '큰 수익을 약속하거나 긴급함을 꾸미지 않아요. 중요한 숫자와 사실부터 읽혀요.'],
  ['다정한', '처음 보는 용어도 쉬운 말로 풀어요. 손그림은 이해를 돕는 자리에만 놓아요.'],
  ['연결하는', '사건에서 기업으로, 기업에서 내 투자로. 다음 질문과 돌아오는 길을 함께 제공해요.'],
] as const;

export const layoutRules = [
  ['위계와 여백', '관련 내용은 8–12px, 묶음은 16–24px, 읽기 장은 32–40px 간격을 기준으로 해요. 큰 여백만 반복해 중요도를 만들지 않아요.'],
  ['한 화면의 강조', '페이지의 주요 시작 동작에 옐로를 써요. 자료·출처·보조 탐색까지 모두 색 상자로 만들지 않아요.'],
  ['좁은 화면', '320·390px에서 줄바꿈과 클릭 영역을 확인해요. 읽기 글자를 줄여 억지로 넣지 않고, 메뉴·자료 목록은 배치를 바꿔요.'],
  ['숫자와 단위', '가격은 숫자를 맞춰 읽고 원화·달러·%·%p를 구분해요. +·− 기호와 문구를 함께 써 색에만 의존하지 않아요.'],
  ['아이콘과 그림', '동작 아이콘은 현재 Lucide 선 아이콘을 재사용해요. 기업 로고·설명 그림·장식 아이콘의 역할을 섞지 않아요.'],
  ['움직임', '일반 동작은 150–180ms의 짧은 반응을 사용해요. 설명 그림의 단발 재생·기존 로고 모션은 별도 역할이며, 움직임 줄이기를 지원해요.'],
  ['차트와 표', '축·통화·단위·비교 기간·기준 시각을 함께 보여줘요. 가격과 수익률, 장중과 마감, 실제 값과 가상 예시를 구분하고 색에는 범례를 붙여요.'],
  ['오류와 취소', '문제와 다음 동작을 같은 자리에서 알려줘요. 재시도·닫기·삭제 취소 뒤에는 읽던 위치와 초점을 복원하고, 오류를 성공처럼 표시하지 않아요.'],
] as const;

export const writingRules = [
  { subject:'자료가 없을 때', use:'확인된 새 기사가 아직 없어요. 제공된 자료 범위를 함께 확인해 주세요.', avoid:'소식이 없어요. 특별한 일이 없어요.' },
  { subject:'가격과 원인', use:'주가가 내려갔어요. 관련 발표와 회사 자료를 함께 살펴봐요.', avoid:'이 뉴스 때문에 떨어졌어요. 지금이 매수 기회예요.' },
  { subject:'AI와 일반 개념', use:'AI 답변은 로그인 후 질문해요. 개념 설명은 바로 읽을 수 있어요.', avoid:'버튼 하나에 무료 설명과 AI 답변을 같은 동작으로 숨기기' },
  { subject:'다음에 할 일', use:'질문을 골라보세요 · 금액으로 미리 계산하기 · 원문 보기', avoid:'모호한 더 보기 · 확인 · 시작 버튼의 반복' },
] as const;

export const reviewChecklist = [
  { id:'hierarchy', group:'읽기', title:'사실 → 의미 → 다음 확인이 읽히나요?', detail:'제목·설명·출처를 같은 강조로 반복하지 않고 빈 자료와 확인된 결과를 구분해요.' },
  { id:'identity', group:'브랜드', title:'로고·색·그림이 각자의 역할을 지키나요?', detail:'붉은 로고, 중립 본문, 옐로 시작, 크림색 해설, 상승·하락 의미 색을 구분해요.' },
  { id:'states', group:'상태', title:'확인 중·오류·빈 자료·지연을 구분했나요?', detail:'실패했을 때 마지막 자료와 재시도 경로를 확인하고 로그인·횟수 제한도 살펴봐요.' },
  { id:'keyboard', group:'접근성', title:'키보드와 초점 복귀가 동작하나요?', detail:'Tab·Enter·Space·닫기 후 원래 동작으로 복귀, 읽기 순서와 접근 가능한 이름을 확인해요.' },
  { id:'viewport', group:'반응형', title:'320·390·1440px와 큰 글자를 확인했나요?', detail:'가로 넘침, 긴 회사명, 큰 수치, 메뉴, 기기 키보드가 열린 상태를 함께 봐요.' },
  { id:'theme', group:'테마', title:'두 테마에서 글자·아이콘·그림이 보이나요?', detail:'실제 글자/바탕 대비, 기업 로고의 흰 종이, 손그림의 선과 버튼 상태를 확인해요.' },
  { id:'motion', group:'움직임', title:'움직임을 줄여도 의미와 동작이 남나요?', detail:'애니메이션이 유일한 설명이 되지 않도록 하고 재생 중·정지 상태를 확인해요.' },
  { id:'privacy', group:'기록', title:'저장·로그인·삭제 범위를 알 수 있나요?', detail:'브라우저 저장과 클라우드 저장을 구분하고 취소·로그아웃·계정 전환을 확인해요.' },
] as const;

export const coverage = [
  { area:'홈·내 투자', status:'공통 적용', detail:'공통 프레임, 평가금액 우선, 손그림4종과 기업 로고를 운영에 반영했어요.', source:'Navigation / AppFrame / Dashboard / PortfolioEmptyState' },
  { area:'종목 상세', status:'공통 적용', detail:'최근 소식·자료·질문·계산 영역에 공통 기준을 적용했어요. 기존 산업 그림97종의 스타일은 별도 검토 대상이에요.', source:'AnalysisPanel / StockAnalysisQuestions / StockLearning' },
  { area:'리포트·시장 소식', status:'공통 적용', detail:'제목과 기록 조회를 공통화했어요. 일부 원천 누락·지연은 계속 표시해요.', source:'InsightsSection / MarketWatchSection' },
  { area:'설정·계정', status:'공통 적용', detail:'컨트롤과 제목 기준, 계정 삭제 위치를 적용했어요. 실제 계정 확인창 취소는 후속 검수예요.', source:'SettingsPanel / UserMenu' },
  { area:'로그인·온보딩·가져오기', status:'추가 검수', detail:'공통 컨트롤 기준은 있어요. 실제 OAuth·키보드·긴 오류·두 기기 흐름은 별도로 확인해요.', source:'AppUI / 온보딩·CSV 가져오기 화면' },
  { area:'도움말·관리자·법적 안내', status:'추가 검수', detail:'공통 읽기·컨트롤 기준과 기존 개별 스타일이 함께 있어요. 전체 화면 시각 검수는 남아 있어요.', source:'ReadingUI / help / admin / 법적 안내' },
  { area:'실제 모바일 기기', status:'추가 검수', detail:'Chrome 크기 검수와 구분해 iPhone Safari/PWA·삼성 브라우저·큰 글자·OS 움직임 줄이기를 확인해요.', source:'실기 검수 기록 / sessionary/TODO.md' },
] as const;
