# 2026-05-13 — 종합 컨설팅 + Phase 1·2 + Broker Feature

> 같은 날 `2026-05-13-listings-cron-fix.md` 이후의 큰 작업 묶음.

## 작업 요약

사용자 ultrathink 요청 — **알고리즘 정당성 9인 리뷰** + **시장성·수익성 9인 토론** + Phase 1 P0 8건 + Phase 2 P1-3 (챕터 강화) + **증권사별 관리 9인 회의** + Phase B-1/B-2/B-4 구현. 

총 8 커밋, 매우 큰 세션. 문서 7건 신규 / 코드 라우트·컴포넌트 다수.

### A. 종합 컨설팅 9인 회의 2회 + 문서 4건 (커밋 cc59722)

**회의 1 — 알고리즘 정당성** (9인: 데이터엔지·퀀트·ML·금융·아키텍트·법무·UX·통계·보안):
- 17개 알고리즘 인벤토리 추출 (Agent로 코드 분석)
- 11개에서 모호함 발견 (임계값 임의 설정, 백테스트 없음)
- **결정적 결함 3개**: Universe 편입 기준 코드 미구현, AI 응답 컴플라이언스 후처리 부재, 건강 점수 액션 제안 부재

**회의 2 — 시장성·수익성** (9인: VC·그로스·CPO·비즈·경쟁자·페르소나×2·카피·BI):
- 차별점: 자본시장법 회피 + AI 통합 균형 (경쟁자 못 따라옴)
- 약점: 단위 경제 증명 0, KPI 측정 인프라 부재, Aha moment 보장 약함
- **합의 슬로건 후보 3종** (시간+가치 / 포지셔닝 / 차별+빈도)
- **PRO 가격 ₩4,900/월** 합의 (한국 결제 willingness $3~7)
- **포지셔닝**: "거래는 토스, 학습은 주비"

**문서 4건 신규**:
- `docs/ALGORITHM_REVIEW.md` — 회의 1 + 누락 알고리즘 정립 제안
- `docs/BUSINESS_REVIEW.md` — 회의 2 + 매출 시나리오 + 마케팅 자산
- `docs/THRESHOLDS.md` — 51개 임계값 SSOT (✅표준/🎯경험/🤷임의 라벨 + 재검증 우선순위)
- `docs/ROADMAP.md` — Phase 1/2/3 + KPI + 트리거 대기

### B. Phase 1 P0 5건 즉시 구현 (같은 커밋)

1. **sanitizeAiObject()** — AI 응답 후처리. FORBIDDEN_PHRASES 19개 자동 교체. ai-analysis + ai-chok 통합
2. **recommendNextAction()** — 건강 점수 약점 축 액션 1개 추천. PortfolioHealth 강조 카드
3. **POST /api/ai-feedback + ai_feedback 테이블** — 👍/👎 1탭. AiChokSection 통합
4. **Today30sCard** — 모닝브리프+챕터+CTA 통합. PortfolioSection 상단 마운트
5. **THRESHOLDS.md** — 임계값 SSOT (위)

### C. Phase 1 P0-6,7,9 (커밋 ef09d6b)

**P0-7 — Universe 3중 AND 자동 검증** (결정적 결함 #1 해결):
- enrich-listings cron 안에서 `market_cap >= $5B AND 상장 12개월+ AND 데이터 정상` 자동 `status='eligible'` 승급
- 응답에 `autoEligible` 카운트 추가

**P0-6 — KPI funnel 위젯** (/admin 성장 탭):
- `/api/admin/growth` 응답에 onboardingFunnel / tourFunnel / helpOpened / feedbackBySource 집계
- `GrowthPanel` 3섹션 위젯 + AI 만족도 위젯 (70%+ 녹색 / 50% 미만 빨강)
- `FunnelRow` 컴포넌트 신규

**P0-9 — KRX 한국 종목 우회**:
- `/api/search` 안에서 .KS/.KQ 종목 자동 `stock_listings` 등록 (status='watch')
- 사용자 검색 → 자연스러운 한국 universe 누적

### D. Phase 2 P1-3 챕터 시즌제 강화 (커밋 b183bf1)

- `ChapterTime.isFinalWeek` (daysRemaining ≤ 7) 필드 추가
- `buildChapterRecap(stats, time)` — 자연어 회고 생성 (Spotify Wrapped 스타일)
- D-카운트다운 시각 강조: 7일 이내 파랑, 3일 이내 주황 + pulse, 당일 🎬 빨강
- 회고 미리보기 카드 자동 노출 (isFinalWeek 시)

### E. Broker Feature 9인 회의 + Phase B-1/B-2/B-4 (커밋 1659b70, 78ba257)

**9인 회의 합의 — "비서답게 활용" 컨셉**:
- 자동 동기화 시늉 X, 수동 입력 + OCR 보강
- 점진 노출 (단일 broker 사용자 UI 변화 0)
- 진짜 moat = 세무 비서 (Phase B-3, 토스도 못 함)

**Phase B-1**:
- `Broker` enum **한국 증권사 15개 + 기타** (toss·kiwoom·mirae·kis·samsung·nh·kb·shinhan·meritz·hana·daishin·yuanta·sk·eugene·kakaopay·other)
- `StockItem.broker?: Broker` (jsonb 호환, 마이그레이션 0건)
- EditStockModal 드롭다운 (선택, 기본 미지정)
- `BrokerSummaryCard` — 점진 노출 (broker ≥ 2 발견 시만 렌더)
- OCR brokerKey 자동 추정 + 화이트리스트 검증

**Phase B-2**:
- BrokerSummaryCard 클릭 가능한 칩 (active/onSelect props)
- PortfolioSection `brokerFilter` state + displayList 필터링
- `ChapterStats.brokerChampions` — 2개 이상 broker 발견 시 산출
- 회고에 `🏦 증권사별: 토스 NVDA +X% · 키움 AAPL +Y%` 라인

**Phase B-4**:
- /help 페이지 "🏦 증권사 통합" 섹션 (5 Q&A)
- /landing 페이지 broker 어필 1줄 + Feature list 항목 추가

**문서**:
- `docs/BROKER_FEATURE.md` — 9인 회의 전문 + Phase B 구현 계획
- `docs/NEXT_ACTIONS.md` — 통합 우선순위 (즉시·사용자 액션·Phase 2/3·트리거)

## 결정사항

### 알고리즘 정당성 — 결정적 결함 3개 모두 해결
- Universe 자동 검증 → P0-7 (enrich-listings)
- AI 응답 후처리 → P0-2 (sanitizeAiObject)
- 건강 점수 액션 → P0-4 (recommendNextAction)

### 컨셉 정립 — "거래는 토스, 학습은 주비"
- 거래 기능 절대 추가 안 함
- 멘토·건강점수·챕터 = 감정적 차별점 (토스가 따라잡기 어려운 영역)
- Broker 통합도 같은 컨셉 — 자동 동기화 시늉 X, 비서 톤 코칭

### 한국 증권사 15개 결정
사용자 피드백: 미국 증권사 제거 + 상위 15개 (한국투자·메리츠·대신·유안타·SK·유진·카카오페이 추가). 토스 + 키움 + 미래에셋 + 한국투자 + 삼성 + NH + KB + 신한 + 메리츠 + 하나 + 대신 + 유안타 + SK + 유진 + 카카오페이 + 기타 = 16개 옵션.

### Phase B-3 (세무 비서) 보류
ISA/IRP/연금 계좌 종류. 세무 검토 필요 + 베타 500명 후. 진짜 moat이지만 지금은 일러요.

## 미해결 TODO

- 🔴 **마이그레이션 5건 미적용** (alert_log·email_subscriptions×2·push_subscriptions_created_at·ai_feedback). 이메일 백업 채널·피드백 수집 위해.
- 🟡 PRO 결제 인프라 (토스페이먼츠 + Vercel Pro 전환)
- 🟡 Affiliate 계좌 개설 보상 (증권사 제휴)
- 🟡 멘토 6명 시연 영상 5분 (외부 제작)
- 🟡 Phase B-3 세무 비서 (베타 500명 후)
- 🟡 사용자 추천 효과 백테스트 (ai_chok_recommendations 6개월 데이터 후)

### F. Broker Merge — Phase M-1~M-3 (커밋 fd27062, 7 files / +549 / −2)

11인 회의 (PM·UX·아키텍트·금융·페르소나×3·성능·법무·그로스·세무) 합의:
**"흩어진 같은 종목을 비서가 합쳐서 진짜 평단가 보여주는 도구. 세금까지 챙겨주는 한국 유일."**

**Phase M-1 — 데이터 모델 + selector**:
- portfolioStore.addStock: (symbol, broker) 페어 중복 제어 (같은 broker 차단, 다른 broker 허용)
- utils/mergedHoldings.ts: mergeHoldings() selector
  - USD/KRW 가중평균 평단가
  - 환율 가중평균 (purchaseRate 있는 lot만)
  - lots 보존 (편집·세금 시뮬용)
  - inferDefaultViewMode() 자동 추론
- SearchBar.handleAdd: 미지정 broker 같은 종목만 차단, 다른 broker 있으면 confirm 모달

**Phase M-2 — MergedHoldingsCard 통합 뷰**:
- 자동 노출 (hasMultipleBrokers ≥ 1개 발견 시)
- 단일 broker 사용자 → UI 변화 0
- 통합 row + broker별 lots accordion
- 디스클레이머: "주비 계산값, 증권사 표시와 다를 수 있어요"

**Phase M-3 — 통합 자산 헤더**:
- BrokerSummaryCard 상단 "💎 통합 자산 ₩X.XM (+5.2%)" 한 줄

**Phase M-4 보류** (세금 비서, 매도 순서 최적화, ISA/IRP):
- 진짜 moat (토스도 못 함)
- 베타 500명 후 + 세무 검토 + 변호사 자문 필수

**문서**: docs/BROKER_MERGE_FEATURE.md — 11인 회의 전문 + 4-Phase 로드맵 + 데이터 모델

## 다음 세션 진입점

`docs/NEXT_ACTIONS.md` 의 권장 진행 순서 3개 옵션:
1. **즉시 가성비** — PRO 결제 페이지 UI 시안 + 랜딩 추가 보강
2. **수익화** — 토스페이먼츠 계정 등록 후 결제 인프라
3. **데이터 검증** — 베타 100명 모집 후 funnel 데이터 누적

또는 사용자 새 방향.

## 메모리 승급 자문

이번 세션에서 다룬 영속적 룰·전략 중 승급 후보:

1. **시장 전략 SSOT** — "거래는 토스, 학습은 주비" 포지셔닝, PRO ₩4,900, 단위 경제 계산, 차별점 3축
2. **Broker Strategy SSOT** — "비서답게 활용" 컨셉, 점진 노출 원칙, 세무 비서가 진짜 moat
3. **Vercel Hobby 한계** — `reference_external.md` 업데이트 (cron 일별 1회, 시간당 금지)
4. **알고리즘 정당성 결과** — 17개 인벤토리 + 결정적 결함 3개 해결 기록

사용자 동의 시 승급 진행.
