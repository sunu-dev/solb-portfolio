'use client';

import { openStockDictionary } from '@/lib/dictionaryNavigation';
import styles from './DictionaryShortcut.module.css';

export default function DictionaryShortcut() {
  return <button type="button" className={styles.shortcut} aria-label="내 주식사전" aria-haspopup="dialog" onClick={() => openStockDictionary()}>
    <svg className={styles.book} width="28" height="34" viewBox="0 0 28 34" aria-hidden="true">
      <path d="M5 2h18a2 2 0 0 1 2 2v26H6a4 4 0 0 1-4-4V6a4 4 0 0 1 3-4Z" fill="currentColor" />
      <path d="M7 3v23" className={styles.seam} />
      <path d="M6 26h18v5H6a2.5 2.5 0 0 1 0-5Z" className={styles.paper} />
      <path d="M17 2h4v12l-2-2-2 2Z" className={styles.ribbon} />
      <path d="M11 18h9m-9 4h6" className={styles.title} />
    </svg>
    <span>주식사전</span>
  </button>;
}
