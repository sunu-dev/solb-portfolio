import { requireServiceClient } from '../supabaseServer';
import type { BudgetPort } from './budgetedAttempt';

/** Service-side adapter only; no endpoint exposes these RPCs to browser callers. */
export function createMarketCauseBudgetPort():BudgetPort {
 const db=requireServiceClient();
 return {
  async reserve(key,maxCost) {
   const {data,error}=await db.rpc('reserve_market_cause_budget',{p_request_key:key,p_max_cost:maxCost});
   if(error||!data||typeof data!=='object')throw new Error('budget_unavailable');
   if(data.status==='reserved'&&typeof data.token==='string'&&data.maxCost===maxCost)return {status:'reserved',token:data.token};
   if(['disabled','limit_reached','already_reserved'].includes(data.status))return {status:data.status as 'disabled'|'limit_reached'|'already_reserved'};
   throw new Error('invalid_budget_response');
  },
  async settle(key,token,actualCost) {
   const {data,error}=await db.rpc('settle_market_cause_budget',{p_request_key:key,p_token:token,p_actual_cost:actualCost});
   if(error)throw new Error('budget_settlement_unavailable');
   return data===true;
  },
 };
}
