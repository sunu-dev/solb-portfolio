/** Editorial links explain the conceptual connection, not a claim about a company's actual exposure. */
export const LEARNING_LINKS: Record<string, readonly [string, string][]> = {
  earnings: [
    ["cash", "장부의 이익이 실제 돈으로 들어오는 과정"],
    ["margins", "많이 팔아도 남는 돈이 달라지는 이유"],
    ["guidance", "확정 실적 다음에 시장이 보는 전망"],
  ],
  cash: [
    ["debt", "들어온 현금으로 갚아야 할 돈"],
    ["capex", "현금을 다시 공장과 설비에 쓰는 과정"],
    ["dividends", "남은 현금을 주주에게 돌려주는 방식"],
  ],
  evidence: [
    ["guidance", "결과와 전망을 구분해서 읽기"],
    ["earnings", "기사 속 매출과 이익을 확인하기"],
    ["regulation", "정책 발표와 시행을 구분하기"],
  ],
  valuation: [
    ["earnings", "가격과 비교할 이익은 어떤 숫자인가"],
    ["rates", "미래 이익을 평가할 때 금리가 닿는 경로"],
    ["cycle", "호황기의 이익만 보면 놓치는 것"],
  ],
  debt: [
    ["rates", "이자 부담이 달라지는 조건"],
    ["cash", "갚을 돈을 마련할 수 있는지 보는 자료"],
    ["dilution", "빚 대신 새 주식으로 자금을 모으면"],
  ],
  dilution: [
    ["earnings", "주식 수가 늘 때 한 주당 이익의 변화"],
    ["capex", "조달한 돈을 설비에 쓰는 이유"],
    ["valuation", "가격 비교에 쓰는 이익도 달라질까"],
  ],
  guidance: [
    ["backlog", "앞으로의 매출을 가늠할 때 보는 주문"],
    ["cycle", "회사의 전망을 바꾸는 산업 수요"],
    ["evidence", "회사 목표와 확정 결과를 구분하는 법"],
  ],
  backlog: [
    ["cash", "계약을 따도 대금을 받기까지의 시차"],
    ["margins", "큰 계약이 큰 이익은 아닐 수 있는 이유"],
    ["customers", "주문을 주는 고객 한 곳에 집중된다면"],
  ],
  margins: [
    ["inputs", "원자재가 남는 돈에 닿는 경로"],
    ["fx", "매출과 비용의 통화가 다르다면"],
    ["earnings", "이익률과 이익 금액을 함께 읽기"],
  ],
  capex: [
    ["cycle", "다 같이 공장을 늘리면 생기는 일"],
    ["cash", "투자 전에 현금 여력을 확인하는 이유"],
    ["debt", "투자 자금을 빌렸다면 확인할 조건"],
  ],
  rates: [
    ["debt", "금리가 차입 비용으로 전달되는 과정"],
    ["valuation", "금리와 미래 이익에 대한 평가"],
    ["inflation", "금리 결정을 볼 때 물가를 함께 읽는 이유"],
  ],
  fx: [
    ["margins", "통화별 매출과 비용이 이익에 닿는 과정"],
    ["inputs", "수입 원자재 비용까지 함께 보기"],
    ["debt", "외화로 빌린 돈을 갚는다면"],
  ],
  inputs: [
    ["margins", "원가 상승을 판매 가격에 반영할 수 있을까"],
    ["inflation", "원자재와 소비자물가는 어떻게 다른가"],
    ["cycle", "공급과 수요가 가격을 바꾸는 과정"],
  ],
  customers: [
    ["backlog", "계약의 기간과 취소 조건을 보는 이유"],
    ["cycle", "고객의 산업이 흔들릴 때 함께 볼 것"],
    ["evidence", "실제 고객 비중은 어디서 확인할까"],
  ],
  dividends: [
    ["cash", "배당의 재원이 실제 현금인지 확인하기"],
    ["debt", "배당과 빚 상환을 함께 보는 이유"],
    ["price", "배당만 보면 주가 손익을 놓치는 이유"],
  ],
  regulation: [
    ["evidence", "제안과 확정 규정을 구분하는 자료"],
    ["capex", "정책 조건이 공장 투자에 닿는 과정"],
    ["margins", "관세와 규제가 비용으로 이어지는 경로"],
  ],
  cycle: [
    ["capex", "호황에 늘린 생산능력이 나중에 만드는 차이"],
    ["inputs", "공급과 수요가 원자재 가격으로 이어질 때"],
    ["valuation", "좋았던 이익만으로 가격을 비교하면"],
  ],
  inflation: [
    ["rates", "물가를 보고 금리 결정까지 이어 읽기"],
    ["margins", "원가와 판매 가격 사이에 남는 돈"],
    ["inputs", "물가를 구성하는 원자재 가격의 역할"],
  ],
  index: [
    ["cycle", "여러 종목에도 남는 산업 공통 위험"],
    ["price", "시장 전체 흐름과 개별 종목을 나눠 보기"],
    ["valuation", "지수도 가격과 실적을 비교할 수 있을까"],
  ],
  price: [
    ["evidence", "차트 밖에서 확인해야 할 실제 발표"],
    ["earnings", "실적과 주가의 반응을 구분하기"],
    ["index", "같은 날 시장 전체는 어땠을까"],
  ],
};
export const LEARNING_TERMS: readonly [string, string][] = [
  ["영업활동 현금흐름", "cash"],
  ["현금흐름표", "cash"],
  ["현금 흐름", "cash"],
  ["순이익", "earnings"],
  ["PER", "valuation"],
  ["가이던스", "guidance"],
  ["수주잔고", "backlog"],
  ["이익률", "margins"],
  ["설비 투자", "capex"],
  ["금리", "rates"],
  ["환율", "fx"],
  ["원자재", "inputs"],
  ["배당수익률", "dividends"],
  ["배당", "dividends"],
  ["희석", "dilution"],
  ["차입금", "debt"],
  ["물가", "inflation"],
  ["분산", "index"],
];
