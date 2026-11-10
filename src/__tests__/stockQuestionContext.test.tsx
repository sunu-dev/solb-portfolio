import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StockAnalysisQuestions from '@/components/analysis/StockAnalysisQuestions';
import { FUND_QUESTIONS, rankQuestions, stockQuestion } from '@/config/stockQuestions';
import { DISCOVERY_PREFIX, emptyDiscovery, parseDiscovery, readQuestionsForSymbol, recordAnsweredQuestion, scopedQuestionKey } from '@/lib/stockDiscovery';

afterEach(() => vi.unstubAllGlobals());
describe('instrument-specific questions and completed answer history', () => {
  it('keeps company accounting out of funds even when headlines mention earnings', () => {
    expect(rankQuestions(['earnings','cash','valuation'], [], 'fund').map(q=>q.id)).toEqual(FUND_QUESTIONS.map(q=>q.id));
    expect(rankQuestions([], [], 'stock').every(q=>!q.id.startsWith('fund-'))).toBe(true);
    for (const question of FUND_QUESTIONS) expect(stockQuestion(question.id)).toEqual(question);
  });
  it('offers starting questions and preserves an answer outside the initial list', () => {
    const html = renderToStaticMarkup(<StockAnalysisQuestions owner="guest" symbol="QQQ" instrument="fund" tags={[]} selectedId="fund-compare" loading={false} onSelect={()=>{}} onLearn={()=>{}} answer={<p>상품 비교 설명</p>} renderBackground={id=><span>{id} 배경 자리</span>} />);
    expect(html.match(/data-question-id=/g)).toHaveLength(4);
    expect(html).toContain('상품 비교 설명');
    expect(html).toContain('fund-compare 배경 자리');
    expect(html).not.toContain('data-question-id="value"');
  });
  it('keeps cached answers and free concepts available when new AI answers are exhausted', () => {
    const html = renderToStaticMarkup(<StockAnalysisQuestions owner="guest" symbol="MU" tags={[]} selectedId={null} loading={false} remaining={0} quotaStatus="ready" cachedQuestionIds={['safe']} onSelect={()=>{}} onLearn={()=>{}} />);
    expect(html).toMatch(/data-question-id="safe"[^>]*aria-disabled="false"/);
    expect(html).toMatch(/data-question-id="value"[^>]*aria-disabled="true"/);
    expect(html).toContain('data-question-background="safe"');
    expect(html).toContain('data-question-background="value"');
    expect(html).toContain('이 화면에서 받은 답변은 다시 볼 수 있어요.');
    expect(html).toContain('개념 먼저 읽기');
  });
  it('restores a background reader outside the main question without an AI selection', () => {
    const html = renderToStaticMarkup(<StockAnalysisQuestions owner="guest" symbol="MU" tags={[]} selectedId={null} backgroundQuestionId="cash" loading={false} onSelect={()=>{}} onLearn={()=>{}} renderBackground={id=>id==='cash'?<p>읽던 현금 설명</p>:null} />);
    expect(html).toContain('data-question-background="cash"');
    expect(html).toContain('data-reading-return="question-cash"');
    expect(html).toContain('읽던 현금 설명');
  });
  it('requires a completed-answer ID and isolates readings by owner and symbol', () => {
    const entries = new Map<string,string>();
    vi.stubGlobal('window', {dispatchEvent:vi.fn()});
    vi.stubGlobal('localStorage', {getItem:(k:string)=>entries.get(k)??null, setItem:(k:string,v:string)=>entries.set(k,v)});
    // Pending selection / failed response has no answeredId and cannot count as read.
    expect(recordAnsweredQuestion('alice','AAPL',undefined)).toBe(false);
    expect(entries.size).toBe(0);
    expect(recordAnsweredQuestion('alice','AAPL','safe')).toBe(true);
    const alice=parseDiscovery(entries.get(DISCOVERY_PREFIX+'alice')!);
    expect(readQuestionsForSymbol(alice,'AAPL')).toEqual(['safe']);
    expect(readQuestionsForSymbol(alice,'NVDA')).toEqual([]);
    expect(readQuestionsForSymbol(parseDiscovery(entries.get(DISCOVERY_PREFIX+'bob')??null),'AAPL')).toEqual([]);
    expect(rankQuestions([],readQuestionsForSymbol(alice,'NVDA'))[0].id).toBe('safe');
    expect(rankQuestions([],readQuestionsForSymbol(alice,'AAPL'))[0].id).toBe('value');
  });
  it('retains legacy parsing without applying global history and bounds scoped records', () => {
    const time=Date.now();
    const legacy=parseDiscovery(JSON.stringify({...emptyDiscovery(),questions:{safe:time,'AAPL:safe':time,'bad/key':time}}));
    expect(legacy.questions.safe).toBe(time);
    expect(readQuestionsForSymbol(legacy,'NVDA')).toEqual([]);
    expect(scopedQuestionKey('aapl','safe')).toBe('AAPL:safe');
    expect(scopedQuestionKey('bad/key','safe')).toBeUndefined();
    const entries=new Map<string,string>();
    vi.stubGlobal('window',{dispatchEvent:vi.fn()});
    vi.stubGlobal('localStorage',{getItem:(k:string)=>entries.get(k)??null,setItem:(k:string,v:string)=>entries.set(k,v)});
    for(let i=0;i<110;i++) recordAnsweredQuestion('alice',`T${i}`,'safe');
    expect(Object.keys(JSON.parse(entries.get(DISCOVERY_PREFIX+'alice')!).questions)).toHaveLength(100);
  });
});
