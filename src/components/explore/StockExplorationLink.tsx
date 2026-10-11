'use client';

import { usageEvent } from '@/lib/usageTelemetry';
import type { ReactNode } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { workspaceUrl } from '@/lib/workspaceNavigation';
import styles from './ContextExploration.module.css';

/** Open internal stock details in the current workspace; keep native modified clicks. */
export default function StockExplorationLink({ symbol, children, onNavigate }: {
  symbol: string; children: ReactNode; onNavigate?: (symbol: string) => void;
}) {
  const section = usePortfolioStore(state => state.currentSection);
  return <a className={styles.stock} href={workspaceUrl('https://joobi.kr/', section, symbol)} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    usageEvent('related_company');
    if (onNavigate) onNavigate(symbol);
    else usePortfolioStore.getState().setAnalysisSymbol(symbol);
  }}>{children} →</a>;
}
