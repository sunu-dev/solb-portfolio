import { explorationCompany } from './contextExploration';
import { getStockIdentityKey } from '@/utils/stockCurrency';

interface StorySource { label: string; url: string; reviewedAt: string }
interface CompanyQuestion { id: string; question: string; answer: string }
export interface CompanyStory {
  name: string;
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
  PLTR: {
    name: '팔란티어',
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
    ?? (products ? `거래소 자료에 등록된 주요 제품·사업은 ${products}예요.` : undefined);
}
