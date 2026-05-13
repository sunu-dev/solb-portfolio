# 증권사별 자산 관리 (Broker Feature) — 9인 회의 결과

> **작성일**: 2026-05-13
> **목적**: 사용자 자산이 어느 증권사에 있는지 추적·관리하는 기능 설계 (페르소나·UX·법무·차별점 종합 검토)
> **관련**: [BUSINESS_REVIEW.md](BUSINESS_REVIEW.md), [ROADMAP.md](ROADMAP.md)

---

## 1. 컨셉 정립

> **"흩어진 자산을 한 곳에 보는 게 아니라, 비서답게 활용하는 것"**

| 함정 | 우리의 길 |
|---|---|
| ❌ 토스·뱅크샐러드처럼 자동 동기화 시늉 | ✅ 수동 입력 + OCR 보강 (자동화 한계 인정) |
| ❌ 단순 자산 통합기로 전락 | ✅ 증권사별 + 계좌별 비서 톤 코칭 |
| ❌ 모든 사용자에게 broker UI 노출 | ✅ 점진 노출 — 단일 broker 사용자는 UI 변화 0 |

### 핵심 차별 (1년 이상 leadership 가능)

1. **세무 비서** — ISA 한도, IRP 환급 시뮬레이션. 토스도 따라오기 어려움.
2. **계좌 목적별 분리** — "키움 = 단타, 미래에셋 IRP = 노후"
3. **broker별 멘토 분석** — Gemini prompt에 broker context 주입

---

## 2. 9인 회의 패널

| 시점 | 역할 |
|---|---|
| 🎯 PM | 제품 정체성·우선순위 |
| 🎨 UX 디자이너 | 입력 부담 vs 가치 |
| 👨‍💼 사용자 페르소나 A | 다증권사 사용자 (토스+키움+미래에셋) |
| 👩‍💼 사용자 페르소나 B | 단일 증권사 (토스만) |
| 🏗️ 데이터 모델 아키텍트 | 스키마 변경 영향 |
| 💰 금융 도메인 전문가 | 계좌 종류 (ISA/IRP/연금) |
| ⚖️ 컴플라이언스/법무 | 데이터 책임 |
| 🚀 그로스 마케터 | 가입 동기 |
| ⚔️ 경쟁자 분석가 | 토스·뱅샐과 비교 |

## 3. 주요 발언 요약

### PM
주비='비서' 컨셉 강화 분기점. 자동 동기화 시늉 = 패배. 수동 입력 + 비서답게 활용 = 승.

### UX 디자이너
한국 사용자는 보통 1~3개 증권사. broker 필드는 무조건 선택. 단일 사용자는 UI 변화 0. 2개 이상 발견 시 자동 활성화.

### 사용자 페르소나 A (다증권사)
"3개 앱 따로 들어감. 통합 뷰만 있어도 가치. ISA·IRP 계좌 종류 구분 필수."

### 사용자 페르소나 B (단일)
"필요 없음. 자산통합기 색이 너무 강해지면 본질 흐려짐."

### 데이터 모델 아키텍트
StockItem.broker?: enum (8개) — 스키마 변경 최소. user_portfolios가 jsonb라 자동 호환.

### 금융 도메인 전문가
- ISA: 200~300만원 비과세, 5년
- IRP: 700만원/년 세액공제 (16.5% 환급)
- 연금저축: 400만원/년 세액공제
- 일반: 22% 양도세 (해외 250만원 공제)
"올해 ISA 한도 80만원 남았어요" 같은 비서 톤 가능.

### 컴플라이언스
큰 위험 0. 단, '실제 증권사 보유와 다를 수 있음' 디스클레이머 첨부.

### 그로스 마케터
다증권사 사용자 30~40% 추정 → 가입 동기 강력. 챕터 회고에도 통합.

### 경쟁자 분석가
뱅크샐러드 자동 동기화 못 따라감. 차별점은 자동화 X, 의사결정 조언 O.

---

## 4. 크로스 토론 합의

| 충돌 | 합의 |
|---|---|
| 단일 사용자 UI 노이즈 | 점진 노출 — 2개 이상 broker 발견 시 자동 활성화 |
| 자동 동기화 vs 수동 | OCR 활용 — 스크린샷 헤더에서 broker 자동 추출 |
| 계좌 종류 우선순위 | Phase 1=broker만, Phase 2=accountType |
| 토스 따라잡힘 위험 | 통합 뷰 1년 leadership, 진짜 moat은 세무 비서 |
| 비서 vs 추적기 정체성 | 메인=통합+통찰, 증권사별=별도 필터 |

### 의외의 발견

- **broker 변경 워크플로 필요** (이관 시 평단가 재계산)
- **accountType 'unsure' 옵션 필수** (세무 안내 톤 조정)

---

## 5. 단계별 구현 계획

### Phase B-1 — broker 필드 + OCR 보강 (1~2일, 🔴 즉시)

**스키마** (한국 증권사 상위 15개 + 기타):
```ts
type Broker =
  | 'toss'      // 토스증권
  | 'kiwoom'    // 키움증권
  | 'mirae'     // 미래에셋증권
  | 'kis'       // 한국투자증권
  | 'samsung'   // 삼성증권
  | 'nh'        // NH투자증권
  | 'kb'        // KB증권
  | 'shinhan'   // 신한투자증권
  | 'meritz'    // 메리츠증권
  | 'hana'      // 하나증권
  | 'daishin'   // 대신증권
  | 'yuanta'    // 유안타증권
  | 'sk'        // SK증권
  | 'eugene'    // 유진투자증권
  | 'kakaopay'  // 카카오페이증권
  | 'other';    // 기타 (DB금융투자·교보·신영증권 등)

export interface StockItem {
  // ...existing
  broker?: Broker;
}
```

> **미국 증권사 미포함**: 한국 사용자 기반이라 한국 증권사 15개 + 기타로 시작. 미국 증권사(Robinhood/Fidelity/IBKR)는 Phase B-2 검토.

**구현**:
- `EditStockModal` broker 드롭다운 (선택, 기본 미지정)
- `PortfolioSection` 에 broker 필터 칩 (2개+ 발견 시 자동 노출)
- `OcrImportModal` OCR에 broker 추정 추가 (헤더 텍스트 매칭)
- 디스클레이머: "사용자가 직접 입력. 실제 보유와 다를 수 있음"

### Phase B-2 — 증권사별 뷰 + 통찰 (2~3일, 베타 100명 후)

**구현**:
- `BrokerSummaryCard`: 증권사별 종목 수·총평가액·수익률 비교 카드
- 챕터 회고에 broker별 라인 ("키움 챔피언 vs 토스 챔피언")
- 검색·필터 UI에 broker 칩 추가

### Phase B-3 — 계좌 종류 + 세무 비서 (3~5일, Phase 3, 베타 500명 후)

**스키마 확장**:
```ts
type AccountType = 'general' | 'isa' | 'irp' | 'pension' | 'overseas' | 'unsure';

export interface StockItem {
  // ...
  broker?: Broker;
  accountType?: AccountType;
}
```

**기능**:
- ISA 한도 진척 위젯 ("200만원 중 120만원 사용")
- IRP 세액공제 시뮬 ("500만원 더 넣으면 +82.5만원 환급")
- 멘토 분석 prompt에 accountType context 주입

### Phase B-4 — 마케팅 통합 (1일, B-1 직후)

- 랜딩 카피: "여러 증권사 자산을 비서가 코칭"
- /help 페이지에 "증권사 통합 안내" 섹션
- 5분 시연 영상에 broker 분리 시나리오 포함

---

## 6. 데이터·인프라 영향

### 마이그레이션
- **없음** — user_portfolios.stocks는 jsonb. 새 필드 자동 호환.
- 마이그레이션 카운트 그대로 유지 (8건)

### 코드 영향 범위
| 파일 | 변경 |
|---|---|
| `src/config/constants.ts` | StockItem.broker 추가 |
| `src/components/common/EditStockModal.tsx` | broker 드롭다운 추가 |
| `src/components/portfolio/PortfolioSection.tsx` | broker 필터 칩 (조건부) |
| `src/components/portfolio/OcrImportModal.tsx` | OCR 결과에 broker 추정 |
| `src/app/api/portfolio/ocr/route.ts` | Gemini prompt에 broker 인식 룰 추가 |
| `src/components/portfolio/BrokerSummaryCard.tsx` (신규) | B-2 |

### Backwards compat
- 기존 사용자 = broker 미지정 → 기존 UI 그대로 노출
- 신규 사용자 + 1개 broker → 동일하게 미노출
- 2개+ broker = 자동 필터 활성화

---

## 7. 마케팅 메시지 (B-4)

### 슬로건 후보

- 🟢 **"여러 증권사 자산을 한 화면, 비서가 코칭"**
- 🟢 **"토스·키움·미래에셋이 따로 있나요? 주비가 합쳐드려요"**
- 🟢 **"ISA 한도, IRP 환급. 증권사가 안 알려주는 걸 비서가 챙겨드려요"** (B-3 출시 후)

### 랜딩 카피 추가

기존: "폭풍우에도 흔들리지 않는 내 주식 비서"

추가 카드:
> 🏦 **증권사가 여러 곳이세요?**
> 주비는 토스·키움·미래에셋 등 어디에 있는 자산이든 한 곳에서 비서답게 코칭합니다.
> 계좌 종류(ISA·IRP·연금)도 분리해 세금까지 챙겨드려요.

---

## 8. 결정 사항 (사용자 승인 대기)

| 항목 | 합의 | 결정 필요 |
|---|---|---|
| Phase B-1 즉시 구현 | ✅ 합의 | 사용자 OK 시 진행 |
| Phase B-2 베타 100명 후 | ✅ 합의 | 그때 재검토 |
| Phase B-3 베타 500명 후 | ✅ 합의 | 세무 검토 별도 |
| 마케팅 (B-4) 슬로건 변경 | 후보 3개 | 사용자 선택 |
| OCR broker 자동 추정 | ✅ 합의 | 우선순위 결정 |

---

## 9. 후속 작업 (Phase B-1 진행 시)

1. StockItem 인터페이스 + Broker enum 작성
2. EditStockModal broker 드롭다운
3. PortfolioSection broker 필터 칩 (조건부 노출)
4. OcrImportModal broker 추정 (Gemini prompt)
5. ROADMAP.md 갱신
6. THRESHOLDS.md에 broker 관련 룰 추가 (예: 점진 노출 임계 = 2개)

---

## 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-13 | 9인 회의 결과 문서화. Phase B-1~B-4 합의안 정립. |
| 2026-05-13 | **Phase B-1 구현 완료** — Broker enum (한국 15개) + EditStockModal 드롭다운 + BrokerSummaryCard 점진 노출 + OCR 자동 추정. |
| 2026-05-13 | **Phase B-2 구현 완료** — BrokerSummaryCard 클릭 필터 + ChapterStats.brokerChampions + buildChapterRecap 증권사별 챔피언 라인. |
| 2026-05-13 | **Phase B-4 구현 완료** — /help 페이지에 "증권사 통합" 섹션 (5 Q&A) + 랜딩 페이지 broker 카피 1줄 추가. |
