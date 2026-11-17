'use client';

import Image from 'next/image';
import { openStockDictionary } from '@/lib/dictionaryNavigation';
import styles from './DictionaryShortcut.module.css';

export default function DictionaryShortcut() {
  return <button type="button" className={styles.shortcut} aria-label="내 주식사전" aria-haspopup="dialog" onClick={() => openStockDictionary()}>
    <Image className={styles.icon} src="/illustrations/joobi/dictionary-brown-v1.png" alt="" width={34} height={31} sizes="34px" aria-hidden="true" />
    <span>주식사전</span>
  </button>;
}
