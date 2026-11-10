'use client';
import { useState } from 'react';
import { koreaDailyExample } from '@/lib/fundLearning';
import styles from './FundExploration.module.css';
const scenarios = [
  {label:'주식 상승 · 환율 그대로',stock:.02,fx:0,explanation:'환율이 그대로라면 한국 주식 묶음의 상승이 달러 가치 상승으로 이어져요.'},
  {label:'주식 상승 · 원화 약세',stock:.02,fx:.03,explanation:'한국 주식은 2% 올랐지만 1달러를 사는 데 드는 원화가 3% 늘었어요. 같은 원화 자산을 달러로 바꾸면 가치가 줄어 지수 방향이 반대가 될 수 있어요.'},
  {label:'주식 그대로 · 원화 강세',stock:0,fx:-.02,explanation:'한국 주가가 그대로여도 1달러를 사는 데 필요한 원화가 줄면 같은 주식의 달러 가치는 높아져요.'},
  {label:'주식 하락 · 환율 그대로',stock:-.02,fx:0,explanation:'환율이 그대로라면 한국 주식 묶음의 하락이 달러 가치 하락으로 이어져요.'},
];
const percent=(n:number)=>`${n>0?'+':''}${(n*100).toFixed(2)}%`;
export default function KoreaFundExample({symbol,multiple}:{symbol:string;multiple:number}) {
  const [index,setIndex]=useState(0);
  const item=scenarios[index];
  const result=koreaDailyExample(item.stock,item.fx,multiple);
  return <section className={styles.example} aria-label="한국 주가와 환율의 가상 계산">
    <h4>한국 주식이 올라도 달러로는 내려갈까요?</h4>
    <p className={styles.note}>가상 계산이에요. 실제 코스피 수익률이 아닌 지수 구성 주식 묶음을 가정하고, 같은 하루의 주가·환율만 바꿔 봐요.</p>
    <div className={styles.scenarios} aria-label="주가와 환율 상황 선택">{scenarios.map((s,i)=><button type="button" key={s.label} aria-pressed={i===index} onClick={()=>setIndex(i)}>{s.label}</button>)}</div>
    <div aria-live="polite" aria-atomic="true">
      <dl className={styles.calculation}>
        <div><dt>한국 주식 묶음 · 원화 기준</dt><dd>{percent(item.stock)}</dd></div>
        <div><dt>달러당 원화 환율</dt><dd>{percent(item.fx)}</dd></div>
        <div><dt>달러로 환산한 지수</dt><dd>{percent(result.dollarReturn)}</dd></div>
        <div><dt>{symbol} · 가상 하루 {multiple}배</dt><dd>{percent(result.productReturn)}</dd></div>
      </dl>
      <p className={styles.exampleResult}>{item.explanation}</p>
    </div>
    <p className={styles.note}>비용·배당·추적 오차 없이 목표를 달성한다고 단순화한 예시예요. 실제 거래가격에는 매수·매도 수요와 거래 시간 차이도 영향을 줘요.</p>
  </section>;
}
