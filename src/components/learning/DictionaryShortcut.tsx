'use client';

import { openStockDictionary } from '@/lib/dictionaryNavigation';
import styles from './DictionaryShortcut.module.css';

export default function DictionaryShortcut() {
  return <button type="button" className={styles.shortcut} aria-label="내 주식사전" aria-haspopup="dialog" onClick={() => openStockDictionary()}>
    <svg className={styles.book} width="34" height="30" viewBox="0 0 40 34" aria-hidden="true">
      <path className={styles.cover} d="M2 7Q11 5 20 10Q29 5 38 7V29Q28 26 20 31Q12 26 2 29Z" />
      <path className={styles.edge} d="M3 6Q12 4 20 9Q28 4 37 6V27Q28 25 20 29Q12 25 3 27Z" />
      <path className={styles.paper} d="M4 4Q12 2 20 7Q28 2 36 4V25Q28 23 20 27Q12 23 4 25Z" />
      <path className={styles.seam} d="M20 7V27" />
      <path className={styles.lines} d="M8 10Q12 10 16 12M8 14Q12 14 16 16M8 18Q11 18 14 19M24 12Q28 10 32 10M24 16Q28 14 32 14" />
      <path className={styles.ribbon} d="M28 4L31 3.7V13L29.5 11.8L28 13Z" />
    </svg>
    <span>주식사전</span>
  </button>;
}
