'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { Layers3, RotateCcw } from 'lucide-react';
import { type FinancialTerm } from '@/lib/financialTerms';
import styles from './DictionaryConceptStage.module.css';
import DictionaryScenarioStage from './DictionaryScenarioStage';

/** Illustrative quantities only. No market data or investment predictions. */
export default function DictionaryConceptStage({ term }: { term: FinancialTerm; onSelect: (id: string) => void }) {
  const stage = useRef<HTMLElement>(null);
  const [trade, setTrade] = useState(3);
  const [shares, setShares] = useState(2);
  const [rate, setRate] = useState(10);
  const [asset, setAsset] = useState(0);
  const volume = term.id === 'chart-volume';
  const stock = term.id === 'stock';
  const returns = term.id === 'return';
  const etf = term.id === 'etf' || term.id === 'fund';
  if (!volume && !stock && !returns && !etf) return <DictionaryScenarioStage key={term.id} term={term} />;
  const assets = [{ label:'주식', detail:'기업의 주식에 투자하는 상품' }, { label:'채권', detail:'채권에 투자하는 상품' }, { label:'원자재', detail:'금 같은 원자재에 투자하는 상품' }];
  return <section ref={stage} className={styles.stage} data-kind={volume ? 'volume' : stock ? 'stock' : returns ? 'return' : 'fund'} aria-label={`${term.title.split(' · ')[0]} 개념 체험`}
    onPointerMove={event => {
      if (event.buttons || (event.target instanceof Element && event.target.closest('button,input')) || event.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const rect = event.currentTarget.getBoundingClientRect();
      event.currentTarget.style.setProperty('--tilt-x', `${(event.clientY - rect.top - rect.height / 2) / rect.height * -8}deg`);
      event.currentTarget.style.setProperty('--tilt-y', `${(event.clientX - rect.left - rect.width / 2) / rect.width * 10}deg`);
    }} onPointerLeave={() => { stage.current?.style.setProperty('--tilt-x', '0deg'); stage.current?.style.setProperty('--tilt-y', '0deg'); }}>
    <div className={styles.stageLabel}><Layers3 size={14} aria-hidden="true" />{volume || stock || returns ? '숫자로 이해하기' : '구조로 이해하기'}<span>{volume || stock || returns ? '가상 예시' : '개념 그림'}</span></div>
    <div className={styles.stageBody}>
      <div className={styles.scene}>
        <div className={styles.halo} />
        {volume ? <div className={styles.bars}>{[100, 200, 50].map((value, i) => <button key={value} type="button" className={styles.barButton} style={{'--height':`${value * .45 + 32}px`, '--order':i} as CSSProperties} aria-label={`${i + 1}번째 거래까지 보기`} aria-pressed={trade >= i + 1} onClick={() => setTrade(i + 1)}><span className={styles.cube}><span className={styles.front}>{value}<small>주</small></span><span className={styles.side} /><span className={styles.top} /></span><span className={styles.barLabel}>{i + 1}번째 거래</span></button>)}</div>
        : stock ? <div className={styles.ownership} aria-label="회사 지분 10칸">{Array.from({length:10},(_,i)=><button type="button" key={i} aria-label={`가상 회사의 지분 ${i + 1}0% 선택`} aria-pressed={i < shares} onClick={() => setShares(i + 1)}><span /></button>)}</div>
        : returns ? <div className={styles.balance}><span className={styles.balanceBack}>처음 투자한 돈<em>100<span>만원</span></em></span><span className={styles.balanceFront}>지금 평가금액<em>{100 + rate}<span>만원</span></em></span></div>
        : etf ? <div className={styles.assetDeck}>{assets.map((item,i)=><button type="button" key={item.label} className={styles.assetCard} data-active={asset===i} style={{'--order':i} as CSSProperties} aria-pressed={asset===i} onClick={()=>setAsset(i)}><span className={styles.assetGlyph}>{i === 0 ? <span className={styles.miniBars}><i/><i/><i/></span> : i === 1 ? <span className={styles.bondLines}><i/><i/><i/></span> : <span className={styles.goldBlock}/>}</span><strong>{item.label}</strong><span>담는 자산</span></button>)}</div>
        : null}
      </div>
      <div className={styles.insight}>
        {volume ? <><p>거래된 수량을 더하면</p><strong aria-live="polite">{[100,200,50].slice(0,trade).reduce((a,b)=>a+b,0).toLocaleString('ko-KR')}<small>주</small></strong><span>{[100,200,50].slice(0,trade).join(' + ')} = 거래량</span><button type="button" className={styles.reset} onClick={()=>setTrade(trade===3?1:trade+1)}><RotateCcw size={13} aria-hidden="true" />{trade===3?'처음 거래부터':'다음 거래 더하기'}</button></>
        : stock ? <><p>회사를 10칸으로 나누면</p><strong aria-live="polite">{shares * 10}<small>%</small></strong><span>선택한 {shares}칸만큼 회사의 일부를 소유해요.</span><span className={styles.hint}>칸을 눌러 바꿔보세요</span></>
        : returns ? <><p>처음 금액과 비교한 변화</p><strong aria-live="polite">{rate>0?'+':''}{rate}<small>%</small></strong><label className={styles.slider}>평가금액 바꿔보기<input type="range" min="-30" max="30" value={rate} onChange={event=>setRate(Number(event.target.value))} aria-label="가상 수익률" /></label><span>비용·세금·배당을 제외한 예시예요.</span></>
        : etf ? <><p>어디에 투자하는지는</p><strong className={styles.phrase}>상품마다{' '}<br/>달라요.</strong><span aria-live="polite">{assets[asset].detail}</span><span className={styles.hint}>카드를 눌러 살펴보세요</span></>
        : null}
      </div>
    </div>
  </section>;
}
