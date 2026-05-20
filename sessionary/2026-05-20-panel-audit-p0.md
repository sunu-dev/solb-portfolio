# 2026-05-20 — 20인 패널 종합 감사 + P0 BLOCKER 18건 즉시 반영

> 사용자 호소: "아직도 잔잔한 오류, 각 뷰·알고리즘·기능·UX·디자인 전체 검증, 출시 전 추가 개선·기능 추가 필요한지 철저히. 전문가 20인 패널 + 크로스 회의."
> 결과: 5분야 × 4인 = 20인 회의 → P0 18건 도출 → 동일 세션에 18건 모두 반영 + 종합 문서 + TODO 박제.

## 작업 요약

### 1) 5 Agent 병렬 패널 회의

`Agent` 도구 5개 동시 호출. 각 Agent는 자기 분야 4인 페르소나 + 7대 질문 + 분야별 파일 hints + 출력 형식(분야 종합 / 7대 질문별 / Top 10 표 / P0·P1·P2 / 의견 불일치 / 크로스 질문)을 받고 합의 보고서 작성.

| 분야 | 4인 패널 |
|---|---|
| 🏛️ 제품·전략 | PM · 포지셔닝 · 비즈니스 모델 · 컴플라이언스 |
| 💻 엔지니어링 | 시스템 아키텍트 · Next.js 16 · 데이터 신뢰성 · 인증·보안 |
| 📊 알고리즘 | Quant · AI/LLM · 시장 데이터 · 알람 정책 |
| 🎨 UX·디자인 | 인터랙션 · 인지·정보구조 · 접근성 · 시각 시스템 |
| 🚀 운영·QA·그로스 | SRE · QA · 그로스 · 마케팅 |

5분야 합의된 P0 18건 + 가장 critical 5건 도출.

### 2) 가장 치명적 발견 Top 5 (분야 단독, 재발견 불가능)

| # | 발견 | 영향 |
|---|---|---|
| 1 | `check-alerts` cron — vercel.json GET vs route POST 미스매치 | 매일 405 → 푸시 알림 100% 누락 |
| 2 | `ai_chok_cache` RLS `for all using (false)` + anon client | 캐시 비기능 → Gemini Free quota D+3 폭발 |
| 3 | `ai_chok_recommendations` INSERT policy 없음 | 백테스트 누적 0건 → chok-followup cron 무의미 |
| 4 | `codes/validate`가 body의 `userId` 신뢰 | 타인 명의 코드·리퍼럴 가로채기 가능 (보안) |
| 5 | `technical.ts` 환각 통계 ("5번 반등 평균 +12%" / "70% 확률로 반등") | 자본시장법 §6 분쟁 시 가장 약한 고리 |

### 3) P0 18건 즉시 반영 (4 Phase)

**Phase 1 — Critical 5건**: check-alerts GET / ai_chok_cache·recommendations admin client / codes/validate token 검증 / 마이그 git 복구

**Phase 2 — 알고리즘·법무 5건**: historicalNote 환각 제거 / "70% 확률" 제거 / 환율 fallback Sentry 캡쳐 / 비-USD/비-KRW 종목 검색 차단 / 종목당 24h 푸시 3개 cap

**Phase 3 — UX 4건**: "SOLB" 잔재 7곳 → JOOBI / "폭풍우" 3곳 → "내 주식, 매일 한 줄로 읽어드려요" / LoginModal·Header 빨강 J → Mossy Teal / OCR 카피 "처리 후 즉시 폐기"

**Phase 4 — 운영·관측성 4건**: alert_log silent fail 제거 + sendCronAlert / notification_log 마이그 + morning-brief 멱등성 가드 / cronAlert 유틸 신설 / 인앱 버그 신고 채널 (bug_reports 마이그 + /api/feedback/report + /help 폼)

### 4) 신규 파일 4건
- `src/lib/cronAlert.ts` — Cron 실패 알림 SSOT (sendCronAlert/sendCronInfo)
- `src/app/api/feedback/report/route.ts` — 인앱 신고 API
- `supabase/migrations/2026-05-20_notification_log.sql` — 푸시 멱등성
- `supabase/migrations/2026-05-20_bug_reports.sql` — 인앱 신고 저장

### 5) 종합 문서
- `docs/BETA_D6_PANEL_AUDIT.md` — 회의 결과 + 반영 + 사용자 액션 Phase A~G + 카나리 페르소나 5종 + P1/P2 + 출시 일자 결정 트리 + KPI 임계 + 모니터링 대시보드

### 6) 검증
- `tsc --noEmit` 통과
- `lint:alerts` 통과
- `npm run build` 성공 + `/api/feedback/report` 라우트 등록 확인

## 결정사항

### 분야 간 합의된 불일치 결정

| 쟁점 | 합의 |
|---|---|
| **출시 일자** | 5/26(월) 권고. 5/22 risk-adjusted 음수 (주말 운영 인력·DNS 24h 여유 부족) |
| **AI 촉 한도** | 1회 유지. 베타 1주차 후 데이터 보고 결정 (트리거: 👎율 >50% OR D1 retention <30%) |
| **카나리 5명 24h** | 5명 유지하되 페르소나 화이트리스트 강제 — Samsung Internet 1 + 카카오 인앱브라우저 1 필수 |
| **"매수 관심" 라벨** | "관찰 후보 (긍정 우세)"로 변경 (P1 SAFE_REPLACEMENTS 매핑) |
| **버그 신고 채널** | 둘 다: 인앱 폼 기본(P0-18 반영) + 카카오 오픈채팅은 community |

### 핵심 운영 원칙 확정
- **Cron 멱등성**: notification_log UNIQUE(user_id, type, sent_date) 패턴. cron retry 중복 차단의 SSOT.
- **RLS 안티패턴**: service-only RLS + anon client는 silent fail로 캐시 무력화. 새 테이블 만들 때 RLS와 client 종류 일치 검증 필수.
- **환각 표현 금지**: 종목별 검증 안 된 통계·확률 표현 노출 금지 ("X번 반등", "Y% 확률" 등). 컴플라이언스 lint에 추가 검토.
- **5분야 패널 회의**: 코드베이스 종합 검증 시 5분야 × 4인 × Agent 병렬 패턴이 효과적. 한 분야 단독 발견이 critical인 경우 다수.

## 미해결 TODO (TODO.md로 흡수됨)

### 🔴 사용자 액션 (D-6 안 필수, Phase A~G)
- [ ] **Phase A**: joobi.kr 결제 완료 + Vercel Add Domain + 가비아 DNS + Resend 가입 + SPF/DKIM TXT
- [ ] **Phase B**: Sentry 가입 + DSN 복사
- [ ] **Phase C**: Vercel env 4종 + Slack webhook env 2종
- [ ] **Phase D**: Supabase SQL Editor에 2건 마이그 적용 (notification_log + bug_reports)
- [ ] **Phase E**: 카카오 콘솔·Supabase Auth Redirect URLs production만 화이트리스트
- [ ] **Phase F**: Slack workspace + 채널 4개 + 카카오 오픈채팅방
- [ ] **Phase G**: Redeploy + Sentry test event + morning-brief 수동 트리거 + /help 신고 폼 검증

### 🔴 카나리 24h 검증 (출시 직전)
- [ ] 페르소나 5명 화이트리스트 통과 (Samsung Internet·카카오 인앱브라우저 필수)
- [ ] 통과 기준 9개 모두 OK → production 승격

### 🟡 P1 (D+7 안) — 핵심 28건은 `docs/BETA_D6_PANEL_AUDIT.md` 7섹션 참조
대표적 항목:
- PRO survey 인앱 popup (KPI #5 측정 시작)
- 첫 AI 촉 wow moment 보강 (보유 종목 직접 연결)
- "매수 관심" → "관찰 후보 (긍정 우세)" SAFE_REPLACEMENTS
- 네이버 Search API fallback
- Supabase 1000-row 페이지네이션
- 14세 게이트 출생연도 입력
- pg_dump GitHub Actions 일별 백업
- "방금 갱신" 배지 + Pull-to-refresh
- EmptyState 일관 적용
- 다크모드 손익 색 AA 5:1 + 좌측 보더
- 한국어 조사 유틸 영문 발음 매핑

### 🟢 P2 (V1.2+) — 진짜 moat
- Phase B-3 세무 비서 (ISA/IRP/연금)
- 양도소득세 시뮬레이션
- Cache Components (`'use cache'`) 시장 탭
- Server Component + Suspense streaming 마이그
- 멘토 시연 영상 5분 (6/30 데드라인)
- Vercel Pro 전환

## 다음 세션 진입점

**최우선**: 사용자가 가비아 joobi.kr 결제 완료 → 트리거 단어("등록했어", "결제 완료", "Phase A 진행") → 7 Phase 순차 진행.

**대안 진입점**: 카나리 24h 검증 결과 보고 후 P1 우선순위 재조정.

**다음 검토 권고**: 카나리 통과 직후 + 출시 D+7 + 출시 D+30

## 후속 인사이트 (각 분야 인용)

### 제품·전략 (PM·포지셔닝)
> events 탭이 첫 5분 funnel에서 빠져 있어 페르소나 27세가 events 탭 존재 자체 모를 가능성 70%. 온보딩 Step 0 가치 카드 3개에 events 추가 권고 (P1).

### 엔지니어링 (시스템·보안)
> ws-token 서버 발급 Finnhub key가 모든 사용자에게 동일 — PRO 단계엔 per-user ephemeral 필요(P2). 베타 50명엔 OK.

### 알고리즘 (Quant·AI/LLM)
> ai_feedback.context에 priorityScore 분해값(z, weight, goalProximity) 미첨부 → A/B 검증 영원 불가. P1 작업으로 격상.

### UX·디자인 (인터랙션·인지)
> PortfolioSection 카드 13종 직렬 스택 → 메인 5장으로 축소. AI 촉이 placeholder CTA로만 있어 약속 가치를 첫 5분에 못 받음. P1 메인 승급.

### 운영·QA (SRE·그로스)
> Sentry DSN 0 + 출시 = 사고 발생 시 사용자 카톡 인입까지 평균 30분~6시간 무지. Phase B 결제 결제와 무관한 작업이므로 즉시 시작 가능.
