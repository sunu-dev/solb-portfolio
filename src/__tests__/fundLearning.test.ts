import { describe, expect, it } from 'vitest';
import { FUNDS, fundProfile, fundQuestions } from '@/lib/fundExploration';
import { FUND_FOUNDATIONS, benchmarkLesson, koreaDailyExample } from '@/lib/fundLearning';
describe('explain the target before its effect',()=>{
 it('covers every catalog product with an asset definition and a concrete check',()=>{
  for(const fund of FUNDS) {
   expect(FUND_FOUNDATIONS[fund.kind].meaning.length,fund.symbol).toBeGreaterThan(30);
   expect(fundQuestions(fund).watch.paragraphs).toContain(FUND_FOUNDATIONS[fund.kind].watch);
  }
 });
 it('keeps KORU, US semiconductor, Nasdaq and single-stock targets distinct',()=>{
  expect(benchmarkLesson(fundProfile('KORU')!)?.detail).toContain('25/50은 종목 수가 아니라');
  expect(benchmarkLesson(fundProfile('SOXL')!)?.name).toBe('NYSE 반도체지수');
  expect(benchmarkLesson(fundProfile('TQQQ')!)?.name).toBe('나스닥100');
  expect(benchmarkLesson(fundProfile('TSLL')!)?.name).toBe('TSLA 보통주');
  expect(benchmarkLesson(fundProfile('SMH')!)).toBeUndefined();
 });
 it('shows why Korean stock gains can become dollar losses',()=>{
  const result=koreaDailyExample(.02,.03,3);
  expect(result.dollarReturn).toBeCloseTo(-.0097087379);
  expect(result.productReturn).toBeCloseTo(-.0291262136);
  expect(koreaDailyExample(.02,0,3).productReturn).toBeCloseTo(.06);
  expect(koreaDailyExample(0,-.02,1).dollarReturn).toBeGreaterThan(0);
 });
 it('rejects impossible FX, nonfinite input and negative fund values',()=>{
  expect(()=>koreaDailyExample(0,-1,3)).toThrow();
  expect(()=>koreaDailyExample(NaN,0,3)).toThrow();
  expect(()=>koreaDailyExample(-.5,0,3)).toThrow();
 });
});
