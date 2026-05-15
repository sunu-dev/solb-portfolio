# 베타 출시 9인 패널 리뷰 (2026-05-15)

> 베타 D-7(2026-05-22 가정) 무료 출시 전 점검. 9인 패널 자유 토론 + 크로스 합의안.
>
> 패널: PM · UX 디자이너 · 법무 · 그로스 · 페르소나(30대 직장인) · 페르소나(20대 사회초년생) · 아키텍트 · QA · VC

---

## 1. 100% 합의된 출시 차단 BLOCKER (12건)

| # | 항목 | 카테고리 | 작업량 | 동의 패널 |
|---|---|---|---|---|
| 1 | RESEND_API_KEY/EMAIL_FROM Vercel 환경변수 적용 + 도메인 검증 | 인프라 | 5분 | PM·인프라·QA |
| 2 | `check-alerts` cron vercel.json 등록 여부 확인 | 인프라 | 5~30분 | PM·인프라 |
| 3 | 카카오 인앱브라우저 OAuth redirect URL 화이트리스트 검증 (production만) | QA·법무 | 30분 | QA·법무·페르소나1 |
| 4 | iOS PWA 푸시 = standalone only 코치마크 분기 (16.4+ 안내) | UX·QA | 1~2h | UX·QA |
| 5 | OG 이미지 동적 생성 (`opengraph-image.tsx` Next.js 16 ImageResponse) | 디자인·그로스 | 0.5d | UX·그로스 |
| 6 | Sentry 또는 PostHog 1개 도입 (DSN + tracesSampleRate 0.1) | 인프라 | 1~2h | 인프라·QA·PM |
| 7 | 샘플 포트폴리오 sandbox 분리 ("진짜 보유로 들어감" 함정 차단) | UX·QA | 0.5d | 페르소나1·QA |
| 8 | AI 촉 카드 인라인 면책 + "당신에게 추천" `FORBIDDEN_PHRASES` 추가 | 법무 | 30분 | 법무·페르소나1·페르소나2 |
| 9 | 14세 미만 가입 차단 게이트 (개인정보보호법 §22-2) | 법무 | 1h | 법무 |
| 10 | 약관·개인정보 동의 시점 DB 로깅 (`terms_version_agreed_at`, `privacy_version_agreed_at`) | 법무 | 1~2h | 법무 |
| 11 | `color_scheme: light` lock + 매니페스트 정렬 (다크 깨짐 방지) | UX | 30분 | UX |
| 12 | `logo-solb.svg` 잔존 정리 + maskable 아이콘 별도 출력 | UX | 1h | UX |

**총 작업량 추정**: 약 2~2.5일 (병렬 가능 시 1.5일).

---

## 2. 디자인 리브랜딩 — V1 vs V1.1 분리 결정

| 단계 | 범위 | 시기 | 작업량 |
|---|---|---|---|
| **V1 (출시 차단 대응)** | 로고·primary color·랜딩 슬로건만 | D-7 안 | 0.5~1일 |
| **V1.1 (전체 토큰화)** | CSS 변수 시스템 (2,013 hex → `--brand-*`), 다크모드 정식 지원 | 출시 후 1주 | 1.5~2일 |

**근거**:
- 디자이너 패널: 풀스코프는 D-7 안 절대 못 끝남 — `landing/page.tsx`만 inline-style로 80개 파일에 hex 박혀 있음
- PM 패널: 디자인 리브랜딩 스코프 컷이 "BLOCKER"인 이유 = 결정 안 하면 출시일 슬립 70%
- UX: V1 단계에서 **다크모드 lock**(매니페스트 `color_scheme: light` + html `style="color-scheme: light"`)으로 깨진 다크보다 안전 확보

---

## 3. 페르소나가 잡은 진짜 함정 (PM·디자이너 미발견)

### 3-1. 36세 직장인 (다증권사, 1억)

| 발견 | 페르소나 발언 | 조치 |
|---|---|---|
| 카피 보험사 톤 | "토스 두고 깔게 만드는 한 방이 없다" | 슬로건 교체: "내 NVDA, 토스+키움 합쳐서 진짜 평단 얼마?" |
| 토스·키움 박아놓고 수동 입력 | "낚인 기분" | 랜딩에 "수동 입력" 솔직 한 줄 + 도움말 OCR 강조 |
| 화투 솔(松)·비 자뻑 | "30초만에 받기엔 자뻑" | 온보딩 Step 0 가치약속 카드만 남기고 브랜드 스토리는 도움말로 |
| 카카오 강요 톤 (도움말) | "회사 PC에서 카카오 켜기 싫음" | Google·카카오 동등 노출 |
| **샘플 포트폴리오가 실제로 들어감** | "체험인 줄 알았다가 본 화면에 안 산 종목 있음" | sandbox 분리 또는 "샘플 지우기" 즉시 버튼 |
| OCR 보안 우려 | "회사 PC에서 KB증권 스샷 올리는 행위 = 보안팀 걸림" | 버튼 옆에 "이미지는 서버 저장 안 됨" |

### 3-2. 27세 사회초년생 (500만원, 첫 투자)

| 발견 | 페르소나 발언 | 조치 |
|---|---|---|
| "비서" 단어 거리감 | "비서는 부자한테나" | 슬로건에서 "비서" 빼고 "공부" 톤 |
| 다증권사 카피 | "토스밖에 없는데... 안 해당이네" | 1증권사 사용자도 어필되는 카피 보강 |
| 폭풍우 톤 기죽음 | "이미 폭풍우 한가운데인데..." | "차분한 부자 톤" 대신 "같이 공부" 톤 |
| PER·VIX·MACD·베타·멘토 이름 | "그리스어야?" | hover tooltip + 멘토 카드에 "어떤 사람" 1줄 |
| Aha 1순위 | "모닝브리프 — 누가 나 대신 봐주고 있구나" | 출시일 가장 임팩트 큰 자리 노출 |
| 첫 한도 1번 | "1번 눌러보고 별로면 24h 대기" | 첫 AI 촉 퀄리티 = retention 핵심 |
| 샘플 너무 모범생 (삼전·AAPL·SPY) | "내 거랑 다르네" 이질감 | SOXL 등 변동성 종목 1개 추가 검토 |

---

## 4. 충돌 → 합의

| 충돌 | 결론 |
|---|---|
| AI 촉 영구 무료 (메모리·법무) vs PRO 차별화 (VC) | **AI 자체 동일**, 단 **딜리버리 깊이**(멘토 6명 풀 비교)·**푸시 시간 선택**·**알림 빈도**는 PRO. 자본시장법 영향 0. |
| 디자인 리브랜딩 D-7 가능? | **V1·V1.1 분리** (위 §2) |
| 베타에도 AI 한도 강제? | **Free tier 한도 그대로 (1+3)**. PRO 7일 트라이얼만 별도. 한도 풀면 PRO 전환 시 다운그레이드 이탈 |
| 통신판매업 신고 | **베타 단계 미발동**. PRO 결제 페이지 노출 D-30 안에 처리 |
| Vercel Pro 전환 | **Hobby 유지**. 단 active CPU·invocations 80% 도달 신호 시 즉시 전환 (Sentry alert) |

---

## 5. 인프라·QA 신규 발견 (BLOCKER 외 보강)

| 항목 | 우선 | 메모 |
|---|---|---|
| `notification_log` UNIQUE(user_id, alert_type, date) 제약 + idempotency key | 🔴 | 오늘 23,413 오탐과 같은 종류, cron retry 시 중복 알림 |
| Web Push 410 GONE → `push_subscriptions` 자동 삭제 핸들러 | 🟡 | Function CPU 낭비 차단 |
| Supabase Free `pg_dump` GitHub Actions 일별 cron (03:00 KST) | 🟡 | PITR 없음, 24,400 listings 복구 불가 위험 |
| `usdKrw` stale 환율 → 모닝브리프 USD 평가액 오류 | 🟡 | cron 순서·환율 freshness 가드 |
| Service Role Key 클라 번들 누출 검증 (`grep -r "SERVICE_ROLE" src/app`) | 🔴 | 보안 사고 방지 |
| Cron secret 7개 cron 모두 `Authorization: Bearer` 가드 검증 | 🔴 | 외부 hammering 방지 |
| Upstash Redis rate limit (IP당 60req/min) | 🟡 | 100명 동접 시 Function 폭발 방지 |

---

## 6. KPI 5종 (베타 1개월 측정 임계값)

| # | 지표 | 임계 | 측정 위치 | 미달 시 트리거 |
|---|---|---|---|---|
| 1 | D7 retention | ≥30% | `daily_snapshot` | 모닝브리프·푸시 빈도 재설계 |
| 2 | 가입→첫 AI 촉 도달률 | ≤5분 / ≥70% | onboarding event | 온보딩 단축 |
| 3 | WAU/MAU | ≥0.5 (주 3.5일) | `daily_snapshot` | 챕터·시즌제 강화 |
| 4 | AI 촉 👍률 / 평가응답률 | ≥60% / ≥40% | `ai_feedback` | priorityScore 재학습 |
| 5 | PRO 결제 의향 survey | ≥25% / ≥10% 즉시 결제 가능 | 인앱 1주차 popup | PRO 가격·기능 재설계 |

**PRO 출시 트리거 동시 충족**: (a) 누적 가입 ≥1,500명, (b) D7 ≥30% / D30 ≥18%, (c) PRO survey ≥15%, (d) affiliate 1건 이상 실수금.

---

## 7. 출시 후 즉시 보완 (V1.1 — D+7 이내)

1. 디자인 리브랜딩 풀스코프 (CSS 토큰 시스템 + 다크모드 정식)
2. PRO 결제 페이지 UI 시안 (`/upgrade` 더미) — 결제 의향 측정 시작
3. 멘토 시연 영상 5분 (외부 제작, **6/30 전 라이브**) — 토스 AI 출시 방어
4. `/admin` funnel D1 데이터 첫 리뷰 + 가중치 검증
5. `chok-debug` PER 채움률 점검 → 50% 이하 시 candle fallback
6. 인스타 릴스 30초 × 3 (멘토 6명 NVDA 분석 차이)
7. 랜딩 A/B 2종 + UTM 대시보드 (`/landing?v=a/b`)
8. 베타 첫 10명 인터뷰 후기 카드

---

## 8. 6개월 내 단일 최대 위협 (VC)

**토스증권 AI 채팅 기능 출시** (체감 확률 50%+, 2026 H2 예상).
거래 화면 안에서 동일 종목 한 줄 답변 무료 → 주비의 비투자 페르소나 50% 흡수.

**방어 시그니처 자산**:
- 멘토 6명 시연 영상 5분 — **6/30 전 라이브 필수**
- 멘토 6명 차별 비교표 (NVDA 등 동일 종목, 다른 시각)
- 세무 비서(Phase B-3·M-4) — exit narrative 핵심 (12개월 안에 데모 못 띄우면 valuation 반토막)

---

## 9. 외부 투자 적정 시점 (VC)

**베타 후 9~12개월 (2027 Q1~Q2)**.

증명 4종 (Pre-A 평가액 ₩30~50억 목표):
- ① MAU 8,000+ 6개월 유지
- ② LTV/CAC ≥ 3 3개월 연속
- ③ PRO 결제자 200명+ 실수금
- ④ affiliate ₩300만/월+ 1채널 검증

그 전까지: **TIPS + 엔젤로 18개월 런웨이 확보**.

---

## 10. D-7 진행 권장 순서

```
[D-6] BLOCKER 인프라 5건 (RESEND·check-alerts·redirect·Sentry·Service Role 검증)
[D-5] BLOCKER 법무 4건 (14세·동의 로깅·면책 인라인·통신판매업 보류 결정)
[D-4] BLOCKER 디자인 5건 (V1 로고·color_scheme·OG 이미지·maskable·logo-solb 정리)
[D-3] BLOCKER UX 2건 (iOS PWA 코치마크·샘플 sandbox) — 최종 동결 데드라인
[D-2] 페르소나 함정 대응 (슬로건 A/B·"수동 입력" 카피·OCR 보안 안내)
[D-1] QA smoke 톱 10 + 카나리 5명 24h
[D-0] 출시 + KPI baseline 캡처
[D+1~7] V1.1 리브랜딩 풀스코프 + 멘토 영상 발주
```

미달 시: **1주 슬립 (5/29 출시)** — 알림 죽은 채 출시는 KPI 측정 자체를 망가뜨려 베타 의미 상실.

---

## 11. 회의 운영 메모

- 시간: 2026-05-15
- 방식: 9인 Agent 병렬 호출 + 메인 PM(Claude)이 종합·합의 정리
- 다음 회의: 베타 1주차 funnel 데이터 후 → "베타 1주차 회고 9인 회의"
- 결과 보존: docs/BETA_LAUNCH_REVIEW.md (이 문서) + sessionary/TODO.md "베타 출시 To-do" 섹션
