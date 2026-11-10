import { STOCK_LESSONS } from '@/config/stockLearning';
import { LEARNING_TERMS } from '@/config/stockLearningGraph';
import { FUNDS } from './fundExploration';
import { benchmarkLesson, FUND_FOUNDATIONS } from './fundLearning';

export interface FinancialTerm {
  id:string; title:string; aliases:readonly string[]; meaning:string; example?:string;
  source:string; related?:readonly string[];
}
const etfSource='https://www.investor.gov/introduction-investing/investing-basics/glossary/exchange-traded-fund-etf';
const indexSource='https://www.investor.gov/introduction-investing/investing-basics/glossary/index-fund';
const dailySource='https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/sec';
const stocksSource='https://www.investor.gov/introduction-investing/investing-basics/investment-products/stocks';
const bondsSource='https://www.investor.gov/introduction-investing/investing-basics/investment-products/bonds-or-fixed-income-products/bonds';
const statementsSource='https://www.sec.gov/about/reports-publications/beginners-guide-financial-statements';
const technicalSource='https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/';
// A chapter about a concept is not necessarily a definition of every word in it.
const CONCEPT_DEFINITIONS:Record<string,string>={
  '영업활동 현금흐름':'회사가 주된 사업을 하면서 실제로 받은 돈과 지출한 돈의 차이예요. 장부에 기록한 이익과 실제로 들어온 돈은 다를 수 있어요.',
  '현금흐름표':'일정 기간 실제로 들어오고 나간 돈을 영업·투자·자금 조달 활동으로 나누어 보여주는 자료예요. 이익이 난 회사가 현금도 충분한지 살펴볼 때 함께 봐요.',
  '현금 흐름':'일정 기간 실제로 들어오고 나간 돈의 움직임이에요. 물건을 팔았어도 돈을 나중에 받기로 했다면, 매출을 기록한 때와 현금이 들어온 때가 다를 수 있어요.',
  '순이익':'판매 수입에서 관련 비용과 세금 등을 반영하고 남은 이익이에요. 매출이 늘어도 비용이 더 많이 늘면 순이익은 줄 수 있어요.',
  'PER':'주가를 한 주당 이익으로 나눈 숫자예요. 회사가 버는 이익에 비해 주가가 어느 정도인지 보는 기준이며, 낮다는 이유만으로 좋은 투자가 되지는 않아요.',
  '가이던스':'회사가 앞으로의 매출·이익·사업 상황 등을 어떻게 예상하는지 밝힌 전망이에요. 이미 발표한 실제 실적이나 외부 전문가의 예상과는 구분해요.',
  '수주잔고':'이미 받은 주문 중 아직 매출로 이어지지 않은 물량이나 금액이에요. 주문을 실제로 공급하고 대금을 받는 시점, 계약 조건도 함께 확인해요.',
  '이익률':'매출에서 이익이 차지하는 비율이에요. 영업이익을 기준으로 하는지, 순이익을 기준으로 하는지에 따라 다른 숫자가 돼요.',
  '설비 투자':'회사가 공장·장비처럼 오래 사용할 자산에 돈을 쓰는 일이에요. 지금 현금이 나가더라도 실제 생산과 판매로 이어지는 데 시간이 걸릴 수 있어요.',
  '원자재':'제품을 만드는 데 쓰는 기본 재료예요. 석유·금속·목재 등이 있고, 어떤 재료를 쓰는지에 따라 가격 변화가 회사의 비용에 미치는 영향도 달라요.',
  '배당수익률':'일정 기간의 주당 배당금을 주가로 나눈 비율이에요. 과거에 지급한 금액인지 앞으로의 예상인지 확인해야 하며, 가격 손실까지 반영한 전체 수익률은 아니에요.',
  '배당':'회사가 번 이익 등을 주주에게 나눠주는 것이에요. 지급 여부와 금액은 바뀔 수 있고, 배당을 받아도 주가가 더 크게 내리면 전체로는 손실일 수 있어요.',
  '희석':'주식 수가 늘어나면서 기존 주주의 소유 비율 등이 작아지는 일이에요. 새로 들어온 자금과 발행 조건도 함께 봐야 하며, 주가가 반드시 내린다는 뜻은 아니에요.',
  '차입금':'회사가 다른 곳에서 빌린 돈이에요. 언제 갚아야 하는지, 이자를 얼마나 내는지, 갚을 현금이 충분한지를 함께 확인해요.',
  '물가':'여러 상품과 서비스의 가격 수준을 함께 보는 말이에요. 한 물건의 가격 변화와 전체 물가의 변화는 다를 수 있어요.',
  '분산':'여러 기업이나 자산에 나누어 투자하는 방식이에요. 특정 한 곳의 손실이 전체에 미치는 영향을 줄이려는 것이며, 전체 손실을 없애는 보장은 아니에요.',
};
export const FINANCIAL_TERMS:FinancialTerm[]=[
  {id:'stock',title:'주식 · 회사의 일부를 소유하는 권리',aliases:['주식'],meaning:'회사의 일부를 소유하는 권리를 나눈 것이에요. 회사에 대한 기대와 시장 상황 등에 따라 사고파는 가격이 바뀌며, 투자한 돈을 잃을 수도 있어요.',source:stocksSource,related:['stock-price','revenue']},
  {id:'stock-price',title:'주가 · 주식 한 주를 사고파는 가격',aliases:['주가'],meaning:'회사 주식 한 주가 시장에서 거래되는 가격이에요. 한 주의 가격이 높다는 것과 회사 전체의 가치가 크다는 것은 다른 이야기예요.',source:stocksSource,related:['stock','weight']},
  {id:'bond',title:'채권 · 돈을 빌려주고 돌려받기로 한 권리',aliases:['채권'],meaning:'국가나 회사 등에 돈을 빌려주고 정해진 조건에 따라 이자와 원금을 돌려받기로 한 권리예요. 약속을 지키지 못할 위험이 있고, 중간에 사고파는 가격도 달라질 수 있어요.',source:bondsSource,related:['asset:treasury','asset:corporate-bond']},
  {id:'interest',title:'금리 · 돈을 빌리거나 맡기는 대가의 비율',aliases:['금리'],meaning:'돈을 빌리거나 맡겼을 때 내거나 받는 이자를 비율로 나타낸 것이에요. 기간과 상품 조건에 따라 실제 금액은 달라져요.',example:'가상으로 100만원에 연 5%의 단순 이자를 적용하면 1년 이자는 5만원이에요. 세금과 다른 비용은 제외한 예시예요.',source:bondsSource,related:['bond','return']},
  {id:'revenue',title:'매출 · 제품과 서비스를 팔아 올린 금액',aliases:['매출'],meaning:'제품과 서비스를 판매해 올린 금액이에요. 재료비·인건비·세금 등을 빼고 남은 돈과는 구분해요.',source:statementsSource,related:['concept:순이익','concept:이익률']},
  {id:'etf',title:'ETF · 주식처럼 사고파는 투자 상품',aliases:['ETF','상장지수펀드'],meaning:'여러 투자자가 모은 돈을 정해진 자산이나 투자 방식에 맞춰 운용하고, 그 몫을 주식처럼 거래소에서 사고팔 수 있게 만든 상품이에요. 무엇에 투자하고 어떻게 운용하는지는 상품마다 달라요.',example:'반도체 ETF와 금 ETF는 모두 주식처럼 거래하지만, 가격에 영향을 주는 투자 대상은 달라요.',source:etfSource,related:['fund','index','leverage']},
  {id:'fund',title:'펀드 · 모은 돈을 정해진 방식으로 운용하는 상품',aliases:['펀드'],meaning:'여러 투자자의 돈을 모아 정해진 대상과 방식에 따라 운용하는 투자 상품이에요. 운용 결과에 따라 투자한 돈이 늘거나 줄 수 있어요.',source:etfSource,related:['etf']},
  {id:'distribution',title:'분배금 · 투자 상품이 보유자에게 나눠주는 돈',aliases:['분배금'],meaning:'ETF 같은 투자 상품이 운용 과정에서 생긴 수입 등을 보유자에게 나눠주는 돈이에요. 지급액만 보고 이익을 판단하지 않고, 상품의 가격 변화와 함께 봐야 해요.',example:'가상으로 분배금 1천원을 받아도 상품 가격이 그보다 크게 내렸다면, 전체로는 손실일 수 있어요.',source:etfSource,related:['etf','return']},
  {id:'stock-split',title:'주식분할 · 한 주를 여러 주로 나누기',aliases:['주식분할','주식 분할','액면분할'],meaning:'한 주를 여러 주로 나누어 주식 수와 한 주의 가격을 조정하는 일이에요. 나누는 행위 자체로 내가 가진 전체 가치가 늘어나지는 않아요.',example:'가상으로 10만원짜리 한 주를 2대1로 나누면 5만원짜리 두 주가 되는 식이에요. 다른 가격 변화는 없다고 가정한 예시예요.',source:'https://www.investor.gov/introduction-investing/investing-basics/glossary/stock-split',related:['stock-price','stock']},
  {id:'reverse-split',title:'주식병합 · 여러 주를 한 주로 합치기',aliases:['주식병합','주식 병합'],meaning:'여러 주를 한 주로 합쳐 주식 수와 한 주의 가격을 조정하는 일이에요. 한 주의 가격이 높아져도 그 조정만으로 전체 투자 가치가 늘어나는 것은 아니에요.',source:'https://www.investor.gov/introduction-investing/investing-basics/glossary/reverse-stock-splits',related:['stock-split','stock-price']},
  {id:'adjusted-price',title:'수정주가 · 배당·분할 등을 반영해 보정한 가격',aliases:['수정주가'],meaning:'배당이나 주식분할 같은 변화 이후에도 과거와 비교할 수 있게 보정한 가격이에요. 어떤 항목을 반영했는지는 자료마다 다를 수 있어요. 차트의 계산 기준을 함께 확인해야 해요.',source:'https://help.yahoo.com/kb/SLN28256.html',related:['stock-split','distribution']},
  {id:'weight',title:'비중 · 전체에서 차지하는 비율',aliases:['비중'],meaning:'전체 금액이나 계산에서 특정 자산이 차지하는 비율이에요. 주가를 묶어 계산하는 지수에서는 기업마다 반영하는 비율이 다를 수 있어요.',example:'가상으로 총 100만원 중 한 종목에 20만원을 투자했다면, 그 종목의 비중은 20%예요.',source:indexSource,related:['index']},
  {id:'return',title:'수익률 · 투자한 금액에 비해 늘거나 줄어든 비율',aliases:['수익률'],meaning:'처음 투자한 금액과 비교해 돈이 얼마나 늘거나 줄었는지 나타내는 비율이에요. 비용과 세금, 받은 현금을 포함하는 기준에 따라 계산 결과가 달라질 수 있어요.',example:'가상으로 1만원이 1만1천원이 되면 +10%, 9천원이 되면 −10%예요. 비용과 세금은 제외한 예시예요.',source:'https://syndication.finra.org/content/key-concepts-return-and-rate-return',related:['etf','weight']},
  {id:'fx',title:'환율 · 서로 다른 돈을 바꾸는 비율',aliases:['환율'],meaning:'서로 다른 나라의 돈을 바꾸는 비율이에요. 달러당 원화 환율이 1,300원이면 1달러를 원화 1,300원으로 계산한다는 뜻이에요. 원화로 본 투자 가치는 상품 가격과 환율에 따라 달라져요.',example:'가상의 달러 상품 가격이 그대로인데 1달러가 1,300원에서 1,200원이 되면, 원화로 환산한 가치는 줄어요. 매매·환전 비용과 세금은 제외한 예시예요.',source:'https://www.investor.gov/introduction-investing/investing-basics/investment-products/international-investing',related:['return','etf']},
  {id:'benchmark',title:'기초지수 · 상품이 따라가려는 기준',aliases:['기초지수','기초 지수'],meaning:'상품이 수익률의 기준으로 삼는 가격 움직임을 뜻해요. 어떤 기업이나 자산을 넣고, 각각 얼마나 반영할지 정한 규칙으로 계산해요.',example:'SOXL은 반도체 기업들의 주가를 묶은 기준을 봐요. 엔비디아 한 회사의 주가와는 움직임이 다를 수 있어요.',source:'https://www.direxion.com/product/daily-semiconductor-bull-bear-3x-etfs',related:['index','nyse-semiconductor','etf']},
  {id:'underlying-stock',title:'기초주식 · 상품이 기준으로 삼는 회사의 주식',aliases:['기초주식'],meaning:'상품이 수익률을 따라가려는 회사의 주식이에요. 예를 들어 테슬라 주가를 기준으로 하는 상품은 테슬라 주식의 가격 움직임에서 출발해요. 여러 기업을 묶은 지수와는 구분해요.',source:'https://www.direxion.com/product/daily-tsla-bull-and-bear-leveraged-single-stock-etfs',related:['benchmark','leverage']},
  {id:'index',title:'지수 · 여러 가격의 움직임을 묶은 숫자',aliases:['주가지수','지수'],meaning:'정해진 기업이나 자산의 가격 움직임을 하나의 숫자로 묶은 기준이에요. 어떤 대상을 넣고 얼마나 반영하는지에 따라 지수의 움직임도 달라져요.',example:'가상의 지수가 100에서 101이 되면 1% 오른 것이에요. 모든 기업이 똑같이 1% 올랐다는 뜻은 아니에요.',source:indexSource,related:['benchmark','etf']},
  {id:'nyse-semiconductor',title:'NYSE 반도체지수',aliases:['NYSE 반도체지수','NYSE 반도체 지수','NYSE Semiconductor Index'],meaning:'미국 주식시장에서 거래되는 반도체 관련 기업 30곳의 주가 움직임을 하나로 묶은 기준이에요. 반도체를 설계·생산하거나 관련 장비를 만드는 기업 등이 포함돼요. 기업마다 가격 변화가 반영되는 비중은 달라요.',example:'SOXL은 이 지수의 하루 수익률 3배를 목표로 해요. 반도체 산업 전체 기업 목록과 이 지수의 구성 목록은 구분해야 해요.',source:'https://www.direxion.com/product/daily-semiconductor-bull-bear-3x-etfs',related:['nyse','index','etf']},
  {id:'nyse',title:'NYSE · 뉴욕증권거래소',aliases:['NYSE'],meaning:'미국의 주식 거래소인 뉴욕증권거래소의 영어 약자예요. 거래소는 주식 같은 증권을 사고파는 시장이에요. NYSE 반도체지수는 이 이름이 붙은 특정 지수이며, 거래소 전체 주식의 움직임을 뜻하지 않아요.',source:'https://www.nyse.com/markets/nyse',related:['nyse-semiconductor','index']},
  {id:'leverage',title:'레버리지 · 가격 변화를 배수로 확대하는 방식',aliases:['레버리지'],meaning:'기준이 되는 가격 움직임을 정해진 배수로 확대하려는 방식이에요. 주비에 설명한 일일 레버리지 상품은 하루를 기준으로 목표를 다시 맞추므로 여러 날의 수익률은 단순 배수와 달라질 수 있어요.',source:dailySource,related:['benchmark','inverse','etf']},
  {id:'inverse',title:'인버스 · 기준과 반대 방향을 목표로 하는 방식',aliases:['인버스'],meaning:'기준 가격이 내려갈 때 이익, 올라갈 때 손실이 나는 방향을 목표로 하는 방식이에요. 일일 목표 상품은 여러 날의 누적 결과가 단순히 반대가 되지는 않아요.',source:dailySource,related:['leverage','benchmark']},
  ...[...new Map(FUNDS.flatMap(fund=>{const lesson=benchmarkLesson(fund);return lesson?[[lesson.name,lesson] as const]:[];})).values()]
    .filter(lesson=>lesson.name!=='NYSE 반도체지수')
    .map(lesson=>({id:`benchmark:${lesson.name}`,title:lesson.name,aliases:[lesson.name],meaning:lesson.meaning,example:lesson.detail,source:lesson.source,related:['index','etf']})),
  ...([
    ['treasury',['국채']],['corporate-bond',['회사채']],['real-estate',['리츠']],
    ['clo',['CLO']],['mortgage-bond',['주택저당증권','MBS']],
    ['commodity-futures',['선물 계약','원자재 선물','비트코인 선물']],['preferred',['우선주']],
    ['inflation-bond',['물가연동국채','TIPS']],
  ] as const).map(([kind,aliases])=>({id:`asset:${kind}`,title:aliases[0],aliases,
    meaning:FUND_FOUNDATIONS[kind].meaning,example:FUND_FOUNDATIONS[kind].watch,
    source:FUNDS.find(fund=>fund.kind===kind)!.issuerUrl,related:['etf']})),
  {id:'chart-average',title:'이동평균선 · 최근 가격을 평균 내어 이은 선',aliases:['이동평균선','이동평균'],meaning:'정해진 개수의 가격을 평균 낸 값을 차례로 이은 선이에요. 짧은 오르내림을 조금 줄여 가격 흐름을 살펴봐요.',example:'5분봉 20개 평균은 받은 5분 구간 가격 20개를 평균 낸 거예요. 20일 동안의 가격을 평균 낸 20일선과는 달라요.',source:technicalSource+'sma',related:['chart-candle','chart-bollinger']},
  {id:'chart-bollinger',title:'볼린저밴드 · 평균 주변의 가격 흔들림',aliases:['볼린저밴드','볼린저 밴드'],meaning:'가운데 평균선과 그 위아래의 두 경계선이에요. 최근 가격이 평균에서 많이 흩어져 있으면 두 경계 사이도 넓어져요. 경계에 닿았다는 사실만으로 사고팔 시점을 알려주지는 않아요.',example:'주비의 5분 차트는 받은 가격 20개의 평균을 가운데에 놓고, 그 가격들의 흔들림 크기의 2배를 위아래에 더하거나 빼서 그려요.',source:'https://www.bollingerbands.com/bollinger-band-rules',related:['chart-average','chart-rsi']},
  {id:'chart-rsi',title:'RSI · 최근 오른 폭과 내린 폭의 비교',aliases:['RSI'],meaning:'최근 가격이 오른 폭과 내린 폭을 비교해 0~100 사이 숫자로 나타낸 거예요. 70 이상이나 30 이하인지 살펴보기도 하지만, 그 값만으로 이후 방향을 알 수는 없어요.',example:'주비의 5분 차트는 14개 구간을 기준으로 계산해요. RSI가 낮은 채로 가격이 계속 내려갈 수도 있어요.',source:technicalSource+'RSI',related:['chart-average','chart-macd']},
  {id:'chart-macd',title:'MACD · 두 가격 평균 사이의 변화',aliases:['MACD'],meaning:'최근 가격에 더 비중을 둔 짧은 평균과 긴 평균의 차이예요. 그 차이가 벌어지거나 줄어드는 모습을 함께 봐요.',example:'주비는 12개·26개 구간 평균의 차이와, 그 차이의 9개 구간 평균을 비교해요. 모두 5분봉 기준이며 일봉 지표와는 달라요.',source:technicalSource+'macd',related:['chart-average','chart-rsi']},
  {id:'chart-candle',title:'5분봉 · 한 구간의 가격을 그린 모양',aliases:['5분봉','캔들'],meaning:'한 구간에서 첫 가격·마지막 가격·가장 높고 낮은 가격을 함께 그린 거예요. 몸통은 첫 가격과 마지막 가격 사이, 위아래 꼬리는 그 밖에서 거래된 가격을 보여줘요.',source:'https://scs.fidelity.com/webcontent/ap010098-etf-content/18.12.0/help/research/cef/advancedChart.shtml',related:['chart-average']},
  {id:'chart-volume',title:'거래량 · 거래된 주식 수',aliases:['거래량'],meaning:'정해진 시간 동안 거래된 주식이 몇 주인지 세는 수치예요. 거래량이 많다는 사실만으로 가격이 오를지 내릴지, 누가 샀는지는 알 수 없어요.',example:'가령 5분 동안 100주, 200주, 50주가 차례로 거래됐다면 그 구간의 거래량은 350주예요. 거래한 사람 수나 거래 금액과는 달라요.',source:'https://www.fidelity.com/webcontent/ap002390-mlo-content/19.09/help/help_definition_v.shtml#volume'},
  {id:'chart-turns',title:'고점·저점 · 비교 범위의 높고 낮은 가격',aliases:['고점','저점','차트 전환점'],meaning:'고점과 저점은 어떤 범위와 비교하는지에 따라 달라요. 52주 고점은 최근 52주 동안 가장 높은 가격이에요. 차트에서 방향이 돌아선 곳을 찾을 때는 주변 가격보다 높거나 낮은 지점을 살펴봐요.',example:'이 화면은 받은 가격의 앞뒤 2개씩과 비교해 전환점을 찾아요. 마지막 가격은 뒤의 자료가 아직 없어 같은 방식으로 확정하지 않아요.',source:'https://www.fidelity.com/learning-center/trading-investing/technical-analysis/using-technical-analysis'},
  ...LEARNING_TERMS.flatMap(([word,id])=>{
    const lesson=STOCK_LESSONS.find(item=>item.id===id),meaning=CONCEPT_DEFINITIONS[word];
    return lesson&&meaning?[{id:`concept:${word}`,title:word,aliases:[word],meaning,example:lesson.example,source:lesson.source}]:[];
  }),
];
const byId=new Map(FINANCIAL_TERMS.map(term=>[term.id,term]));
const aliasOwners=new Map<string,{word:string;id:string}>();
for(const term of FINANCIAL_TERMS)for(const word of term.aliases)if(!aliasOwners.has(word.toLowerCase()))aliasOwners.set(word.toLowerCase(),{word,id:term.id});
export const financialTerm=(id:string)=>byId.get(id);

/** Longest phrase wins: NYSE 반도체지수 opens its own definition, not three nested links. */
export function financialTermMatches(text:string,current?:string) {
  const lower=text.toLowerCase();
  const candidates=[...aliasOwners.values()].filter(term=>term.id!==current).flatMap(({word,id})=>{
    const found=[];
    for(let index=lower.indexOf(word.toLowerCase());index>=0;index=lower.indexOf(word.toLowerCase(),index+word.length)) {
      if(/^[A-Za-z]+$/.test(word)&&(/[A-Za-z]/.test(text[index-1]??'')||/[A-Za-z]/.test(text[index+word.length]??'')))continue;
      found.push({id,word:text.slice(index,index+word.length),index});
    }
    return found;
  }).sort((a,b)=>a.index-b.index||b.word.length-a.word.length);
  const chosen:typeof candidates=[],seen=new Set();let end=0;
  for(const match of candidates) {
    if(match.index<end||seen.has(match.id))continue;
    chosen.push(match);seen.add(match.id);end=match.index+match.word.length;
  }
  return chosen;
}
