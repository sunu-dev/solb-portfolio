import { benchmarkLesson, FUND_FOUNDATIONS } from './fundLearning';
import catalogue from '@/data/etf-explanations.json';
import { getStockIdentityKey } from '@/utils/stockCurrency';
import { eunNeun } from '@/utils/koreanJosa';

export interface FundMechanism {
  label: string;
  icon: 'stocks' | 'bond' | 'income' | 'metal' | 'futures' | 'bitcoin' | 'ether' | 'leverage' | 'building';
  flow: [string, string, string];
  returns: string;
  risk: string;
  question: string;
  answer: string;
}
export const FUND_MECHANISMS = {
  equity: { label:'주가지수',icon:'stocks',flow:['기업의 이익과 기대','편입 주식의 가격·배당','ETF 가치와 분배금'],returns:'편입 기업의 주가가 오르면 펀드가 가진 주식의 가치도 커져요. 기업이 지급한 배당은 펀드의 수입이 돼요. ETF 한 주의 가격 변화와 받은 분배금을 함께 봐야 전체 성과를 알 수 있어요.',risk:'많은 기업을 담아도 비중이 큰 기업이나 시장 전체가 하락하면 손실이 나요. 종목 수와 실제 분산 정도는 달라요.',question:'기업을 많이 담으면 위험도 똑같이 나뉘나요?',answer:'기업마다 담는 비중이 달라요. 시가총액을 기준으로 하는 지수에서는 큰 기업의 움직임이 더 크게 작용해요. 구성 종목 수와 상위 기업의 비중을 함께 확인해 보세요.'},
  growth:{label:'성장주',icon:'stocks',flow:['미래 성장에 대한 기대','성장주 가격 변화','ETF 가치 변화'],returns:'매출·이익의 성장을 기대하는 기업의 주식에 투자해요. 실제 실적과 앞으로의 성장에 대한 평가가 좋아지면 펀드 가치가 커질 수 있어요.',risk:'좋은 성장 전망이 이미 가격에 반영되어 있으면 실적이 늘어도 주가가 떨어질 수 있어요. 금리와 기대의 변화에도 민감할 수 있어요.',question:'실적이 성장하는데 왜 주가는 떨어질까요?',answer:'주가는 지금 이익뿐 아니라 앞으로 얼마나 더 벌 것인지에 대한 기대도 담아요. 성장이 시장 예상보다 느리거나 같은 미래 이익에 매기는 가격이 낮아지면 실적 성장과 주가 방향이 다를 수 있어요.'},
  value:{label:'가치주',icon:'stocks',flow:['실적 대비 가격 평가','가치주의 주가·배당','ETF 가치와 분배금'],returns:'이익·자산 등과 비교한 가격을 기준으로 고른 주식에 투자해요. 기업에 대한 평가가 개선되거나 배당을 받는 과정이 수익으로 이어질 수 있어요.',risk:'가격이 낮은 이유가 사업의 지속적인 악화일 수 있어요. 저평가 지표만으로 회복을 보장할 수 없어요.',question:'싸게 보이는 주식이면 언젠가 오르나요?',answer:'싸다는 판단에 쓰는 이익·자산 자체가 줄어들 수도 있어요. 편입 기준과 기업의 실적 변화를 함께 봐야 해요. 가치주 ETF도 하락할 수 있어요.'},
  dividend:{label:'배당주',icon:'income',flow:['기업이 이익을 냄','기업 배당이 펀드로','분배금과 주가 변화'],returns:'기업이 지급하는 배당이 펀드의 수입이 되고, 편입 주식의 가격 변화도 성과에 반영돼요. 지급받는 현금만큼 가격 변화를 함께 확인해야 해요.',risk:'기업이 배당을 줄이거나 주가가 크게 하락하면 분배금을 받아도 전체로는 손실일 수 있어요.',question:'분배금을 많이 받으면 그만큼 번 건가요?',answer:'분배금은 펀드 안의 돈이 밖으로 지급되는 과정이에요. 분배락에는 다른 조건이 같다면 지급액만큼 펀드 가치가 낮아져요. 가격 변화와 분배금을 합친 총수익으로 비교해야 해요.'},
  'equal-weight':{label:'동일 비중 주식',icon:'stocks',flow:['기업별 주가 변화','정기적으로 비중 맞추기','ETF 가치 변화'],returns:'정기 조정 시점에 기업별 투자 비중을 비슷하게 맞춰요. 초대형 기업 몇 곳보다 더 많은 기업의 주가 흐름이 성과에 영향을 줄 수 있어요.',risk:'시장을 초대형주 몇 곳이 이끌 때 시가총액 방식 지수보다 덜 오를 수 있어요. 조정 사이에는 비중이 다시 달라져요.',question:'같은 S&P 500인데 왜 수익률이 다를까요?',answer:'회사 목록이 같아도 비중이 다르면 결과가 달라요. 동일 비중 방식은 정기적으로 비중을 맞추고, 시가총액 방식은 큰 기업의 영향이 커요.'},
  sector:{label:'산업 주식',icon:'stocks',flow:['산업 수요·비용 변화','관련 기업의 실적 기대','주식 묶음의 가치'],returns:'특정 산업 기업의 주가와 배당이 펀드 성과로 이어져요. 산업 수요가 늘어도 원가·경쟁·이미 반영된 기대에 따라 기업마다 결과는 다를 수 있어요.',risk:'한 산업에 집중되어 있어 같은 충격을 여러 편입 기업이 함께 받을 수 있어요.',question:'산업이 성장하면 관련 ETF도 꼭 오르나요?',answer:'산업 성장과 투자 수익은 같지 않아요. 회사가 실제로 이익을 남기는지, 이미 주가가 얼마나 높은 기대를 반영했는지, 어떤 기업을 얼마나 담았는지에 따라 달라져요.'},
  theme:{label:'테마 주식',icon:'stocks',flow:['기술·정책·수요 변화','테마 관련 기업의 주가','ETF 가치 변화'],returns:'특정 기술이나 변화와 연결된 기업의 주식에 투자해요. 그 변화가 실제 매출·이익으로 이어질 것이라는 기대가 가격에 반영돼요.',risk:'테마가 같아도 각 기업의 관련 사업 비중은 다를 수 있어요. 좋은 이야기가 이미 높은 가격에 반영되어 있을 수도 있어요.',question:'이름에 AI가 있으면 모두 같은 기업을 담나요?',answer:'테마 이름보다 편입 규칙과 실제 보유 종목을 확인해야 해요. 매출 연관성·사업 정의·지역·기업 규모를 정하는 방식에 따라 같은 테마 ETF도 구성이 달라요.'},
  'active-equity':{label:'운용사가 고르는 주식',icon:'stocks',flow:['운용사의 기업 선택','주식 비중·구성 변경','가격 변화와 배당'],returns:'운용사가 기업과 비중을 직접 선택해요. 담은 주식의 가격과 배당, 이후 종목을 바꾸는 결정이 성과를 만들어요.',risk:'운용사의 판단이 틀리거나 특정 종목에 집중되면 손실이 커질 수 있어요. 액티브라는 이름이 지수보다 높은 성과를 보장하지 않아요.',question:'운용사가 직접 고르면 지수보다 잘 버나요?',answer:'좋은 선택으로 지수보다 나을 수도, 반대일 수도 있어요. 어떤 기준으로 고르는지, 비용을 뺀 장기간 성과와 구성 변화가 어떤지 확인해요.'},
  international:{label:'국가·해외 주식',icon:'stocks',flow:['현지 기업의 주가·배당','현지 통화와 달러 환율','달러 기준 ETF 가치'],returns:'투자한 나라 기업의 주가·배당과 통화 변화가 성과에 영향을 줘요. 환헤지 여부에 따라 환율의 영향은 달라질 수 있어요.',risk:'국가 정책·경기·환율에 영향을 받아요. 같은 신흥국·선진국이라는 이름이라도 지수 회사별 국가 분류가 다를 수 있어요.',question:'현지 주식은 올랐는데 ETF는 왜 덜 오르나요?',answer:'달러 기준으로 보는 해외 주식은 현지 가격과 환율이 함께 작용해요. 거래 시간, 지수 구성, 비용도 차이를 만들어요. 단순히 현지 대표 지수의 등락률만 대입하면 맞지 않을 수 있어요.'},
  'real-estate':{label:'부동산·리츠 주식',icon:'building',flow:['임대 수입·자산 평가','리츠의 이익·배당 기대','ETF 가치와 분배금'],returns:'부동산을 소유·운영하는 기업과 리츠의 주식에 투자해요. 임대 수입·공실·차입 비용 등이 기업 평가와 배당에 영향을 줘요.',risk:'건물 가격이나 임대료만으로 결정되지 않아요. 금리 상승으로 차입 비용이 늘거나 부동산 평가가 낮아지면 손실이 날 수 있어요.',question:'건물을 담는데 왜 주식처럼 떨어지나요?',answer:'ETF가 담는 것은 주로 부동산 기업의 주식이에요. 거래소에서 매일 거래되므로 자산 가치뿐 아니라 기업 이익 전망과 투자자의 평가도 가격을 움직여요.'},
  treasury:{label:'미국 국채',icon:'bond',flow:['시장금리 변화','기존 국채 가격·이자','ETF 가치와 분배금'],returns:'국채가 지급하는 이자와 국채 가격 변화가 수익을 만들어요. 다른 조건이 같다면 시장금리가 낮아질 때 기존 고정금리 채권의 가격이 오르는 방향으로 작용해요.',risk:'국채도 만기 전에 시장에서 거래하는 가격은 떨어질 수 있어요. 금리 변화에 대한 민감도가 큰 장기채는 변동 폭이 커질 수 있어요.',question:'미국 국채인데 왜 원금이 줄어드나요?',answer:'정부의 상환 능력과 지금 시장에서 팔 수 있는 가격은 다른 문제예요. 더 높은 이자의 새 채권이 나오면 기존 채권의 가격이 낮아질 수 있어요. ETF는 채권을 계속 교체하므로 한 채권의 만기 보유와도 달라요.'},
  'cash-bond':{label:'단기 채권',icon:'bond',flow:['단기금리·발행사 신용','짧은 채권의 이자·가격','분배금과 ETF 가치'],returns:'짧은 만기의 채권에서 이자가 쌓여요. 새로 편입하는 채권의 금리가 바뀌면 앞으로 받을 수입도 달라져요. 회사채 포함 여부는 상품마다 달라요.',risk:'변동 폭이 작을 수 있어도 예금과 같지는 않아요. 신용위험·시장가격·환율에 따라 손실이 날 수 있어요.',question:'차트가 조금씩 오르다가 떨어지는 건 왜인가요?',answer:'이자가 쌓이고 분배금이 지급되는 과정이 가격에 나타날 수 있어요. 분배락의 가격 하락과 실제 손실을 구분하려면 받은 분배금을 함께 봐야 해요. 해당 날짜의 분배 공지를 확인해야 원인을 판단할 수 있어요.'},
  'aggregate-bond':{label:'종합 채권',icon:'bond',flow:['금리·발행사 신용 변화','채권의 가격·이자','ETF 가치와 분배금'],returns:'여러 종류의 채권에서 받는 이자와 채권 가격 변화가 성과를 만들어요. 국채·회사채 비중, 신용등급, 금리 민감도와 환헤지가 상품마다 달라요.',risk:'금리가 오르거나 발행사의 상환 능력이 나빠지면 가격이 떨어질 수 있어요. 다양한 채권을 담아도 손실 가능성이 사라지지 않아요.',question:'채권을 여러 개 담으면 금리 영향도 없어지나요?',answer:'여러 채권이 같은 금리 변화에 반응할 수 있어요. 종목 수와 함께 금리 민감도인 듀레이션, 신용등급, 투자 지역을 확인해요.'},
  'corporate-bond':{label:'투자등급 회사채',icon:'bond',flow:['금리·회사의 상환 능력','회사채 가격과 이자','ETF 가치와 분배금'],returns:'기업이 지급하는 이자와 회사채 가격 변화가 성과로 이어져요. 국채금리뿐 아니라 기업 위험을 감수하는 대가로 요구하는 추가 금리도 중요해요.',risk:'투자등급이어도 신용등급 하락이나 금리 상승으로 가격이 떨어질 수 있어요.',question:'금리가 내렸는데 회사채 ETF는 왜 떨어질까요?',answer:'회사가 돈을 갚기 어렵다는 우려가 커지면 투자자는 더 높은 추가 금리를 요구해요. 이 영향이 국채금리 하락 효과보다 크면 회사채 가격이 떨어질 수 있어요.'},
  'high-yield':{label:'고수익·저신용 채권',icon:'bond',flow:['기업의 상환 능력','높은 이자와 부도 위험','채권 가격·분배금'],returns:'신용위험이 큰 기업의 채권은 더 높은 이자를 약속하는 경우가 많아요. 받은 이자에서 가격 하락과 부도 손실을 함께 고려해야 해요.',risk:'경기 악화 때 부도 우려와 추가 금리가 커지며 주식처럼 큰 폭으로 떨어질 수 있어요.',question:'이자가 높은데 왜 더 안전한 게 아닌가요?',answer:'높은 이자는 더 큰 신용위험을 감수하는 대가일 수 있어요. 약속한 이자와 실제로 받은 이자는 다를 수 있고, 채권 가격도 떨어질 수 있어요.'},
  'inflation-bond':{label:'물가연동국채',icon:'bond',flow:['물가와 실질금리 변화','채권 원금 조정·시장가격','ETF 가치와 이자'],returns:'미국 물가에 연동해 채권 원금이 조정되고 이자가 발생해요. 동시에 시장에서 요구하는 실질금리가 채권의 거래 가격에 영향을 줘요.',risk:'물가가 올라 원금이 조정되어도 실질금리 상승으로 시장가격이 더 크게 떨어질 수 있어요.',question:'물가가 올랐는데 왜 물가연동채가 떨어지나요?',answer:'물가에 따른 원금 조정과 시장가격 변화가 동시에 일어나기 때문이에요. 실질금리가 오르면 기존 물가연동채의 가격을 낮추는 힘이 생겨요.'},
  'floating-treasury':{label:'변동금리 국채',icon:'bond',flow:['단기 기준금리 변화','지급 이자 재조정','ETF의 이자 수입'],returns:'고정된 이자만 받는 대신 기준금리에 맞춰 이자율이 바뀌는 미국 국채에 투자해요. 단기금리 변화가 지급 이자에 반영돼요.',risk:'금리가 내려가면 앞으로 받는 이자도 줄 수 있어요. 달러 상품이므로 원화로 볼 때 환율 영향도 있어요.',question:'금리가 내리면 장기 국채처럼 크게 오르나요?',answer:'변동금리 채권은 이자가 재조정되어 고정금리 장기채와 가격 반응이 달라요. 금리 하락 때는 미래 이자 수입 감소를 함께 봐야 해요.'},
  clo:{label:'기업대출을 묶은 채권',icon:'bond',flow:['기업 대출의 상환','순위별로 원리금 배분','CLO 채권 수입'],returns:'여러 기업 대출의 원리금을 모아 정해진 순서대로 지급하는 CLO 채권에 투자해요. 변동금리 수입과 채권 가격이 성과를 만들어요.',risk:'AAA 등급도 원금 보장은 아니에요. 대출 부실·시장 유동성·구조의 조건에 따라 가치가 낮아질 수 있어요.',question:'AAA면 미국 국채와 같은 건가요?',answer:'등급은 신용 평가이고 자산의 종류는 달라요. 기업대출을 묶는 구조, 지급 순위, 실제 대출 부실과 거래 가능성을 따로 확인해야 해요.'},
  'mortgage-bond':{label:'주택저당증권',icon:'building',flow:['주택대출 원리금 상환','채권 보유자에게 배분','ETF 수입·가격'],returns:'주택담보대출에서 나오는 원금·이자 지급 흐름에 투자해요. 금리와 사람들이 대출을 미리 갚는 속도도 수익에 영향을 줘요.',risk:'금리가 내릴 때 대출이 조기 상환되면 높은 이자를 받던 기간이 짧아질 수 있어요. 반대로 금리가 오르면 상환이 늦어질 수 있어요.',question:'주택대출을 빨리 갚으면 투자자에게도 좋나요?',answer:'약속된 원금은 빨리 돌아오지만 높은 이자를 받을 기간이 짧아질 수 있어요. 더 낮은 금리로 다시 투자해야 하는 상황도 생겨요.'},
  'muni-bond':{label:'미국 지방채',icon:'bond',flow:['지방정부 등의 재정','지방채 가격·이자','ETF 가치와 분배금'],returns:'미국 지방정부 등이 발행한 채권의 이자와 가격 변화가 수익을 만들어요. 상품명에 면세가 있어도 한국 투자자에게 같은 세금 혜택이 자동 적용되는 것은 아니에요.',risk:'발행 주체의 재정 상태와 금리 변화가 가격에 영향을 줘요. 세금은 거주지와 계좌에 따라 별도로 확인해야 해요.',question:'Tax-Exempt면 한국에서도 세금이 없나요?',answer:'미국 세법상 상품 특성과 한국 거주자의 세금은 구분해야 해요. 국내 과세 여부를 상품 이름만 보고 판단할 수 없어요.'},
  'option-income':{label:'주식·옵션 수입',icon:'income',flow:['주식 보유 + 옵션 전략','배당·옵션 대가 발생','분배금과 가격 변화'],returns:'주식의 배당과 옵션 거래에서 받는 대가를 활용해 수입을 만들어요. 옵션은 정해진 조건으로 사고팔 권리이고, 그 권리를 파는 쪽은 대가를 받아요. 실제 매도 범위와 방식은 상품마다 달라요.',risk:'상승에 참여할 수 있는 폭이 제한될 수 있고 주가 하락 손실은 남아요. 분배금은 예금 이자처럼 확정된 수익이 아니에요.',question:'월분배금을 많이 받는데 원금은 왜 줄까요?',answer:'분배금에는 배당·옵션 수입·자본환급 등이 포함될 수 있어요. 받은 현금보다 주식·상품 가치가 더 줄면 전체로는 손실이에요. 분배율과 총수익률을 구분하고 분배 내역을 확인해요.'},
  metal:{label:'귀금속 현물',icon:'metal',flow:['금·은 현물 가격','보관한 금속의 가치','비용을 뺀 상품 가치'],returns:'보관한 금·은의 현물 가격이 오르면 상품 가치가 높아지는 구조예요. 금속 자체가 기업처럼 이익을 내거나 이자를 지급하지는 않아요.',risk:'가격 하락과 보관·운용 비용이 수익을 낮출 수 있어요. 안전자산이라는 이름이 가격 안정이나 원금 보장을 뜻하지 않아요.',question:'금값이 오르면 금광주 ETF도 똑같이 오르나요?',answer:'실물 금을 담는 상품과 광산 회사의 주식은 달라요. 광산 회사에는 채굴 비용·생산량·부채·경영 위험도 있으므로 금 현물과 수익률이 달라질 수 있어요.'},
  'commodity-futures':{label:'원자재 선물',icon:'futures',flow:['원자재 선물 가격','만기 계약을 교체','상품 가치 변화'],returns:'원자재를 창고에 계속 보관하는 대신 미래 인도 계약인 선물 등을 활용해요. 선물 가격 변화와 만기가 가까운 계약을 새 계약으로 교체하는 과정이 성과에 영향을 줘요.',risk:'현물 가격이 올라도 교체하는 선물의 가격 조건과 비용 때문에 같은 수익률이 나오지 않을 수 있어요.',question:'원유·가스 가격이 회복했는데 왜 손실일까요?',answer:'뉴스의 현물 가격과 펀드가 들고 있는 선물은 달라요. 다음 만기 계약이 더 비싸거나 싼 상황에서 계약을 교체하므로 장기 성과가 현물 가격과 달라질 수 있어요.'},
  'bitcoin-spot':{label:'비트코인 현물',icon:'bitcoin',flow:['비트코인 가격','보유 코인의 달러 가치','비용을 뺀 상품 가치'],returns:'보유한 비트코인의 달러 가격이 변하면 상품 가치도 움직여요. 투자자가 이 상품을 보유하는 것과 코인을 개인 지갑에 직접 보유하는 것은 달라요.',risk:'코인 가격 변동과 보관·운영 위험이 있어요. 코인은 주말에도 거래되지만 상장상품은 거래소 운영 시간의 영향을 받아요.',question:'주말 코인 가격과 ETF 차트는 왜 다를까요?',answer:'거래 가능한 시간이 다르기 때문이에요. 거래소가 닫힌 동안 코인이 움직이면 다음 거래 때 상장상품 가격에 반영될 수 있어요. 기준 시각을 맞춰 비교해야 해요.'},
  'bitcoin-futures':{label:'비트코인 선물',icon:'futures',flow:['비트코인 선물 가격','선물 교체·담보 운용','상품 가치·분배금'],returns:'비트코인 선물 계약을 통해 가격 변화에 참여해요. 선물 교체 조건과 담보 운용 등도 성과에 영향을 주므로 현물 보유 상품과 결과가 다를 수 있어요.',risk:'비트코인이 오르는 정도와 똑같이 오르는 것은 아니에요. 선물 구조와 가격 변동, 비용을 함께 봐야 해요.',question:'비트코인 현물 ETF와 무엇이 다른가요?',answer:'현물 상품은 코인을 보유하고, 선물 상품은 만기가 있는 계약을 활용해요. 계약을 계속 교체하는 조건과 분배금 지급도 차트 차이를 만들 수 있어요.'},
  leverage:{label:'일일 레버리지·인버스',icon:'leverage',flow:['기초지수의 하루 변화','정해진 배수 목표','매일 다시 맞추기'],returns:'기초지수는 이 상품이 수익률의 기준으로 삼는 지수예요. 그 지수의 하루 변화에 정해진 배수를 적용하는 것이 목표예요. 매일 달라진 금액을 기준으로 투자 규모를 다시 맞추므로 여러 날 수익률은 단순 배수와 달라져요.',risk:'오를 때뿐 아니라 내릴 때의 손실도 커질 수 있어요. 비용과 실제 운용 결과, 매수 시각에 따라 목표와 실제 수익률이 달라질 수 있어요.',question:'지수가 제자리인데 왜 내 돈은 줄었나요?',answer:'매일 달라진 금액에 다음 날 수익률이 곱해져요. 오르내리는 과정 자체가 결과를 바꾸므로, 시작과 끝의 지수만 비교해서는 설명이 안 돼요. 아래 가상 예시로 확인해 보세요.'},
  quality:{label:'기준으로 고르는 주식',icon:'stocks',flow:['재무·위험 등 선정 기준','선택한 기업과 비중','주가·배당의 결과'],returns:'정해진 재무·위험·비재무 기준으로 기업을 고르거나 비중을 조절해요. 선택된 주식의 가격과 배당이 실제 수익을 만들어요.',risk:'선정 기준이 좋다고 항상 시장보다 나은 성과가 나는 것은 아니에요. 특정 기업·업종에 비중이 쏠릴 수 있어요.',question:'좋은 기업만 고르면 좋은 수익이 보장되나요?',answer:'좋은 기업도 비싸게 사면 수익이 낮을 수 있어요. 무엇을 좋은 기업으로 정의하는지와 지금 담는 기업·비중을 함께 살펴봐야 해요.'},
  momentum:{label:'주가 흐름 기준',icon:'stocks',flow:['최근 주가 흐름 평가','편입 기업·비중 조정','이후 주가의 성과'],returns:'최근 주가 흐름이 강한 기업 등을 규칙에 따라 골라요. 흐름이 이어지면 유리할 수 있지만 미래의 상승을 미리 아는 방식은 아니에요.',risk:'시장 주도주가 갑자기 바뀌면 성과가 나빠질 수 있어요. 구성 변경에 따른 거래 비용도 생길 수 있어요.',question:'많이 오른 주식을 담으면 너무 늦은 것 아닌가요?',answer:'이 전략은 최근 흐름이 이어지는 현상에 투자하지만 언제나 이어지지는 않아요. 관찰 기간과 교체 규칙, 급격한 추세 전환 때의 위험을 함께 확인해요.'},
  'box-spread':{label:'옵션 조합·단기 수익',icon:'futures',flow:['상쇄되는 옵션 네 개 조합','만기 수령액과 매입액의 차이','비용을 뺀 펀드 가치'],returns:'같은 만기의 옵션 네 개를 조합해 기초자산 가격에 따른 손익을 서로 상쇄하는 박스 스프레드를 활용해요. 조합을 산 가격과 만기에 받는 금액의 차이가 단기 대출 이자와 비슷한 수익을 만드는 원리예요.',risk:'미국 국채를 직접 보유하는 것과 달라요. 만기 전 매도 가격·거래 유동성·옵션 운용과 비용에 따라 손실이 날 수 있어요.',question:'국채와 비슷한 수익 목표면 국채를 담나요?',answer:'목표가 비슷해도 수단은 달라요. BOXX는 옵션 조합을 활용해요. 만기와 금리, 거래 가격이 조합의 가치에 영향을 주므로 예금이나 국채 원금 보장으로 이해하면 안 돼요.'},
  'energy-partnership':{label:'에너지 인프라 지분',icon:'building',flow:['에너지 운송·저장 사업','사업 수입과 지분 가격','펀드 세금·비용 반영'],returns:'석유·가스 등을 운송·저장하는 인프라 사업체의 지분에 투자해요. 사업체가 지급하는 현금과 지분 가격 변화가 성과를 만들어요. AMLP는 펀드 단계의 법인세 비용·부채도 순자산 가치에 영향을 줄 수 있어요.',risk:'물동량·계약·에너지 업황·차입 비용이 사업에 영향을 줘요. 원유 가격에 정해진 배수로 움직이는 구조는 아니에요.',question:'원유가 오르면 이 상품도 같은 만큼 오르나요?',answer:'원유 선물이 아니라 인프라 사업체의 지분을 담아요. 운송량·요금·계약·부채와 사업 전망이 중요하고 펀드 자체의 세금도 반영돼요. 현금 분배만으로 전체 수익을 판단할 수 없어요.'},
  preferred:{label:'우선주·혼합 증권',icon:'income',flow:['발행사의 지급 능력·금리','우선주 등의 배당·가격','ETF 가치와 분배금'],returns:'보통주보다 배당이나 청산 때 지급 순서가 앞설 수 있는 우선주와 주식·채권 특성이 섞인 증권에 투자해요. 지급받는 수입과 증권 가격 변화가 성과를 만들어요.',risk:'우선이라는 이름이 원금 보장을 뜻하지 않아요. 금리 상승·발행사의 신용 악화·지급 중단·조기 상환 조건으로 손실이 날 수 있어요.',question:'우선주면 보통주보다 항상 안전한가요?',answer:'지급 순서가 앞설 수 있지만 일반적으로 채권보다 뒤에 있어요. 배당 조건과 조기 상환 조건도 증권마다 달라요. 발행사와 업종 비중, 금리 민감도를 함께 확인해요.'},
  'floating-bond':{label:'변동금리 채권',icon:'bond',flow:['단기금리와 발행사 신용','지급 이자 재조정','채권 가격과 이자 수입'],returns:'기준금리에 맞춰 이자율이 바뀌는 투자등급 채권에 투자해요. 기준금리 변화가 이후의 이자 수입에 반영되고 발행사의 신용과 거래 가격도 성과에 영향을 줘요.',risk:'미국 국채만 담는 상품은 아니에요. 투자등급이어도 신용 악화로 가격이 내릴 수 있고 금리가 내려가면 이자 수입도 줄 수 있어요.',question:'이자가 바뀌면 가격 손실도 없어지나요?',answer:'이자 재조정은 고정금리 채권보다 금리 민감도를 줄일 수 있지만 신용·유동성 위험을 없애지는 않아요. 어떤 발행사의 채권을 담는지와 재조정 주기를 함께 봐요.'},
  buffer:{label:'조건부 손실 완충',icon:'futures',flow:['미국 주식의 가격 변화','기간별 옵션·상승 한도','여러 버퍼 ETF의 결과'],returns:'옵션을 활용해 정해진 기간의 일부 하락을 완충하는 대신 상승 참여에 한도를 두는 여러 ETF를 담아요. BUFR는 시작·종료 시점이 다른 상품을 묶으므로 하나의 고정된 완충률이나 수익 상한을 그대로 받는 구조가 아니에요.',risk:'원금 보장 상품이 아니에요. 매수 시점·남은 기간·이미 움직인 가격에 따라 완충 여력이 달라지고 큰 하락에는 손실이 남아요. 비용도 성과를 낮춰요.',question:'버퍼가 있으면 하락장에서도 손실이 없나요?',answer:'완충은 정해진 조건과 기간 안에서 작동해요. 중간에 매수하면 표시된 전체 완충 폭을 누리지 못할 수 있어요. BUFR의 여러 기초 ETF는 조건이 서로 다르며 펀드 자체가 일정한 손실 방어를 보장하지 않아요.'},
  'ether-spot':{label:'이더 현물',icon:'ether',flow:['이더의 달러 가격','보유 이더의 가치','비용을 뺀 상품 가치'],returns:'이더리움 네트워크에서 쓰는 가상자산 이더를 보유해 현물 가격 변화에 참여해요. 네트워크 관련 기업의 주식이나 비트코인을 담는 상품과 달라요.',risk:'이더 가격 변동과 보관·운영 위험이 있어요. 가상자산과 상장상품의 거래 시간 차이도 가격 비교에 영향을 줘요.',question:'이더리움 ETF면 비트코인 ETF와 같은가요?',answer:'담는 가상자산이 달라요. 네트워크의 쓰임·수급·기술과 규제 변화가 서로 다르게 작용할 수 있어요. 현물 추종이라는 구조가 같아도 같은 가격 변화나 수익을 보장하지 않아요.'},
} satisfies Record<string,FundMechanism>;
export type FundKind = keyof typeof FUND_MECHANISMS;
export interface FundProfile { symbol:string;name:string;kind:FundKind;target:string;multiple?:number;underlyingSymbol?:string;sourceUrl:string;issuerUrl:string;checkedAt:string }
export const FUNDS: FundProfile[] = [...catalogue.records as FundProfile[], {
  symbol:'TSLL', name:'Direxion Daily TSLA Bull 2X ETF', kind:'leverage', target:'테슬라(TSLA) 보통주', multiple:2, underlyingSymbol:'TSLA',
  sourceUrl:'https://www.sec.gov/Archives/edgar/data/1424958/000119312526078582/d95556d497k.htm', issuerUrl:'https://www.direxion.com/product/daily-tsla-bull-and-bear-leveraged-single-stock-etfs', checkedAt:'2026-10-18',
}, {
  symbol:'MUU', name:'Direxion Daily MU Bull 2X ETF', kind:'leverage', target:'마이크론(MU) 보통주', multiple:2, underlyingSymbol:'MU',
  sourceUrl:'https://www.sec.gov/Archives/edgar/data/1424958/000119312526078542/d51121d497k.htm', issuerUrl:'https://www.direxion.com/product/daily-mu-bull-and-bear-leveraged-single-stock-etfs', checkedAt:'2026-11-06',
}];
const bySymbol = new Map(FUNDS.map(fund=>[fund.symbol,fund]));
export const fundProfile = (symbol:string) => bySymbol.get(getStockIdentityKey(symbol));
export const fundStrategyLabel = (fund:FundProfile) => fund.multiple
  ? `일일 ${fund.multiple<0?'인버스':'레버리지'} · ${Math.abs(fund.multiple)}배 목표`
  : FUND_MECHANISMS[fund.kind].label;
export const FUND_SELECTION = `${catalogue.selection} 여기에 공식 자료를 확인한 TSLL·MUU 설명을 추가했어요.`;

export type FundQuestionId='target'|'returns'|'pitfall'|'compare'|'distribution'|'currency'|'watch';
export interface FundQuestion { id:FundQuestionId;title:string;paragraphs:string[];next:FundQuestionId[] }
const returnQuestions: Record<FundKind, string> = {
  equity:'담고 있는 주식이 오르면 ETF도 오르나요?',
  growth:'기업이 성장하면 ETF 가격도 오르나요?',
  value:'싸게 산 주식으로 어떻게 수익을 내나요?',
  dividend:'기업이 준 배당금은 어떻게 내 수익이 되나요?',
  'equal-weight':'같은 회사들을 담아도 왜 수익률이 다른가요?',
  sector:'이 산업이 잘되면 ETF도 오르나요?',
  theme:'이 분야가 주목받으면 ETF도 오르나요?',
  'active-equity':'운용사가 고른 주식이 ETF 가격을 결정하나요?',
  international:'해외 주가가 올라도 환율 때문에 손해 볼 수 있나요?',
  'real-estate':'부동산 임대료가 어떻게 ETF 수익으로 이어지나요?',
  treasury:'미국 국채 ETF도 가격이 오르내리나요?',
  'cash-bond':'채권에서 받는 이자가 내 수익이 되나요?',
  'aggregate-bond':'채권 이자를 받는데 가격도 달라지나요?',
  'corporate-bond':'회사가 주는 이자 외에 무엇을 봐야 하나요?',
  'high-yield':'높은 이자를 받아도 손해 볼 수 있나요?',
  'inflation-bond':'물가가 오르면 이 채권도 오르나요?',
  'floating-treasury':'금리가 바뀌면 받는 이자도 달라지나요?',
  clo:'기업에 빌려준 돈에서 어떻게 이자를 받나요?',
  'mortgage-bond':'주택 대출에서 갚는 돈이 내 수익이 되나요?',
  'muni-bond':'지방정부에 돈을 빌려주고 이자를 받는 건가요?',
  'option-income':'투자자에게 나눠 주는 돈은 어디서 나오나요?',
  metal:'보관한 금속의 가격이 오르면 이 상품도 오르나요?',
  'commodity-futures':'원자재 가격이 오르면 이 상품도 오르나요?',
  'bitcoin-spot':'비트코인을 직접 사는 것과 어떻게 다른가요?',
  'bitcoin-futures':'비트코인을 보관하지 않는데 가격을 어떻게 따라가나요?',
  leverage:'하루에 몇 배 움직인다는 건 무슨 뜻인가요?',
  quality:'좋은 기업을 고르면 ETF도 오르나요?',
  momentum:'최근 많이 오른 주식을 사는 건가요?',
  'box-spread':'국채 대신 옵션으로 어떻게 수익을 내나요?',
  'energy-partnership':'에너지 운송·저장 사업에서 어떻게 돈을 버나요?',
  preferred:'우선주에서 받는 배당도 줄어들 수 있나요?',
  'floating-bond':'금리에 따라 채권 이자도 바뀌나요?',
  buffer:'하락을 막아 주는 대신 상승에도 제한이 있나요?',
  'ether-spot':'이더 가격이 오르면 이 상품도 오르나요?',
};

/** Explain the existing daily objective with both directions and its limits. */
export function fundDailyExplanation(fund: FundProfile) {
  if (!fund.multiple) return undefined;
  const amount = Math.abs(fund.multiple);
  const subject = fund.underlyingSymbol === 'TSLA' ? '테슬라 주가'
    : fund.underlyingSymbol ? `${fund.underlyingSymbol} 주가`
    : ['SOXL','SOXS'].includes(fund.symbol) ? '반도체 지수' : fund.target;
  return {
    example: `${subject}${eunNeun(subject)} 하루에 1% 오르면 ${fund.symbol}은 약 ${amount}% ${fund.multiple > 0 ? '오르' : '내리'}도록 운용해요. 1% 내릴 때는 약 ${amount}% ${fund.multiple > 0 ? '내리' : '오르'}도록 운용해요.`,
    period: `오늘 번 돈이나 잃은 돈까지 포함해 다음 날 다시 계산해요. 그래서 ${subject}의 한 달 상승률이 10%여도 ${fund.symbol}이 ${amount * 10}% ${fund.multiple > 0 ? '오른다' : '내린다'}는 뜻은 아니에요.`,
    costs: `상품을 운용하는 비용이 빠지고, 내가 사고파는 시각에 따라서도 가격이 달라요. 그래서 실제로 오르내리는 폭이 하루에도 정확히 ${amount}배가 되지는 않을 수 있어요.`,
  };
}
const connections:Record<string,string[]>={USFR:['FLOT','SGOV'],RSP:['SPY','XLG'],MTUM:['QUAL','USMV'],BOXX:['SGOV','BIL'],AMLP:['XLE','IGF'],PFF:['LQD','SCHD'],FLOT:['USFR','LQD'],BUFR:['SPY','JEPI'],ETHA:['IBIT','BITO'],QQQ:['QQQM','TQQQ','QYLD'],QQQM:['QQQ','TQQQ','SPY'],TQQQ:['QQQ','QLD','SQQQ'],SOXL:['SOXX','SMH','SOXS'],SOXX:['SOXL','SMH'],SMH:['SOXX','SOXL'],KORU:['EWY','TQQQ'],EWY:['KORU','EEM'],SCHD:['VIG','VYM','JEPI'],JEPI:['JEPQ','SCHD','QYLD'],JEPQ:['QQQ','JEPI','QYLD'],TLT:['IEF','SGOV','TMF'],TMF:['TLT','TMV'],GLD:['IAU','GDX'],GDX:['GLD','IAU'],IBIT:['FBTC','BITO'],BITO:['IBIT','FBTC'],USO:['UNG','XLE'],BNDX:['BND','AGG']};
export function relatedFunds(fund:FundProfile) { return (connections[fund.symbol] ?? FUNDS.filter(item=>item.kind===fund.kind && item.symbol!==fund.symbol).slice(0,3).map(item=>item.symbol)).map(symbol=>bySymbol.get(symbol)!).filter(Boolean); }
/** Comparison reasons describe an axis of comparison, never inferred identical benchmarks. */
export function fundComparisonReason(fund:FundProfile, other:FundProfile) {
  const pair=[fund.symbol,other.symbol].sort().join(':');
  if(pair==='EWY:KORU') return '한국 대형·중형주 노출을 비교해요. 같은 MSCI Korea 25/50 지수라도 EWY의 주식 보유와 KORU의 일일 3배 목표는 달라요.';
  if(pair==='KORU:TQQQ') return '매일 3배를 다시 맞추는 원리는 같지만, 한국 주식과 나스닥100으로 투자 시장·기초지수가 달라요.';
  if(fund.multiple&&!other.multiple) return `${other.symbol}에는 ${fund.symbol}의 하루 ${Math.abs(fund.multiple)}배 목표가 없어요. 투자 대상: ${other.target}.`;
  if(!fund.multiple&&other.multiple) return `${other.symbol}은 ${other.target}의 하루 ${Math.abs(other.multiple)}배${other.multiple<0?' 반대 방향':''}를 목표로 해요. ${fund.symbol}에는 이 일일 배수 목표가 없어요.`;
  if(fund.multiple && other.multiple) return '일일 배수와 방향을 비교해요. 투자 대상·기초지수도 따로 확인해야 해요.';
  if(fund.kind===other.kind) return `${FUND_MECHANISMS[fund.kind].label}라는 운용 구조를 함께 살펴봐요. 같은 기초지수나 구성이라는 뜻은 아니에요.`;
  return '투자 대상과 수익을 만드는 방식이 어떻게 다른지 비교해요.';
}
export function fundComparisonFacts(fund:FundProfile) {
  const benchmark = fund.underlyingSymbol ? `${fund.underlyingSymbol} 보통주 · 지수가 아닌 한 회사` : ['KORU','EWY'].includes(fund.symbol)?'MSCI Korea 25/50':
    ['QQQ','QQQM','TQQQ','SQQQ','QLD','QID'].includes(fund.symbol)?'나스닥100':
    ['SOXL','SOXS','SOXX'].includes(fund.symbol)?'NYSE 반도체지수':
    '아래 투자 대상과 운용사 원문에서 확인';
  return {target:fund.target,benchmark,dailyTarget:fund.multiple?`하루 ${Math.abs(fund.multiple)}배 목표 · ${fund.multiple<0?'반대 방향':'같은 방향'}`:'일일 배수 목표 없음 · 투자 대상·전략에 따라 움직임'};
}
export function fundFollowupReason(current:FundQuestionId|undefined, next:FundQuestionId) {
  const reasons:Record<FundQuestionId,string>={
    target:'결과가 다른 이유를 알려면, 먼저 무엇에 투자하는지 확인해요.',
    returns:'투자 대상의 변화가 내 상품 가격으로 전달되는 과정을 이어서 봐요.',
    pitfall:'수익이 생기는 원리를 알았다면, 예상과 달라지는 상황을 살펴봐요.',
    compare:'이 차이를 다른 상품과 나란히 놓고 확인해요.',
    distribution:'가격 변화에 현금 분배를 더하면 실제 성과를 어떻게 읽는지 봐요.',
    currency:'달러로 본 결과가 내 원화 계좌에서는 달라질 수 있어요.',
    watch:'이 구조를 이해한 뒤 다음 공시에서 확인할 항목으로 이어가요.',
  };
  if(current==='pitfall'&&next==='compare') return '방금 본 위험이 다른 구조의 상품에서는 어떻게 달라지는지 비교해요.';
  return reasons[next];
}
// Business background links, deliberately not presented as a current holdings list.
export function fundBusinessLinks(symbol:string) {
  if(symbol==='TSLL') return [{symbol:'TSLA',label:'테슬라 · 자동차와 에너지 사업'}];
  if(['SOXL','SOXS','SOXX','SMH','DRAM'].includes(symbol)) return [{symbol:'NVDA',label:'엔비디아 · 반도체 설계'},{symbol:'MU',label:'마이크론 · 메모리 반도체'}];
  if(['KORU','EWY'].includes(symbol)) return [{symbol:'005930.KS',label:'삼성전자 · 반도체와 전자제품'},{symbol:'000660.KS',label:'SK하이닉스 · 메모리 반도체'}];
  if(['QQQ','QQQM','TQQQ','QLD','QYLD','JEPQ'].includes(symbol)) return [{symbol:'MSFT',label:'마이크로소프트 · 클라우드와 소프트웨어'},{symbol:'NVDA',label:'엔비디아 · AI 연산 반도체'}];
  return [];
}
export function fundSummary(fund:FundProfile) {
  const daily = fundDailyExplanation(fund);
  if(daily) {
    const meaning = ['SOXL','SOXS'].includes(fund.symbol)
      ? `${fund.symbol}은 미국에 상장한 반도체 기업들의 주가 변화를 기준으로 운용하는 ETF예요. 그 주가를 묶어 나타낸 숫자가 반도체 지수예요.`
      : fund.symbol === 'KORU'
        ? 'KORU는 MSCI Korea 25/50 지수의 움직임을 기준으로 운용하는 ETF예요. 이 지수는 한국의 대형·중형 기업 주가를 달러 기준으로 묶어 나타낸 숫자이며, 코스피와는 달라요.'
        : fund.underlyingSymbol
          ? `이 ETF는 ${fund.target}의 하루 가격 변화를 기준으로 운용해요.`
          : `이 ETF는 ${fund.target}의 하루 움직임을 기준으로 운용해요.`;
    return `${meaning} ${daily.example}`;
  }
  return `${fund.target}.`;
}
export function fundQuestions(fund:FundProfile):Record<FundQuestionId,FundQuestion> {
  const original=FUND_MECHANISMS[fund.kind];
  const mechanism=fund.underlyingSymbol ? {...original, returns:'기초주식은 이 상품이 수익률의 기준으로 삼는 회사의 주식이에요. 그 주식의 하루 가격 변화에 정해진 배수를 적용하는 것이 목표예요. 매일 달라진 금액을 기준으로 투자 규모를 다시 맞추므로 여러 날 수익률은 단순 배수와 달라져요.', risk:original.risk.replaceAll('지수','주가'), question:original.question.replaceAll('지수','주가'), answer:original.answer.replaceAll('지수','주가')} : original;
  const foundation=FUND_FOUNDATIONS[fund.kind];
  const daily=fundDailyExplanation(fund);
  const benchmark=benchmarkLesson(fund);
  const specialTarget=fund.underlyingSymbol ? `${fund.underlyingSymbol} 한 회사의 주가가 기준이에요. 여러 기업을 담은 지수와 달리 회사 고유의 충격이 직접 반영돼요.` : fund.symbol==='KORU'
    ? '한국 대형·중형주를 담는 MSCI Korea 25/50 지수를 기준으로 해요. 코스피 등락률에 바로 3을 곱하는 상품은 아니에요. 지수에 들어 있는 기업의 비중과 달러 환산 기준을 함께 봐야 해요.'
    : ['SOXL','SOXS'].includes(fund.symbol)
      ? '엔비디아 한 회사의 주가에 배수를 곱하는 상품은 아니에요.'
      : ['TQQQ','SQQQ','QLD','QID','QQQ','QQQM'].includes(fund.symbol)
        ? '나스닥100은 나스닥에 상장한 대형 비금융 기업을 묶는 지수예요. 나스닥의 모든 기업이나 기술 기업만 담는 목록은 아니에요.'
        : ['TMF','TMV'].includes(fund.symbol)
          ? '배수를 적용하는 대상은 금리 자체가 아니라 장기 미국 국채 지수의 하루 수익률이에요. 다른 조건이 같다면 시장금리 하락은 기존 고정금리 채권의 가격을 높이는 방향으로 작용해요.'
          : '투자 대상과 편입 방식이 이 상품을 이해하는 출발점이에요. 실제 구성과 비중은 바뀔 수 있으므로 운용사의 최신 자료를 확인해요.';
  const comparison=fund.underlyingSymbol ? '한 회사 주식을 기준으로 하므로 여러 기업을 담은 ETF와 분산 정도가 달라요. 기초주식 직접 보유와 일일 배수 상품은 보유 기간이 길어질수록 성과 차이가 커질 수 있어요.' : fund.kind==='leverage'
    ? '비교 상품마다 투자 시장과 기초지수가 다를 수 있어요. 같은 지수를 보더라도 배수·방향·비용이 다르면 결과가 달라요. 일반 ETF와 레버리지 ETF를 비교할 때는 하루 목표와 보유 기간을 먼저 맞춰 봐요.'
    : fund.kind==='option-income'
      ? '같은 주식시장을 보더라도 옵션을 파는 범위와 조건이 달라요. 일반 주식 ETF와 비교할 때는 현금 분배뿐 아니라 상승 참여와 가격 손실을 함께 봐요.'
      : '이름이 비슷해도 편입 기준·기업 또는 채권의 비중·비용·분배 방식이 다를 수 있어요. 아래 연결은 차이를 살펴보는 출발점이며 같은 수익을 내는 상품이라는 뜻은 아니에요.';
  return {
    target:{id:'target',title:`${fund.symbol}, 무엇에 투자하는 상품인가요?`,paragraphs:[...(benchmark ? [`${benchmark.name}${eunNeun(benchmark.name)} ${benchmark.meaning}`,benchmark.detail] : [fund.target,foundation.meaning]),...(['TQQQ','SQQQ','QLD','QID','QQQ','QQQM'].includes(fund.symbol)?[]:[specialTarget])],next:['returns','compare','watch']},
    returns:{id:'returns',title:fund.multiple ? fund.multiple < 0 ? `${fund.underlyingSymbol ? '주가' : '지수'}가 오르면 이 상품은 왜 내리나요?` : `하루 ${fund.multiple}배라는 건 무슨 뜻인가요?` : returnQuestions[fund.kind],paragraphs:[fundSummary(fund),...(fund.symbol==='KORU' ? ['지수 안의 한국 기업 주가가 오르면 지수를 높이는 방향으로 작용해요. 비중이 큰 기업의 변화가 더 크게 반영돼요. 달러 기준으로 환산할 때는 원화 가치도 함께 작용해요.','다른 조건이 같을 때 원화가 달러 대비 강해지면 한국 주식의 달러 가치가 커지고, 원화가 약해지면 줄어요. 한국 주가 상승보다 원화 약세의 영향이 크면 달러 기준 지수는 떨어질 수도 있어요.'] : daily ? [] : [mechanism.returns]),...(daily ? [daily.period,daily.costs] : []),mechanism.risk],next:['pitfall','distribution','currency']},
    pitfall:{id:'pitfall',title:mechanism.question,paragraphs:[mechanism.answer,mechanism.risk],next:['compare','returns','watch']},
    compare:{id:'compare',title:`${fund.symbol}, 비슷한 상품과 무엇이 다른가요?`,paragraphs:[comparison],next:['target','pitfall','distribution']},
    distribution:{id:'distribution',title:'차트 수익률과 내가 번 돈은 왜 다를까요?',paragraphs:['가격만 보는 차트에는 지급받은 분배금이 반영되지 않을 수 있어요. 총수익은 가격 변화와 분배금을 함께 보며, 실제 투자 성과에는 매매 비용·세금·환율도 영향을 줘요.','분배금은 공짜로 더해지는 돈이 아니에요. 분배금 지급, 주식분할·주식병합 여부, 차트의 수정주가 기준을 확인해요. 배당수익률 표시만으로 앞으로 받을 현금이 확정되지는 않아요.'],next:['pitfall','currency','watch']},
    currency:{id:'currency',title:'달러로 올랐는데 원화 수익은 왜 다르죠?',paragraphs:['원화로 환산한 가치는 상품의 달러 가격과 달러당 원화 환율이 함께 결정해요. 달러 가격이 올라도 환율이 더 크게 내리면 원화 평가액은 줄 수 있어요.','가상으로 상품의 달러 가격이 10% 오르고 달러당 원화 환율이 10% 내리면, 원화 가치는 1.1 × 0.9 = 0.99로 약 1% 줄어요. 비용과 세금을 제외한 계산 예시예요.',fund.symbol==='KORU'?'KORU는 한국 주식의 달러 기준 평가와 매일 적용되는 레버리지가 연결돼요. 한국과 미국의 거래 시간도 달라 코스피 당일 등락률과 미국 장중 KORU를 바로 비교하면 맞지 않을 수 있어요.':['BNDX','IAGG','DBEF'].includes(fund.symbol)?`${fund.symbol}의 환헤지는 외화 움직임을 달러 기준으로 줄이는 방식이에요. 한국 투자자의 달러·원화 환율까지 없애 주는 것은 아니에요.`:'실제 손익을 볼 때는 상품 매매와 환전에 드는 비용, 세금도 따로 확인해요.'],next:['target','distribution','watch']},
    watch:{id:'watch',title:`${fund.symbol}, 다음에 확인할 것은?`,paragraphs:[foundation.watch,'새로운 기사·운용 공지에서 투자 대상이나 운용 방식이 실제로 바뀌었는지 확인해요. 구성 종목·배수 변경, 분배금 지급, 주식분할·주식병합 공지가 차트 이해에 중요할 수 있어요.','이 설명은 상품의 일반적인 작동 방식이에요. 오늘 가격이 움직인 이유를 살펴보려면 최근 소식에서 날짜와 출처가 확인된 자료를 함께 읽어보세요.'],next:['target','pitfall','compare']},
  };
}

/** Prioritize relevant unread answers; never manufacture more questions after all seven. */
export function fundNextQuestions(fund:FundProfile, current:FundQuestionId|undefined, visited:FundQuestionId[]) {
  const questions=fundQuestions(fund), seen=new Set([...visited,...(current?[current]:[])]);
  const preferred=current?questions[current].next:['target','returns','pitfall'] as FundQuestionId[];
  return [...new Set([...preferred,...Object.keys(questions) as FundQuestionId[]])].filter(id=>!seen.has(id));
}

/** Educational daily compounding only: no live price, fees, tracking error or return forecast. */
export function dailyTargetExample(returns:number[], multiple:number) {
  if(!Number.isFinite(multiple) || !returns.every(value=>Number.isFinite(value)&&value>=-1&&1+value*multiple>=0)) throw new Error('Invalid educational scenario');
  let index=100, product=100;
  return [{day:0,index,product},...returns.map((value,i)=>({day:i+1,index:index*=1+value,product:product*=1+value*multiple}))];
}
