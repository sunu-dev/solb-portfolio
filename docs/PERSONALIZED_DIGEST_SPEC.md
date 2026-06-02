# 시차 인지 개인화 digest — 구현 스펙

> 출처: 초개인화 ADD/REMOVE 패널 워크플로 (웹리서치 4 + 5인 전문가 패널 + 종합, 2026-06-02). 만장일치 "조건부 강한 YES". 전략 SSOT는 메모리 `project_personalized_digest_strategy`.

## 0. 한 줄

기존 `morning-brief` cron(KST 07:00·멱등성·양채널)을 **국장 07:00 / 국장마감 16:00 2슬롯**으로 분기하고, 비어 있던 `buildPushPayload` 델타 숫자에 **RAG-grounded·sanitize된 "왜 움직였나" 사후 해설**을 얹어 — 토스가 비워둔 "시차 인지 정시 push digest"를 무면허 주비가 **거래 유인 없는 순수 학습 레인(방향0·descriptive 멈춤)**으로 영구 무료 선점.

## 1. 무엇을 / 언제

| 슬롯 | 시각(KST) | cron | 콘텐츠 | 비고 |
|---|---|---|---|---|
| 국장 morning | 07:00 | `0 22 * * *` (기존 재활용) | 간밤 미장 보유분 "왜 움직였나" 사후 해설 | morning-brief 진화 |
| 국장 close | 16:00 | `0 7 * * *` (신규) | 오늘 국장 마감 정리 | getKRStatus 연장거래창·무음 밖 |
| 미장 전 evening | 21:00 | (P1 보류) | 미장 개장 전 국장 정리 | 무음 22:00 근접 + Hobby daily-1x 한계 → in-app/email 전용 후속 |

**콘텐츠 3축 (전부 방향0·과거 사실):**
1. **왜 움직였나** — biggestMover 종목에 RAG 1~2문장 사후 해설. 비단정 어조(`~관련 보도가 있었어요` / `~로 보입니다`). 인과 단정(`때문에`) 금지.
2. **보유 종목 한정 필터링** — 개인화는 '노출 대상 선택 + 해설'까지. 방향은 0. (금융위 해석: 같은 종목 보유자에겐 같은 사실 해설 = 개별성 있는 조언 아님.)
3. **다가오는 일정** — 보유 종목 다음 실적일 D-N = 달력 사실 (P1).

**절대 금지:** 무엇을/언제/얼마에 살까 · 매수 매력 · 아웃퍼폼 평가 어조 · 다음 행동 제안 · 보유 밖 종목 무버 랭킹 · 1:1 AI 상담 CTA. CTA는 '앱에서 확인' 이상 금지.

## 2. §6 안전 4중 방어

- **(a) descriptive에서 멈춤** — 과거 사실·맥락 해설에만 한정. prescriptive 미끄러짐 차단. (컴플라이언스이자 차별점.)
- **(b) RAG-first** — 검증 출처(뉴스탭 API·캘린더·시세)에서 retrieve 후에만 generate. free generation 금지. 심볼 STOCK_KR 정규화만(토스 2026-01 동일티커 환각사고 방어).
- **(c) 출력 이중 게이트** — `sanitizeAiObject()` 강제 통과 + `FORBIDDEN_PHRASES`에 인과 단정어(`때문에`/`덕분에`/`확실히`/`~로 인해`) 추가(⚠️ `alertCompliance.ts`와 `scripts/lint-alerts.mjs` 양쪽 — 후자는 부분 복제라 드리프트 주의) + 수치·확률 생성 차단.
- **(d) 정시 규칙 발송 고정** — 이벤트 트리거 금지(= Publisher's Exclusion 면제 유지). digest≠alert 정책 분리(Status≠Alert). Robinhood식 '자기한계 선언형' 면책 부착. RLS service-only 보유데이터 접근.

## 3. P0 구현 체크리스트

- [ ] **시차 2슬롯** — `morning-brief/route.ts` 슬롯 분기 + 신규 `0 7 * * *` cron. 멱등성 타입 슬롯별 분리(`digest_kr_morning` / `digest_kr_close`)해 UNIQUE(user,type,sent_date) 충돌로 두 번째 슬롯 silent skip 방지.
- [ ] **"왜 움직였나" 해설** — 멘토 엔진 재활용, `sanitizeAiObject()` 강제, 비단정 어조. **플래그 게이트(off 출발) 권장** — 환각이 유일한 §6 위험.
- [ ] **컴플라이언스 게이트** — `FORBIDDEN_PHRASES` 인과 단정어 추가 (양쪽 동기).
- [ ] **digest 카테고리 배선** — `alertPolicy.ts`의 예약·미매핑 `'digest'` AlertCategory에 배선. 채널 [inapp, email] 기본 / push opt-in. 보유 종목 없으면 미발송.
- [ ] **자기한계 면책 SSOT** — `DISCLAIMER`에 Robinhood식 "주비는 당신의 투자목표·위험성향·투자기간을 모르므로 자문·로보어드바이저 아님" 추가.

## 4. 제외/단순화 (REMOVE)

- ❌ MAB/Contextual Bandit/GNN/Two-Tower 추천 ML — 클릭 보상함수 = 매수 유인 자동생성(§6 역행) + 규모 과함. "시차"라는 결정적 룰이 더 단순·안전·감사가능.
- ❌ 이벤트 트리거 즉시 digest — 면제 약화. 이벤트형은 기존 `check-alerts`(ramp-up 레인)에 분리.
- ❌ daily blast 푸시 기본값 — 2026 핀테크 합의 위반 + 무음(22:00~07:00) 충돌. push opt-in 고정.
- ❌ 보유 밖 종목 무버 랭킹·아웃퍼폼 평가 어조 — 매수 유인. 시장 무버는 뉴스탭·AI 촉에 위임.
- ❌ prescriptive 시각화·다음 행동 제안·1:1 AI 상담 CTA — §6 레드라인.

## 5. 배포 게이트

- digest 면책 문구 + RAG 해설 범위는 **약관 v4 변호사 검토 묶음**에 포함 후 LIVE (`feedback_consent_version_ssot` 정합).
- RAG "왜 움직였나" 레이어는 **플래그 off로 출발** → 구조적 digest(안전)만 먼저, RAG는 변호사 검토 후 on.

## 6. 경쟁사 레퍼런스 (방향0 선례)

- **토스 AI 시그널** (2025.11) — 보유/관심 종목 "왜 움직였나" RAG 해설. "변동의 이유를 읽어드려요"(방향 아님). 실시간·관심탭 pull.
- **카카오페이 AI 시황** (2024.12) — 미장 마감·변동요인 매일 아침 요약. "선별·전달(추천 아님)".
- **Robinhood Cortex Digests** (2026 Q1) — 보유 맞춤 AI 요약. 면책 교과서. 단 Gold $5 유료(주비는 무료로 역공).
- **Yahoo Morning Brief** — 6am ET 간밤 아시아·유럽 정리(시차 콘텐츠 정석).
- ⛔ **Public.com AI Agents** — briefing→자동매매. 주비 절대 안 넘는 선.
- ⚠️ **토스 2026-01 정확성 사고** — 동일 티커 오노출→환각 인과. RAG 게이트 당위.
