'use client';

import { BookOpenText } from 'lucide-react';
import { openStockDictionary } from '@/lib/dictionaryNavigation';
import styles from './DictionaryShortcut.module.css';

export default function DictionaryShortcut() {
  return <button type="button" className={styles.shortcut} aria-label="내 주식사전" aria-haspopup="dialog" onClick={() => openStockDictionary()}>
    <BookOpenText size={23} strokeWidth={1.7} aria-hidden="true" />
    <span>주식사전</span>
  </button>;
}
