# SOLB DB 동기화 완료 + 다음 단계 — 전문가 패널 회의록 v15

**일시:** 2026년 3월 26일
**안건:** DB 저장 기능 완료 평가 + 관리 페이지 전략

---

## 1부: Phase 2A 완료 평가

### PM

> **Phase 2A 계획 vs 실제:**
>
> | 계획 | 상태 | 비고 |
> |------|------|------|
> | Supabase Auth (Google/Kakao) | ✅ 완료 | Kakao KOE205 해결 |
> | DB 포트폴리오 저장 | ✅ 완료 | upsert + RLS |
> | 온보딩 플로우 | ✅ 완료 | 3단계 + 종목 추가 |
> | Level 1.5 복합 분석 | ⏳ 미진행 | 다음 스프린트 |
>
> **현재 데이터 흐름:**
> ```
> 비로그인 사용자:
>   브라우저 → localStorage → 브라우저 (기기 종속)
>
> 로그인 사용자:
>   브라우저 → localStorage + Supabase DB → 어디서든 접근
>   ├── 첫 로그인: localStorage → DB 마이그레이션
>   ├── 이후: DB가 source of truth
>   └── 변경 시: 2초 디바운스 후 자동 저장
> ```

---

## 2부: 전체 아키텍처 현황

### 백엔드 전문가

> ```
> ┌─────────────────────────────────────────────────┐
> │  사용자 브라우저 (Next.js)                        │
> │  ├── Zustand Store (메모리)                       │
> │  ├── localStorage (오프라인 캐시)                  │
> │  ├── Finnhub WebSocket (실시간 미국 주식)          │
> │  └── Gemini AI (분석 리포트)                      │
> ├─────────────────────────────────────────────────┤
> │  Next.js API Routes (서버)                       │
> │  ├── /api/ai-analysis (Gemini 프록시)             │
> │  ├── /api/kr-quote (Yahoo Finance 프록시)         │
> │  └── /api/candle (Yahoo Finance 캔들 프록시)      │
> ├─────────────────────────────────────────────────┤
> │  Supabase (클라우드)                              │
> │  ├── Auth (Google/Kakao 로그인)                   │
> │  ├── PostgreSQL (포트폴리오 저장)                  │
> │  └── RLS (사용자별 데이터 격리)                    │
> ├─────────────────────────────────────────────────┤
> │  외부 API                                        │
> │  ├── Finnhub (미국 주식 시세/캔들)                 │
> │  ├── Yahoo Finance (한국 주식/환율/캔들 폴백)      │
> │  ├── Gemini 2.5 Flash (AI 분석)                  │
> │  └── Google News RSS (뉴스)                      │
> ├─────────────────────────────────────────────────┤
> │  배포                                            │
> │  ├── Vercel (프론트엔드 + API Routes)             │
> │  └── Supabase Cloud (DB + Auth)                  │
> └─────────────────────────────────────────────────┘
> ```

---

## 3부: 관리 페이지 전략

### PM

> **관리 페이지에서 봐야 할 것:**
>
> | # | 항목 | 데이터 소스 | 중요도 |
> |---|------|-----------|--------|
> | 1 | **총 가입자 수** | Supabase Auth | 높음 |
> | 2 | **일일 활성 유저 (DAU)** | 자체 로깅 필요 | 높음 |
> | 3 | **Gemini API 호출 수** | 자체 카운터 | 높음 |
> | 4 | **종목 추가/삭제 통계** | Supabase DB | 중간 |
> | 5 | **인기 종목 TOP 10** | Supabase DB 집계 | 중간 |
> | 6 | **로그인 방식 비율** | Supabase Auth | 낮음 |
> | 7 | **에러 로그** | Vercel Logs | 낮음 |

### UX 전문가

> **관리 페이지 구현 방법 2가지:**
>
> #### A안: Supabase Dashboard 활용 (지금 바로)
> - 이미 Supabase Dashboard에서 Users 수, DB 데이터 볼 수 있음
> - Gemini 사용량: Google AI Studio에서 확인
> - Vercel: Analytics 탭에서 방문자 확인
> - **비용: $0, 개발 시간: 0**
>
> #### B안: 자체 관리 페이지 (/admin)
> - SOLB 앱 안에 관리자 전용 페이지
> - 통계 대시보드: 가입자, DAU, API 사용량, 인기 종목
> - **비용: $0, 개발 시간: 4~8시간**
>
> **추천: 유저 100명까지는 A안으로 충분. 그 이후 B안.**

### 백엔드 전문가

> **B안 구현 시 필요한 것:**
>
> 1. **Supabase DB에 로그 테이블 추가:**
> ```sql
> -- API 호출 로그
> create table api_logs (
>   id bigint generated always as identity primary key,
>   user_id uuid references auth.users(id),
>   action text, -- 'ai_analysis', 'stock_add', 'login'
>   symbol text,
>   created_at timestamptz default now()
> );
>
> -- 일일 통계 (배치 집계용)
> create table daily_stats (
>   date date primary key,
>   total_users int,
>   active_users int,
>   ai_calls int,
>   stocks_added int
> );
> ```
>
> 2. **`/admin` 페이지:** 관리자만 접근 (특정 user_id 체크)
> 3. **통계 API Route:** Supabase에서 집계 쿼리

---

## 4부: 합의 — 다음 단계

### 전원 합의

> #### 즉시 (이번 세션)
>
> | # | 작업 | 내용 |
> |---|------|------|
> | 1 | **관리 페이지 (/admin)** | 가입자 수, AI 호출 수, 인기 종목 |
> | 2 | **Gemini API 카운터** | 호출 시 DB에 로깅 |
>
> #### 다음 스프린트
>
> | # | 작업 |
> |---|------|
> | 3 | Level 1.5 복합 분석 알고리즘 |
> | 4 | 분할 매수/매도 기록 |
> | 5 | 푸시 알림 (PWA) |
> | 6 | 다크모드 |

---

*— END OF MEETING v15 —*
