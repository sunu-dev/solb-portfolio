'use client';

import { useState } from 'react';
import PersonalLearningProvider from '@/components/learning/PersonalLearningProvider';
import StockDictionary from '@/components/learning/StockDictionary';
import DictionaryShortcut from '@/components/learning/DictionaryShortcut';
import styles from './preview.module.css';

export default function DictionaryMaterialPreview() {
  const [open, setOpen] = useState(true);
  const [dark, setDark] = useState(false);
  return <main className={`${styles.screen} ${dark ? 'dark' : ''}`}>
    <div className={styles.toolbar}><span>실제 사전 · 이 브라우저에 저장</span><button type="button" aria-pressed={dark} onClick={() => setDark(value => !value)}>어두운 화면</button>{!open && <DictionaryShortcut />}</div>
    <PersonalLearningProvider owner="guest"><div className={styles.frame}>{open && <StockDictionary titleId="material-dictionary-title" onClose={() => setOpen(false)} />}</div></PersonalLearningProvider>
  </main>;
}
