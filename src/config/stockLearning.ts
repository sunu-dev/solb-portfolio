/** Source-backed background education. Examples are hypothetical, never company-specific facts. */
export const STOCK_LESSONS = [
  {
    id: "earnings",
    label: "이익 읽기",
    title: "매출이 늘면 이익도 늘었을까요?",
    titlePhrases: ["매출이 늘면", "이익도 늘었을까요?"],
    explanation:
      "매출은 제품과 서비스를 판매한 금액이고, 순이익은 비용과 세금 등을 반영한 결과예요. 매출이 늘어도 비용이 더 많이 늘면 순이익은 줄 수 있어요.",
    example:
      "가상의 회사가 매출 100, 비용·세금 80이면 순이익은 20이에요. 다음 기간에 매출 120, 비용·세금 110이면 순이익은 10이에요. 같은 단위로 단순화한 예시예요.",
    observation:
      "실적 뉴스에서 매출과 이익의 비교 기간이 같은지 찾아보세요. 분기 실적과 연간 실적은 구분해서 읽어요.",
    source:
      "https://www.sec.gov/about/reports-publications/beginners-guide-financial-statements",
    sourceLabel: "SEC · 재무제표 입문 (영문)",
  },
  {
    id: "cash",
    label: "현금 흐름",
    title: "이익과 통장에 들어온 돈은 같을까요?",
    titlePhrases: ["이익과", "통장에 들어온 돈은", "같을까요?"],
    explanation:
      "순이익과 현금 흐름은 서로 다른 숫자예요. 외상 판매처럼 매출을 기록한 시점과 현금을 받는 시점이 다를 수 있어요.",
    example:
      "가상의 회사가 상품을 외상으로 판매했어요. 매출을 인식했지만 대금은 다음 기간에 받기로 했다면, 이번 판매의 현금 수입은 아직 없어요.",
    observation:
      "실적 자료에서 영업활동 현금흐름과 순이익을 찾아보세요. 차이가 있다면 주석이나 회사 설명에 이유가 있는지 확인해요.",
    source:
      "https://www.sec.gov/about/reports-publications/beginners-guide-financial-statements",
    sourceLabel: "SEC · 재무제표 입문 (영문)",
  },
  {
    id: "evidence",
    label: "뉴스 읽기",
    title: "기사 속 숫자는 어디서 왔을까요?",
    titlePhrases: ["기사 속 숫자는", "어디서 왔을까요?"],
    explanation:
      "회사가 발표한 실적, 회사의 목표, 기사 작성자의 해석은 구분해서 읽어요. 미국 기업의 연차보고서인 10-K에는 사업 설명, 위험 요인, 재무제표 등이 담겨 있어요.",
    example:
      "가상의 기사에 올해 실적과 내년 목표가 함께 나왔어요. 올해 실적은 해당 기간의 결과이고, 내년 목표는 아직 실현된 결과가 아니에요.",
    observation:
      "관련 뉴스 한 건에서 확인된 사실과 아직 궁금한 점을 하나씩 찾아보세요. 국내 기업은 사업보고서, 미국 기업은 10-K 등 원문과 연결해 읽을 수 있어요.",
    source: "https://www.sec.gov/answers/reada10k.htm",
    sourceLabel: "SEC · 10-K 읽는 법 (영문)",
  },
  {
    id: "valuation",
    label: "가격과 가치",
    title: "PER이 낮으면 무조건 싼가요?",
    titlePhrases: ["PER이 낮으면 무조건 싼가요?"],
    explanation:
      "PER은 주가를 한 주당 이익으로 나눈 값이에요. 이익이 일시적으로 크거나 앞으로 줄 것으로 예상돼도 낮아질 수 있어요.",
    example:
      "가상의 회사 A와 B의 PER이 각각 8배와 20배예요. A의 이익에 일회성 자산 매각이 포함돼 있다면 숫자만으로 A가 더 싸다고 말하기 어려워요.",
    observation:
      "최근 실적 기준인지 예상 실적 기준인지, 이익이 반복되는지, 같은 업종의 비교인지 확인해요. 적자 회사에서는 PER 비교가 적절하지 않을 수 있어요.",
    next: "earnings",
    source:
      "https://www.investor.gov/introduction-investing/investing-basics/investment-products/stocks",
    sourceLabel: "SEC Investor.gov · 주식의 기초 (영문)",
  },
  {
    id: "debt",
    label: "빚과 현금",
    title: "부채가 많으면 모두 위험할까요?",
    titlePhrases: ["부채가 많으면 모두 위험할까요?"],
    explanation:
      "부채에는 외상 매입금도 포함돼요. 이자를 내는 차입금은 만기와 금리를 따로 봐야 해요. 갚을 돈과 쓸 수 있는 현금의 시점이 중요해요.",
    example:
      "가상의 회사가 1년 뒤 100을 갚아야 하는데 현금 20만 갖고 있다면, 영업으로 벌 현금과 차환 가능성을 더 확인해야 해요.",
    observation:
      "차입금 만기, 고정·변동금리, 현금, 영업활동 현금흐름을 함께 찾아봐요. 부채 총액 하나로 안전성을 확정하지 않아요.",
    next: "cash",
    source:
      "https://www.sec.gov/about/reports-publications/beginners-guide-financial-statements",
    sourceLabel: "SEC · 재무제표 입문 (영문)",
  },
  {
    id: "dilution",
    label: "한 주의 몫",
    title: "주식 수가 늘면 내 한 주는 어떻게 되나요?",
    titlePhrases: ["주식 수가 늘면 내 한 주는 어떻게 되나요?"],
    explanation:
      "회사가 새 주식을 발행하면 기존 한 주가 차지하는 지분 비율이 줄 수 있어요. 이를 희석이라고 해요. 조달한 돈을 어디에 쓰는지도 중요해요.",
    example:
      "가상의 회사 주식이 100주에서 125주가 되고 이익이 그대로 100이라면, 주당 이익은 1에서 0.8이 돼요. 주식 분할은 주가·주식 수를 함께 조정하므로 같은 현상이 아니에요.",
    observation:
      "발행 규모와 가격, 자금 용도, 주식 보상, 전환사채 조건을 확인해요. 자금 조달이 기업 성장으로 이어질지는 별도 판단이에요.",
    next: "earnings",
    source:
      "https://www.investor.gov/introduction-investing/investing-basics/investment-products/stocks",
    sourceLabel: "SEC Investor.gov · 주식의 기초 (영문)",
  },
  {
    id: "guidance",
    label: "회사 전망",
    title: "가이던스는 약속한 실적인가요?",
    titlePhrases: ["가이던스는 약속한 실적인가요?"],
    explanation:
      "가이던스는 회사가 제시한 향후 매출·이익 등의 전망이에요. 확정 결과가 아니라 수요·비용·환율 같은 가정 위에 놓여 있어요.",
    example:
      "가상의 회사가 다음 분기 매출을 90~110으로 예상했어요. 실제 결과 100은 범위 안이지만, 시장이 115를 기대했다면 반응은 다를 수 있어요.",
    observation:
      "전망의 대상 기간, 이전 전망과 바뀐 점, 회사가 밝힌 가정과 실제 결과를 나눠 읽어요. 시장 예상 자료가 없으면 비교를 만들지 않아요.",
    next: "evidence",
    source: "https://www.sec.gov/answers/reada10k.htm",
    sourceLabel: "SEC · 10-K 읽는 법 (영문)",
  },
  {
    id: "backlog",
    label: "수주와 매출",
    title: "큰 계약을 따면 당장 돈이 들어오나요?",
    titlePhrases: ["큰 계약을 따면 당장 돈이 들어오나요?"],
    explanation:
      "수주는 주문이나 계약을 확보하는 일이에요. 수주잔고는 아직 매출로 반영되지 않은 주문의 규모를 나타낼 수 있지만 회사마다 정의가 달라요.",
    example:
      "가상의 조선사가 배를 수주해 3년 뒤 인도해요. 계약금은 먼저 받고 나머지는 공정에 따라 받으며, 매출 인식도 계약 조건에 따라 달라질 수 있어요.",
    observation:
      "납품 일정, 취소·가격 변경 조건, 원가, 계약금과 매출 인식 기준을 확인해요. 수주 총액을 이번 분기 이익으로 더하지 않아요.",
    next: "cash",
    source: "https://www.sec.gov/answers/reada10k.htm",
    sourceLabel: "SEC · 10-K 읽는 법 (영문)",
  },
  {
    id: "margins",
    label: "남는 돈",
    title: "많이 팔았는데 이익률은 왜 줄까요?",
    titlePhrases: ["많이 팔았는데 이익률은 왜 줄까요?"],
    explanation:
      "이익률은 매출 중 이익으로 남는 비율이에요. 원가 상승이나 할인 판매, 제품 구성 변화로 매출이 늘어도 이익률은 낮아질 수 있어요.",
    example:
      "가상의 제품을 100에 팔고 원가가 60이면 매출총이익은 40이에요. 원가가 80이 되면 같은 가격에 팔아도 20만 남아요. 다른 비용은 생략한 예시예요.",
    observation:
      "매출총이익률과 영업이익률을 구분하고 비교 기간·일회성 비용·제품 구성을 살펴봐요. 숫자만으로 원인을 확정하지 않아요.",
    next: "earnings",
    source:
      "https://www.sec.gov/about/reports-publications/beginners-guide-financial-statements",
    sourceLabel: "SEC · 재무제표 입문 (영문)",
  },
  {
    id: "capex",
    label: "설비 투자",
    title: "공장을 지으면 바로 이익이 늘까요?",
    titlePhrases: ["공장을 지으면 바로 이익이 늘까요?"],
    explanation:
      "설비 투자는 생산이나 서비스에 오래 쓸 자산에 돈을 쓰는 일이에요. 현금은 먼저 나가지만 가동과 매출은 뒤에 생길 수 있어요.",
    example:
      "가상의 회사가 공장에 100을 쓰고 내년에 가동해요. 주문이 부족해 절반만 가동하면 예상한 매출과 현금 회수가 늦어질 수 있어요.",
    observation:
      "투자 지출, 가동 시점, 생산능력 대비 수요, 감가상각, 현금 여력을 함께 봐요. 투자 발표와 실현 이익을 구분해요.",
    next: "cycle",
    source:
      "https://www.sec.gov/about/reports-publications/beginners-guide-financial-statements",
    sourceLabel: "SEC · 재무제표 입문 (영문)",
  },
  {
    id: "rates",
    label: "금리의 연결",
    title: "금리가 내리면 모든 회사에 좋을까요?",
    titlePhrases: ["금리가 내리면 모든 회사에 좋을까요?"],
    explanation:
      "금리는 돈을 빌리는 가격이에요. 이자 부담과 고객의 소비·투자, 미래 이익에 대한 평가에 서로 다른 경로로 닿아요.",
    example:
      "가상의 회사가 변동금리로 빌렸다면 금리 하락이 이자 부담을 줄일 수 있어요. 그러나 경기 악화로 고객 주문이 더 줄면 전체 이익은 나빠질 수도 있어요.",
    observation:
      "차입금의 금리 조건, 고객의 자금 조달, 금융자산 수익과 실제 수요를 확인해요. 금리 방향만으로 주가 방향을 정하지 않아요.",
    next: "debt",
    source:
      "https://www.federalreserve.gov/aboutthefed/fedexplained/monetary-policy.htm",
    sourceLabel: "연준 · 통화정책의 작동 방식 (영문)",
  },
  {
    id: "fx",
    label: "환율의 연결",
    title: "달러가 오르면 수출 회사는 늘 유리할까요?",
    titlePhrases: ["달러가 오르면 수출 회사는 늘 유리할까요?"],
    explanation:
      "환율은 서로 다른 돈을 바꾸는 비율이에요. 매출과 비용, 빚의 통화가 다르면 같은 환율 변화도 서로 다른 영향을 줘요.",
    example:
      "가상의 회사가 달러 매출 100, 달러 원료비 80을 갖고 있다면 매출 전체가 아니라 비용과 환헤지까지 함께 봐야 해요.",
    observation:
      "매출·비용·차입 통화, 환헤지, 해외 자회사 환산 효과를 확인해요. 수출 기업이라는 이유만으로 수혜를 확정하지 않아요.",
    next: "margins",
    source: "https://www.sec.gov/answers/reada10k.htm",
    sourceLabel: "SEC · 10-K 읽는 법 (영문)",
  },
  {
    id: "inputs",
    label: "원자재와 비용",
    title: "유가가 오르면 어떤 과정을 거칠까요?",
    titlePhrases: ["유가가 오르면 어떤 과정을 거칠까요?"],
    explanation:
      "원자재 가격은 기업의 생산·운송 비용으로 전달될 수 있어요. 판매 가격에 얼마나 빨리 반영할 수 있는지가 이익에 영향을 줘요.",
    example:
      "가상의 항공사가 연료를 비싸게 사도 운임을 바로 올리기 어렵다면 이익 부담이 생길 수 있어요. 미리 가격을 고정한 계약이 있다면 시차가 달라져요.",
    observation:
      "원가 구성, 구매 계약, 재고, 판매 가격, 수요 변화를 확인해요. 원자재와 주가가 함께 움직였다는 것만으로 원인을 확정하지 않아요.",
    next: "margins",
    source: "https://www.sec.gov/answers/reada10k.htm",
    sourceLabel: "SEC · 10-K 읽는 법 (영문)",
  },
  {
    id: "customers",
    label: "고객 집중",
    title: "고객이 크면 사업도 더 안전할까요?",
    titlePhrases: ["고객이 크면 사업도 더 안전할까요?"],
    explanation:
      "큰 고객은 안정적인 주문을 줄 수도 있지만 한 고객의 구매 축소가 회사 전체에 크게 영향을 줄 수도 있어요. 이를 고객 집중 위험이라고 해요.",
    example:
      "가상의 회사 매출 절반이 한 고객에게서 나온다면 그 고객의 발주 20% 감소가 다른 조건이 같을 때 전체 매출 10%에 영향을 줄 수 있어요.",
    observation:
      "사업보고서의 주요 고객 비중, 계약 기간, 대체 고객, 고객의 투자 계획을 확인해요. 비공개 고객 이름은 추정하지 않아요.",
    next: "backlog",
    source: "https://www.sec.gov/answers/reada10k.htm",
    sourceLabel: "SEC · 10-K 읽는 법 (영문)",
  },
  {
    id: "dividends",
    label: "배당 읽기",
    title: "배당수익률이 높으면 이익도 큰가요?",
    titlePhrases: ["배당수익률이 높으면 이익도 큰가요?"],
    explanation:
      "배당수익률은 주가 대비 연간 배당의 비율이에요. 주가가 떨어져 높아질 수도 있고 배당은 줄거나 중단될 수 있어요.",
    example:
      "가상의 주식 배당이 5이고 가격이 100에서 50으로 내려가면 수익률 표시는 5%에서 10%가 돼요. 기존 투자자의 주가 손실이 사라진 것은 아니에요.",
    observation:
      "과거·예상 배당 여부, 배당 재원과 현금흐름, 일회성 배당, 주가를 포함한 총수익을 함께 봐요.",
    next: "cash",
    source:
      "https://www.investor.gov/introduction-investing/investing-basics/investment-products/stocks",
    sourceLabel: "SEC Investor.gov · 주식의 기초 (영문)",
  },
  {
    id: "regulation",
    label: "정책과 규제",
    title: "정책 발표가 바로 회사 이익이 되나요?",
    titlePhrases: ["정책 발표가 바로 회사 이익이 되나요?"],
    explanation:
      "정책은 제안, 의결, 시행을 거쳐 실제 사업에 적용돼요. 적용 대상과 예외, 시행 시점에 따라 영향이 달라져요.",
    example:
      "가상의 보조금 정책이 발표돼도 대상 제품이나 생산 지역 조건을 충족하지 못하면 해당 회사가 받지 못할 수 있어요.",
    observation:
      "공식 발표 원문, 확정 여부, 시행일, 적용 조건과 회사의 실제 사업 노출을 확인해요. 법안 발의를 이미 시행된 규정처럼 읽지 않아요.",
    next: "evidence",
    source: "https://www.sec.gov/answers/reada10k.htm",
    sourceLabel: "SEC · 10-K 읽는 법 (영문)",
  },
  {
    id: "cycle",
    label: "산업의 순환",
    title: "호황인데 왜 재고를 살펴보나요?",
    titlePhrases: ["호황인데 왜 재고를 살펴보나요?"],
    explanation:
      "수요가 늘면 기업들이 생산을 확대하지만 공급이 수요를 앞지르면 재고가 쌓이고 가격이 내려갈 수 있어요. 산업마다 이 과정의 속도가 달라요.",
    example:
      "가상의 메모리 회사들이 동시에 공장을 늘렸는데 고객 주문이 멈추면 재고와 할인 판매가 늘 수 있어요. 실제 기업의 상황을 말하는 예시는 아니에요.",
    observation:
      "재고 일수, 가동률, 제품 가격, 고객 주문을 여러 기간 비교해요. 한 숫자로 호황의 끝이나 주가 저점을 예측하지 않아요.",
    next: "capex",
    source: "https://www.sec.gov/answers/reada10k.htm",
    sourceLabel: "SEC · 10-K 읽는 법 (영문)",
  },
  {
    id: "inflation",
    label: "물가와 소비",
    title: "물가 상승이 왜 내 주식과 연결되나요?",
    titlePhrases: ["물가 상승이 왜 내 주식과 연결되나요?"],
    explanation:
      "물가는 여러 상품과 서비스의 가격 수준이에요. 상승률이 낮아지는 것과 가격 자체가 내려가는 것은 달라요. 기업의 원가와 소비자의 구매력에 닿을 수 있어요.",
    example:
      "가상의 물건 가격이 100에서 110, 다음 해 115.5가 되면 상승률은 10%에서 5%로 낮아졌지만 가격은 더 올랐어요.",
    observation:
      "소비자물가의 대상 국가·기간, 세부 항목, 임금과 원가, 기업의 가격 전가 여력을 함께 봐요. 발표 수치만으로 금리 결정을 확정하지 않아요.",
    next: "rates",
    source: "https://www.bls.gov/cpi/questions-and-answers.htm",
    sourceLabel: "BLS · 소비자물가 설명 (영문)",
  },
  {
    id: "index",
    label: "지수와 분산",
    title: "여러 종목을 사면 위험이 사라지나요?",
    titlePhrases: ["여러 종목을 사면 위험이 사라지나요?"],
    explanation:
      "분산은 한 기업에 문제가 생겼을 때의 영향을 줄이는 방법이에요. 같은 산업·국가에 쏠려 있으면 종목 수가 많아도 공통 위험은 남아요.",
    example:
      "가상의 펀드가 100개 기업을 담아도 대부분 같은 산업이면 그 산업 수요 감소가 여러 종목에 동시에 영향을 줄 수 있어요.",
    observation:
      "지수의 구성·상위 종목 비중·국가와 산업 분포, 추종 방식과 비용을 확인해요. 분산이 원금 보장을 뜻하지 않아요.",
    next: "cycle",
    source:
      "https://www.investor.gov/introduction-investing/investing-basics/investment-products/stocks",
    sourceLabel: "SEC Investor.gov · 주식의 기초 (영문)",
  },
  {
    id: "price",
    label: "가격과 거래량",
    title: "주가가 떨어진 이유를 차트만으로 알 수 있나요?",
    titlePhrases: ["주가가 떨어진 이유를 차트만으로 알 수 있나요?"],
    explanation:
      "차트는 거래된 가격과 거래량을 보여줘요. 시장 참여자의 모든 이유나 다음 가격은 보여주지 않아요.",
    example:
      "가상의 회사 주가가 실적 발표일에 내려갔어도 같은 날 시장 전체가 하락했다면 실적 하나가 원인이라고 확정하기 어려워요.",
    observation:
      "시세 시각, 거래 시간, 비교 기간, 시장 흐름과 공식 발표를 함께 확인해요. 기술 지표를 매매 결과의 보장으로 사용하지 않아요.",
    next: "evidence",
    source:
      "https://www.investor.gov/introduction-investing/investing-basics/investment-products/stocks",
    sourceLabel: "SEC Investor.gov · 주식의 기초 (영문)",
  },
] as const;
