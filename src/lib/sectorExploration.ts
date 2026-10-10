import { industryGroup, providerIndustryParent, type StoredIndustryProfile } from './industryRegistry';
import { getStockIdentityKey } from '@/utils/stockCurrency';

/** Major industry groups plus editorial sub-industries. Not a licensed classification or a live ranking. */
export type SectorId = 'semiconductors' | 'technology' | 'communication' | 'consumer-discretionary' | 'consumer-staples' | 'energy' | 'financials' | 'healthcare' | 'industrials' | 'materials' | 'real-estate' | 'utilities' | 'photonics' | 'pharma' | 'equipment' | 'defense' | 'aerospace' | 'shipbuilding' | 'batteries' | 'automotive' | 'fuel-cells';
export type SectorTopicId = `sector:${SectorId}` | `sector:${SectorId}:driver` | `sector:${SectorId}:check`;
export interface SectorProfile { sector?: string | null; industry?: string | null; classification?: StoredIndustryProfile }
export interface SectorCompany {
  symbol: string; name: string; role: string; business: string;
  source: { label: string; url: string; reviewedAt: string };
}
export interface SectorDefinition {
  id: SectorId; name: string; parent: SectorId | null; anchor: string; companies: string[];
  flow: string[]; intro: string; driver: string; steps: { title: string; body: string }[]; watch: string;
  check: string; checks: { title: string; body: string }[]; connections: SectorId[];
}

export const SECTOR_COMPANY_EVIDENCE: SectorCompany[] = [
  {
    symbol: 'BE', name: '블룸에너지', role: '연료전지 발전장비',
    business: '연료전지는 연료를 불에 태우지 않고 전기로 바꾸는 장치예요. 블룸에너지는 천연가스·바이오가스·수소 등을 이용해 고객 현장에서 전기를 만드는 발전장비와 관련 서비스를 공급해요. 전기를 저장하는 배터리나 석유를 생산하는 회사와는 사업이 달라요.',
    source: { label: '블룸에너지 · 공식 연료전지 기술 소개', url: 'https://www.bloomenergy.com/technology/', reviewedAt: '2026-10-10' },
  },
  {
    "symbol": "COHR",
    "name": "코히런트",
    "role": "광학 소재·레이저",
    "business": "광학 소재·레이저와 데이터센터·통신용 광학 제품을 공급해요.",
    "source": {
      "label": "코히런트 · 공식 사업 소개",
      "url": "https://www.coherent.com/company",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "LITE",
    "name": "루멘텀",
    "role": "광통신 부품",
    "business": "AI·클라우드·통신망과 산업·센싱용 광학·포토닉스 제품을 공급해요.",
    "source": {
      "label": "루멘텀 · 공식 사업 소개",
      "url": "https://www.lumentum.com/en/company",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "NVO",
    "name": "노보 노디스크",
    "role": "의약품 개발",
    "business": "당뇨병·비만 등 만성 질환 치료를 위한 의약품을 개발하고 공급해요.",
    "source": {
      "label": "노보 노디스크 · 공식 사업 소개",
      "url": "https://www.novonordisk.com/about/what-we-do.html",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "207940.KS",
    "name": "삼성바이오로직스",
    "role": "위탁 개발·생산",
    "business": "다른 회사의 바이오 의약품을 위탁 개발·생산하는 서비스를 제공해요.",
    "source": {
      "label": "삼성바이오로직스 · 공식 사업 소개",
      "url": "https://samsungbiologics.com/",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "ASML",
    "name": "ASML",
    "role": "노광 장비",
    "business": "반도체 웨이퍼에 회로를 그리는 노광 시스템과 관련 서비스를 공급해요.",
    "source": {
      "label": "ASML · 공식 사업 소개",
      "url": "https://www.asml.com/en/products",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "LIN",
    "name": "린데",
    "role": "산업용 가스",
    "business": "산업용 가스와 관련 설비·기술을 공급해요. 고객의 공정과 에너지 수요를 함께 살펴봐요.",
    "source": {
      "label": "린데 · 공식 사업 소개",
      "url": "https://www.linde.com/about-us",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "LMT",
    "name": "록히드마틴",
    "role": "항공·방위·우주",
    "business": "항공기·방위 시스템·우주 관련 제품과 기술을 공급해요.",
    "source": {
      "label": "록히드마틴 · 공식 사업 소개",
      "url": "https://www.lockheedmartin.com/en-us/products.html",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "RTX",
    "name": "RTX",
    "role": "엔진·방위 시스템",
    "business": "Collins Aerospace·Pratt & Whitney·Raytheon을 통해 항공·엔진·방위 분야 사업을 운영해요.",
    "source": {
      "label": "RTX · 공식 사업 소개",
      "url": "https://www.rtx.com/who-we-are",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "012450.KS",
    "name": "한화에어로스페이스",
    "role": "항공 엔진·방산",
    "business": "항공 엔진과 지상 방산, 우주 분야 사업을 운영해요. 부문별 고객과 계약을 나눠 살펴봐요.",
    "source": {
      "label": "한화에어로스페이스 · 공식 사업 소개",
      "url": "https://www.hanwha.com/companies/hanwha-aerospace.do",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "BA",
    "name": "보잉",
    "role": "완성 항공기",
    "business": "민간 항공기를 제작·공급해요. 항공사 주문과 실제 납품·안전 요건을 함께 살펴봐요.",
    "source": {
      "label": "보잉 · 공식 사업 소개",
      "url": "https://www.boeing.com/commercial",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "GE",
    "name": "GE에어로스페이스",
    "role": "항공 엔진·서비스",
    "business": "민간·방위 분야 항공 엔진과 관련 서비스 사업을 운영해요.",
    "source": {
      "label": "GE에어로스페이스 · 공식 사업 소개",
      "url": "https://www.geaerospace.com/company/about-us/leadership",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "042660.KS",
    "name": "한화오션",
    "role": "상선·특수선",
    "business": "LNG 운반선 등 상선과 특수선·해양 분야 사업을 운영해요. 선종에 따라 고객과 계약이 달라요.",
    "source": {
      "label": "한화오션 · 공식 사업 소개",
      "url": "https://www.hanwha.com/companies/hanwha-ocean.do",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "HII",
    "name": "헌팅턴 잉걸스",
    "role": "함정 건조",
    "business": "미국의 해군 함정 건조와 관련 기술 사업을 운영해요.",
    "source": {
      "label": "헌팅턴 잉걸스 · 공식 사업 소개",
      "url": "https://www.hii.com/",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "006400.KS",
    "name": "삼성SDI",
    "role": "배터리·전자재료",
    "business": "배터리와 전자재료 사업을 운영해요. 전기차용·에너지 저장용 등 제품별 수요를 나눠봐요.",
    "source": {
      "label": "삼성SDI · 공식 사업 소개",
      "url": "https://www.samsungsdi.com/business/index.html",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "XOM",
    "name": "엑슨모빌",
    "role": "에너지·화학",
    "business": "원유·가스 생산과 정유·화학 등 사업을 운영해요. 사업별 가격과 비용의 영향을 나눠봐요.",
    "source": {
      "label": "엑슨모빌 · 공식 사업 소개",
      "url": "https://corporate.exxonmobil.com/what-we-do",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "NEE",
    "name": "넥스트에라 에너지",
    "role": "전력·에너지",
    "business": "전력 유틸리티와 에너지 사업을 운영해요. 발전·전력 공급·투자 계획을 함께 봐요.",
    "source": {
      "label": "넥스트에라 에너지 · 공식 사업 소개",
      "url": "https://www.nexteraenergy.com/about-us.html",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "005380.KS",
    "name": "현대자동차",
    "role": "완성차",
    "business": "승용차·SUV·전기차 등 차량을 판매해요. 차종과 지역별 수요를 나눠봐요.",
    "source": {
      "label": "현대자동차 · 공식 사업 소개",
      "url": "https://www.hyundai.com/worldwide/en/vehicles",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "AMZN",
    "name": "아마존",
    "role": "쇼핑·클라우드",
    "business": "온라인 쇼핑과 AWS 클라우드, 기기·엔터테인먼트 등 사업을 운영해요.",
    "source": {
      "label": "아마존 · 공식 사업 소개",
      "url": "https://www.aboutamazon.com/what-we-do",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "JPM",
    "name": "JP모건체이스",
    "role": "은행·투자금융",
    "business": "소비자·기업 금융과 투자금융, 자산관리 사업을 운영해요.",
    "source": {
      "label": "JP모건체이스 · 공식 사업 소개",
      "url": "https://www.jpmorganchase.com/about",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "BAC",
    "name": "뱅크오브아메리카",
    "role": "은행·자산관리",
    "business": "개인과 기업에 금융·자산관리 서비스를 제공해요.",
    "source": {
      "label": "뱅크오브아메리카 · 공식 사업 소개",
      "url": "https://about.bankofamerica.com/en",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "V",
    "name": "비자",
    "role": "결제 네트워크",
    "business": "소비자·가맹점·금융기관 사이의 전자결제를 연결하는 네트워크를 운영해요.",
    "source": {
      "label": "비자 · 공식 사업 소개",
      "url": "https://corporate.visa.com/en/about-visa.html",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "UNH",
    "name": "유나이티드헬스",
    "role": "보험·의료 서비스",
    "business": "UnitedHealthcare와 Optum을 통해 건강보험과 의료 관련 서비스를 제공해요.",
    "source": {
      "label": "유나이티드헬스 · 공식 사업 소개",
      "url": "https://www.unitedhealthgroup.com/",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "TMO",
    "name": "써모피셔 사이언티픽",
    "role": "연구·진단 도구",
    "business": "연구·진단·의약품 개발 등에 쓰이는 제품과 서비스를 제공해요.",
    "source": {
      "label": "써모피셔 사이언티픽 · 공식 사업 소개",
      "url": "https://corporate.thermofisher.com/us/en/index/about.html",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "O",
    "name": "리얼티 인컴",
    "role": "임대 부동산",
    "business": "부동산을 보유하고 임차인에게서 임대료를 받는 사업을 운영해요.",
    "source": {
      "label": "리얼티 인컴 · 공식 사업 소개",
      "url": "https://www.realtyincome.com/who-we-are",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "VZ",
    "name": "버라이즌",
    "role": "통신 네트워크",
    "business": "통신망을 통해 개인·기업에 연결 서비스를 제공해요.",
    "source": {
      "label": "버라이즌 · 공식 사업 소개",
      "url": "https://www.verizon.com/about/our-company/what-we-do",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "WMT",
    "name": "월마트",
    "role": "유통",
    "business": "매장과 온라인에서 상품을 판매하는 유통 사업을 운영해요.",
    "source": {
      "label": "월마트 · 공식 사업 소개",
      "url": "https://corporate.walmart.com/about",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "COST",
    "name": "코스트코",
    "role": "회원제 유통",
    "business": "회원을 대상으로 상품을 판매하는 창고형 유통 사업을 운영해요.",
    "source": {
      "label": "코스트코 · 공식 사업 소개",
      "url": "https://www.costco.com/f/-/about",
      "reviewedAt": "2026-10-10"
    }
  },
  {
    "symbol": "PG",
    "name": "P&G",
    "role": "생활용품",
    "business": "일상에서 사용하는 생활·위생·건강 관련 소비재 브랜드를 운영해요.",
    "source": {
      "label": "P&G · 공식 사업 소개",
      "url": "https://us.pg.com/brands/",
      "reviewedAt": "2026-10-10"
    }
  }
];

export const INDUSTRY_SECTORS: SectorDefinition[] = [
  {
    id: 'fuel-cells', name: '연료전지·분산발전', parent: 'industrials', anchor: 'BE', companies: ['BE'],
    flow: ['발전장비', '현장 설치', '전력 공급'],
    intro: '연료전지는 연료를 전기로 바꾸는 장치예요. 전기를 쓰는 건물 가까이에서 직접 발전하는 방식을 분산발전이라고 해요.',
    driver: '데이터센터가 늘면 블룸에너지 매출도 늘까요?',
    steps: [
      { title: '서버에는 안정적인 전기가 필요해요', body: '데이터센터가 늘면 전력 공급이 중요해져요. 현장에서 전기를 만드는 연료전지도 공급 방법 중 하나예요.' },
      { title: '전력 수요와 장비 주문은 달라요', body: '고객이 어떤 발전 방식을 선택하는지, 연료 공급과 설치 조건은 어떤지 확인해야 해요. 데이터센터 증가가 모든 발전장비 회사의 주문으로 이어지는 것은 아니에요.' },
      { title: '계약에서 설치까지 시간이 걸려요', body: '실제 계약과 납품·설치 일정, 생산 비용을 함께 봐야 매출과 이익으로 이어지는지 알 수 있어요.' },
    ],
    watch: '공식 실적에서 계약·납품과 설치 일정, 제품·서비스 매출, 원가와 이익률을 확인해요.',
    check: '연료전지와 배터리는 무엇이 다를까요?',
    checks: [
      { title: '연료전지는 전기를 만들어요', body: '연료를 공급받아 전기를 만드는 발전장치예요. 블룸에너지의 기술은 천연가스·바이오가스·수소 등을 이용할 수 있어요.' },
      { title: '배터리는 전기를 저장해요', body: '충전한 전기를 필요한 때 꺼내 써요. 같은 전력 수요와 연결돼도 연료전지와 제품·비용 구조가 달라요.' },
      { title: '연료에 따라 배출도 달라요', body: '연료를 태우지 않는다고 언제나 탄소 배출이 없는 것은 아니에요. 사용하는 연료와 그 생산 과정을 함께 봐야 해요.' },
    ],
    connections: ['utilities', 'batteries', 'technology'],
  },
  {
    "id": "technology",
    "flow": ["고객 수요", "서버 투자", "서비스 매출"],
    "name": "정보기술",
    "parent": null,
    "anchor": "MSFT",
    "companies": [
      "MSFT",
      "AAPL",
      "AMZN"
    ],
    "intro": "기기·소프트웨어·클라우드는 돈을 버는 방식이 달라요. 고객과 비용부터 나눠봐요.",
    "driver": "클라우드 매출이 늘면 이익도 같이 늘까요?",
    "steps": [
      {
        "title": "기업이 쓰는 서비스",
        "body": "클라우드는 기업이 서버와 소프트웨어를 빌려 쓰는 사업이에요. 사용량과 계약 규모가 매출에 영향을 줘요."
      },
      {
        "title": "서버 투자가 먼저 필요해요",
        "body": "고객을 받으려면 서버·전력·부지가 필요해요. 설비 투자 지출과 회계상 비용이 반영되는 시점은 달라요."
      },
      {
        "title": "성장과 비용을 함께 봐요",
        "body": "서비스 매출뿐 아니라 운영 비용과 이익률, 실제 현금흐름을 확인해요."
      }
    ],
    "watch": "클라우드 성장·설비 투자·이익률을 같은 기간으로 비교해요.",
    "check": "소프트웨어 회사와 기기 회사는 무엇이 다를까요?",
    "checks": [
      {
        "title": "반복 결제와 기기 판매",
        "body": "소프트웨어는 구독·사용료, 기기는 제품 판매가 중요한 수익원이에요. 실제 비중은 회사별 사업 자료로 확인해요."
      },
      {
        "title": "고객이 줄이는 지출",
        "body": "기업의 예산 축소와 개인의 기기 교체 연기는 서로 다른 수요 변화예요."
      }
    ],
    "connections": [
      "semiconductors",
      "photonics"
    ]
  },
  {
    "id": "communication",
    "flow": ["통신망", "이용자", "이용료"],
    "name": "통신·미디어",
    "parent": null,
    "anchor": "VZ",
    "companies": [
      "VZ",
      "AMZN"
    ],
    "intro": "통신망의 이용료와 미디어·광고 수입은 서로 다른 사업이에요.",
    "driver": "통신 이용자가 늘어도 이익이 줄 수 있나요?",
    "steps": [
      {
        "title": "이용자와 요금",
        "body": "통신 회사는 고객 수와 고객 한 명이 내는 요금을 함께 봐요. 할인으로 고객이 늘어도 매출 효과는 달라요."
      },
      {
        "title": "망을 유지하는 비용",
        "body": "기지국·광케이블 등 통신망 투자와 유지 비용이 필요해요."
      },
      {
        "title": "투자 뒤 남는 현금",
        "body": "이익과 현금흐름을 보고 설비 투자·이자·배당을 감당하는지 확인해요."
      }
    ],
    "watch": "이용자 수·요금 설명·설비 투자·현금흐름을 확인해요.",
    "check": "광고와 구독은 경기에 어떻게 반응할까요?",
    "checks": [
      {
        "title": "광고주는 예산을 조절해요",
        "body": "광고 수요는 기업의 판매 계획과 예산에 영향을 받아요."
      },
      {
        "title": "구독자는 계속 쓸지 결정해요",
        "body": "구독 서비스는 가격 인상 뒤 해지와 신규 가입을 함께 봐야 해요."
      }
    ],
    "connections": [
      "photonics",
      "consumer-discretionary"
    ]
  },
  {
    "id": "consumer-discretionary",
    "flow": ["구매 여력", "제품 판매", "이익"],
    "name": "경기소비재",
    "parent": null,
    "anchor": "AMZN",
    "companies": [
      "AMZN",
      "TSLA"
    ],
    "intro": "자동차·쇼핑처럼 미루거나 줄일 수 있는 소비는 구매 여력과 금리의 영향을 받아요.",
    "driver": "소비가 살아나면 매출과 이익은 어떻게 이어질까요?",
    "steps": [
      {
        "title": "소득과 구매 부담",
        "body": "소비자는 소득과 대출 부담, 가격을 보고 구매를 결정해요."
      },
      {
        "title": "판매량과 할인",
        "body": "많이 팔아도 할인 폭이 커지면 제품당 이익은 줄 수 있어요."
      },
      {
        "title": "회사별 사업을 나눠요",
        "body": "아마존은 쇼핑 외에 클라우드도 운영해요. 소비 변화로 회사 전체를 설명하지 않아요."
      }
    ],
    "watch": "판매량·가격·사업별 이익과 다음 수요 설명을 봐요.",
    "check": "금리가 자동차 구매에 왜 중요한가요?",
    "checks": [
      {
        "title": "할부 부담",
        "body": "대출금리가 오르면 같은 자동차라도 월 납부액이 커질 수 있어요."
      },
      {
        "title": "회사도 판매 조건을 바꿔요",
        "body": "할인·금융 지원·제품 구성에 따라 실제 판매와 이익의 반응은 달라요."
      }
    ],
    "connections": [
      "automotive",
      "financials"
    ]
  },
  {
    "id": "consumer-staples",
    "flow": ["가격·원가", "판매량", "이익"],
    "name": "필수소비재",
    "parent": null,
    "anchor": "WMT",
    "companies": [
      "WMT",
      "COST",
      "PG"
    ],
    "intro": "식료품과 생활용품처럼 자주 사는 제품도 가격·원가·판매량에 따라 실적이 달라져요.",
    "driver": "가격을 올리면 생활용품 회사 이익도 늘까요?",
    "steps": [
      {
        "title": "매출은 가격과 수량",
        "body": "가격을 올려도 소비자가 덜 사면 매출 효과가 줄어들어요."
      },
      {
        "title": "원가도 같이 바뀌어요",
        "body": "원재료·포장·운송 비용이 판매 가격과 다른 속도로 변할 수 있어요."
      },
      {
        "title": "구매처가 달라져요",
        "body": "소비자가 저렴한 제품이나 매장으로 옮기는지도 함께 봐요."
      }
    ],
    "watch": "가격 효과·판매량·이익률과 고객의 구매 변화 설명을 봐요.",
    "check": "마트와 생활용품 제조사는 어떻게 비교할까요?",
    "checks": [
      {
        "title": "만드는 회사와 파는 회사",
        "body": "제조사는 제품·브랜드, 유통사는 상품 구성·회전·매장 운영이 중요해요."
      },
      {
        "title": "회원제는 별도로 봐요",
        "body": "코스트코의 회원제 모델처럼 회사 고유의 수익 구조를 확인해요."
      }
    ],
    "connections": [
      "materials",
      "energy"
    ]
  },
  {
    "id": "energy",
    "flow": ["생산", "정유·화학", "판매"],
    "name": "에너지",
    "parent": null,
    "anchor": "XOM",
    "companies": [
      "XOM"
    ],
    "intro": "원유·가스를 생산하는 사업과 정유·화학 사업은 같은 유가에도 다르게 반응할 수 있어요.",
    "driver": "유가가 오르면 에너지 회사에 모두 좋을까요?",
    "steps": [
      {
        "title": "생산자는 판매 가격을 봐요",
        "body": "원유·가스를 생산하는 회사는 판매 가격과 생산량이 매출에 영향을 줘요."
      },
      {
        "title": "정유는 원가와 제품 가격 사이",
        "body": "원유를 사서 연료를 만드는 사업은 원유 원가와 판매하는 제품 가격의 차이를 봐요."
      },
      {
        "title": "사업 구성을 나눠요",
        "body": "엑슨모빌처럼 여러 사업을 운영하면 생산·정유·화학을 나눠 실적을 확인해요."
      }
    ],
    "watch": "사업별 이익·생산량·설비 투자와 가격 설명을 봐요.",
    "check": "LNG 수요가 조선업까지 이어지는 이유는?",
    "checks": [
      {
        "title": "가스를 옮기는 방법",
        "body": "LNG는 천연가스를 액체로 만들어 선박으로 운송하는 방식이에요."
      },
      {
        "title": "운송 수요와 배 주문",
        "body": "장기 운송 계획과 선박 공급, 자금 조달 조건을 거쳐 새 배 주문으로 이어질 수 있어요."
      }
    ],
    "connections": [
      "shipbuilding",
      "utilities"
    ]
  },
  {
    "id": "financials",
    "flow": ["자금", "대출·결제", "이자·수수료"],
    "name": "금융",
    "parent": null,
    "anchor": "JPM",
    "companies": [
      "JPM",
      "BAC",
      "V"
    ],
    "intro": "은행의 예금·대출과 결제망의 수수료는 서로 다른 돈벌이예요.",
    "driver": "금리가 오르면 은행 이익이 늘까요?",
    "steps": [
      {
        "title": "받는 이자와 주는 이자",
        "body": "대출 이자 수입에서 예금 등에 지급하는 이자 비용을 함께 봐요."
      },
      {
        "title": "대출 손실도 봐야 해요",
        "body": "고객이 대출을 갚지 못할 위험에 대비하는 비용이 늘 수 있어요."
      },
      {
        "title": "사업별 영향을 나눠요",
        "body": "은행·투자금융·결제망은 금리와 경기의 영향을 받는 경로가 달라요."
      }
    ],
    "watch": "이자 수익·예금 비용·대출 손실 대비금과 회사 전망을 봐요.",
    "check": "은행과 비자는 같은 금융 회사인가요?",
    "checks": [
      {
        "title": "은행은 자금을 중개해요",
        "body": "예금을 받아 대출하거나 기업의 자금 조달을 돕는 사업이에요."
      },
      {
        "title": "결제망은 거래를 연결해요",
        "body": "비자는 소비자·가맹점·금융기관 사이의 전자결제를 연결하는 네트워크를 운영해요."
      }
    ],
    "connections": [
      "real-estate",
      "consumer-discretionary"
    ]
  },
  {
    "id": "healthcare",
    "flow": ["연구·치료", "서비스", "비용·매출"],
    "name": "헬스케어",
    "parent": null,
    "anchor": "UNH",
    "companies": [
      "UNH",
      "TMO",
      "207940.KS"
    ],
    "intro": "보험·진료·연구 도구·의약품은 서로 다른 시장이에요. 같은 의료 뉴스의 영향도 나눠봐요.",
    "driver": "의료 이용이 늘면 헬스케어 회사에 모두 좋을까요?",
    "steps": [
      {
        "title": "보험은 지급 비용을 봐요",
        "body": "가입자가 의료 서비스를 더 쓰면 보험 회사가 지급하는 의료 비용이 늘 수 있어요."
      },
      {
        "title": "연구·생산은 주문을 봐요",
        "body": "연구 도구와 의약품 생산 서비스는 고객의 연구·생산 예산과 계약을 확인해요."
      },
      {
        "title": "각자의 매출과 비용",
        "body": "보험료·의료 비용·연구 예산·생산 물량은 같은 지표가 아니에요."
      }
    ],
    "watch": "사업별 매출·비용 설명과 보험의 의료 비용, 고객의 연구·생산 계획을 봐요.",
    "check": "신약 개발사와 위탁생산 회사는 어떻게 다를까요?",
    "checks": [
      {
        "title": "개발사는 효능과 허가",
        "body": "신약의 임상 결과·허가·판매를 통해 투자 회수를 기대해요."
      },
      {
        "title": "위탁생산은 고객 계약",
        "body": "다른 회사의 의약품을 생산하며 계약·시설·품질·가동률을 살펴봐요."
      }
    ],
    "connections": [
      "pharma",
      "materials"
    ]
  },
  {
    "id": "industrials",
    "flow": ["계약", "납품", "정비"],
    "name": "산업재",
    "parent": null,
    "anchor": "GE",
    "companies": [
      "BE",
      "GE",
      "BA",
      "012450.KS"
    ],
    "intro": "항공 엔진·설비·운송 장비는 주문 뒤 생산·납품까지 시간이 걸려요.",
    "driver": "수주가 늘었는데 왜 매출은 바로 늘지 않을까요?",
    "steps": [
      {
        "title": "수주는 앞으로 할 일",
        "body": "계약을 맺어도 납품과 작업 진행까지는 시간이 필요해요."
      },
      {
        "title": "생산 능력과 공급망",
        "body": "부품 부족·인력·인증 일정이 납품을 늦출 수 있어요."
      },
      {
        "title": "납품 이후도 사업이에요",
        "body": "항공 엔진처럼 정비·서비스가 이어지는 사업은 새 제품 판매와 나눠봐요."
      }
    ],
    "watch": "수주 잔고·납품 일정·원가·서비스 매출과 현금흐름을 봐요.",
    "check": "장비 판매와 유지보수는 무엇이 다를까요?",
    "checks": [
      {
        "title": "새 장비는 투자 계획",
        "body": "고객이 큰 설비를 살 예산과 계획이 수요에 영향을 줘요."
      },
      {
        "title": "서비스는 쓰는 장비",
        "body": "이미 운영 중인 장비의 사용량·정비 시점이 서비스 수요와 연결돼요."
      }
    ],
    "connections": [
      "fuel-cells",
      "aerospace",
      "defense",
      "shipbuilding"
    ]
  },
  {
    "id": "materials",
    "flow": ["원료·에너지", "생산", "고객 공정"],
    "name": "소재",
    "parent": null,
    "anchor": "LIN",
    "companies": [
      "LIN",
      "COHR"
    ],
    "intro": "산업용 가스와 특수 소재는 고객 산업의 생산 과정에 쓰여요.",
    "driver": "고객 공장이 늘어나면 소재 회사 매출도 늘까요?",
    "steps": [
      {
        "title": "무엇을 공급하는지",
        "body": "린데는 산업용 가스와 관련 설비·기술을 공급해요. 광소재는 빛을 만드는 제품과 통신·제조 등에 쓰여요."
      },
      {
        "title": "계약과 가동을 거쳐요",
        "body": "새 공장 계획이 발표된 뒤 계약·건설·실제 생산으로 이어져야 수요를 확인할 수 있어요."
      },
      {
        "title": "비용과 판매 조건",
        "body": "전력·원료 비용과 계약 가격 조건이 이익을 바꿀 수 있어요."
      }
    ],
    "watch": "고객 산업의 가동·신규 계약·가격 조건·에너지 비용을 봐요.",
    "check": "일반 소재와 첨단 소재는 같은 기준으로 볼까요?",
    "checks": [
      {
        "title": "규격과 고객이 달라요",
        "body": "광학·반도체용 제품은 고객이 요구하는 성능·품질을 충족하는지 확인해요."
      },
      {
        "title": "시장 범위를 맞춰요",
        "body": "소재 전체 매출과 특정 첨단 제품 매출을 같은 숫자로 비교하지 않아요."
      }
    ],
    "connections": [
      "photonics",
      "equipment"
    ]
  },
  {
    "id": "real-estate",
    "flow": ["부동산", "임대", "현금흐름"],
    "name": "부동산",
    "parent": null,
    "anchor": "O",
    "companies": [
      "O"
    ],
    "intro": "부동산을 보유해 임대료를 받는 회사는 임차인·계약·차입 비용이 중요해요.",
    "driver": "금리가 내려가면 리츠에 바로 좋을까요?",
    "steps": [
      {
        "title": "리츠의 뜻",
        "body": "리츠는 부동산 등에 투자하고 그 수익을 주주에게 나누는 회사예요."
      },
      {
        "title": "차입과 임대료",
        "body": "금리 변화는 차입 비용에 영향을 주지만 임대료와 공실도 함께 봐야 해요."
      },
      {
        "title": "다시 빌리는 시점",
        "body": "기존 고정금리 대출과 새 자금 조달은 금리 변화가 반영되는 시점이 달라요."
      }
    ],
    "watch": "임대율·임차인 구성·계약 만기·차입 만기·배당에 쓸 현금을 봐요.",
    "check": "배당이 높으면 좋은 리츠인가요?",
    "checks": [
      {
        "title": "주가가 떨어져도 비율은 올라요",
        "body": "배당수익률은 주가 변화에도 움직여요. 높은 비율만으로 안정성을 판단하지 않아요."
      },
      {
        "title": "임대 사업의 현금",
        "body": "배당을 유지할 현금과 부채, 시설 투자 필요를 확인해요."
      }
    ],
    "connections": [
      "financials",
      "consumer-staples"
    ]
  },
  {
    "id": "utilities",
    "flow": ["발전", "전력망", "전력 공급"],
    "name": "전력·유틸리티",
    "parent": null,
    "anchor": "NEE",
    "companies": [
      "NEE"
    ],
    "intro": "전력 사업은 발전·송배전·요금 규제와 자금 조달을 함께 봐야 해요.",
    "driver": "AI 데이터센터가 늘면 전력 회사 이익도 늘까요?",
    "steps": [
      {
        "title": "전기를 쓸 수 있어야 해요",
        "body": "서버를 운영하려면 발전뿐 아니라 전력망 연결과 부지가 필요해요."
      },
      {
        "title": "설비 투자와 계약",
        "body": "전력 수요 전망 뒤 발전·전력망 투자와 계약, 규제 승인이 이어져야 해요."
      },
      {
        "title": "요금과 자금 조달",
        "body": "새 수요가 있어도 요금 규제·건설 비용·차입 비용에 따라 이익 반영이 달라요."
      }
    ],
    "watch": "수요 계약·전력망 연결 일정·설비 투자·요금 승인·부채를 봐요.",
    "check": "에너지 회사와 전력 회사는 무엇이 다를까요?",
    "checks": [
      {
        "title": "연료를 파는 사업",
        "body": "원유·가스 생산은 연료의 가격과 판매량이 중요해요."
      },
      {
        "title": "전기를 만드는 사업",
        "body": "발전·전력 공급은 요금·계약·설비·규제 구조를 봐야 해요."
      }
    ],
    "connections": [
      "energy",
      "technology"
    ]
  },
  {
    "id": "photonics",
    "flow": ["빛·소재", "광학 부품", "데이터 이동"],
    "name": "광소재·광통신",
    "parent": "technology",
    "anchor": "COHR",
    "companies": [
      "COHR",
      "LITE"
    ],
    "intro": "빛을 만들고 보내고 받는 소재·부품이 데이터센터와 통신, 제조 장비를 연결해요.",
    "driver": "AI 서버가 늘면 광통신 회사까지 왜 살펴볼까요?",
    "steps": [
      {
        "title": "서버끼리도 데이터를 보내요",
        "body": "AI 계산이 커지면 서버 내부와 서버 사이의 데이터 이동도 중요해져요."
      },
      {
        "title": "빛으로 신호를 전달해요",
        "body": "광통신은 빛을 이용해 데이터를 보내요. 광학 소재·레이저·송수신 부품은 서로 다른 역할이에요."
      },
      {
        "title": "제품 수요를 따로 확인해요",
        "body": "데이터센터 투자 뒤 고객이 어떤 속도·규격의 부품을 주문하는지 확인해요."
      }
    ],
    "watch": "데이터센터용 제품 매출·고객 주문·제품 규격·공급 능력을 봐요.",
    "check": "광소재와 광통신 부품은 같은 회사가 만드나요?",
    "checks": [
      {
        "title": "소재에서 완제품까지",
        "body": "빛을 다루는 소재와 레이저·송수신 부품은 다른 생산 단계예요. 코히런트와 루멘텀의 제품 범위를 나눠봐요."
      },
      {
        "title": "회사가 파는 시장",
        "body": "산업용 레이저와 데이터센터용 부품의 수요는 다를 수 있어요."
      }
    ],
    "connections": [
      "semiconductors",
      "communication"
    ]
  },
  {
    "id": "pharma",
    "flow": ["임상·계약", "허가·생산", "판매"],
    "name": "의약·바이오",
    "parent": "healthcare",
    "anchor": "NVO",
    "companies": [
      "NVO",
      "207940.KS"
    ],
    "intro": "약을 개발하는 회사와 다른 회사의 약을 생산해 주는 회사는 확인할 내용이 달라요.",
    "driver": "임상 성공 소식만으로 신약 매출을 알 수 있을까요?",
    "steps": [
      {
        "title": "임상은 사람에게 효과와 안전성을 확인해요",
        "body": "시험의 단계·대상·평가 항목을 확인해요. 한 시험 결과를 모든 환자에게 적용하지 않아요."
      },
      {
        "title": "허가와 판매는 다음 단계",
        "body": "판매 허가 뒤 생산 능력·가격·보험 적용·환자 접근성이 실제 판매에 영향을 줘요."
      },
      {
        "title": "개발과 위탁생산을 나눠요",
        "body": "노보 노디스크의 의약품 사업과 삼성바이오로직스의 위탁 개발·생산은 수익 구조가 달라요."
      }
    ],
    "watch": "임상 단계·허가 범위·생산·판매와 계약 원문을 확인해요.",
    "check": "바이오 위탁생산에서 가동률은 왜 중요할까요?",
    "checks": [
      {
        "title": "공장을 대신 운영하는 사업",
        "body": "위탁 개발·생산은 고객의 약을 개발하거나 생산하는 서비스를 제공해요."
      },
      {
        "title": "계약에서 생산으로",
        "body": "계약 규모·생산 일정·공장 가동과 품질 요건을 거쳐 매출과 비용을 확인해요."
      }
    ],
    "connections": [
      "healthcare",
      "materials"
    ]
  },
  {
    "id": "equipment",
    "flow": ["공장 투자", "장비·소재", "가동"],
    "name": "반도체 소부장",
    "parent": "technology",
    "anchor": "ASML",
    "companies": [
      "ASML",
      "LIN"
    ],
    "intro": "소부장은 소재·부품·장비의 줄임말이에요. 반도체 공정에 무엇을 공급하는지 나눠봐요.",
    "driver": "반도체 공장 투자 소식이 소부장에 어떻게 이어질까요?",
    "steps": [
      {
        "title": "공장을 짓기 전에 투자 계획",
        "body": "반도체 고객의 설비 투자 계획이 장비 주문의 출발점이에요."
      },
      {
        "title": "공정마다 필요한 것이 달라요",
        "body": "ASML은 회로를 그리는 노광 장비를, 소재 회사는 공정에 필요한 재료·가스 등을 공급해요."
      },
      {
        "title": "주문 뒤 설치와 가동",
        "body": "장비 납품·설치·고객 확인과 공장 가동 시점에 따라 매출·소재 사용이 달라져요."
      }
    ],
    "watch": "고객 설비 투자·장비 주문·납품·설치와 공장 가동을 봐요.",
    "check": "장비와 소재는 업황에 같은 속도로 반응할까요?",
    "checks": [
      {
        "title": "장비는 큰 투자 결정",
        "body": "공장을 늘리거나 공정을 바꾸는 계획이 새 장비 주문과 연결돼요."
      },
      {
        "title": "소재는 실제 생산",
        "body": "공장이 얼마나 생산하는지에 따라 사용량이 달라질 수 있어요."
      }
    ],
    "connections": [
      "semiconductors",
      "materials"
    ]
  },
  {
    "id": "defense",
    "flow": ["예산", "계약", "납품"],
    "name": "방산",
    "parent": "industrials",
    "anchor": "LMT",
    "companies": [
      "LMT",
      "RTX",
      "012450.KS"
    ],
    "intro": "방산은 정부와 맺는 계약·예산·납품 일정이 중요한 사업이에요.",
    "driver": "국방 예산이 늘면 방산 회사 매출도 바로 늘까요?",
    "steps": [
      {
        "title": "예산에서 계약으로",
        "body": "예산 발표 뒤 사업 승인·계약·수출 허가 등의 절차를 확인해요."
      },
      {
        "title": "수주에서 납품으로",
        "body": "무기·장비는 제작과 납품에 시간이 필요해요. 계약 잔고는 당장 받은 이익이 아니에요."
      },
      {
        "title": "원가와 조건",
        "body": "고정 가격 계약·개발 비용·납품 지연에 따라 수주가 늘어도 이익은 다르게 움직일 수 있어요."
      }
    ],
    "watch": "계약 원문·수주 잔고·납품·원가·허가 조건을 봐요.",
    "check": "방산과 항공우주 회사가 자주 겹치는 이유는?",
    "checks": [
      {
        "title": "기술과 제품이 겹쳐요",
        "body": "항공기·엔진·우주 시스템을 민간과 국방 분야에 공급하는 회사가 있어요."
      },
      {
        "title": "고객과 예산은 나눠요",
        "body": "민간 항공 수요와 정부 방위 예산은 다른 시장이므로 사업별 매출을 확인해요."
      }
    ],
    "connections": [
      "aerospace",
      "shipbuilding"
    ]
  },
  {
    "id": "aerospace",
    "flow": ["주문", "제작·인증", "운항·정비"],
    "name": "항공·우주",
    "parent": "industrials",
    "anchor": "BA",
    "companies": [
      "BA",
      "GE",
      "LMT",
      "012450.KS"
    ],
    "intro": "완성 항공기·엔진·우주 시스템은 고객과 납품 과정이 달라요.",
    "driver": "항공기 주문이 늘면 엔진 회사까지 왜 볼까요?",
    "steps": [
      {
        "title": "완성품에도 부품이 필요해요",
        "body": "새 항공기를 만들려면 엔진·전자장비·소재 공급이 필요해요."
      },
      {
        "title": "납품·인증이 먼저",
        "body": "주문 뒤 실제 생산·안전 인증·납품으로 이어지는지를 확인해요."
      },
      {
        "title": "정비가 뒤따를 수 있어요",
        "body": "운항하는 항공기가 늘면 사용량과 정비 시점에 따라 엔진 서비스 수요가 이어질 수 있어요."
      }
    ],
    "watch": "항공기 납품·인증·엔진 주문·서비스와 사업별 비용을 봐요.",
    "check": "우주 사업과 민간 항공은 같은 시장인가요?",
    "checks": [
      {
        "title": "비행기와 우주 시스템",
        "body": "민간 항공은 항공사 수요, 우주는 발사·위성·정부·상업 계약 등을 각각 봐요."
      },
      {
        "title": "발표와 수익 사이",
        "body": "기술 성과 뒤 계약·제작·발사·운영 단계가 필요해요. 우주 뉴스 하나로 회사 전체를 평가하지 않아요."
      }
    ],
    "connections": [
      "defense",
      "materials"
    ]
  },
  {
    "id": "shipbuilding",
    "flow": ["수주", "건조", "인도"],
    "name": "조선",
    "parent": "industrials",
    "anchor": "042660.KS",
    "companies": [
      "042660.KS",
      "HII"
    ],
    "intro": "상선과 군함은 발주처가 달라요. 주문한 배를 만드는 기간과 비용을 함께 봐요.",
    "driver": "조선 수주가 늘어도 이익이 늦게 보이는 이유는?",
    "steps": [
      {
        "title": "주문한 배를 오래 만들어요",
        "body": "배 계약 뒤 설계·자재 조달·건조·납품이 이어져요. 수주 잔고와 실제 매출은 달라요."
      },
      {
        "title": "선종과 계약 조건",
        "body": "LNG 운반선 같은 상선과 군함은 고객·규격·계약 조건이 달라요."
      },
      {
        "title": "계약 가격과 만드는 비용",
        "body": "강재·인건비·환율·공정 지연에 따라 이익이 달라질 수 있어요."
      }
    ],
    "watch": "선종별 수주·건조 일정·원가·환율·현금 유입 조건을 봐요.",
    "check": "에너지·방산과 조선은 어디서 연결되나요?",
    "checks": [
      {
        "title": "가스를 옮기는 배",
        "body": "LNG 운송 수요는 선박 공급과 장기 계약 등을 거쳐 운반선 발주와 연결될 수 있어요."
      },
      {
        "title": "해군이 쓰는 배",
        "body": "함정 사업은 정부 예산·국방 계약·안전 요건을 살펴봐요."
      }
    ],
    "connections": [
      "energy",
      "defense"
    ]
  },
  {
    "id": "batteries",
    "flow": ["고객 주문", "배터리 생산", "차량·저장"],
    "name": "배터리",
    "parent": "industrials",
    "anchor": "006400.KS",
    "companies": [
      "006400.KS",
      "TSLA"
    ],
    "intro": "배터리는 전기차와 에너지 저장장치 등에 쓰여요. 고객과 제품을 나눠봐요.",
    "driver": "전기차 판매가 늘면 배터리 회사도 좋아질까요?",
    "steps": [
      {
        "title": "차량에 필요한 배터리",
        "body": "전기차 생산은 배터리 수요와 연결되지만 고객별 계약·제품 규격을 먼저 확인해요."
      },
      {
        "title": "물량과 가격이 함께 움직여요",
        "body": "판매 물량뿐 아니라 원재료 가격·판매 가격 조건·공장 가동률도 이익에 영향을 줘요."
      },
      {
        "title": "저장장치는 별도 시장",
        "body": "에너지 저장장치 수요는 전기차 수요와 다른 고객·계약을 가질 수 있어요."
      }
    ],
    "watch": "고객 생산 계획·제품별 매출·가동률·원재료와 가격 조건을 봐요.",
    "check": "배터리 업체와 완성차 업체는 어떻게 비교할까요?",
    "checks": [
      {
        "title": "공급하는 회사",
        "body": "배터리 업체는 고객 계약과 공장 가동·품질을 봐요."
      },
      {
        "title": "차를 파는 회사",
        "body": "완성차 업체는 차량 판매·할인·비용을 보고 배터리·저장장치 사업도 별도로 확인해요."
      }
    ],
    "connections": [
      "automotive",
      "utilities",
      "materials"
    ]
  },
  {
    "id": "automotive",
    "flow": ["생산", "판매", "서비스"],
    "name": "자동차",
    "parent": "consumer-discretionary",
    "anchor": "TSLA",
    "companies": [
      "TSLA",
      "005380.KS"
    ],
    "intro": "차량 판매량·가격·할인·부품 비용을 함께 봐야 실적을 이해할 수 있어요.",
    "driver": "자동차 판매량이 늘어도 이익이 줄 수 있나요?",
    "steps": [
      {
        "title": "가격과 수량",
        "body": "많이 팔아도 판매 가격을 더 크게 내리면 매출·이익 효과가 달라져요."
      },
      {
        "title": "차종과 생산 비용",
        "body": "비싼 차와 저렴한 차의 판매 구성, 공장 가동·부품 비용도 이익을 바꿔요."
      },
      {
        "title": "다른 사업은 별도로",
        "body": "테슬라는 에너지 사업도 운영해요. 차량 판매만으로 회사 전체를 평가하지 않아요."
      }
    ],
    "watch": "판매량·가격·할인·차종 구성·사업별 이익률을 봐요.",
    "check": "전기차 수요는 배터리와 전력에 어떻게 이어질까요?",
    "checks": [
      {
        "title": "차량에서 배터리로",
        "body": "생산 계획과 고객 계약을 통해 배터리 공급사의 물량을 확인해요."
      },
      {
        "title": "충전에서 전력으로",
        "body": "충전 설비·이용량·전력망 투자로 연결되지만 시간과 규제 조건을 함께 봐야 해요."
      }
    ],
    "connections": [
      "batteries",
      "utilities"
    ]
  }
];

export const SEMICONDUCTOR_SECTOR: SectorDefinition = {
  id: 'semiconductors', flow: ['서버 투자', '연산·메모리', '제품 매출'], name: '반도체', parent: 'technology', anchor: 'NVDA',
  companies: ['NVDA', '000660.KS', '005930.KS', 'MU'],
  intro: '계산하는 칩부터 데이터를 건네는 메모리까지. 같은 산업 안에서 서로 다른 역할을 살펴보세요.',
  driver: '', steps: [], watch: '', check: '', checks: [], connections: ['equipment', 'photonics'],
};
export const SECTORS = [...INDUSTRY_SECTORS, SEMICONDUCTOR_SECTOR];
export const sectorById = (id: SectorId) => SECTORS.find(item => item.id === id)!;
export const sectorOverview = (id: SectorId): SectorTopicId | 'semiconductors' => id === 'semiconductors' ? 'semiconductors' : `sector:${id}`;
export function sectorCompany(symbol: string) {
  return SECTOR_COMPANY_EVIDENCE.find(item => getStockIdentityKey(item.symbol) === getStockIdentityKey(symbol));
}
export function sectorsForCompany(symbol: string): SectorDefinition[] {
  const identity = getStockIdentityKey(symbol);
  const matches = SECTORS.filter(item => item.companies.some(value => getStockIdentityKey(value) === identity));
  // Specific product markets first, then broader industries; preserve editorial order within each.
  return [...matches.filter(item => item.parent), ...matches.filter(item => !item.parent)];
}
const PROFILE_SECTORS: Record<string, SectorId> = {
  'technology': 'technology', 'communication services': 'communication',
  'consumer cyclical': 'consumer-discretionary', 'consumer discretionary': 'consumer-discretionary',
  'consumer defensive': 'consumer-staples', 'consumer staples': 'consumer-staples',
  'energy': 'energy', 'financial services': 'financials', 'financials': 'financials',
  'healthcare': 'healthcare', 'health care': 'healthcare', 'industrials': 'industrials',
  'basic materials': 'materials', 'materials': 'materials', 'real estate': 'real-estate', 'utilities': 'utilities',
};
const PROFILE_INDUSTRIES: Record<string, SectorId> = {
  'semiconductors': 'semiconductors', 'semiconductor equipment & materials': 'equipment',
  'drug manufacturers - general': 'pharma', 'drug manufacturers - specialty & generic': 'pharma', 'biotechnology': 'pharma',
  'aerospace & defense': 'aerospace', 'auto manufacturers': 'automotive',
};
export function classifiedSectors(symbol: string, profile?: SectorProfile): { sectors: SectorDefinition[]; basis: 'reviewed' | 'catalog' | 'provider' | 'unknown' } {
  const reviewed = sectorsForCompany(symbol);
  if (reviewed.length) return { sectors: reviewed, basis: 'reviewed' };
  const catalog = industryGroup(profile?.classification?.industryId);
  if (profile?.classification?.status === 'classified' && catalog) return { sectors: [sectorById(catalog.parent)], basis: 'catalog' };
  if (profile?.classification && ['etp', 'shell', 'instrument', 'conflict'].includes(profile.classification.status)) return { sectors: [], basis: 'unknown' };
  const industry = PROFILE_INDUSTRIES[profile?.industry?.trim().toLowerCase() ?? ''] ?? providerIndustryParent(profile?.industry);
  const broad = PROFILE_SECTORS[profile?.sector?.trim().toLowerCase() ?? ''];
  const ids = [...new Set([industry, broad].filter((value): value is SectorId => !!value))];
  return { sectors: ids.map(sectorById), basis: ids.length ? 'provider' : 'unknown' };
}
