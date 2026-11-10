const LABELS:Record<string,string>={avgCost:'평균 매수 단가',shares:'보유 수량',purchaseRate:'매수 시 환율',targetReturn:'목표 수익률',targetProfitUSD:'목표 수익금',targetProfitKRW:'목표 수익금',targetSell:'목표 매도가',stopLoss:'손절가',stopLossPct:'하락 기준',weight:'비중',buyBelow:'목표 매수가',addBuyPrice:'추가 매수 단가',addBuyShares:'추가 매수 수량',addBuyRate:'추가 매수 환율'};
export function stockEditError(fields:Record<string,string>):string|null {
  for(const [key,label] of Object.entries(LABELS)) {
    const input=fields[key]?.trim(); if(!input)continue;
    const value=Number(input);
    if(!Number.isFinite(value)||value<0)return `${label}에 0 이상의 올바른 숫자를 입력해주세요.`;
    if(['stopLossPct','weight'].includes(key)&&value>100)return `${label}은 100% 이하로 입력해주세요.`;
    if(['purchaseRate','addBuyRate'].includes(key)&&value===0)return `${label}은 0보다 커야 해요.`;
  }
  const price=Number(fields.addBuyPrice||0),shares=Number(fields.addBuyShares||0);
  if((price>0)!==(shares>0))return '추가 매수 단가와 수량을 함께 입력해주세요.';
  if(fields.buyZones?.trim()&&fields.buyZones.split(',').some(value=>!value.trim()||!Number.isFinite(Number(value))||Number(value)<=0))return '매수 구간에는 0보다 큰 가격을 쉼표로 구분해 입력해주세요.';
  return null;
}
