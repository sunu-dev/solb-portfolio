'use client';

import DictionaryShortcut from '@/components/learning/DictionaryShortcut';
import JoobiAssistantLauncher from '@/components/learning/JoobiAssistantLauncher';
import styles from './PortfolioTools.module.css';

/** Small, named shortcuts beside the portfolio heading; dialogs keep the page in place. */
export default function PortfolioTools() {
  return <div className={styles.tools} data-learning-desk aria-label="내 투자 도구">
    <JoobiAssistantLauncher iconOnly />
    <DictionaryShortcut />
  </div>;
}
