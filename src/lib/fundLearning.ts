import type { FundKind, FundProfile } from './fundExploration';

/** Definitions describe the asset/strategy, not a live cause of a ticker's move. */
export const FUND_FOUNDATIONS: Record<FundKind, { meaning: string; watch: string }> = {
  equity: {meaning:'주식은 회사의 일부를 소유하는 권리예요. 주가지수는 정해진 기업들의 가격 움직임을 하나의 숫자로 묶은 기준이고, 지수 ETF는 그 기준을 따라가도록 투자해요.',watch:'상위 기업의 비중, 기업 실적, 지수의 편입 기준을 확인해요.'},
  growth: {meaning:'성장주는 매출·이익이 커질 것으로 기대되는 기업의 주식이에요. 좋은 회사인지와 현재 가격에 기대가 얼마나 담겼는지는 따로 봐야 해요.',watch:'실제 성장률과 예상의 차이, 금리, 상위 기업 비중을 봐요.'},
  value: {meaning:'가치주는 이익이나 자산 등에 비해 가격이 낮다고 평가되는 주식이에요. 저렴한 이유가 일시적인지 사업 악화 때문인지가 중요해요.',watch:'편입 기준과 기업 이익의 변화, 저평가의 배경을 봐요.'},
  dividend: {meaning:'배당은 기업이 번 돈의 일부를 주주에게 나누는 것이에요. ETF가 받은 배당 등으로 투자자에게 지급하는 돈은 분배금이라고 해요.',watch:'배당을 계속 지급할 여력, 분배금과 주가를 합친 성과를 봐요.'},
  'equal-weight': {meaning:'동일 비중은 정해진 조정 시점마다 기업별 투자 금액의 비율을 비슷하게 맞추는 방식이에요. 조정 사이에는 주가 변화로 비중이 달라져요.',watch:'비중을 다시 맞추는 주기와 대형주·중소형주의 흐름을 봐요.'},
  sector: {meaning:'산업 ETF는 비슷한 사업을 하는 회사들을 묶어요. 같은 산업이라도 제품을 만드는 회사, 장비를 파는 회사처럼 돈 버는 역할은 달라요.',watch:'산업 수요와 비용, 상위 기업의 실적·비중을 함께 봐요.'},
  theme: {meaning:'테마는 AI·로봇처럼 여러 산업에 걸친 변화의 주제예요. 주제와 관련 있다는 것과 그 회사가 실제 이익을 낸다는 것은 달라요.',watch:'관련 사업의 실제 매출, 편입 기준, 특정 기업 집중도를 봐요.'},
  'active-equity': {meaning:'액티브 운용은 정해진 지수를 그대로 따르기보다 운용사가 종목과 비중을 판단하는 방식이에요. 구성과 성과가 운용사의 선택에 따라 달라져요.',watch:'운용 전략과 실제 구성 변화, 비용을 뺀 성과를 봐요.'},
  international: {meaning:'해외 주식은 현지 회사의 주가와 통화 가치가 함께 영향을 줘요. MSCI·FTSE 같은 지수 회사는 어느 나라와 기업을 담을지 정하는 기준을 만들어요.',watch:'투자 국가, 현지 통화와 달러의 관계, 환헤지 여부를 봐요.'},
  'real-estate': {meaning:'리츠는 부동산을 보유·운영하거나 관련 대출에 투자해 수입을 얻는 구조예요. 리츠 주식 ETF를 사는 것은 건물 한 채를 직접 소유하는 것과 달라요.',watch:'임대 수입·공실, 차입 비용, 보유 부동산 종류를 봐요.'},
  treasury: {meaning:'국채는 정부에 돈을 빌려주고 이자와 원금을 받는 채권이에요. 만기까지 남은 기간이 길면 보통 금리 변화에 시장가격이 더 크게 움직여요.',watch:'시장금리와 만기 구성, 금리에 대한 가격 민감도를 봐요.'},
  'cash-bond': {meaning:'단기 채권은 돈을 돌려받기까지 남은 기간이 짧은 채권이에요. 예금처럼 보일 수 있지만 시장에서 거래되는 가격과 발행사의 상환 능력이 영향을 줘요.',watch:'짧은 만기의 범위, 국채·회사채 비중, 분배 일정을 봐요.'},
  'aggregate-bond': {meaning:'종합 채권은 국채·회사채 등 여러 채권을 묶은 것이에요. 투자등급은 신용평가사가 상대적으로 상환 능력이 높다고 평가한 등급이며 원금 보장을 뜻하지 않아요.',watch:'국채·회사채 비중, 신용등급, 금리 민감도를 봐요.'},
  'corporate-bond': {meaning:'회사채는 기업에 돈을 빌려주는 채권이에요. 국채보다 더 받으려는 금리 차이는 기업의 상환 위험을 감수하는 대가를 포함해요.',watch:'시장금리와 국채 대비 추가 금리, 신용등급 변화를 봐요.'},
  'high-yield': {meaning:'하이일드 채권은 신용등급이 낮아 더 높은 이자를 제시하는 채권이에요. 약속한 이자가 높아도 기업이 갚지 못하면 손실이 날 수 있어요.',watch:'부도율, 기업의 상환 여력, 추가 금리의 확대를 봐요.'},
  'inflation-bond': {meaning:'TIPS는 미국 물가 변화에 맞춰 원금을 조정하는 국채예요. 물가 반영과 별개로 현재 시장에서 거래하는 채권 가격은 실질금리의 영향을 받아요.',watch:'물가에 따른 원금 조정과 실질금리 변화를 나눠 봐요.'},
  metal: {meaning:'현물은 실제 금·은 같은 자산 자체를 뜻해요. 이를 보관하는 상품은 금속 가격에 연결되며, 금광 회사의 이익에 투자하는 주식 상품과 달라요.',watch:'현물 가격과 달러·금리 환경, 보관·운용 비용을 봐요.'},
  'commodity-futures': {meaning:'선물은 정해진 미래 시점의 거래를 약속하는 계약이에요. 만기가 오면 새 계약으로 바꾸는데, 이 교체 가격도 성과에 영향을 줘요.',watch:'뉴스의 현물 가격과 보유 선물의 차이, 만기 교체 조건을 봐요.'},
  'bitcoin-spot': {meaning:'비트코인 현물 상품은 코인을 보관해 가격 변화에 참여하는 구조예요. ETF 주식을 사도 내 지갑으로 비트코인이 들어오는 것은 아니에요.',watch:'코인 가격의 기준 시각, 거래소 개장 시간, 보관 비용을 봐요.'},
  'bitcoin-futures': {meaning:'비트코인 선물은 코인 자체가 아니라 미래 거래 계약이에요. 현물 가격뿐 아니라 계약 가격과 만기 교체가 성과에 영향을 줘요.',watch:'현물과 선물 가격의 차이, 교체 조건, 분배금을 봐요.'},
  leverage: {meaning:'기초지수는 수익률을 비교하는 기준이고, 레버리지는 그 하루 변화를 배수로 확대하려는 방식이에요. 인버스는 기준과 반대 방향의 하루 수익률을 목표로 해요.',watch:'정확한 기초지수, 배수와 방향, 하루 기준, 여러 날의 누적 결과를 봐요.'},
  'muni-bond': {meaning:'지방채는 미국 지방정부 등이 자금을 조달하며 발행하는 채권이에요. 미국의 세금상 혜택이 한국 투자자에게 그대로 적용되는 것은 아니에요.',watch:'발행사의 상환 능력, 만기 구성, 내 계좌에 적용되는 세금을 확인해요.'},
  quality: {meaning:'퀄리티는 수익성·부채·이익의 안정성 같은 재무 기준으로 기업을 고르는 방식이에요. 어떤 기준을 쓰는지는 상품마다 달라요.',watch:'선정 기준과 재무 상태의 변화, 가격에 반영된 기대를 봐요.'},
  'mortgage-bond': {meaning:'주택담보대출 관련 채권은 여러 대출의 원리금 상환을 묶은 구조예요. 대출자가 예상보다 빨리 갚거나 늦게 갚으면 받는 돈의 시점이 달라져요.',watch:'금리, 조기 상환 가능성, 정부기관 보증 여부를 봐요.'},
  clo: {meaning:'CLO는 여러 기업 대출을 묶고 돈을 지급받는 순서를 나눈 증권이에요. 앞순위일수록 먼저 받지만 손실 가능성이 없어지는 것은 아니에요.',watch:'담는 지급 순위와 신용등급, 대출 부도 위험을 봐요.'},
  momentum: {meaning:'모멘텀은 최근 상대적으로 강한 가격 흐름을 보인 주식을 고르는 방식이에요. 과거 상승이 계속된다는 보장은 없어요.',watch:'선정·교체 주기, 시장의 주도 종목이 바뀌는 상황을 봐요.'},
  'floating-treasury': {meaning:'변동금리 국채는 기준에 따라 이자율을 다시 맞추는 국채예요. 금리가 바뀌면 앞으로 받을 이자도 달라져요.',watch:'이자 조정 기준과 주기, 분배금 변화를 봐요.'},
  'box-spread': {meaning:'박스 스프레드는 여러 콜·풋옵션을 조합해 만기의 지급 구조를 만드는 전략이에요. 옵션은 정해진 가격으로 사거나 팔 수 있는 권리예요.',watch:'옵션 계약 조건, 만기, 거래 비용과 세금 처리를 봐요.'},
  'energy-partnership': {meaning:'에너지 파트너십은 송유관·저장 시설 등 에너지 기반 사업과 연결된 지분 구조예요. 원유 가격 자체와 사업 수입은 같지 않아요.',watch:'운송·처리 물량, 계약과 비용, 상품의 세금 구조를 봐요.'},
  preferred: {meaning:'우선주는 보통주보다 배당이나 잔여 재산 지급에서 우선하는 조건을 가진 주식이에요. 채권과 비슷한 성격이 있어도 예금이나 국채는 아니에요.',watch:'배당 조건, 발행사 신용, 금리와 조기 상환 조건을 봐요.'},
  'floating-bond': {meaning:'변동금리 채권은 기준금리에 따라 이자가 조정되는 채권이에요. 금리 변화에 대한 가격 민감도가 작아도 발행사의 신용위험은 남아요.',watch:'이자 조정 기준, 발행사 신용등급, 추가 금리를 봐요.'},
  buffer: {meaning:'버퍼는 정해진 기간과 조건 아래 일부 하락을 완충하도록 옵션을 조합하는 구조예요. 완충 한도와 상승 참여 한도가 있고 매수 시점에 따라 결과가 달라져요.',watch:'결과 측정 기간, 남은 완충·상승 한도, 매수 시점을 확인해요.'},
  'ether-spot': {meaning:'이더 현물 상품은 이더리움 네트워크의 자산인 이더 가격에 연결돼요. 네트워크 이용 증가와 코인 투자 수익이 항상 같은 방향인 것은 아니에요.',watch:'이더 가격, 보관 방식, 스테이킹 제공 여부와 관련 조건을 확인해요.'},
  'option-income': {meaning:'콜옵션은 정해진 가격에 살 수 있는 권리예요. 이를 파는 전략은 대가를 받는 대신 일부 상승 이익을 내줄 수 있어요. ELN은 이런 수익 구조를 담은 금융기관 발행 증권이에요.',watch:'옵션 매도 범위·만기, 상승 참여 한도, 분배금과 가격을 합친 결과를 봐요.'},
};
export interface BenchmarkLesson { name: string; meaning: string; detail: string; source: string }
const KOREA: BenchmarkLesson = {name:'MSCI Korea 25/50',meaning:'MSCI라는 지수 회사가 한국 대형·중형 기업의 주가를 비중에 따라 묶어 계산한 지수예요. 주가지수는 여러 주식의 움직임을 하나의 숫자로 보여주는 기준이에요.',detail:'25/50은 종목 수가 아니라 비중 제한이에요. 지수 조정 시 한 기업 집단의 비중은 25% 이하, 비중이 5%를 넘는 기업 집단들의 합은 50% 이하가 되도록 맞춰요. 코스피와 편입 기업·비중·계산 기준이 달라요.',source:'https://www.msci.com/indexes/index/702747/msci-korea-25-50-index'};
const NASDAQ: BenchmarkLesson = {name:'나스닥100',meaning:'나스닥 거래소에 상장한 대형 비금융 기업 100개를 중심으로 묶는 지수예요. 나스닥 전체 종목이나 기술 기업만의 목록은 아니에요.',detail:'기업별 비중이 달라 비중이 큰 회사의 주가 변화가 지수에 더 크게 작용해요. 같은 지수를 보더라도 배수·옵션 전략에 따라 상품 수익은 달라져요.',source:'https://indexes.nasdaq.com/docs/FS_NDX.pdf'};
const SP500: BenchmarkLesson = {name:'S&P 500',meaning:'미국 대형 기업 500개를 중심으로 시장의 흐름을 보여주는 지수예요. 모든 회사가 같은 비중으로 들어가는 것은 아니에요.',detail:'규모·유동성·이익 등의 편입 기준을 적용해요. 같은 기업들을 담아도 동일 비중, 산업별 선별, 옵션 전략인지에 따라 결과가 달라져요.',source:'https://www.spglobal.com/spdji/en/indices/equity/sp-500/'};
const RUSSELL: BenchmarkLesson = {name:'러셀2000',meaning:'미국 주식시장 중 상대적으로 작은 기업 약 2,000개의 움직임을 보여주는 지수예요. 숫자 2000은 지수의 목표 구성 규모를 나타내요.',detail:'소형 기업은 자금 조달 환경과 경기 변화에 영향을 받을 수 있어요. 대형주 지수와 구성·비중이 달라 움직임도 같지 않아요.',source:'https://www.lseg.com/en/ftse-russell/indices/russell-2000-index'};
const SEMI: BenchmarkLesson = {name:'NYSE 반도체지수',meaning:'미국에 상장한 반도체 관련 기업들의 주가를 묶는 지수예요. 칩 설계·생산·장비 등 서로 다른 역할의 기업이 포함될 수 있어요.',detail:'한 회사가 아닌 여러 기업의 가격을 비중에 따라 합쳐요. 반도체 수요 증가가 모든 기업의 이익 증가로 똑같이 이어지는 것은 아니에요.',source:'https://www.ishares.com/us/products/239705/ishares-phlx-semiconductor-etf'};
export function benchmarkLesson(fund: FundProfile): BenchmarkLesson | undefined {
  if (fund.symbol === 'TSLL') return {name:`${fund.underlyingSymbol} 보통주`,meaning:'보통주는 회사의 일부를 소유하는 권리예요. 이 상품은 여러 회사의 지수가 아니라 테슬라 한 회사의 하루 주가 변화를 기준으로 삼아요.',detail:'테슬라의 자동차·에너지 사업 실적과 전망, 이미 주가에 반영된 기대 등이 기초주식 가격에 영향을 줄 수 있어요. TSLL은 그 하루 변화의 2배를 목표로 하며 여러 날의 단순 2배는 아니에요.',source:fund.issuerUrl};
  if (['TMF','TMV'].includes(fund.symbol)) return {name:'장기 미국 국채 지수',meaning:'미국 정부가 발행한 국채 중 만기가 20년 이상 남은 채권들의 수익률을 묶는 기준이에요. 배수를 곱하는 대상은 금리 숫자가 아닌 채권 지수의 하루 변화예요.',detail:'시장금리가 내리면 기존 고정금리 채권의 가격을 높이는 방향으로 작용하고, 금리가 오르면 반대예요. 만기가 긴 채권은 이 변화에 더 민감할 수 있어요.',source:fund.issuerUrl};
  if (['KORU','EWY'].includes(fund.symbol)) return KOREA;
  if (/나스닥100/.test(fund.target)) return NASDAQ;
  if (/S&P 500/.test(fund.target)) return SP500;
  if (/러셀2000/.test(fund.target)) return RUSSELL;
  if (/NYSE 반도체/.test(fund.target)) return SEMI;
  return undefined;
}
/** Constant-FX and weighted-basket simplification. Not a live NAV/market-price model. */
export function koreaDailyExample(localReturn: number, usdKrwReturn: number, multiple: number) {
  if (![localReturn,usdKrwReturn,multiple].every(Number.isFinite) || localReturn <= -1 || usdKrwReturn <= -1) throw new Error('Invalid example');
  const dollarReturn = (1 + localReturn) / (1 + usdKrwReturn) - 1;
  const productReturn = dollarReturn * multiple;
  if (productReturn < -1) throw new Error('Example exceeds loss limit');
  return { dollarReturn, productReturn };
}
