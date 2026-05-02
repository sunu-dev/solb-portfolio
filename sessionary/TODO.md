# 미해결 TODO

이 파일은 세션 간 누적되는 미해결 작업 항목입니다.
세션 시작 시 자동 로드되며, 세션 종료 시 갱신합니다.

## 진행 중

(작업 중인 항목)

## 대기 (우선순위 순)

### 🔴 사용자 액션 필요 (이메일 백업 채널 활성화 위해)

- [ ] **Supabase migration 4건 적용** (Supabase 콘솔 SQL Editor)
  - `supabase/migrations/2026-05-02_alert_log.sql` — 알림 송신 로그 (분쟁 증거)
  - `supabase/migrations/2026-05-02_email_subscriptions.sql` — 이메일 모닝브리프 옵트인
  - `supabase/migrations/2026-05-02_email_subscriptions_monthly_d3.sql` — 월말 D-3 옵트인 추가
  - `supabase/migrations/2026-05-02_push_subscriptions_created_at.sql` — 7일 ramp-up 위해
- [ ] **Vercel 환경변수 추가**
  - `RESEND_API_KEY` (resend.com 발급, 무료 월 3천건)
  - `EMAIL_FROM` (예: `"주비 <noreply@solb.kr>"`, 도메인 검증 필요)
  - `EMAIL_UNSUB_SECRET` (선택 — 없으면 CRON_SECRET fallback)

### 일반 대기

- [ ] **🔴 NEXT** `/admin/chok-debug` 배포 후 PER 채움률 확인 → 50% 이하면 F 작업(/candle fallback) 검토 *(지금 바로 가능)*
- [ ] 매수 시뮬 P2 (회의 결과 보류분):
  - 호가 단위 정렬 (가격대별 1원/10원/50원)
  - stale price 배지 (휴장/시간외)
  - 모바일 키보드 가림 sticky 또는 scrollIntoView
  - 엣지 케이스 가드 강화 (`usdKrw=0`, 음수 입력)
- [ ] 포트폴리오 맵 (PortfolioTreemap) 색·비율 사용자 피드백 따라 미세조정 *(사용자 의견 있을 때)*
- [ ] 베타 1개월 후 `ai_chok_recommendations` 백테스트 데이터로 추천 효과성 분석 *(시간 필요)*

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
