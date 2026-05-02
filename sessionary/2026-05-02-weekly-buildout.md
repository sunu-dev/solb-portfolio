# 세셔너리 — 2026-05-02

## 세션 범위
2026-04-26 ~ 2026-05-02 작업 누적.
총 커밋 ~25개, 푸시 완료.

## 오늘 한 일 (요약)

### 1. 월간 챕터 시스템 Phase 1~6 (커밋 b5d0a9f)
- Phase 1: 척추 카드 + P1~P4 신선도 엔진 (`monthlyChapter.ts`, `MonthlyChapter.tsx`)
- Phase 2: Streak + 챔피언 + 주별 씬
- Phase 3: 풀스크린 회고 Wrapped (`MonthlyWrapped.tsx`, 7슬라이드)
- Phase 4: 챕터 책장 (`chapterArchive.ts`, `ChapterShelf.tsx`)
- Phase 5: 챕터 키워드 입력 (`ChapterKeywordPrompt.tsx`)
- Phase 6: D-3 푸시 cron (`api/cron/monthly-d3-reminder`, vercel.json)

### 2. 포트폴리오 맵 — 여러 차례 iteration
사용자가 디자인 거부 → 재설계 사이클 4번:
1. Heatmap 어필 v1 (12 항목, "쉣" 거부) → 원복
2. Heatmap v2 (6 항목, soft 톤) — 원복까진 아니었으나 사용자가 원형 시도 원함
3. Circle Pack (D3 hierarchy.pack, 라이트 + 파스텔 + 도넛 토글) — "촌스러움" 거부
4. Mindmap (옵시디언 그래프 톤, 도트 그리드, 곡선 연결) — 단일 섹터·소수 종목 케이스에서 빈약. 거부
5. **Treemap (현재 active, 토스 톤)** — squarify + 라이트 + vivid 색 + 라디우스 14 + 갭 6 + Pretendard
   - 현재 비율: 4:3 (가로:세로), maxWidth compact 720 / full 960
   - 색: vivid (#FF6B6B ~ #2858E5), 강한 셀(|pct|≥3%)은 흰 텍스트

**보존 컴포넌트** (revert 가능):
- `PortfolioHeatmap.tsx` (다크 Finviz)
- `PortfolioCirclePack.tsx`
- `PortfolioMindmap.tsx`
- 현재 PortfolioSection은 `PortfolioTreemap.tsx`만 import

### 3. AI 촉 알고리즘 옵션 2 (커밋 7384ec3)
3인 회의 결과 Critical/High 항목 모두 처리:
- C1: Finnhub `/stock/metric`으로 PER/52w/1Y 사전 페치 → 프롬프트에 객관 수치 강제 주입 (환각 차단)
- C3: sector 라벨 한/영 통일 (`SECTOR_LABELS_KR`, `CHOK_SECTOR_MAP`)
- H1: 다른 섹터 3개 코드 검증 + 1회 재시도 + 결정론적 폴백
- H2: 캐시 키에 VIX bucket 추가 (regime 변동 시 자동 invalidate)
- H3: `ai_chok_recommendations` 테이블 + 추천 시점 데이터 로깅
- M1: Temperature 0.4 (이전 0.8)
- 컴플라이언스: "AI의 관찰 후보" + "둘러보기" 라벨

### 4. 한국 universe 100 + market movers (커밋 fa43d24)
- `koreanUniverse.ts` 100종 (KOSPI 70 + KOSDAQ 30, 시총 객관 기준)
- `MarketMovers.tsx` + `/api/market-movers` (158 universe, 캐시 10분)
- 종목 탭 하단 "오늘 시장이 주목한 종목" — 한미 + 상승/하락 토글
- 회의 결과 반영: "급등 TOP" ❌ → "주목한 종목" ✓, 매수 버튼 직결 ❌

### 5. 백테스트 cron + 어드민 페이지
- `/api/cron/chok-followup` — 매일 KST 02:30, 30/90일 가격 자동 채움
- `/admin/chok-debug` — 어드민 UI, PER/52w 채움률 + TOP5 상승/하락 + 섹터 분포

### 6. 약관 강화 (커밋 fc71242)
- 제2조: 자본시장법상 유사투자자문업 명시 X
- 제7조: AI 촉 면책 + AI 학습 한계 언급
- 시행일 2026-04-28

### 7. ADMIN_EMAILS 7개 파일 통일 (커밋 895cfaa)
`['soonooya@gmail.com', 'sunu.develop@gmail.com']` 통일.
대상: /admin, /admin/chok-debug, /api/config, /api/admin/api-stats,
      /api/admin/growth, /api/admin/chok-debug, /api/codes/generate

### 8. 메모리 갱신
- `feedback_design_direction.md` — Bloomberg/Finviz 톤 NO, 토스/카카오뱅크풍
- `project_monetization_model.md` — PRO는 도구만 잠금, AI 촉 영구 무료 (유사투자자문업 신고 회피). 유료화 트리거 시 약관 12조 갱신 + 변호사 상담 트리거 명시

## 검증
- `npx tsc --noEmit`: ✅ 0 errors
- `npm run build`: ✅ 통과 (모든 cron route, /admin/chok-debug 페이지 등록)
- 모든 작업 main 브랜치에 푸시됨

## 인계 사항

### 사용자 수동 액션 (이미 완료)
- ✅ SQL migration `ai_chok_recommendations` 테이블 적용 (Supabase 콘솔)

### 다음 세션 시작점
1. **포트폴리오 맵** — 사용자가 트리맵 색·비율 가다듬는 중. 추가 미세조정 가능성 있음
2. **AI 촉 데이터 검증** — `/admin/chok-debug` 결과 보고 PER 채움률 50% 이하면 F 작업(/candle fallback) 검토
3. **벨테스트 30/90일 데이터 누적** — cron이 매일 돌면 추천 효과성 분석 가능 (베타 1개월 후)

### 트리거 발동 시 자동 처리 (메모리에 박힘)
- **유료화/PRO/멤버십** 단어 등장 시:
  - 약관 제12조 "무료" 표현 갱신
  - PRO 설계 가드레일 재확인 (AI 촉 무료 유지 원칙)
  - 변호사 1시간 상담 (30~50만원)
  - 결제 인프라 (토스페이먼츠/포트원)

### 현재 구조 (snapshot)
- 포트폴리오 맵: `PortfolioTreemap.tsx` (4:3, 토스 vivid 톤)
- AI 촉: `route.ts` (옵션 2 — Finnhub 실데이터, 검증, 캐시, 로깅)
- Cron 4개: `morning-brief`, `cleanup-pii`, `monthly-d3-reminder`, `chok-followup`
- 어드민: `/admin`, `/admin/chok-debug`
- Universe: chok 58 (US) + 한국 100 = 158
- 컴플라이언스: 약관 강화 완료, "관찰 후보" 톤, 매수 버튼 직결 ❌
