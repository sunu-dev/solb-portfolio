# 미해결 TODO

이 파일은 세션 간 누적되는 미해결 작업 항목입니다.
세션 시작 시 자동 로드되며, 세션 종료 시 갱신합니다.

## 진행 중

(작업 중인 항목)

## 대기 (우선순위 순)

### 🔴 사용자 액션 필요 (이메일 백업 채널 활성화 위해)

- [ ] **Supabase migration 6건 남음** (Supabase 콘솔 SQL Editor)
  - `supabase/migrations/2026-05-02_alert_log.sql` — 알림 송신 로그 (분쟁 증거)
  - `supabase/migrations/2026-05-02_email_subscriptions.sql` — 이메일 모닝브리프 옵트인
  - `supabase/migrations/2026-05-02_email_subscriptions_monthly_d3.sql` — 월말 D-3 옵트인 추가
  - `supabase/migrations/2026-05-02_push_subscriptions_created_at.sql` — 7일 ramp-up 위해
  - `supabase/migrations/2026-05-10_ai_chok_cache.sql` — **AI 촉 호출 정책 변경 (P0)**: excluded_recent + created_at 컬럼. 미적용 시 fetch intent에서 폴백만 노출됨 (기능은 동작, 다양성/스테일 lookup만 제한)
  - [x] ~~`supabase/migrations/2026-05-12_stock_listings.sql`~~ — **적용 완료 (2026-05-13)** — stock_listings 테이블 + 상태 머신 + 인덱스 + last_seen 트리거. cron 수동 트리거 또는 다음 UTC 00:00 대기로 데이터 채움.
  - `supabase/migrations/2026-05-13_ai_feedback.sql` — **사용자 피드백 1탭 (Phase 1 P0-3)**: 👍/👎 + comment 수집. ALGORITHM_REVIEW.md §5 보강. 미적용 시 AI 촉 카드 피드백 버튼이 silent fail.
  - [x] ~~`supabase/migrations/2026-05-12_user_profiles_tier.sql`~~ — **적용 완료 (2026-05-12)** — profiles 테이블 + auto-create trigger + 기존 사용자 백필. PRO 승급 시 `UPDATE profiles SET tier='pro' WHERE id=X`.
- [ ] **Vercel 환경변수 추가**
  - `RESEND_API_KEY` (resend.com 발급, 무료 월 3천건)
  - `EMAIL_FROM` (예: `"주비 <noreply@solb.kr>"`, 도메인 검증 필요)
  - `EMAIL_UNSUB_SECRET` (선택 — 없으면 CRON_SECRET fallback)
  - (선택) `CHOK_DAILY_FREE=1` `CHOK_DAILY_PRO=30` `ANALYSIS_DAILY_FREE=3` `ANALYSIS_DAILY_PRO=30` — 미설정 시 코드 기본값 동일

### 일반 대기

- [x] ~~stock_listings 마이그레이션 + cron 첫 트리거~~ — **완료 (2026-05-13)**. US 24,400건 수집, KS/KQ는 별도 우회.
- [x] ~~Phase 1 P0-6 KPI funnel 위젯~~ — **완료 (2026-05-13)**. /admin 성장 탭에 onboarding/tour/feedback funnel 위젯 + AI 만족도 표시.
- [x] ~~Phase 1 P0-7 Universe 3중 AND 자동 검증~~ — **완료 (2026-05-13)**. enrich-listings에서 자동 'eligible' 승급.
- [x] ~~Phase 1 P0-9 KRX 한국 종목 우회~~ — **완료 (2026-05-13)**. /api/search 자동 등록.
- [x] ~~Phase 2 P1-3 챕터 시즌제 강화~~ — **완료 (2026-05-13)**. D-7 카운트다운 + 회고 자연어 자동 생성.
- [x] ~~Phase B-1 broker 필드~~ — **완료 (2026-05-13)**. 한국 증권사 15개 + OCR 자동 추정 + BrokerSummaryCard.
- [x] ~~Phase B-2 필터·챕터 통합~~ — **완료 (2026-05-13)**. 클릭 필터 + brokerChampions 라인.
- [x] ~~Phase B-4 마케팅 카피~~ — **완료 (2026-05-13)**. /help + /landing 보강.
- [ ] **🟡 (후속) KRX/OpenDART 한국 신규 상장 자동 fetch cron** — admin 수동/search 자동 등록은 임시. 월 10건 이하라 운영 가능하나 완전 자동화는 후속.
- [ ] **🟡 enrich-listings cron 1주일 모니터링** — `SELECT count(*) FROM stock_listings WHERE market_cap IS NOT NULL;` 진행률 확인. 일별 40건이라 시총 큰 종목 25일 안 완료 예상.
- [ ] **🟡 코치마크 모바일 보텀시트 패턴** — 베타 사용자 피드백 보고 결정.
- [ ] **🟡 docs/UNIVERSE_INCLUSION_CRITERIA.md** 작성 — 법무 리스크 회피용 외부 문서 (코드는 이미 enrich-listings에 구현됨).
- [ ] **🟡 ai-analysis 신규 IPO 안내** — 6개월 이내 IPO 종목 분석 시 "데이터 부족" 안내. stock_listings 데이터 누적 후.
- [ ] **🔴 NEXT** 베타 1주일 후 `/admin` 성장 탭 funnel 데이터 확인 — D1/D7 retention + AI 만족도 + 온보딩 이탈률.
- [ ] **🔴** `/admin/chok-debug` 배포 후 PER 채움률 확인 → 50% 이하면 F 작업(/candle fallback) 검토.
- [ ] **🟡 멘토 6명 시연 영상 (5분)** — 외부 제작. NVDA 종목 6명 분석 비교. 마케팅 핵심 자산.
- [ ] **🟡 PRO 결제 페이지 UI 시안** — 토스페이먼츠 등록 전 UI만 먼저. 1일.
- [ ] **🟡 PRO 결제 인프라 (토스페이먼츠)** — 사용자 계정 등록 후. 베타 100명+ 시점.
- [ ] **🟡 Phase B-3 계좌 종류 + 세무 비서** — ISA/IRP/연금. 진짜 moat. 베타 500명 후.
- [ ] **🟡 Affiliate 계좌 개설 보상** — 증권사 1~3개 제휴.
- [ ] 매수 시뮬 P2 (회의 결과 보류분):
  - 호가 단위 정렬 (가격대별 1원/10원/50원)
  - stale price 배지 (휴장/시간외)
  - 모바일 키보드 가림 sticky 또는 scrollIntoView
  - 엣지 케이스 가드 강화 (`usdKrw=0`, 음수 입력)
- [ ] 포트폴리오 맵 (PortfolioTreemap) 색·비율 사용자 피드백 따라 미세조정.
- [ ] 베타 1개월 후 `ai_chok_recommendations` 백테스트 데이터로 추천 효과성 분석.

### 알림 Phase 5 (보류)

- [ ] 푸시 송신 실패 시 자동 이메일 retry (현재 두 채널 독립)
- [ ] 카카오 알림톡 / SMS (비용 발생 → 매출 단계 검토)
- [ ] GitHub Actions CI에 `npm run lint:alerts` 통합 (현재는 prebuild 로컬만)

## 차단됨

(외부 요인으로 막힌 항목 — 차단 사유 함께 기록)

## 트리거 대기 (조건 충족 시 자동 발동 — auto-memory에 박힘)

- **유료화/PRO/멤버십 단어 등장 시:**
  - 약관 제12조 "무료" 표현 갱신
  - PRO 설계 가드레일 재확인 (AI 촉 무료 유지 원칙)
  - 변호사 1시간 상담 (30~50만원)
  - 결제 인프라 (토스페이먼츠/포트원)
- **사용자 손실 클레임 / 금감원 시정조치:** 즉시 변호사
- **광고 매출 연 5천만+:** 회색 지대 진입, 변호사 검토
