'use client';
import { useState } from 'react';
import type { FinancialTerm } from '@/lib/financialTerms';
import { dictionaryScene } from '@/lib/dictionaryScenes';
import styles from './DictionaryScenarioStage.module.css';

export default function DictionaryScenarioStage({term}:{term:FinancialTerm}) {
 const [step,setStep]=useState(0);
 const scene=dictionaryScene(term);
 if(!scene) return null;
 const frame=scene.frames[step];
 const maximum=Math.max(1,...scene.frames.flatMap(item=>item.values.map(Math.abs)));
 const mixed=['chart-rsi','chart-macd','concept:PER','concept:이익률','concept:배당수익률'].includes(term.id);
 const shares=scene.kind==='shares';
 const candle=term.id==='chart-candle';
 return <section className={styles.stage} aria-label={`${term.title} 개념 체험`}>
  <header><span>직접 바꿔보는 개념</span><small>{scene.kind==='flow'?'개념 그림':'가상 예시'}</small></header>
  <div className={styles.steps} aria-label="예시 단계">{scene.frames.map((item,i)=><button type="button" key={item.action} aria-pressed={step===i} onClick={()=>setStep(i)}><small>{String(i+1).padStart(2,'0')}</small>{item.action}</button>)}</div>
  <div className={styles.visual}>
   {shares && <div className={styles.shares} aria-hidden="true">{Array.from({length:5},(_,i)=><span key={i} style={{flex:i<frame.values[1]?1:0,opacity:i<frame.values[1]?1:0}}>{i<frame.values[1]?`${frame.values[0]}만원`:''}</span>)}</div>}
   {candle && <svg className={styles.candle} viewBox="0 0 240 130" role="img" aria-label="고가와 저가 사이의 선, 시가와 종가 사이의 몸통"><line x1="120" x2="120" y1="15" y2="115"/><rect x="95" width="50" y={115-(Math.max(frame.values[0],frame.values[3])-95)*100/15} height={Math.abs(frame.values[3]-frame.values[0])*100/15} /></svg>}
   {scene.kind==='flow' ? <ol className={styles.flow}>{frame.labels.map((label,i)=><li key={label} data-active={i<=step}><span>{i+1}</span><strong>{label}</strong>{i<frame.labels.length-1&&<i aria-hidden="true">→</i>}</li>)}</ol>
   : <div className={styles.metrics}>{frame.labels.map((label,i)=><div key={i} className={styles.metric}><span>{label}</span><strong>{frame.values[i].toLocaleString('ko-KR')}<small>{shares&&i===1?'주':mixed?'':scene.unit}</small></strong>{!shares&&!mixed&&!candle&&<div className={styles.track}><i data-negative={frame.values[i]<0} style={{width:`${Math.abs(frame.values[i])/maximum*100}%`}}/></div>}</div>)}</div>}
  </div>
  <p className={styles.note} aria-live="polite" aria-atomic="true">{frame.note}</p>
  <footer><small>{scene.caveat}</small><button type="button" onClick={()=>setStep((step+1)%scene.frames.length)}>{step===scene.frames.length-1?'처음부터 보기':'다음 변화 보기'} <span aria-hidden="true">→</span></button></footer>
 </section>;
}
