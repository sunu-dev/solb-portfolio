'use client';

import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { financialTerm, financialTermMatches } from '@/lib/financialTerms';
import ReadingText from './ReadingText';
import SaveTermButton from '@/components/learning/SaveTermButton';
import styles from './FinancialText.module.css';
import theme from '@/components/learning/DictionaryTheme.module.css';
import JoobiAvatar from '@/components/learning/JoobiAvatar';
import { openStockDictionary } from '@/lib/dictionaryNavigation';
import { useModalViewport } from '@/hooks/useModalViewport';

function TermDialog({id,onClose}:{id:string;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),titleId=useId();
  const heading=useRef<HTMLHeadingElement>(null),sheet=useRef<HTMLDivElement>(null);
  const [current,setCurrent]=useState(id),[history,setHistory]=useState<string[]>([]);
  const term=financialTerm(current);
  useModalViewport(true,dialog);
  useEffect(()=>{
    const element=dialog.current;if(!element)return;
    if(!element.open)element.showModal();element.querySelector<HTMLButtonElement>('button')?.focus();
  },[]);
  useEffect(()=>{heading.current?.focus({preventScroll:true});if(sheet.current)sheet.current.scrollTop=0;},[current]);
  if(!term)return null;
  const [name,...description]=term.title.split(' · ');
  return createPortal(<dialog ref={dialog} className={`${theme.theme} ${styles.dialog}`} aria-labelledby={titleId} data-financial-term-dialog
    onCancel={event=>{event.preventDefault();onClose();}} onClose={onClose}
    onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div className={styles.miniNotebook}>
      <span className={styles.peek} aria-hidden="true"><JoobiAvatar size={72} /></span>
      <div ref={sheet} className={styles.sheet}>
      <div className={styles.header}><div><h2 className={theme.hand} id={titleId} ref={heading} tabIndex={-1}>{name}</h2>{description.length>0&&<p className={styles.subtitle}>{description.join(" · ")}</p>}</div><button type="button" onClick={onClose} aria-label="용어 설명 닫기"><X size={20} aria-hidden="true" /></button></div>
      {history.length>0&&<button type="button" className={styles.back} onClick={()=>{setCurrent(history.at(-1)!);setHistory(previous=>previous.slice(0,-1));}}>이전 용어로</button>}
      <p><FinancialText current={current} onOpen={next=>{setHistory(previous=>[...previous,current]);setCurrent(next);}}>{term.meaning}</FinancialText></p>
      {term.example&&<div className={styles.example}><h3>예시</h3><p>{term.example}</p></div>}
      {!!term.related?.length&&<nav className={styles.related} aria-label="함께 알아둘 용어">{term.related.map(next=><button type="button" key={next} onClick={()=>{setHistory(previous=>[...previous,current]);setCurrent(next);}}>{financialTerm(next)?.title}</button>)}</nav>}
      <SaveTermButton key={current} termId={current} notebook />
      <button type="button" className={`${theme.linkButton} ${styles.openDictionary}`} onClick={()=>{onClose();requestAnimationFrame(()=>openStockDictionary(current));}}><BookOpen size={17} aria-hidden="true" />내 주식사전 열기</button>
      <a className={styles.source} href={term.source} target="_blank" rel="noopener noreferrer">설명의 공식 출처 <span className="sr-only">(새 창)</span></a>
      </div>
    </div>
  </dialog>,document.body);
}

/** Use in prose, never inside another button, link or disclosure summary. */
export default function FinancialText({children,current,onOpen}:{children:string;current?:string;onOpen?:(id:string)=>void}) {
  const [active,setActive]=useState<string|null>(null);
  const trigger=useRef<HTMLButtonElement|null>(null);
  const matches=financialTermMatches(children,current);
  const close=()=>{setActive(null);requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));};
  return <>
    {matches.map((match,index)=><Fragment key={match.index}>
      <ReadingText>{children.slice(index?matches[index-1].index+matches[index-1].word.length:0,match.index)}</ReadingText>
      <button type="button" className={styles.term} data-financial-term={match.id} aria-haspopup="dialog"
        aria-label={`${match.word} 뜻 보기`} onClick={event=>{if(onOpen)onOpen(match.id);else {trigger.current=event.currentTarget;setActive(match.id);}}}>{match.word}</button>
    </Fragment>)}
    <ReadingText>{children.slice(matches.length?matches[matches.length-1].index+matches[matches.length-1].word.length:0)}</ReadingText>
    {active&&<TermDialog id={active} onClose={close}/>}
  </>;
}
