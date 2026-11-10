import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {usePortfolioStore} from '@/store/portfolioStore';
import {stockEditError} from '@/utils/stockEditValidation';
const original=usePortfolioStore.getState();
beforeEach(()=>usePortfolioStore.setState({stocks:{investing:[{symbol:'MSFT',avgCost:100,shares:3,targetReturn:0,demo:true},{symbol:'AAPL',avgCost:100,shares:2,targetReturn:0,demo:true}],watching:[],sold:[]},editingCat:'investing',editingIdx:0}));
afterEach(()=>usePortfolioStore.setState(original));
describe('stock editing',()=>{
 it.each(['-1','Infinity','NaN','1e309'])('rejects invalid holdings %s before saving',value=>{
  expect(stockEditError({shares:value})).toContain('보유 수량');expect(stockEditError({avgCost:value})).toContain('매수 단가');
 });
 it('keeps fractional and zero quantities and rejects incomplete added purchases',()=>{
  expect(stockEditError({avgCost:'100.5',shares:'.25',purchaseRate:'1300'})).toBeNull();expect(stockEditError({shares:'0'})).toBeNull();
  expect(stockEditError({addBuyPrice:'200',addBuyShares:''})).toContain('함께');
  expect(stockEditError({weight:'101'})).toContain('100%');expect(stockEditError({buyZones:'100,abc'})).toContain('매수 구간');
 });
 it('saves a classification change and edit atomically without pointing at the next row',()=>{
  const updates:unknown[]=[];const off=usePortfolioStore.subscribe(state=>updates.push(state.stocks));
  usePortfolioStore.getState().updateStock('investing',0,{shares:4},'sold');off();
  const state=usePortfolioStore.getState();expect(state.stocks.sold[0]).toMatchObject({symbol:'MSFT',shares:4});expect(state.stocks.investing[0].symbol).toBe('AAPL');expect(updates).toHaveLength(1);expect(state.editingCat).toBe('');
 });
 it('does not reclassify a sold stock when saving only notes',()=>{
  usePortfolioStore.getState().updateStock('investing',0,{},'sold');
  usePortfolioStore.getState().updateStock('sold',0,{notes:[]});expect(usePortfolioStore.getState().stocks.sold[0].symbol).toBe('MSFT');
 });
 it('still moves a watchlist entry into holdings when its first position is recorded',()=>{
  usePortfolioStore.getState().updateStock('investing',0,{shares:0});
  expect(usePortfolioStore.getState().stocks.watching[0].symbol).toBe('MSFT');
  usePortfolioStore.getState().updateStock('watching',0,{shares:.5});expect(usePortfolioStore.getState().stocks.investing.at(-1)).toMatchObject({symbol:'MSFT',shares:.5});
 });
});
