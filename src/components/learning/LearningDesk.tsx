'use client';
import { useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import dynamic from 'next/dynamic';
import DictionaryShortcut from './DictionaryShortcut';
import { usePersonalDictionary } from './PersonalLearningProvider';
import JoobiAvatar from './JoobiAvatar';
import styles from './LearningDesk.module.css';
import chat from './JoobiChat.module.css';
const AskJoobi = dynamic(() => import('./AskJoobi'), { loading: () => <p role="status">질문 입력창을 열고 있어요.</p> });
export default function LearningDesk({ symbol }: { symbol?: string }) {
  const [view, setView] = useState<'ask' | null>(null);
  const { owner } = usePersonalDictionary();
  const id = useId();
  const trigger = useRef<HTMLButtonElement | null>(null);
  return <section className={styles.desk} data-learning-desk aria-label="주비에게 질문하고 용어 모으기">
    <div className={styles.navigation}><button type="button" aria-label="주비에게 물어보기" aria-expanded={view === 'ask'} aria-controls={id} onClick={event => { trigger.current = event.currentTarget; setView('ask'); }}><JoobiAvatar size={28} /><span className={styles.navigationLabel} aria-hidden="true">주비에게 물어보기</span></button><DictionaryShortcut /></div>
    <div id={id} hidden={!view}>{view && <div className={chat.panel}><div className={chat.header}><JoobiAvatar /><div><h2>주비에게 물어보기</h2><p>나의 AI 주식비서</p></div><button type="button" className={styles.close} aria-label="질문 접기" onClick={() => { setView(null); requestAnimationFrame(() => trigger.current?.focus()); }}><X size={20} /></button></div><AskJoobi key={`${owner}:${symbol}`} symbol={symbol} /></div>}</div>
  </section>;
}
