# 2026-05-15 — 디자인 리브랜딩 V1.1 (3인 패널 + 4 Step)

> 같은 날 `2026-05-15-beta-launch-prep.md` 이후 진행. 베타 출시 D-7 마지막 작업.

## 작업 요약

사용자 "디자인 리브랜딩 시작하자" → 3인 패널 회의(A 옵션) → 합의안 그대로 진행 → V1.1 Step 1+2+3+4 한 세션에 완료.

기존 9인 회의에서 V1·V1.1 분리 결정됨:
- V1 (D-7 안): color_scheme lock + OG + logo 정리 → 완료
- **V1.1 (출시 후 1주 → 한 세션에 압축)**: 토큰 시스템 + 다크 매핑 + 컴포넌트 톤 통일

총 3 커밋, 13 파일 변경.

## 3인 패널 회의 (커밋 a56b05c 직전)

방식: Agent 3개 병렬 호출 + 자유 토론.

패널: 아트 디렉터 · UX 디자이너 · 페르소나 27 (사회초년생).

### 100% 합의 사항

| 항목 | 결정 |
|---|---|
| 토스블루 #3182F6 탈출 | 즉시 폐기 (페르소나: "토스 켰나?", 아트: "100% 카피") |
| 메인 색 = 그린 계열 | 솔(松) 컨셉 직결 |
| 다크모드 토글 V1.2로 연기 | V1.1은 `prefers-color-scheme` 자동 매핑만 |
| Pretendard Variable 단독 | Geist 제거 (한·영 베이스라인 통일) |
| lucide-react + stroke 1.75 | 자체 SVG는 멘토 6동물·로고만 |

### 충돌 → 합의

| 충돌 | 결론 |
|---|---|
| 신뢰감(아트) vs 아기자기(페르소나) | **색은 차분(teal) + 형태는 부드럽게(radius 16) + accent 1포인트(amber)** |
| 다크 우선(아트) vs 라이트 우선(UX·페르소나) | **라이트 우선 토큰화 + 다크 시스템 일치 매핑** |
| 정보 밀도(UX) vs 더 숨겨달라(페르소나) | **점선 밑줄 TermHint — 학습 신호 유지** |

### 최종 컬러 시스템

```
Primary (송우 Mossy Teal)   #0E7C7B  ← 아트 1순위
Accent  (인스타 골드)        #F59E0B  ← 페르소나 "포인트 색"
Slate   (비 보조)           #94A3B8  ← 아트 "비 머금은 청회색"
Radius  8 · 12 · 16 · 24 · full (4 제거)
Space   4·8·12·16·24·32·48 (8 grid)
```

다크 매핑:
- Primary dark: #14B8A6 (명도↑ 채도↓)
- Accent dark: #FBBF24

## Step 1 — CSS 토큰 시스템 (커밋 a56b05c)

`src/app/globals.css` 갱신:
- `:root` 신규: `--brand-primary`·`primary-hover`·`primary-light`·`primary-bg`
- `:root` 신규: `--brand-accent`·`accent-hover`·`accent-light`·`accent-bg`
- `:root` 신규: `--brand-slate`·`slate-strong`
- `.dark` 매핑 (다크 명도↑ 채도↓)
- `@theme inline`: Tailwind 클래스 노출 (`bg-brand-primary` 등)
- 기존 `--brand-rain: #3182F6` 보존 (한국 컨벤션 loss color fallback)

## Step 2 — 첫 화면 5개 (커밋 a56b05c)

페르소나27 "토스 켰나?" 함정 차단 우선 화면:

| 파일 | 변경 |
|---|---|
| `landing/page.tsx` | 헤드라인·CTA·Feature list 색 |
| `opengraph-image.tsx` | OG 그라데이션 `#0E7C7B → #0A6362` |
| `LoginModal.tsx` | 로고 그라데이션·동의 링크·체크박스 accent |
| `OnboardingFlow.tsx` | Step 0 가치카드·스텝 인디케이터 |
| `AiChokSection.tsx` | keyMetric chip·CTA 버튼 |

변경 패턴:
- `#3182F6` → `var(--brand-primary)`
- `#1B64DA` → `var(--brand-primary-hover)`
- `rgba(49,130,246,0.08)` → `var(--brand-primary-light)`

## Step 3 — 메인 카드 3종 (커밋 738d504)

UX 패널 최우선:

| 파일 | 변경 |
|---|---|
| `MorningBriefing.tsx` | 그라데이션 amber→teal→slate (기존 amber→blue→purple) |
| `MergedHoldingsCard.tsx` | 그라데이션 teal+amber·보유 종목 배지 |
| `BrokerSummaryCard.tsx` | 통합 자산 헤더·active broker chip·progress bar |

**핵심**: 손익 색(`var(--color-loss, #3182F6)`, `pnlColor`) 전부 보존 — 한국 컨벤션 유지.

## Step 4 — 레이아웃 + /help (커밋 738d504)

사용자 진입 빈도 높은 영역:

| 파일 | 변경 |
|---|---|
| `Header.tsx` | 로고 그라데이션·사용자 메뉴 색 |
| `RightSidebar.tsx` | AI 촉 카드 그라데이션·CTA·watching 버튼 (L107 Tailwind 손익색 보존) |
| `MobileNav.tsx` | 활성 탭 색 + indicator |
| `/help` page | HelpCircle 아이콘·투어 다시 보기 CTA |

## 결정사항

### V1 vs V1.1 분리 → V1.1 한 세션 압축 가능 발견

9인 회의 추정 1.5~2일이었으나 실제로는 **토큰 시스템 + 5+3+4 파일 마이그레이션 = 한 세션에 완료**. 이유:
- 기존 globals.css에 이미 토큰 일부 존재 (`--brand-sol`, `--brand-rain` 등) — 추가만 하면 됨
- inline-style이라 `var()` 사용 가능 — 일괄 변경 효율적
- 손익 색은 별도 패턴(`var(--color-loss, #3182F6)`)으로 명확히 분리됨 → 영향 0

### 한국 손익 컨벤션 보존 원칙

`#3182F6`은 **두 가지 의미**로 사용 중:
1. 토스블루 브랜드 → **변경** (Mossy Teal로)
2. 한국 손익 컨벤션 loss color (파랑=하락) → **보존**

분리 방법:
- `var(--color-loss, #3182F6)` fallback → 보존
- `pnlColor = ... ? '#3182F6' : '...'` → 보존
- `text-[#3182F6]` Tailwind class → 보존 (대부분 손익색 패턴)
- 인라인 `'#3182F6'`, 그라데이션 `#3182F6` → 변경 (브랜드)

### V1.2 보류 명확화

- 다크모드 정식 토글 + 위험 영역 3개 (AI 촉 그라데이션·멘토 SVG·차트 grid)
- admin·debug 화면 마이그레이션 (Step 5)
- 슬로건 A/B 인프라
- PER/VIX hover tooltip (`<TermHint>` 컴포넌트)
- 푸시 권한 타이밍 재설계

## 미해결 TODO

### 외부 자산 (사용자 결정)
- 로고 시안 (Mossy Teal 기반, 또는 변경)
- maskable 아이콘 별도 PNG (V1 차단 항목)
- iOS PWA 스플래시 8종

### V1.2 작업
- 다크모드 정식 토글 + 위험 영역 검증
- 토큰화 완료 후 inline-style hex 잔존 lint (`no-inline-hex` 룰)
- admin·debug 마이그레이션
- 슬로건 A/B 인프라

## 다음 세션 진입점

1. 사용자가 새 로고·primary color 결정 후 (또는 Mossy Teal 유지) V1.2 진행
2. 또는 베타 1주차 funnel 데이터 후 디자인 회고

## 메모리 승급 자문

승급 후보:

1. **디자인 시스템 SSOT (project_design_system.md 신규)**:
   - Mossy Teal #0E7C7B·Amber #F59E0B·Slate #94A3B8
   - 한국 손익 컨벤션 보존 원칙 (파랑=손실, 빨강=이익)
   - 토스블루 회피 원칙 ("거래는 토스" 차별화)
   - radius 시스템 8·12·16·24·full
   - V1·V1.1·V1.2 분리 결정

사용자 동의 시 승급.
