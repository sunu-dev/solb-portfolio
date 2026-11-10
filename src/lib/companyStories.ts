import { explorationCompany } from './contextExploration';
import { getStockIdentityKey } from '@/utils/stockCurrency';
import { euroRo } from '@/utils/koreanJosa';

interface StorySource { label: string; url: string; reviewedAt: string }
interface CompanyQuestion { id: string; question: string; answer: string }
export interface CompanyStory {
  name: string;
  headline: string;
  summary: string;
  example: string;
  customers: string;
  revenue: string;
  questions: CompanyQuestion[];
  watch: string;
  sources: StorySource[];
}
const checkedAt = '2026-10-11';
const source = (label: string, url: string): StorySource => ({ label, url, reviewedAt: checkedAt });

/** Reviewed business explanations. No company facts are inferred from an industry label. */
export const COMPANY_STORIES: Record<string, CompanyStory> = {
  'KR:340810': {
    name: '시선AI', headline: '얼굴을 알아보고, PC 화면을 보호하는 회사',
    summary: '얼굴로 본인을 확인하는 프로그램과 출입 장비를 만들어요. PC 화면을 지키는 SEEU ON은 사용자가 자리를 비우거나 다른 사람이 화면에 접근하면 화면을 가려줘요.',
    example: '은행 앱에서 계좌를 만들려고 신분증과 얼굴을 촬영하는 상황을 떠올려 보세요. 신분증 사진과 지금 촬영한 얼굴이 같은 사람인지 비교하고, 사진이나 영상으로 속이려는 시도도 살펴보는 기술이 필요해요.',
    customers: '공항·공공기관·금융회사·일반 기업이 이용해요. 공항과 건물에서는 출입하는 사람을 확인하고, 금융회사에서는 창구를 방문하지 않은 고객의 신원을 확인하는 데 써요.',
    revenue: '얼굴인식 프로그램과 출입 장비를 공급하고, 고객이 쓸 수 있게 설치·연결하는 작업에서 매출을 얻어요. 자회사의 기업·공공기관 전산시스템 구축과 로봇 사업도 있어요.',
    questions: [
      { id: 'real-face', question: '사진을 보여줘도 본인으로 인식하나요?', answer: '얼굴 사진만 비교하면 사진이나 영상으로 속이려는 시도가 생길 수 있어요. 시선AI의 본인 확인 제품은 촬영된 얼굴이 사진·영상·가면은 아닌지도 함께 살펴요.' },
      { id: 'screen', question: 'SEEU ON과 SEEU ID는 어디에 쓰나요?', answer: 'SEEU ON은 PC 카메라로 화면 앞에 허용된 사용자가 있는지 계속 살펴요. 자리를 비우거나 다른 사람이 접근하면 화면을 가려요. SEEU ID는 은행 앱 등에서 본인을 확인할 때, 신분증 사진과 촬영한 얼굴을 비교하고 사진·영상으로 속이는 시도도 살피는 제품이에요.' },
      { id: 'comparison', question: '알체라·피앤피시큐어와 비슷한 회사인가요?', answer: '제품의 쓰임이 겹치는 부분이 있어요. 알체라의 본인 확인 제품과 SEEU ID는 신분증과 얼굴로 본인을 확인하는 데 쓰여요. 피앤피시큐어의 FaceLocker와 SEEU ON은 PC 사용자를 계속 확인하고 화면 노출을 막는 기능이 겹쳐요. 각 회사의 제품 소개를 비교한 내용이며, 매출 규모나 기술 우열까지 같다는 뜻은 아니에요.' },
      { id: 'industry', question: '얼굴인식 회사가 왜 소프트웨어 업종에 들어가나요?', answer: '얼굴의 특징을 찾고 비교하는 일을 프로그램이 하기 때문이에요. 거래소는 시선AI를 넓은 ‘소프트웨어 개발 및 공급업’으로 묶고 있어요. 같은 업종에 속한 회사가 모두 얼굴인식 제품을 만드는 것은 아니에요.' },
    ],
    watch: '얼굴인식·화면 보호 제품의 새 계약과 실제 매출을 나눠 봐요. 자회사 사업이 합쳐져 매출이 커졌을 때는, 기존 제품 판매도 늘었는지 함께 확인해요.',
    sources: [
      { label: '시선AI · 2025 사업보고서 (제품·고객·매출·자회사)', url: 'https://kind.krx.co.kr/external/2026/03/20/000006/20260320000041/11011.htm', reviewedAt: '2026-11-03' },
      { label: '시선AI · SEEU ON 화면 정보보호 제품', url: 'https://secern.ai/솔루션/seeu-on/', reviewedAt: '2026-11-03' },
      { label: '시선AI · SEEU ID 본인 확인 제품', url: 'https://secern.ai/솔루션/seeu-id/', reviewedAt: '2026-11-03' },
      { label: '알체라 · 비대면 본인 확인 제품 (쓰임 비교)', url: 'https://www.alchera.ai/solutions/ekyc', reviewedAt: '2026-11-03' },
      { label: '피앤피시큐어 · FaceLocker (쓰임 비교)', url: 'https://pnpsecure.com/02_7_facelocker', reviewedAt: '2026-11-03' },
    ],
  },
  NFLX: {
    name: '넷플릭스', headline: '영화와 시리즈를 구독으로 제공하는 회사',
    summary: '인터넷으로 영화·시리즈·라이브 콘텐츠 등을 볼 수 있는 서비스를 운영해요. 자체 콘텐츠를 만들거나 다른 제작사의 작품을 확보해 제공하며, 회원 구독료가 주된 수입이에요.',
    example: '가족이 거실 TV에서 보던 시리즈를 휴대전화로 이어 본다고 생각해 보세요. 작품마다 따로 구매하는 대신 선택한 요금제의 월 구독료를 내고 서비스를 이용하는 방식이에요.',
    customers: '콘텐츠를 시청하는 개인·가구가 회원이에요. 광고가 포함된 서비스에서는 시청자에게 상품이나 서비스를 알리려는 광고주도 고객이에요.',
    revenue: '회원이 매달 내는 구독료가 주된 매출이에요. 광고 판매에서도 매출이 발생해요. 회원 수뿐 아니라 요금제와 가격, 광고 이용과 판매 상황도 매출에 영향을 줄 수 있어요.',
    questions: [
      { id: 'subscriptions', question: '가입자가 늘면 이익도 같은 만큼 늘까요?', answer: '구독 매출이 늘어도 콘텐츠 제작·구입과 서비스 운영 비용이 함께 늘 수 있어요. 매출과 이익, 실제로 남는 현금을 나눠 확인해야 해요.' },
      { id: 'ads', question: '광고형 요금제는 어떻게 돈을 버나요?', answer: '회원에게 구독료를 받고, 광고주에게 광고를 판매해요. 광고 매출은 광고형 서비스를 이용하는 시청자, 채워진 광고 자리와 광고 단가 등의 영향을 받아요.' },
      { id: 'content', question: '인기 작품 하나가 나오면 실적도 바로 좋아지나요?', answer: '작품이 회원의 가입과 시청 지속에 도움이 될 수 있지만, 제작·구입 비용과 다른 작품의 성과도 함께 봐야 해요. 넷플릭스는 시청과 회원 유지, 비용 대비 성과 등을 살펴본다고 설명해요.' },
    ],
    watch: '주비의 점검 관점이에요. 매출과 영업이익, 콘텐츠에 쓰는 돈과 현금흐름을 함께 봐요. 광고형 서비스의 성장도 확인하되 가입자 수 하나로 실적을 판단하지 않아요.',
    sources: [
      { label: '넷플릭스 · 2025 연차보고서 (사업·구독료·광고)', url: 'https://www.sec.gov/Archives/edgar/data/1065280/000106528026000034/nflx-20251231.htm', reviewedAt: '2026-10-31' },
      { label: '넷플릭스 · 투자자 질문 (광고·콘텐츠·성과)', url: 'https://ir.netflix.net/ir-overview/top-investor-questions/default.aspx', reviewedAt: '2026-10-31' },
    ],
  },
  'KR:009150': {
    name: '삼성전기', headline: '스마트폰과 자동차 등에 들어가는 전자부품을 만드는 회사',
    summary: '전자회로의 전기 흐름을 다루는 작은 부품, 반도체를 연결하는 기판, 카메라 모듈을 만들어요. 스마트폰·자동차·컴퓨터 등에 들어가는 부품을 공급하는 회사예요.',
    example: '스마트폰으로 사진을 찍는 상황을 떠올려 보세요. 카메라 모듈뿐 아니라 기기 안에서 전기를 안정적으로 공급하는 부품과 반도체를 연결하는 기판도 필요해요.',
    customers: '스마트폰·자동차·컴퓨터 등 제품과 부품을 만드는 기업이 주요 수요처예요. 고객은 기기에 필요한 기능과 성능을 갖추기 위해 전자부품을 구매해요.',
    revenue: '회로용 부품, 반도체 패키지 기판, 카메라 모듈 등을 생산해 판매한 금액이 매출이 돼요. 제품별 판매량과 가격, 제조 비용의 변화를 함께 살펴볼 필요가 있어요.',
    questions: [
      { id: 'mlcc', question: 'MLCC는 어떤 부품인가요?', answer: '전기를 잠시 저장하고 회로에 필요한 전기가 안정적으로 흐르게 돕는 작은 부품이에요. 스마트폰이나 자동차 안의 여러 전자회로에 쓰여요.' },
      { id: 'substrate', question: '반도체 기판은 반도체와 무엇이 다른가요?', answer: '반도체가 기능을 수행하는 칩이라면, 기판은 칩과 다른 부품을 연결하는 기반이에요. 삼성전기는 반도체 패키지에 쓰이는 기판을 생산해요.' },
      { id: 'demand', question: '스마트폰이 잘 팔리면 무조건 좋아지나요?', answer: '기기에 들어가는 부품 수요와 연결될 수 있어요. 다만 제품 구성과 판매 가격, 자동차·컴퓨터 등 다른 수요처, 공장 가동과 비용도 함께 확인해야 해요.' },
    ],
    watch: '주비의 점검 관점이에요. 부품·기판·카메라 사업별 매출과 이익 변화를 보고, 스마트폰·자동차·컴퓨터 수요와 제조 비용이 어떻게 달라지는지 함께 확인해요.',
    sources: [
      { label: '삼성전기 · 2025 사업보고서 (사업·제품·판매)', url: 'https://kind.krx.co.kr/external/2026/03/10/001914/20260310004267/11011.htm', reviewedAt: '2026-10-31' },
      { label: '삼성전기 · 회사와 사업 소개', url: 'https://www.samsungsem.com/kr/about-us/company/overview.do', reviewedAt: '2026-10-31' },
    ],
  },

  PLTR: {
    name: '팔란티어',
    headline: '데이터를 연결해 업무 판단을 돕는 회사',
    summary: '기업과 정부에 흩어진 데이터를 연결해, 지금 무슨 일이 벌어지고 있고 어떻게 대응할지 판단하도록 돕는 데이터·AI 소프트웨어 회사예요.',
    example: '공장의 부품이 부족해졌다고 생각해 보세요. 재고·주문·납기·생산 계획을 연결하면 어떤 제품이 늦어지는지 파악하고, 생산 순서나 부품 배분을 조정하는 데 활용할 수 있어요.',
    customers: '정부기관과 민간 기업이 고객이에요. 데이터가 여러 시스템에 나뉘어 있어도 담당자가 함께 상황을 이해하고 업무에 활용하도록 도와요.',
    revenue: '소프트웨어를 일정 기간 사용하는 구독료와 운영·유지보수, 전문 서비스에서 매출이 발생해요. 고객의 환경에서 운영하거나 팔란티어가 관리하는 환경에서 제공해요.',
    questions: [
      { id: 'products', question: '고담·파운드리·AIP는 각각 무엇인가요?', answer: '고담은 국방·정보 업무의 데이터 분석을, 파운드리는 조직의 데이터 통합과 업무 운영을 지원해요. AIP는 AI를 조직의 데이터·업무에 연결하고, 아폴로는 소프트웨어 배포와 업데이트를 관리해요.' },
      { id: 'models', question: 'AI 모델을 만드는 회사와는 무엇이 다른가요?', answer: 'AIP는 여러 AI 모델을 기업 데이터와 실제 업무에 연결하는 데 초점을 둬요. 예를 들어 질문에 답하는 기능에 더해, 누가 어떤 자료를 보고 어떤 업무를 실행할 수 있는지 권한과 기록을 함께 관리해요.' },
      { id: 'contracts', question: '큰 계약을 따면 그 금액이 바로 매출이 되나요?', answer: '계약 금액과 당장 실적에 기록되는 매출은 달라요. 예를 들어 클라우드 구독 매출은 일반적으로 서비스를 제공하는 계약 기간에 걸쳐 인식해요. 계약 발표와 실제 매출 증가를 나눠 봐야 해요.' },
    ],
    watch: '주비의 점검 관점이에요. 정부·민간 부문 매출을 나눠 보고, 기존 고객의 사용 확대와 비용·이익 변화를 함께 살펴봐요. 도입 시험이나 계약 발표만으로 이익 증가를 확정할 수는 없어요.',
    sources: [
      source('팔란티어 · 2025 사업보고서 (제품·고객·매출 인식)', 'https://www.sec.gov/Archives/edgar/data/1321655/000132165526000011/pltr-20251231.htm'),
      source('팔란티어 · 데이터 플랫폼 소개', 'https://www.palantir.com/docs/foundry/getting-started/overview'),
      source('팔란티어 · AIP의 역할과 권한 관리', 'https://www.palantir.com/docs/foundry/aip/overview'),
    ],
  },
  MSFT: {
    name: '마이크로소프트',
    headline: '업무 도구와 클라우드를 파는 회사',
    summary: '문서 작성·협업에 쓰는 소프트웨어와 기업의 서비스를 운영하는 클라우드를 판매하는 회사예요. 윈도, 게임, 업무용 AI도 함께 운영해요.',
    example: '회사가 직원에게 문서·회의 도구를 제공하고, 고객용 앱은 외부 데이터센터에서 운영한다고 생각해 보세요. Microsoft 365는 직원의 업무 도구, Azure는 앱을 실행할 컴퓨팅 기반 역할을 할 수 있어요.',
    customers: '개인과 기업, 학교·정부기관이 고객이에요. 고객은 업무 도구를 쓰거나 컴퓨팅·저장 공간 등을 이용하기 위해 비용을 지불해요.',
    revenue: 'Microsoft 365 등의 구독료, Azure 등 클라우드 사용료, 소프트웨어 이용 권리 판매에서 매출이 발생해요. 게임·기기·광고 등 다른 사업도 있어요.',
    questions: [
      { id: 'azure', question: 'Azure는 쉽게 말해 무엇인가요?', answer: '인터넷을 통해 컴퓨팅·저장 공간·데이터베이스 등 필요한 기능을 이용하는 클라우드 서비스예요. 기업은 모든 서버를 직접 갖추는 대신 서비스를 이용해 앱과 업무를 운영할 수 있어요.' },
      { id: 'ai', question: 'AI가 잘되면 회사 전체가 똑같이 좋아지나요?', answer: 'AI 사용은 클라우드·업무 소프트웨어 수요와 연결될 수 있어요. 다만 윈도·게임 등 다른 사업의 흐름과 데이터센터 비용도 함께 작용해요. AI 수요만으로 전체 이익을 판단하기는 어려워요.' },
      { id: 'spending', question: '데이터센터에 돈을 많이 쓰면 좋은 건가요?', answer: '앞으로 서비스를 제공할 능력을 늘리는 투자예요. 주비에서는 실제 고객 수요가 따라오는지와 투자 이후의 현금흐름·이익률을 함께 살펴봐요. 지출 시점과 비용이 실적에 반영되는 시점도 달라요.' },
    ],
    watch: '주비의 점검 관점이에요. 클라우드 성장, 업무용 소프트웨어 구독, 데이터센터 투자와 현금흐름을 함께 확인해요.',
    sources: [source('마이크로소프트 · 2025 연차보고서 (사업·매출·투자)', 'https://www.microsoft.com/investor/reports/ar25/index.html')],
  },
  ORCL: {
    name: '오라클',
    headline: '기업의 기록과 서비스를 운영하는 기반',
    summary: '기업의 주문·고객·회계 같은 정보를 저장하고 관리하는 데이터베이스, 업무 소프트웨어, 클라우드를 제공하는 회사예요.',
    example: '온라인 쇼핑몰의 주문과 결제 기록을 빠짐없이 저장하고, 재고·회계 업무를 운영한다고 생각해 보세요. 데이터베이스는 기록을 관리하고, 업무 소프트웨어와 클라우드는 그 기록을 쓰는 업무와 서비스를 뒷받침해요.',
    customers: '여러 산업의 기업과 기관이 고객이에요. 많은 데이터를 관리하고 핵심 업무를 안정적으로 운영하는 데 오라클의 제품과 서비스를 활용해요.',
    revenue: '기업용 소프트웨어와 클라우드 서비스 등에서 매출을 얻어요. OCI 클라우드는 사용한 자원에 따라 요금을 내거나 약정한 크레딧을 사용하는 방식 등을 제공해요.',
    questions: [
      { id: 'database', question: '데이터베이스는 엑셀과 무엇이 다른가요?', answer: '이해를 돕는 비교예요. 여러 사람이 동시에 주문·재고 기록을 바꾸는 큰 서비스를 떠올려 보세요. 데이터베이스는 많은 기록을 저장·조회하고, 접근 권한과 변경의 일관성을 관리하는 기반이에요.' },
      { id: 'cloud', question: 'OCI라는 이름은 무슨 뜻인가요?', answer: 'Oracle Cloud Infrastructure의 줄임말로, 오라클의 클라우드 기반 서비스예요. 컴퓨팅·저장 공간·네트워크 등을 제공해 기업이 자체 서비스나 AI 작업을 운영하게 해요.' },
      { id: 'comparison', question: '팔란티어와 같은 회사라고 보면 되나요?', answer: '비교할 때 먼저 맡는 일을 나눠 보세요. 오라클은 데이터 저장·관리와 업무 소프트웨어·클라우드를 제공하고, 팔란티어는 여러 데이터를 연결해 분석과 업무 판단에 쓰도록 돕는 역할을 설명해요. 실제 제품 영역은 겹칠 수 있어요.' },
    ],
    watch: '주비의 점검 관점이에요. 클라우드 수요가 실제 매출로 이어지는지와 데이터센터 투자·운영 비용을 함께 살펴봐요. 발표된 계약과 당기 매출은 구분해요.',
    sources: [
      source('오라클 · 회사와 제품 소개', 'https://www.oracle.com/corporate/'),
      source('오라클 · 클라우드 요금 구조', 'https://www.oracle.com/cloud/pricing/'),
      source('팔란티어 · 데이터 플랫폼 소개 (사업 역할 비교)', 'https://www.palantir.com/docs/foundry/getting-started/overview'),
    ],
  },
};

export const companyStory = (symbol: string) => COMPANY_STORIES[getStockIdentityKey(symbol)];
export function companyBusinessSummary(symbol: string, products?: string) {
  return companyStory(symbol)?.summary ?? explorationCompany(symbol)?.business
    ?? (products ? `주요 제품·사업은 ‘${products}’${euroRo(products)} 등록돼 있어요.` : undefined);
}
