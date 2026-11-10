/** A single external attempt. Caller must disable SDK retries/fallback or reserve each separately.
 * Uncertain completion keeps the reservation; it never means the call was free.
 */
export interface BudgetPort {
  reserve(key:string,maxCost:number):Promise<{status:'reserved';token:string}|{status:'disabled'|'limit_reached'|'already_reserved'}>;
  settle(key:string,token:string,actualCost:number):Promise<boolean>;
}
export type BudgetedResult<T> = {status:'completed';value:T}|{status:'blocked';reason:string}|{status:'unsettled';reason:'call_uncertain'|'cost_unknown'|'settlement_failed'};
export async function budgetedAttempt<T>(input:{key:string;maxCost:number;budget:BudgetPort;call:()=>Promise<{value:T;actualCost:number|null}>}):Promise<BudgetedResult<T>> {
  if(!/^[a-zA-Z0-9:_./-]{1,200}$/.test(input.key)||!Number.isSafeInteger(input.maxCost)||input.maxCost<1||input.maxCost>1_000_000_000)throw new Error('invalid_attempt');
  let reservation:Awaited<ReturnType<BudgetPort['reserve']>>;
  try { reservation=await input.budget.reserve(input.key,input.maxCost); } catch {return {status:'blocked',reason:'budget_unavailable'};}
  if(reservation.status!=='reserved')return {status:'blocked',reason:reservation.status};
  // Do not accept a malformed successful reservation as authorization.
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reservation.token))return {status:'blocked',reason:'invalid_reservation'};
  let result:{value:T;actualCost:number|null};
  try {result=await input.call();} catch {return {status:'unsettled',reason:'call_uncertain'};}
  if(result.actualCost===null||!Number.isSafeInteger(result.actualCost)||result.actualCost<0||result.actualCost>1_000_000_000)return {status:'unsettled',reason:'cost_unknown'};
  try {
    if(!await input.budget.settle(input.key,reservation.token,result.actualCost))return {status:'unsettled',reason:'settlement_failed'};
  } catch {return {status:'unsettled',reason:'settlement_failed'};}
  // A result exceeding the reserved ceiling is retained in the ledger, not published.
  if(result.actualCost>input.maxCost)return {status:'blocked',reason:'reservation_exceeded'};
  return {status:'completed',value:result.value};
}
