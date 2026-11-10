'use client';
import FinancialText from '@/components/common/FinancialText';
import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { FUNDS, FUND_MECHANISMS, FUND_SELECTION, dailyTargetExample, fundBusinessLinks, fundComparisonFacts, fundComparisonReason, fundDailyExplanation, fundNextQuestions, fundQuestions, fundStrategyLabel, fundSummary, relatedFunds, type FundProfile, type FundQuestionId } from '@/lib/fundExploration';
import { benchmarkLesson } from '@/lib/fundLearning';
import KoreaFundExample from './KoreaFundExample';
import { usageEvent } from '@/lib/usageTelemetry';
import StockExplorationLink from './StockExplorationLink';
import FundMechanismDiagram from './FundMechanismDiagram';
import readingUI from '../ui/ReadingUI.module.css';
import styles from './FundExploration.module.css';
import { fundExplorationEntry } from '@/lib/fundExplorationEntry';
import InstrumentExplorationEntry from './InstrumentExplorationEntry';
import type { ExplorationReadingState } from './ContextExploration';

export interface FundReadingState { trail:FundQuestionId[]; scenario?:string; targetOpen?:boolean; industry?:ExplorationReadingState }
const scenarios = [
  {id:'roundtrip',label:'올랐다가 제자리',returns:[0.1,-1/11],description:'지수 +10% 뒤 약 −9.09%: 100 → 110 → 100'},
  {id:'rise',label:'이틀 연속 상승',returns:[0.05,0.05],description:'지수가 이틀 연속 +5%: 100 → 105 → 110.25'},
  {id:'fall',label:'이틀 연속 하락',returns:[-0.05,-0.05],description:'지수가 이틀 연속 −5%: 100 → 95 → 90.25'},
];

export interface FundExplorationProps {
  fund?:FundProfile; symbol:string; initialReading?:FundReadingState;
  onOpenStock?:(symbol:string,reading:FundReadingState)=>void; onNews?:()=>void;
  onReadingChange?:(reading:FundReadingState)=>void;
  embedded?:boolean; initialQuestion?:FundQuestionId; returnLabel?:string; onReturn?:()=>void; entrySequence?:number;
}
export default function FundExploration(props:FundExplorationProps) {
  return <FundReader key={`${props.symbol}:${props.entrySequence ?? 0}:${props.initialQuestion ?? ''}`} {...props}/>;
}
function FundReader({fund,symbol,initialReading,onOpenStock,onNews,onReadingChange,embedded=false,initialQuestion,returnLabel='읽던 소식으로 돌아가기',onReturn}:FundExplorationProps) {
  const [trail,setTrail]=useState<FundQuestionId[]>(initialReading?.trail ?? (embedded ? [initialQuestion ?? 'returns'] : []));
  const [scenarioId,setScenarioId]=useState(initialReading?.scenario ?? 'roundtrip');
  const [targetOpen,setTargetOpen]=useState(initialReading?.targetOpen ?? false);
  const [industry,setIndustry]=useState<ExplorationReadingState | undefined>(initialReading?.industry);
  const emitReading=useEffectEvent((reading:FundReadingState)=>onReadingChange?.(reading));
  useEffect(()=>{emitReading({trail,scenario:scenarioId,targetOpen,industry});},[trail,scenarioId,targetOpen,industry]);
  const [query,setQuery]=useState('');
  const [visibleCount,setVisibleCount]=useState(20);
  const heading=useRef<HTMLHeadingElement>(null);
  const searchId=useId();
  const daily=fund&&fundDailyExplanation(fund);
  const questions=fund?fundQuestions(fund):undefined;
  const current=trail.at(-1);
  const question=current&&questions?questions[current]:undefined;
  const benchmark=fund?benchmarkLesson(fund):undefined;
  const mechanism=fund?FUND_MECHANISMS[fund.kind]:undefined;
  const entry=fund?fundExplorationEntry(fund):undefined;
  const next=fund?fundNextQuestions(fund,current,trail):[];
  const scenario=scenarios.find(item=>item.id===scenarioId)??scenarios[0];
  const example=fund?.multiple?dailyTargetExample(scenario.returns,fund.multiple):undefined;
  const navigate=(updated:FundQuestionId[])=>{
    if(updated.length>trail.length) usageEvent('explore_step');
    setTrail(updated);
    requestAnimationFrame(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'nearest'});});
  };
  const openStock=onOpenStock?(nextSymbol:string)=>onOpenStock(nextSymbol,{trail,scenario:scenarioId,targetOpen,industry}):undefined;
  const matching=FUNDS.filter(item=>`${item.symbol} ${item.name} ${item.target} ${FUND_MECHANISMS[item.kind].label}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <section className={`${styles.fund} ${embedded?styles.embedded:''}`} data-context-exploration data-fund-exploration={symbol}
    data-explanation-overview="fund" data-explanation-coverage={fund?'reviewed':'missing'} data-explanation-multiple={fund?.multiple}
    aria-label={`${symbol} 상품 구조와 연결된 질문`}>
    <p className={styles.eyebrow}><span>{symbol} · 상품 이해</span>{mechanism&&<span className={styles.badge}><FinancialText>{fund?fundStrategyLabel(fund):mechanism.label}</FinancialText></span>}</p>
    {onReturn&&<button className={styles.action} type="button" onClick={onReturn}>← {returnLabel}</button>}
    {trail.length>0&&<nav className={styles.history} aria-label="상품 설명 탐색 경로"><button type="button" onClick={()=>navigate(trail.slice(0,-1))}>← 이전 설명</button><button type="button" onClick={()=>navigate([])}>상품 구조로</button></nav>}
    <h3 ref={heading} tabIndex={-1}><FinancialText>{question?.title ?? `${symbol} 한눈에`}</FinancialText></h3>
    {fund&&mechanism&&questions ? <>
      {question?<div className={styles.answer} data-fund-answer={question.id}>{question.paragraphs.map(text=><p key={text}><FinancialText>{text}</FinancialText></p>)}</div>:<><p className={styles.summary} data-explanation-summary><FinancialText>{fundSummary(fund)}</FinancialText></p>{daily&&<div className={styles.note} data-explanation-daily><p><FinancialText>{daily.period}</FinancialText></p><p>{daily.costs}</p></div>}</>}
      {!question&&entry&&<InstrumentExplorationEntry {...entry} image={`/illustrations/funds/${mechanism.icon}-v1.png`} open={targetOpen} onOpenChange={setTargetOpen}
        reading={industry} onReadingChange={setIndustry}
        onOpenStock={onOpenStock?(next,reading)=>onOpenStock(next,{trail,scenario:scenarioId,targetOpen:true,industry:reading}):undefined} />}
      {!embedded&&(!question||current==='returns'||current==='target')&&<details className={styles.sources}><summary className={readingUI.disclosure}>가격으로 이어지는 과정 보기</summary><FundMechanismDiagram fund={fund}/></details>}
      {['KORU','EWY'].includes(symbol)&&(current==='returns'||current==='currency')&&<KoreaFundExample symbol={symbol} multiple={fund.multiple??1}/>}

      {fund.multiple&&current==='pitfall'&&example&&<div className={styles.example} data-daily-example>
        <h4>같은 100에서 출발한다면</h4><p className={styles.note}>이해를 돕는 가상 계산이에요. 비용·오차 없이 매일 목표 배수를 달성한다고 가정하며 실제 수익 예측은 아니에요.</p>
        <div className={styles.scenarios} aria-label="가상 가격 흐름 선택">{scenarios.map(item=><button type="button" key={item.id} aria-pressed={scenario.id===item.id} onClick={()=>setScenarioId(item.id)}>{item.label}</button>)}</div>
        <table><caption>{fund.underlyingSymbol ? scenario.description.replaceAll('지수', '기초주식') : scenario.description}</caption><thead><tr><th scope="col">시점</th><th scope="col"><FinancialText>{fund.underlyingSymbol ? fund.underlyingSymbol : '기초지수'}</FinancialText></th><th scope="col">일일 {fund.multiple}배</th></tr></thead><tbody>{example.map(row=><tr key={row.day}><th scope="row">{row.day?`${row.day}일 뒤`:'출발'}</th><td>{row.index.toFixed(2)}</td><td>{row.product.toFixed(2)}</td></tr>)}</tbody></table>
        <p className={styles.exampleResult}>{fund.underlyingSymbol ? fund.underlyingSymbol : '지수'}는 {(example.at(-1)!.index-100).toFixed(2)}%, 가상 상품은 {(example.at(-1)!.product-100).toFixed(2)}%예요. 매일 달라진 금액에 다음 날 수익률이 적용된 결과예요.</p>
      </div>}
      {current==='compare'&&<div className={styles.comparisons}>{[fund,...relatedFunds(fund)].map(item=>{
        const facts=fundComparisonFacts(item);
        return <article key={item.symbol} className={styles.comparison}>
          <h4>{item.symbol} · <FinancialText>{fundStrategyLabel(item)}</FinancialText>{item.symbol===symbol?' · 지금 읽는 상품':''}</h4>
          {item.symbol!==symbol&&<p><FinancialText>{fundComparisonReason(fund,item)}</FinancialText></p>}
          <dl><div><dt>투자 대상</dt><dd><FinancialText>{facts.target}</FinancialText></dd></div><div><dt>일일 배수·방향</dt><dd>{facts.dailyTarget}</dd></div><div><dt>기준 자산</dt><dd><FinancialText>{facts.benchmark}</FinancialText></dd></div></dl>
          {item.symbol!==symbol&&<StockExplorationLink symbol={item.symbol} onNavigate={openStock}>{item.symbol} 구조 이어서 읽기</StockExplorationLink>}
        </article>;
      })}</div>}
      {current==='target'&&fundBusinessLinks(symbol).length>0&&<><h4>기업은 실제로 무엇을 하나요?</h4><p className={styles.note}>투자 배경을 이해하는 기업 설명이에요. 현재 편입 목록이나 비중을 뜻하지 않아요.</p><div className={styles.actions}>{fundBusinessLinks(symbol).map(item=><StockExplorationLink key={item.symbol} symbol={item.symbol} onNavigate={openStock}>{item.label}</StockExplorationLink>)}</div></>}
      {current==='watch'&&<a className={styles.action} href={fund.issuerUrl} target="_blank" rel="noopener noreferrer">{symbol} 운용사의 구성·운용 공지 확인하기 <span className="sr-only">(새 창)</span></a>}
      <h4>{question?next.length?'이 설명에서 한 걸음 더':'읽었던 설명 다시 보기':'먼저 이 질문부터'}</h4>
      <div className={styles.questions}>{next.slice(0,2).map((id,index)=><button data-fund-question={id} className={`${styles.question} ${index===0?styles.primaryQuestion:''}`} type="button" key={id} onClick={()=>navigate([...trail,id])}><strong>{questions[id].title}</strong><span aria-hidden="true">→</span></button>)}</div>
      <details key={current ?? 'intro'} className={styles.sources} data-fund-more><summary className={readingUI.disclosure}>다른 궁금증 더 보기</summary><div className={styles.questions}>{(Object.keys(questions) as FundQuestionId[]).filter(id=>id!==current&&!next.slice(0,2).includes(id)).map(id=><button data-fund-question={id} className={styles.question} type="button" key={id} onClick={()=>navigate([...trail,id])}>{questions[id].title} →</button>)}</div></details>
      {onNews&&<button className={styles.action} type="button" onClick={onNews} style={{marginTop:16}}>구조를 알았다면, 최근 소식 확인하기 →</button>}
      <details className={styles.sources}><summary className={readingUI.disclosure}>설명에 사용한 자료와 확인일</summary><p>상품 개요 확인: {fund.checkedAt}. 구성·비용·운용 방식은 바뀔 수 있어요. 일반 구조 설명과 오늘의 변동 원인은 구분해요.</p><a href={fund.sourceUrl} target="_blank" rel="noopener noreferrer">{symbol} 상품 개요 원문 (새 창)</a><a href={fund.issuerUrl} target="_blank" rel="noopener noreferrer">{symbol} 운용사 원문·구성·공시 확인 (새 창)</a>{fund.multiple&&<a href="https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/sec" target="_blank" rel="noopener noreferrer">미국 SEC · 일일 레버리지와 여러 날 수익률 (새 창)</a>}{benchmark&&<a href={benchmark.source} target="_blank" rel="noopener noreferrer">{benchmark.name} · 지수 설명 원문 (새 창)</a>}{symbol==='KORU'&&<a href="https://www.sec.gov/Archives/edgar/data/1424958/000119312526078549/d60837d497k.htm" target="_blank" rel="noopener noreferrer">KORU · 2026 투자설명서, 비중 제한·일일 목표·환율 (새 창)</a>}</details>
    </>:<><p className={styles.summary}>펀드·상장상품으로 분류된 종목이에요. 이 상품의 투자 대상과 운용 방식은 아직 확인하지 못했어요.</p><p className={styles.note}>일반적으로 투자 대상의 가격·이자·배당과 상품의 운용 방식이 수익을 만들어요. 이름만으로 추종지수나 배수를 추정하지 않아요. 아래에서 설명이 준비된 상품을 살펴볼 수 있어요.</p></>}
    {!embedded&&<details className={styles.directory}><summary className={readingUI.disclosure}>다른 ETF의 수익 구조 살펴보기 · {FUNDS.length}개</summary><p className={styles.note}>{FUND_SELECTION}</p><label htmlFor={searchId}>티커·이름·투자 대상으로 찾기<input id={searchId} value={query} onChange={event=>{setQuery(event.target.value);setVisibleCount(20);}} placeholder="QQQ, 반도체, 국채, 배당" type="search"/></label><p className={styles.note} role="status">{matching.length}개 상품{matching.length>visibleCount?` · ${visibleCount}개 표시 중`:''}</p><div className={styles.directoryList}>{matching.slice(0,visibleCount).map(item=><StockExplorationLink key={item.symbol} symbol={item.symbol} onNavigate={openStock}><strong>{item.symbol}</strong><small>{item.target}</small></StockExplorationLink>)}</div>{matching.length>visibleCount&&<button className={styles.action} type="button" onClick={()=>setVisibleCount(count=>count+20)}>다음 {Math.min(20,matching.length-visibleCount)}개 더 보기</button>}</details>}
  </section>;
}
