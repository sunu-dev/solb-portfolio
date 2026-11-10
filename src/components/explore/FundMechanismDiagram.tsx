import Image from 'next/image';
import { FUND_MECHANISMS, type FundProfile } from '@/lib/fundExploration';
import styles from './FundExploration.module.css';
import FinancialText from '@/components/common/FinancialText';

/** Semantic mechanism diagram, with the same information available as text. */
export default function FundMechanismDiagram({ fund }: { fund:FundProfile }) {
  const mechanism=FUND_MECHANISMS[fund.kind];
  const flow=[...mechanism.flow];
  if(['KORU','EWY'].includes(fund.symbol)) flow.splice(0,3,'한국 기업의 주가','원화·달러 환율','달러 기준 지수',fund.multiple ? `하루 ${fund.multiple}배 목표` : 'ETF 가치');
  else if(fund.multiple) flow[1]=`하루 ${fund.multiple>0?'+':''}${fund.multiple}배 목표`;
  if(fund.underlyingSymbol) flow[0]=`${fund.underlyingSymbol} 주가의 하루 변화`;
  return <figure className={styles.diagram} data-fund-diagram={fund.kind}>
    <Image className={styles.assetDrawing} src={`/illustrations/funds/${mechanism.icon}-v1.png`} alt="" aria-hidden="true" width={320} height={200} sizes="(max-width:560px) 140px, 180px" />
    <figcaption><span className={styles.caption}>가격으로 이어지는 과정</span><ol className={styles.flow}>{flow.map((label,index)=><li key={label}><span className={styles.step}>{index+1}</span><span><FinancialText>{label}</FinancialText></span>{index<flow.length-1&&<span className={styles.arrow} aria-hidden="true">→</span>}</li>)}</ol></figcaption>
  </figure>;
}
