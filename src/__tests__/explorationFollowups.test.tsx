import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ContextExploration from '@/components/explore/ContextExploration';
import FundExploration from '@/components/explore/FundExploration';
import { FUNDS, fundProfile, fundQuestions, fundComparisonFacts, fundComparisonReason, fundFollowupReason } from '@/lib/fundExploration';
import { explorationTopic, explorationFollowupReason } from '@/lib/contextExploration';

describe('contextual next reading',()=>{
  it('continues the unresolved HBM production question before switching to other hardware',()=>{
    expect(explorationTopic('hbm').related.slice(0,2)).toEqual(['hbm-production','memory-cycle']);
    const answer=explorationTopic('hbm-production');
    expect(answer.steps.map(step=>step.body).join(' ')).toMatch(/고객 평가.*출하.*판매.*비용/);
    expect(answer.related[0]).toBe('memory-cycle');
    expect(explorationTopic('memory-cycle').related[0]).toBe('earnings');
    expect(explorationFollowupReason('hbm','hbm-production')).toContain('판매와 이익');
  });
  it('separates Korean exposure comparison from the daily leverage comparison',()=>{
    const koru=fundProfile('KORU')!, ewy=fundProfile('EWY')!, tqqq=fundProfile('TQQQ')!;
    expect(fundComparisonReason(koru,ewy)).toContain('한국 대형·중형주');
    expect(fundComparisonFacts(koru).benchmark).toBe(fundComparisonFacts(ewy).benchmark);
    expect(fundComparisonReason(koru,tqqq)).toContain('기초지수가 달라요');
    expect(fundComparisonFacts(koru).benchmark).not.toBe(fundComparisonFacts(tqqq).benchmark);
    expect(fundComparisonFacts(ewy).dailyTarget).toContain('배수 목표 없음');
    expect(fundComparisonFacts(fundProfile('SQQQ')!).dailyTarget).toContain('반대 방향');
  });
  it('offers meaningful follow-up reasons and comparison facts across all 300 products',()=>{
    for(const fund of FUNDS){
      for(const question of Object.values(fundQuestions(fund))){
        expect(new Set(question.next.slice(0,2)).size).toBe(2);
        for(const next of question.next.slice(0,2)) expect(fundFollowupReason(question.id,next).length).toBeGreaterThan(15);
      }
      expect(fundComparisonFacts(fund).target).toBe(fund.target);
    }
  });
  it('opens the chosen answer inline without repeating the directory or diagram',()=>{
    const html=renderToStaticMarkup(<FundExploration symbol="KORU" fund={fundProfile('KORU')} embedded initialQuestion="compare" returnLabel="기사로 돌아가기" onReturn={()=>{}}/>);
    expect(html).toContain('KORU, 비슷한 상품과 무엇이 다른가요?');
    expect(html).toContain('기사로 돌아가기');
    expect(html.replace(/<[^>]*>/g,'')).toContain('기초지수가 달라요');
    expect(html).not.toContain('다른 ETF의 수익 구조');
    expect(html).not.toContain('data-fund-diagram');
  });
  it('restores the selected scenario and question on return from another product',()=>{
    const html=renderToStaticMarkup(<FundExploration symbol="KORU" fund={fundProfile('KORU')} embedded initialQuestion="compare" initialReading={{trail:['returns','pitfall'],scenario:'rise'}}/>);
    expect(html).toContain('이틀 연속 +5%');
    expect(html).toContain('132.25');
    expect(html).toContain('이전 설명');
  });
  it('restores the company-section fund reader from the saved visit without resetting to its introduction',()=>{
    const html=renderToStaticMarkup(<ContextExploration symbol="KORU" context="KORU 살펴보기" topics={['earnings']}
      initialReadingState={{trail:[],expanded:true,catalogDismissed:false,fund:{trail:['returns','pitfall'],scenario:'fall'}}}/>);
    expect(html).toContain('이틀 연속 −5%');
    expect(html).toContain('72.25');
    expect(html.replace(/<[^>]*>/g,'')).toContain('지수가 제자리인데 왜 내 돈은 줄었나요?');
    expect(html).not.toContain('KORU, 무엇이 가격을 움직일까요?');
  });

});
