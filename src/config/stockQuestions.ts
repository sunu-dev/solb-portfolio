/** Question IDs are shared by the UI and the server. No free-form instructions cross this boundary. */
export const STOCK_QUESTIONS = [
  {
    id: "safe",
    mentor: "safe",
    question: "어떤 위험부터 봐야 하나요?",
    description: "가격 변동과 재무 안정성에서 확인할 점",
    focus: "공개 자료로 확인되는 위험과 확인되지 않은 위험을 구분하세요.",
    tags: ["risk", "debt"],
  },
  {
    id: "value",
    mentor: "value",
    question: "가격은 실적에 비해 어떤가요?",
    description: "회사가 버는 돈과 주가를 함께 읽기",
    focus: "PER의 비교 기간과 적자일 때의 한계를 설명하세요.",
    tags: ["valuation"],
  },
  {
    id: "growth",
    mentor: "growth",
    question: "앞으로 성장할 근거가 있나요?",
    description: "성장을 뒷받침하는 사업과 달라질 조건",
    focus: "성장 기대와 확인된 결과를 구분하세요.",
    tags: ["growth"],
  },
  {
    id: "balance",
    mentor: "balance",
    question: "함께 보유할 때 무엇을 볼까요?",
    description: "한 종목에 치우치지 않는 비교 관점",
    focus: "개인 보유내역 없이 분산과 공통 위험을 설명하세요.",
    tags: ["risk"],
  },
  {
    id: "trend",
    mentor: "trend",
    question: "최근 주가 흐름은 어떤가요?",
    description: "가격과 거래량을 함께 읽기",
    focus: "가격 흐름을 원인이나 미래 수익으로 단정하지 마세요.",
    tags: ["price"],
  },
  {
    id: "simple",
    mentor: "simple",
    question: "시장 전체에 투자하면 어떨까요?",
    description: "개별 종목과 시장 지수의 차이",
    focus: "지수 투자도 손실 가능성이 있음을 비교 관점에서 설명하세요.",
    tags: ["index"],
  },
  {
    id: "earnings",
    mentor: "value",
    question: "실적이 좋아도 주가는 왜 다를까요?",
    description: "매출·이익·시장 기대를 구분하기",
    focus:
      "실제 실적, 회사 전망, 시장 기대를 분리하고 비교 자료가 없으면 없다고 하세요.",
    tags: ["earnings"],
  },
  {
    id: "cash",
    mentor: "safe",
    question: "이익이 실제 현금으로 들어오나요?",
    description: "순이익과 영업활동 현금흐름의 차이",
    focus:
      "현금흐름표가 없으면 이 회사의 현금 사정을 추정하지 말고 확인할 항목을 안내하세요.",
    tags: ["cash"],
  },
  {
    id: "debt",
    mentor: "safe",
    question: "빚과 금리 부담은 어떻게 봐야 하나요?",
    description: "차입금 만기·현금·이자 비용",
    focus:
      "총부채와 이자부 차입금을 구분하고 부채 자료가 없으면 판단을 유보하세요.",
    tags: ["debt", "rates"],
  },
  {
    id: "dilution",
    mentor: "value",
    question: "주식 수가 늘면 무엇이 달라지나요?",
    description: "증자·주식 보상과 한 주의 몫",
    focus:
      "주식 분할과 희석을 구분하고 실제 증자가 확인되지 않으면 가정으로만 설명하세요.",
    tags: ["dilution"],
  },
  {
    id: "guidance",
    mentor: "growth",
    question: "회사의 전망은 얼마나 믿어도 될까요?",
    description: "목표·가이던스와 확정 실적의 차이",
    focus:
      "가이던스는 미래 전망이며 조건과 실제 결과를 확인해야 함을 설명하세요.",
    tags: ["guidance", "growth"],
  },
  {
    id: "backlog",
    mentor: "growth",
    question: "수주가 바로 매출이 되나요?",
    description: "계약부터 납품·대금 회수까지",
    focus:
      "수주잔고와 매출·현금 수령의 시차, 취소 조건을 설명하되 계약 사실은 만들지 마세요.",
    tags: ["backlog"],
  },
  {
    id: "margins",
    mentor: "value",
    question: "많이 팔아도 남는 돈이 줄 수 있나요?",
    description: "원가·가격·이익률을 연결하기",
    focus:
      "매출 증가와 이익률 변화의 경로를 설명하고 실제 원인은 자료로 확인될 때만 제시하세요.",
    tags: ["margins", "inputs"],
  },
  {
    id: "capex",
    mentor: "growth",
    question: "공장·설비 투자는 언제 이익으로 이어질까요?",
    description: "먼저 쓰는 현금과 이후 가동률",
    focus:
      "투자 지출, 가동률, 감가상각과 수요의 조건을 설명하세요. 투자 발표만으로 미래 이익이 확정됐다고 설명하지 마세요.",
    tags: ["capex"],
  },
  {
    id: "rates",
    mentor: "value",
    question: "금리 변화가 이 회사에 어떻게 닿나요?",
    description: "이자 비용·고객 수요·주가 평가",
    focus:
      "금리에서 기업으로 전달되는 경로와 반대 효과를 설명하고 직접 노출은 미확인으로 구분하세요.",
    tags: ["rates"],
  },
  {
    id: "fx",
    mentor: "balance",
    question: "환율이 오르면 무조건 유리한가요?",
    description: "매출 통화와 비용 통화를 함께 보기",
    focus:
      "수출·수입·차입 통화와 환헤지 여부가 없으면 수혜나 피해를 단정하지 마세요.",
    tags: ["fx"],
  },
  {
    id: "customers",
    mentor: "safe",
    question: "큰 고객 한 곳에 의존하면 어떤가요?",
    description: "고객 집중과 계약 지속성을 확인하기",
    focus:
      "고객 집중 위험을 설명하되 확인되지 않은 고객 이름과 계약 비중은 만들지 마세요.",
    tags: ["customers"],
  },
  {
    id: "dividends",
    mentor: "safe",
    question: "배당이 높으면 좋은 투자일까요?",
    description: "배당 재원·지속 가능성·주가 하락",
    focus: "배당수익률과 총수익, 현금 재원, 감액 가능성을 구분하세요.",
    tags: ["dividends"],
  },
  {
    id: "regulation",
    mentor: "safe",
    question: "정책과 규제는 어디로 이어지나요?",
    description: "발표·시행·실제 사업 영향을 구분하기",
    focus:
      "법안·확정 법률·시행 시점을 구분하고 직접 적용이 확인되지 않으면 영향 확정으로 말하지 마세요.",
    tags: ["regulation"],
  },
  {
    id: "cycle",
    mentor: "growth",
    question: "이 산업의 호황은 계속될까요?",
    description: "재고·생산능력·수요의 순환",
    focus:
      "경기 순환의 확인 항목과 기업별 차이를 설명하고 고점·저점을 예측하지 마세요.",
    tags: ["cycle"],
  },
] as const;
export type StockQuestion = (typeof STOCK_QUESTIONS)[number];
export function stockQuestion(id: unknown): StockQuestion | undefined {
  return typeof id === "string"
    ? STOCK_QUESTIONS.find((item) => item.id === id)
    : undefined;
}
export const DISCOVERY_SIGNALS: Record<string, RegExp> = {
  earnings: /실적|매출|순이익|분기|earnings|revenue|profit/i,
  cash: /현금|cash.?flow/i,
  debt: /부채|차입|이자|debt|bond/i,
  dilution: /증자|희석|주식.?보상|dilut|offering/i,
  guidance: /전망|가이던스|guidance|outlook/i,
  backlog: /수주|계약|backlog|contract/i,
  margins: /이익률|마진|margin/i,
  capex: /설비|공장|투자.?지출|capex|capacity/i,
  rates: /금리|연준|fomc|interest.?rate/i,
  fx: /환율|달러|원화|currency|exchange.?rate/i,
  inputs: /원자재|유가|원가|oil|commodity/i,
  customers: /고객|customer/i,
  dividends: /배당|dividend/i,
  regulation: /규제|정책|관세|regulat|tariff/i,
  cycle: /재고|감산|증산|inventory|cycle/i,
};
export function discoveryTags(text: string): string[] {
  return Object.entries(DISCOVERY_SIGNALS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([tag]) => tag);
}
export function rankQuestions(
  tags: readonly string[],
  read: readonly string[] = [],
) {
  return STOCK_QUESTIONS.map((item, index) => ({
    item,
    index,
    score:
      item.tags.reduce((n, tag) => n + (tags.includes(tag) ? 5 : 0), 0) -
      (read.includes(item.id) ? 2 : 0),
  }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}

export function lessonForQuestion(id: string): string {
  return (
    (
      {
        safe: "debt",
        value: "valuation",
        growth: "guidance",
        balance: "index",
        trend: "price",
        simple: "index",
      } as Record<string, string>
    )[id] ?? id
  );
}
