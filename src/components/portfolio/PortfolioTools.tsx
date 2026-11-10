'use client';

import { BookOpen } from 'lucide-react';
import JoobiAssistantLauncher from '@/components/learning/JoobiAssistantLauncher';
import { openStockDictionary } from '@/lib/dictionaryNavigation';
import styles from './PortfolioTools.module.css';

/** Small, named shortcuts beside the portfolio heading; dialogs keep the page in place. */
export default function PortfolioTools() {
  return <div className={styles.tools} data-learning-desk aria-label="내 투자 도구">
    <JoobiAssistantLauncher iconOnly />
    <button type="button" className={styles.dictionary} aria-label="내 주식사전" aria-haspopup="dialog" onClick={() => openStockDictionary()}>
      <BookOpen size={21} aria-hidden="true" /><span aria-hidden="true">내 주식사전</span>
    </button>
  </div>;
}
