# 다중 broker 통합 자산 + 동일 티커 합산 (11인 회의)

> **작성일**: 2026-05-13
> **목적**: 같은 종목을 여러 증권사에 분산 보유하는 사용자를 위한 통합 평단가·자산 뷰 설계
> **관련**: [BROKER_FEATURE.md](BROKER_FEATURE.md) (Phase B), [THRESHOLDS.md](THRESHOLDS.md), [BUSINESS_REVIEW.md](BUSINESS_REVIEW.md)

---

## 1. 핵심 문제

현재 Phase B-1까지 작업으로:
- `StockItem.broker` 필드 추가 (한국 증권사 15개)
- 사용자가 같은 종목 중복 등록 **불가** (SearchBar isDuplicate 차단)

**그러나 실제 사용자 시나리오**:
- 토스 NVDA 10주 평단 $130
- 이후 키움으로 일부 이관해서 NVDA 5주 추가 매수 $180
- → **두 앱 따로 봐야 진짜 평단 계산** 됨
- "내 NVDA 진짜 평단은 얼마?" 답 안 나옴

→ **다중 broker 보유 + 통합 뷰** 필요.

---

## 2. 11인 회의 패널

| 시점 | 역할 |
|---|---|
| 🎯 PM | 제품 정체성 |
| 🎨 UX 디자이너 | 뷰 모드·편집 UX |
| 🏗️ 데이터 모델 아키텍트 | 옵션 A/B/C |
| 💰 금융 도메인 전문가 | 가중평균·환율 |
| 👨‍💼 페르소나 A | 분산 보유자 (같은 종목 여러 증권사) |
| 👩‍💼 페르소나 B | 증권사별 분리 (다른 종목) |
| 🧑‍💼 페르소나 C | 양도세 절세 전략가 |
| 🏎️ 백엔드 성능 엔지니어 | grouping 비용 |
| ⚖️ 컴플라이언스/법무 | 통합 평단가 표시 책임 |
| 🚀 그로스 마케터 | PRO 전환 동기 |
| 📋 세무 전문가 | 한국 세제 (양도세·ISA·IRP) |

## 3. 주요 발언 요약

### PM
'broker 기능 → 통합 자산 관리 도구' 정체성 전환점. 잘하면 토스조차 못 따라옴. **통합 뷰 디폴트 + broker별 분해 옵션**.

### UX
뷰 모드 3가지 필요 (통합·broker별·하이브리드). 편집 모달 broker 라벨 필수.

### 데이터 모델 아키텍트
**옵션 A 추천** — `stocks` 그대로, `(symbol, broker)` 페어로 unique, selector로 통합. 마이그레이션 0건.

### 금융 전문가
가중평균 평단가 공식:
```
mergedAvgCost = Σ(row_i.avgCost × row_i.shares) / Σ(row_i.shares)
```
환율 가중평균은 별도 계산.

### 페르소나 A (분산 보유)
"정확히 그렇게 함. 비서가 합쳐주면 진짜 가치 큼."

### 페르소나 B (증권사별 분리)
"같은 종목 중복 X. 통합보다 broker별 비교가 중요."

### 페르소나 C (양도세 전략가)
**가장 중요**. 매도 순서가 세금 결정. 250만원 공제 안에서 어느 broker NVDA 먼저 매도? 토스 못함. 진짜 moat.

### 백엔드 성능
50종목 × 3 broker = 150 lots. useMemo 충분. 다만 editingIdx가 array index라 깨질 위험.

### 컴플라이언스
통합 평단가는 '주비 계산값' — 증권사 표시와 다를 수 있음. 디스클레이머 필수.

### 그로스 마케터
무료 통합 뷰 + PRO 세금 시뮬·매도 순서 최적화. 진짜 PRO 동기.

### 세무 전문가
- 국내주식: 일반 비과세
- 해외주식: 22% 양도세 + 250만원 공제
- ISA: 200~400만원 비과세 한도
- IRP: 700만원 세액공제 (16.5% 환급)
- 연금저축: 400만원 세액공제

`accountType` 필드 우선순위 ↑.

---

## 4. 크로스 토론 합의 (7개 충돌)

| 충돌 | 합의 |
|---|---|
| 통합 vs broker별 디폴트 | **자동 추론** — 같은 symbol ≥ 2 broker 발견 시 통합 디폴트, 사용자 토글 우선 |
| 데이터 모델 A/B/C | **옵션 A + Transaction 보조** (raw 보존, selector 통합) |
| 중복 허용 — SearchBar | `(symbol, broker)` 페어로 차단. 다른 broker면 허용 |
| 세금 시뮬 무료/PRO | 무료=텍스트 안내, PRO=시뮬·매도 최적화 |
| 환율 시점 가중평균 | 2단계 — USD 평단가(정확) + KRW 현재 환율(참고) |
| 편집 UI 복잡도 | broker 선택 → 편집 모달 2단계 (broker 1개면 바로) |
| 매도 시 broker 선택 | 무료=수동, PRO=최저 세금 자동 |

---

## 5. 데이터 모델 — 옵션 A 최종

```ts
// 현재 (Phase B-1) — 그대로 유지
export interface StockItem {
  symbol: string;
  avgCost: number;
  shares: number;
  broker?: Broker;
  purchaseRate?: number;
  // ...
}
```

### addStock 변경

```ts
addStock: (category, stock) => set(state => {
  const existing = state.stocks[category].find(s =>
    s.symbol === stock.symbol && s.broker === stock.broker
  );
  if (existing) {
    alert(`이 종목은 ${stock.broker ? BROKER_LABELS[stock.broker] : '미지정'}에 이미 등록돼 있어요.`);
    return state;
  }
  // ... 동일 symbol 다른 broker → 허용
});
```

### Merge Selector (신규)

```ts
// utils/mergedHoldings.ts
export interface MergedHolding {
  symbol: string;
  totalShares: number;
  mergedAvgCost: number;          // USD/KRW 가중평균
  mergedPurchaseRate?: number;    // 환율 가중평균 (USD 종목만)
  lots: StockItem[];              // raw 보존
  brokers: Broker[];              // 등록된 broker 목록
  hasMultipleBrokers: boolean;
}

export function mergeHoldings(stocks: StockItem[]): MergedHolding[];
```

### 자동 추론 룰

```ts
const hasAnyMultiBrokerSymbol = mergedHoldings.some(h => h.hasMultipleBrokers);
const defaultViewMode = hasAnyMultiBrokerSymbol ? 'merged' : 'separated';
```

---

## 6. 4-Phase 구현 로드맵

### Phase M-1 — 데이터 모델 + selector (1~2일) 🔴 즉시

- portfolioStore.addStock `(symbol, broker)` 페어 중복 제어
- utils/mergedHoldings.ts selector 작성
- SearchBar isDuplicate 변경 → 모달 "다른 증권사로 추가?"

### Phase M-2 — 통합 뷰 UI (1~2일) 🔴 즉시

- PortfolioSection viewMode state (auto/merged/separated)
- 통합 row + broker별 분해 accordion
- 종목 카드 "🏦 2개 증권사" 배지
- 편집 시 broker 선택 모달 우선

### Phase M-3 — 자산 합계 카드 (0.5~1일) 🟠 즉시

- AssetSummaryCard 신규 또는 BrokerSummaryCard 보강
- 통합 자산 + broker별 분해 (트리 구조)
- 손익 + 비중 % 표시

### Phase M-4 — 세금 비서 (Phase 3, 베타 500명+) 🟡 진짜 moat

- accountType 필드 활성화 (Phase B-3 차용)
- 무료: ISA/IRP 한도 텍스트 안내
- PRO: 매도 순서 최적화 + 환차익 시뮬
- 세무 검토 + 변호사 자문 필수

---

## 7. 컴플라이언스 가드

1. **통합 평단가 ℹ️ 호버**: "주비 계산값. 증권사 표시와 다를 수 있어요"
2. **세금 시뮬은 참고용** 명시
3. **PRO 세금 비서 출시 시 변호사 1시간 검토** (메모리 트리거)
4. ISA/IRP 한도 안내 = 자기 입력 신뢰 (오류 시 책임 회피)

---

## 8. 마케팅 카피 (Phase M-2 후)

- 🟢 **"토스 NVDA + 키움 NVDA, 진짜 내 평단가는 얼마?"**
- 🟢 **"흩어진 같은 종목, 비서가 합쳐서 보여드려요"**
- 🟢 **"세금까지 챙겨주는 한국 유일의 주식 비서"** (M-4 후)

---

## 9. ROI

| Phase | 코드 | 사용자 가치 | 차별화 | 시점 |
|---|---|---|---|---|
| **M-1** | 1~2일 | 🔥 분산 보유자 즉시 만족 | 토스 1~2년 leadership | 즉시 |
| **M-2** | 1~2일 | 🔥 진짜 평단가 노출 | 동일 | M-1 직후 |
| **M-3** | 0.5~1일 | 🟢 한눈에 자산 합산 | 약함 | M-2 직후 |
| **M-4** | 5~10일 | 🔥 PRO 핵심 동기 | 🔥 진짜 moat | 베타 500명 + 세무 검토 |

---

## 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-13 | 11인 회의 결과 + 4-Phase 합의안. M-1/M-2/M-3 즉시 진행 결정. |
