export type MarketGuideId = 'rates' | 'inflation' | 'currency' | 'earnings';

export interface MarketGuide {
  id: MarketGuideId;
  category: string;
  title: string;
  summary: string;
  terms: { term: string; meaning: string }[];
  steps: { title: string; body: string }[];
  watchPoints: string[];
  condition: string;
  sources: { label: string; url: string }[];
  eventKinds: import('@/lib/economicEvents').EconomicKind[];
  connection: 'us-market' | 'usd-value' | 'company';
}

// Editorial learning guides, not a feed of current events or individual recommendations.
// Source definitions were checked on 2026-10-02.
export const MARKET_GUIDES: MarketGuide[] = [
  {
    id: 'rates',
    category: '금리와 경기',
    title: '금리를 내리면 왜 주식도 움직일까요?',
    summary: '돈을 빌리는 비용이 바뀌면 소비와 기업 투자, 주식을 평가하는 기준까지 달라질 수 있어요.',
    terms: [
      { term: '기준금리', meaning: '중앙은행이 정책으로 정하는 금리예요. 시중의 대출·예금 금리에 영향을 주는 출발점이에요.' },
      { term: '연준·FOMC', meaning: '연준은 미국의 중앙은행이고, FOMC는 미국 기준금리 등 통화정책을 결정하는 회의체예요.' },
      { term: '시장금리', meaning: '금융시장에서 실제로 돈을 빌리고 빌려줄 때 적용되는 금리예요. 앞으로의 금리·경기 전망에도 영향을 받아요.' },
    ],
    steps: [
      { title: '결정과 이유를 함께 읽어요', body: '금리 인하를 발표하면 이번 결정뿐 아니라 왜 내렸는지, 앞으로 무엇을 확인하겠다는지도 봐요. 경기 둔화에 대응하는 인하일 수도 있어요.' },
      { title: '대출과 소비로 전달돼요', body: '대출금리가 내려가면 가계의 이자 부담이 줄고 집이나 자동차를 살 여력이 늘 수 있어요. 기존 고정금리 대출에는 바로 반영되지 않을 수 있어요.' },
      { title: '산업과 기업의 이익을 바꿔요', body: '소비가 늘면 관련 기업의 매출에 도움이 되고, 기업도 낮은 이자로 설비에 투자할 수 있어요. 효과는 회사의 빚과 고객 수요에 따라 달라져요.' },
      { title: '주식의 평가 기준에도 영향을 줘요', body: '채권에서 받을 수 있는 이자가 줄면 투자자는 주식의 예상 이익을 다시 비교해요. 미래 성장에 대한 기대가 큰 회사는 금리 전망 변화에 민감할 수 있어요.' },
    ],
    watchPoints: [
      '이번 결정은 시장이 예상했던 내용과 얼마나 다른가요?',
      '대출·국채금리도 움직였나요? 중앙은행은 경기와 물가를 어떻게 설명했나요?',
      '내 회사의 이자 비용과 고객 수요 중 어느 경로가 더 중요한가요?',
    ],
    condition: '금리를 내려도 경기 악화로 매출 전망이 나빠지면 주가가 내릴 수 있어요. 이미 예상한 결정은 새 소식이 아닐 수도 있어요.',
    sources: [
      { label: '연준 · 통화정책의 작동 방식', url: 'https://www.federalreserve.gov/aboutthefed/fedexplained/monetary-policy.htm' },
      { label: '연준 · 금리와 금융 여건의 연결', url: 'https://www.federalreserve.gov/monetarypolicy/monetary-policy-what-are-its-goals-how-does-it-work.htm' },
    ],
    eventKinds: ['fomc'],
    connection: 'us-market',
  },
  {
    id: 'inflation',
    category: '물가와 시장',
    title: '물가 발표를 주식 투자자가 보는 이유는?',
    summary: '장바구니 가격의 변화는 생활비뿐 아니라 금리 전망, 기업의 비용과 매출에도 이어져요.',
    terms: [
      { term: 'CPI·소비자물가지수', meaning: '미국 도시 소비자가 사는 상품·서비스의 가격이 평균적으로 얼마나 변했는지 보여줘요.' },
      { term: 'PCE 물가지수', meaning: '미국 가계의 소비와 가계를 대신해 지출한 항목까지 폭넓게 보는 물가 지표예요. 연준의 물가 목표는 이 지표를 기준으로 해요.' },
      { term: '근원 물가', meaning: '미국 CPI·PCE에서 변동이 큰 식품·에너지를 제외해 지속적인 가격 흐름을 살펴보는 지표예요.' },
      { term: '전월 대비·전년 대비', meaning: '각각 지난달, 지난해 같은 달과 비교한 변화예요. 비교 기간이 달라 두 수치를 구분해서 봐요.' },
    ],
    steps: [
      { title: '어떤 가격이 변했는지 봐요', body: '물가 상승률이 낮아졌다는 건 가격이 오르는 속도가 느려졌다는 뜻일 수 있어요. 전체 수치와 함께 주거·서비스 등 어떤 항목이 움직였는지 확인해요.' },
      { title: '금리 전망으로 이어져요', body: '물가 압력이 약해지면 연준이 높은 금리를 유지할 필요가 줄었다는 기대가 생길 수 있어요. 한 번의 발표보다 이어지는 흐름과 고용 상황도 중요해요.' },
      { title: '기업마다 비용과 매출이 달라져요', body: '재료비 상승이 둔화하면 비용 부담이 줄 수 있어요. 반대로 판매 가격을 올리기 어려워지거나 소비가 약해지면 매출에 부담이 될 수 있어요.' },
      { title: '예상과 실제의 차이를 확인해요', body: '투자자는 발표 전에 이미 물가를 예상해요. 실제 수치가 그 예상과 어떻게 달랐는지, 이후 시장금리와 기업 이익 전망이 바뀌었는지를 함께 봐요.' },
    ],
    watchPoints: [
      'CPI와 PCE 중 무엇이며, 전월 대비와 전년 대비 중 어떤 수치인가요?',
      '전체와 근원 물가가 같은 방향인가요? 어느 항목이 변했나요?',
      '내 회사에는 비용 부담 완화와 소비 둔화 중 어느 쪽이 더 관련 있나요?',
    ],
    condition: '물가 상승률 둔화와 물가 하락은 달라요. 같은 물가 수치라도 예상치와 경기 상황에 따라 시장의 해석이 달라질 수 있어요.',
    sources: [
      { label: '미국 노동통계국 · CPI 설명', url: 'https://www.bls.gov/cpi/questions-and-answers.htm' },
      { label: '미국 경제분석국 · PCE 물가지수', url: 'https://www.bea.gov/data/personal-consumption-expenditures-price-index' },
      { label: '미국 경제분석국 · 근원 PCE', url: 'https://www.bea.gov/data/personal-consumption-expenditures-price-index-excluding-food-and-energy' },
      { label: '연준 · 물가 목표와 통화정책', url: 'https://www.federalreserve.gov/monetarypolicy/monetary-policy-what-are-its-goals-how-does-it-work.htm' },
    ],
    eventKinds: ['cpi', 'pce'],
    connection: 'us-market',
  },
  {
    id: 'currency',
    category: '환율과 내 수익',
    title: '미국 주가는 그대로인데 내 수익은 왜 바뀔까요?',
    summary: '한국 투자자의 미국 주식은 달러로 본 가격과 원화로 환산한 금액을 나누어 봐야 해요.',
    terms: [
      { term: '원·달러 환율', meaning: '1달러를 사는 데 필요한 원화 금액이에요. 1,300원에서 1,400원이 되면 달러가 원화보다 비싸진 거예요.' },
      { term: '달러 기준 수익', meaning: '미국 주식을 달러로 샀던 가격과 현재 가격을 비교한 수익이에요. 원·달러 환율 변화와는 구분해요.' },
      { term: '원화 평가액', meaning: '달러로 표시된 보유 주식의 가치를 현재 환율로 원화로 바꿔 계산한 금액이에요.' },
    ],
    steps: [
      { title: '돈이 어느 통화로 이동하는지 봐요', body: '금리 전망과 경기 불안 등은 투자자들의 달러 수요를 바꿀 수 있어요. 여러 요인이 함께 작용하므로 금리 한 가지로 환율 방향을 정할 수는 없어요.' },
      { title: '달러 가격과 환율을 나눠요', body: '일반 미국 주식의 원화 평가액은 달러 주가 × 보유 수량 × 원·달러 환율로 계산해요. 주가가 같아도 환율이 오르면 원화 평가액은 커져요.' },
      { title: '간단한 숫자로 연결해봐요', body: '학습 예시예요. 100달러짜리 주식 1주는 환율 1,300원일 때 13만원, 1,400원일 때 14만원이에요. 달러 주가는 그대로이며 수수료·세금은 제외한 계산이에요.' },
      { title: '회사의 실적 영향은 따로 봐요', body: '내 계좌의 원화 환산 효과와 회사가 받는 영향은 달라요. 회사의 판매·재료 구입 통화에 따라 매출과 비용이 달라질 수 있어 실적 설명을 따로 확인해요.' },
    ],
    watchPoints: [
      '달러 기준 주가 변화와 원화 기준 평가 변화가 각각 얼마인가요?',
      '매수 당시와 현재 환율은 같은 기준으로 비교했나요?',
      '환율 수치는 최신인가요? 실제 환전에는 수수료와 적용 환율 차이도 있나요?',
    ],
    condition: '환율 상승이 달러 주가 하락을 모두 상쇄해주지는 않아요. 이 예시는 일반 주식의 단순 환산이며, 환율 변동을 줄이도록 설계된 상품은 계산이 달라질 수 있어요.',
    sources: [
      { label: '미국 SEC 투자자 교육 · 해외투자와 환율', url: 'https://www.investor.gov/introduction-investing/investing-basics/investment-products/international-investing' },
      { label: '미국 SEC 투자자 교육 · 환율의 뜻', url: 'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/foreign' },
      { label: '연준 · 금리·환율과 경제의 연결', url: 'https://www.federalreserve.gov/monetarypolicy/monetary-policy-what-are-its-goals-how-does-it-work.htm' },
    ],
    eventKinds: ['fomc', 'bok'],
    connection: 'usd-value',
  },
  {
    id: 'earnings',
    category: '기업과 실적',
    title: '매출이 늘었는데 왜 주가는 내릴까요?',
    summary: '경기와 산업의 변화가 회사 숫자에 어떻게 나타났는지, 시장의 기대와 함께 확인해요.',
    terms: [
      { term: '매출', meaning: '상품이나 서비스를 팔아 올린 판매액이에요. 비용을 빼기 전이라 매출이 늘어도 이익은 줄 수 있어요.' },
      { term: '영업이익', meaning: '매출에서 제품 원가와 판매·관리 등 본업을 운영하는 비용을 뺀 이익이에요.' },
      { term: 'EPS·주당순이익', meaning: '회사의 순이익을 주식 한 주 기준으로 나타낸 값이에요. 주가나 주주에게 지급하는 배당금과는 달라요.' },
      { term: '예상치와 가이던스', meaning: '예상치는 발표 전에 시장이 추정한 숫자예요. 가이던스는 회사가 제시하는 앞으로의 실적 전망이에요.' },
    ],
    steps: [
      { title: '경기와 산업의 변화를 떠올려요', body: '소비가 늘었는지, 원자재가 비싸졌는지, 업종의 수요가 달라졌는지 먼저 봐요. 그 변화가 회사의 판매량·가격·비용에 나타났는지 확인할 차례예요.' },
      { title: '매출과 이익을 나란히 봐요', body: '판매액이 늘어도 재료비나 인건비가 더 늘면 이익은 줄어요. 매출 증가가 더 많이 팔아서인지, 가격을 올려서인지도 회사 설명에서 찾아봐요.' },
      { title: '같은 기준의 예상과 비교해요', body: '작년보다 좋아진 실적도 시장이 기대한 숫자에는 못 미칠 수 있어요. 발표 기간과 회계 기준이 같은 예상치인지 확인하고 매출·이익을 각각 비교해요.' },
      { title: '다음 분기까지 연결해요', body: '투자자는 이미 끝난 분기뿐 아니라 앞으로 벌 돈도 평가해요. 회사가 전망을 바꿨다면 이유를 읽고, 다음 발표에서 확인할 매출·비용 항목을 정해요.' },
    ],
    watchPoints: [
      '매출이 늘어난 이유와 영업이익이 달라진 이유를 각각 설명할 수 있나요?',
      '예상치와 실제 수치의 기간·회계 기준이 같은가요?',
      '회사 전망이 바뀌었나요? 다음 발표에서 확인할 항목은 무엇인가요?',
    ],
    condition: '좋은 실적도 이미 주가에 기대가 반영돼 있으면 반응이 작을 수 있어요. 발표 직후 주가만으로 어떤 숫자가 원인이었는지 단정하지 않아요.',
    sources: [
      { label: '미국 SEC · 재무제표 읽기', url: 'https://www.sec.gov/investor/pubs/begfinstmtguide.htm' },
      { label: '미국 SEC 투자자 교육 · 주당순이익', url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary/earnings-share' },
      { label: '미국 SEC 투자자 교육 · 사업보고서 읽기', url: 'https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-bulletins/how-read' },
    ],
    eventKinds: ['earnings'],
    connection: 'company',
  },
];
